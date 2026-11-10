"""Mini Capital – văn phòng AI nghiên cứu & quản lý cổ phiếu (backend).

Bốn agent CrewAI làm việc tuần tự cho từng khách hàng:
    Chuyên viên phân tích -> Chuyên viên định lượng -> Quản trị rủi ro -> Giám đốc đầu tư (ký báo cáo)

Mọi trạng thái gửi xuống trình duyệt đều đến từ sự kiện thật của CrewAI
(TaskStarted / TaskCompleted / LLMCall...), không phải kịch bản dựng sẵn.
"""

import asyncio
import json
import os
import re
import threading
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Literal

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from crewai import LLM, Agent, Crew, Process, Task
from crewai.events import (
    LLMCallCompletedEvent,
    LLMCallStartedEvent,
    TaskCompletedEvent,
    TaskFailedEvent,
    TaskStartedEvent,
    crewai_event_bus,
)
from crewai.events.types.tool_usage_events import ToolUsageErrorEvent, ToolUsageStartedEvent

from market_tools import FinancialStatementsTool, StockSnapshotTool, data_tools_available

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

@asynccontextmanager
async def lifespan(_: FastAPI):
    office.loop = asyncio.get_running_loop()
    yield


app = FastAPI(title="AI Mini Office", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
# Chỉ cho phép trang chạy trên máy này (vd. VS Code Live Server) gọi API – không mở "*".
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

# ---------------------------------------------------------------------------
# Danh mục model – UI lấy danh sách này qua /api/models nên nhãn luôn khớp.
# ---------------------------------------------------------------------------
MODELS: dict[str, dict[str, str]] = {
    # Gói API miễn phí tính hạn mức RIÊNG cho từng model: hết lượt model này thì đổi sang model khác.
    "gemini-3.8-flash": {"label": "Gemini 3.8 Flash", "model": "gemini/gemini-3.8-flash", "env": "GEMINI_API_KEY"},
    "gemini-3.5-flash": {"label": "Gemini 3.5 Flash", "model": "gemini/gemini-3.5-flash", "env": "GEMINI_API_KEY"},
    "gemini-3.1-flash-lite": {"label": "Gemini 3.1 Flash Lite", "model": "gemini/gemini-3.1-flash-lite", "env": "GEMINI_API_KEY"},
    "gemini-3.1-pro": {"label": "Gemini 3.1 Pro (preview)", "model": "gemini/gemini-3.1-pro-preview", "env": "GEMINI_API_KEY"},
    "gpt-5.5": {"label": "GPT-5.5", "model": "openai/gpt-5.5", "env": "OPENAI_API_KEY"},
    "gpt-5.4-mini": {"label": "GPT-5.4 Mini", "model": "openai/gpt-5.4-mini", "env": "OPENAI_API_KEY"},
    "claude-opus-5-5": {"label": "Claude Opus 5.5", "model": "anthropic/claude-opus-5-5", "env": "ANTHROPIC_API_KEY"},
    "claude-sonnet-5-5": {"label": "Claude Sonnet 5.5", "model": "anthropic/claude-sonnet-5-5", "env": "ANTHROPIC_API_KEY"},
    "claude-haiku-5-5": {"label": "Claude Haiku 5.5", "model": "anthropic/claude-haiku-5-5", "env": "ANTHROPIC_API_KEY"},
}
# Mặc định = model đầu tiên trong danh sách ưu tiên mà .env có API key.
# Claude đứng đầu: Sonnet làm Giám đốc đầu tư (viết báo cáo cuối cần chất lượng), Haiku cho đội thực thi (nhanh, rẻ).
LEADER_PREFERENCE = ["claude-sonnet-5-5", "gemini-3.5-flash", "gemini-3.8-flash", "gpt-5.4-mini"]
TEAM_PREFERENCE = ["claude-haiku-5-5", "gemini-3.1-flash-lite", "gemini-3.5-flash", "gpt-5.4-mini"]


def model_available(key: str) -> bool:
    return bool(os.getenv(MODELS[key]["env"], "").strip())


def default_model(preference: list[str]) -> str:
    return next((k for k in preference if model_available(k)), preference[0])


def build_llm(key: str) -> LLM:
    spec = MODELS[key]
    extra: dict[str, Any] = {}
    if spec["model"].startswith("gemini/"):
        # google-genai 3.x mặc định gọi API "v1", nơi KHÔNG có các model preview (vd. gemini-3.1-pro-preview)
        # -> 404 NOT_FOUND. "v1beta" có cả model ổn định lẫn preview.
        # Máy chủ Gemini hay quá tải tạm thời (503) -> tự thử lại vài lần thay vì hỏng cả nhiệm vụ.
        # Không thử lại 429 (hết hạn mức): thử lại cũng vô ích, để explain_error báo cho người dùng.
        extra["client_params"] = {"http_options": {
            "api_version": "v1beta",
            "retry_options": {"attempts": 6, "initial_delay": 2.0, "max_delay": 45.0,
                              "http_status_codes": [500, 502, 503, 504]},
        }}
    return LLM(model=spec["model"], api_key=os.getenv(spec["env"]), **extra)


# ---------------------------------------------------------------------------
# Trạng thái văn phòng + phát sóng WebSocket
# ---------------------------------------------------------------------------
STAFF_IDS = ("manager", "analyst", "quant", "risk")


class Office:
    def __init__(self) -> None:
        self.connections: set[WebSocket] = set()
        self.agents: dict[str, dict[str, str]] = {
            sid: {"status": "idle", "message": "Đang chờ việc."} for sid in STAFF_IDS
        }
        self.busy = False
        self.result: str | None = None
        self.loop: asyncio.AbstractEventLoop | None = None

    def snapshot(self) -> dict[str, Any]:
        return {"type": "snapshot", "busy": self.busy, "agents": self.agents, "result": self.result}

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.connections.add(ws)
        await ws.send_text(json.dumps(self.snapshot()))

    def disconnect(self, ws: WebSocket) -> None:
        self.connections.discard(ws)

    async def broadcast(self, payload: dict[str, Any]) -> None:
        text = json.dumps(payload)
        dead = []
        for ws in list(self.connections):
            try:
                await ws.send_text(text)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.connections.discard(ws)

    # Gọi được từ luồng worker của CrewAI.
    def emit(self, payload: dict[str, Any]) -> None:
        if payload.get("type") == "status":
            self.agents[payload["agent"]] = {"status": payload["status"], "message": payload["message"]}
        if self.loop:
            asyncio.run_coroutine_threadsafe(self.broadcast(payload), self.loop)

    def status(self, agent: str, status: str, message: str) -> None:
        self.emit({"type": "status", "agent": agent, "status": status, "message": message})


office = Office()
job_lock = threading.Lock()


def short(text: Any, limit: int = 90) -> str:
    text = " ".join(str(text or "").split())
    return text if len(text) <= limit else text[: limit - 1] + "…"


# ---------------------------------------------------------------------------
# Đội ngũ & công việc
# ---------------------------------------------------------------------------
DATA_RULES_OFFLINE = (
    "QUY TẮC DỮ LIỆU: Bạn KHÔNG có dữ liệu thị trường thời gian thực. Chỉ dùng kiến thức bạn chắc chắn, "
    "luôn ghi rõ mốc thời gian của số liệu (vd. 'theo BCTC 2024'), đánh dấu rõ số nào là ƯỚC TÍNH, "
    "và tuyệt đối không bịa giá cổ phiếu hay số liệu tài chính. Nếu không chắc, hãy nói là không chắc."
)
DATA_RULES_LIVE = (
    "QUY TẮC DỮ LIỆU: Đội có công cụ tra dữ liệu thị trường (Yahoo Finance): 'stock_snapshot' (giá, chỉ số định giá, "
    "biến động) và 'financial_statements' (báo cáo tài chính năm). Cổ phiếu sàn HOSE dùng mã có đuôi .VN (vd. VNM.VN), "
    "Nhật dùng 4 số + .T (vd. 7203.T), Mỹ dùng mã gốc (vd. AAPL); sàn HNX/UPCoM KHÔNG có trong nguồn này. "
    "Với mã cổ phiếu liên quan tới yêu cầu, HÃY dùng công cụ để lấy giá và chỉ số MỚI NHẤT thay vì dựa vào trí nhớ; "
    "mỗi số liệu lấy từ công cụ phải ghi nguồn và thời điểm (vd. 'Yahoo Finance, ngày 2026-11-10'). "
    "Thông tin công cụ không có (tin tức, sự kiện, kế hoạch kinh doanh...) chỉ dùng kiến thức bạn chắc chắn, ghi rõ mốc "
    "thời gian và nói rõ có thể đã lỗi thời. Đánh dấu rõ số nào là ƯỚC TÍNH; tuyệt đối không bịa số liệu. "
    "Nếu công cụ báo lỗi hoặc không có dữ liệu, hãy nói thẳng như vậy."
)
DATA_RULES = DATA_RULES_LIVE if data_tools_available() else DATA_RULES_OFFLINE
# Giới hạn số lần tra mỗi người (mỗi lần tra là thêm lượt gọi AI -> tốn hạn mức API).
TOOL_LIMIT = int(os.getenv("DATA_TOOL_LIMIT", "6"))


def data_tools(*kinds: str) -> list:
    if not data_tools_available():
        return []
    make = {"snapshot": StockSnapshotTool, "statements": FinancialStatementsTool}
    return [make[k](max_usage_count=TOOL_LIMIT) for k in kinds]


# ---------------------------------------------------------------------------
# Đa ngôn ngữ: báo cáo + thông báo trạng thái + lỗi theo ngôn ngữ người dùng chọn (vi / en / ja).
# ---------------------------------------------------------------------------
LANG_NAME = {"vi": "tiếng Việt", "en": "English", "ja": "日本語 (Japanese)"}
CLIENT_ADDRESS = {"vi": "Quý khách {name}", "en": "{name}", "ja": "{name}様"}

MSG = {
    "vi": {
        "assigning": "Đang phân công công việc", "monitoring": "Đã giao việc, theo dõi tiến độ",
        "work": {"analyst": "Đang nghiên cứu doanh nghiệp", "quant": "Đang định giá & lập kịch bản",
                 "risk": "Đang thẩm định rủi ro", "manager": "Đang viết báo cáo đầu tư"},
        "done": "Xong phần việc", "ready": "Sẵn sàng cho việc tiếp theo", "stopped": "Dừng do lỗi",
        "task_error": "Lỗi: {error}",
        "bad_model": "Model không hợp lệ: {key}", "no_key": "Chưa có {env} trong .env cho {label}.",
        "busy": "Văn phòng đang bận một nhiệm vụ khác.",
        "retry_in": " Thử lại sau khoảng {wait}.", "minutes": "{n} phút",
        "quota_day": "Hết hạn mức MIỄN PHÍ trong ngày của {models}.{wait} Mỗi model có hạn mức riêng – hãy chọn model khác (vd. Gemini 3.5 Flash / 3.1 Flash Lite) hoặc bật Billing cho API key trong AI Studio.",
        "quota_min": "Gọi {models} quá nhanh so với hạn mức theo phút.{wait} Đợi một chút rồi gửi lại, hoặc giảm CREW_MAX_RPM trong .env.",
        "not_found": "Model {models} không tồn tại hoặc API key không có quyền dùng. Hãy chọn model khác.",
        "auth": "API key không hợp lệ hoặc không có quyền. Kiểm tra lại key trong .env rồi khởi động lại backend.",
        "resuming": "Máy chủ AI đang quá tải – chờ {s} giây rồi làm tiếp từ bước này ({n}/{max})",
        "no_credit": "Tài khoản API của {models} đã hết tiền/credit (không phải lỗi gọi quá nhanh). Hãy nạp thêm credit trong trang Billing của nhà cung cấp, hoặc chọn model của hãng khác.",
        "overloaded": "Máy chủ {models} đang quá tải (đã tự thử lại nhưng chưa được). Đây là lỗi tạm thời phía nhà cung cấp – hãy gửi lại sau ít phút hoặc chọn model khác.",
        "tool": {"stock_snapshot": "Tra giá & chỉ số {symbol}", "financial_statements": "Tra báo cáo tài chính {symbol}"},
        "tool_error": "Tra cứu {symbol} không thành công",
    },
    "en": {
        "assigning": "Assigning tasks", "monitoring": "Tasks assigned, monitoring progress",
        "work": {"analyst": "Researching the company", "quant": "Valuing & building scenarios",
                 "risk": "Reviewing risks", "manager": "Writing the investment report"},
        "done": "Part done", "ready": "Ready for the next task", "stopped": "Stopped due to an error",
        "task_error": "Error: {error}",
        "bad_model": "Invalid model: {key}", "no_key": "{env} is missing in .env for {label}.",
        "busy": "The office is busy with another task.",
        "retry_in": " Try again in about {wait}.", "minutes": "{n} min",
        "quota_day": "The FREE daily quota for {models} is used up.{wait} Each model has its own quota – pick another model (e.g. Gemini 3.5 Flash / 3.1 Flash Lite) or enable Billing for the API key in AI Studio.",
        "quota_min": "{models} was called faster than the per-minute quota allows.{wait} Wait a moment and resend, or lower CREW_MAX_RPM in .env.",
        "not_found": "Model {models} doesn't exist or the API key can't use it. Please choose another model.",
        "auth": "The API key is invalid or lacks permission. Check the key in .env and restart the backend.",
        "resuming": "The AI servers are overloaded – waiting {s}s, then continuing from this step ({n}/{max})",
        "no_credit": "The API account for {models} has no credits left (this is not a rate limit). Add credits on the provider's Billing page, or pick a model from another provider.",
        "overloaded": "The {models} servers are overloaded (automatic retries didn't help). This is a temporary provider-side issue – resend in a few minutes or pick another model.",
        "tool": {"stock_snapshot": "Looking up price & ratios for {symbol}", "financial_statements": "Looking up financial statements for {symbol}"},
        "tool_error": "Lookup for {symbol} failed",
    },
    "ja": {
        "assigning": "タスクを割り振り中", "monitoring": "割り振り完了、進捗を確認中",
        "work": {"analyst": "企業を調査中", "quant": "バリュエーションとシナリオ作成中",
                 "risk": "リスクを審査中", "manager": "投資レポートを作成中"},
        "done": "担当完了", "ready": "次のタスクの準備OK", "stopped": "エラーで停止",
        "task_error": "エラー：{error}",
        "bad_model": "無効なモデル：{key}", "no_key": "{label} 用の {env} が .env にありません。",
        "busy": "オフィスは別のタスクを処理中です。",
        "retry_in": " 約{wait}後に再試行してください。", "minutes": "{n}分",
        "quota_day": "{models} の無料枠（1日分）を使い切りました。{wait} 無料枠はモデルごとに別なので、他のモデル（例：Gemini 3.5 Flash / 3.1 Flash Lite）を選ぶか、AI Studio でAPIキーの課金を有効にしてください。",
        "quota_min": "{models} の1分あたりの上限を超える速さで呼び出しました。{wait} 少し待ってから再送するか、.env の CREW_MAX_RPM を下げてください。",
        "not_found": "モデル {models} が存在しないか、APIキーで利用できません。別のモデルを選んでください。",
        "auth": "APIキーが無効か権限がありません。.env のキーを確認し、バックエンドを再起動してください。",
        "resuming": "AIサーバーが混雑中 – {s}秒待ってからこの工程を再開します（{n}/{max}）",
        "no_credit": "{models} のAPIアカウントのクレジットが残っていません（速度制限ではありません）。提供元の Billing ページでクレジットを追加するか、別のプロバイダーのモデルを選んでください。",
        "overloaded": "{models} のサーバーが混雑しています（自動で再試行しましたが失敗）。提供元の一時的な問題です。数分後に再送するか、別のモデルを選んでください。",
        "tool": {"stock_snapshot": "{symbol} の株価・指標を照会中", "financial_statements": "{symbol} の財務諸表を照会中"},
        "tool_error": "{symbol} の照会に失敗しました",
    },
}


def build_crew(prompt: str, leader_key: str, team_key: str, client: str, lang: str = "vi"):
    leader_llm, team_llm = build_llm(leader_key), build_llm(team_key)
    addressed = CLIENT_ADDRESS[lang].format(name=client)
    brief = (
        f"Khách hàng: {addressed}\nYêu cầu của khách hàng:\n{prompt}\n\n{DATA_RULES}\n\n"
        f"NGÔN NGỮ ĐẦU RA: viết TOÀN BỘ câu trả lời bằng {LANG_NAME[lang]} (kể cả tiêu đề các mục và phần miễn trừ trách nhiệm); "
        f"xưng hô với khách hàng là \"{addressed}\"."
    )

    analyst = Agent(
        role="Chuyên viên phân tích",
        goal="Nghiên cứu cơ bản doanh nghiệp, ngành và bối cảnh vĩ mô liên quan tới yêu cầu của khách hàng",
        backstory="Chuyên viên phân tích cổ phiếu nhiều năm kinh nghiệm, đọc kỹ báo cáo tài chính và luôn ghi nguồn, mốc thời gian.",
        llm=team_llm,
        tools=data_tools("snapshot", "statements"),
    )
    quant = Agent(
        role="Chuyên viên định lượng",
        goal="Lượng hoá định giá, kịch bản và đề xuất tỷ trọng phân bổ phù hợp khẩu vị rủi ro của khách hàng",
        backstory="Chuyên viên định lượng thận trọng, mọi con số đều kèm giả định rõ ràng và không bao giờ bịa dữ liệu.",
        llm=team_llm,
        tools=data_tools("snapshot", "statements"),
    )
    risk = Agent(
        role="Quản trị rủi ro",
        goal="Phát hiện rủi ro, lỗ hổng lập luận và đặt quy tắc kiểm soát rủi ro cho khuyến nghị",
        backstory="Chuyên viên quản trị rủi ro khó tính, luôn hỏi 'nếu sai thì mất bao nhiêu?' và soi từng giả định.",
        llm=team_llm,
        tools=data_tools("snapshot"),
    )
    manager = Agent(
        role="Giám đốc đầu tư",
        goal="Tổng hợp, thẩm định và ký duyệt Báo cáo đầu tư gửi khách hàng",
        backstory="Giám đốc đầu tư điềm tĩnh, đặt lợi ích và sự an toàn của khách hàng lên trên hết, viết báo cáo rõ ràng, trung thực.",
        llm=leader_llm,
    )

    research = Task(
        description=(
            f"{brief}\n\nNhiệm vụ: nghiên cứu cơ bản – mô hình kinh doanh, vị thế cạnh tranh, tình hình tài chính "
            "gần nhất (tra bằng công cụ nếu có), động lực tăng trưởng, yếu tố ngành/vĩ mô/chính sách ảnh hưởng."
        ),
        expected_output="Bản nghiên cứu cơ bản dạng gạch đầu dòng, mỗi số liệu có nguồn và mốc thời gian.",
        agent=analyst,
    )
    valuation = Task(
        description=(
            f"{brief}\n\nNhiệm vụ: dựa trên nghiên cứu, lượng hoá – các chỉ số định giá chính (P/E, P/B, ROE, "
            "EV/EBITDA... nếu phù hợp) so với ngành, 3 kịch bản (xấu / cơ sở / tốt) với giả định rõ ràng, "
            "và đề xuất tỷ trọng + cách giải ngân phù hợp yêu cầu của khách hàng."
        ),
        expected_output="Bảng chỉ số, 3 kịch bản định giá có giả định, đề xuất phân bổ vốn.",
        agent=quant,
        context=[research],
    )
    risk_review = Task(
        description=(
            f"{brief}\n\nNhiệm vụ: thẩm định rủi ro – rủi ro doanh nghiệp, ngành, vĩ mô, thanh khoản; kiểm tra "
            "giả định của Chuyên viên định lượng; stress test; đề xuất quy tắc cắt lỗ/chốt lời và giới hạn tỷ trọng; "
            "chỉ ra mọi chỗ thiếu căn cứ hoặc có thể đã lỗi thời."
        ),
        expected_output="Danh sách rủi ro xếp theo mức độ, kết quả stress test, quy tắc kiểm soát rủi ro.",
        agent=risk,
        context=[research, valuation],
    )
    report = Task(
        description=(
            f"{brief}\n\nNhiệm vụ: viết BÁO CÁO ĐẦU TƯ gửi {addressed} bằng Markdown, gồm: "
            "1) Tóm tắt khuyến nghị (Mua / Nắm giữ / Bán / Theo dõi) và mức độ tin cậy; 2) Luận điểm đầu tư; "
            "3) Định giá & kịch bản; 4) Kế hoạch phân bổ vốn; 5) Rủi ro & cách kiểm soát; 6) Việc khách hàng nên kiểm chứng thêm. "
            "Kết thúc bằng mục 'Miễn trừ trách nhiệm': báo cáo do AI tạo, không phải tư vấn đầu tư được cấp phép, "
            "dữ liệu có thể lỗi thời, khách hàng tự chịu trách nhiệm với quyết định của mình. "
            "Ngay trước mục đó, thêm mục 'Nguồn dữ liệu' liệt kê nguồn và thời điểm của các số liệu chính "
            "(phần nào tra từ công cụ, phần nào chỉ dựa trên kiến thức của AI)."
        ),
        expected_output="Báo cáo đầu tư hoàn chỉnh bằng Markdown, có mục miễn trừ trách nhiệm.",
        agent=manager,
        context=[research, valuation, risk_review],
    )

    crew = Crew(
        agents=[analyst, quant, risk, manager],
        tasks=[research, valuation, risk_review, report],
        process=Process.sequential,
        # Gói miễn phí giới hạn số request/phút; CrewAI tự chờ khi chạm ngưỡng này thay vì nhận lỗi 429.
        max_rpm=int(os.getenv("CREW_MAX_RPM", "8")),
    )
    agent_ids = {id(analyst): "analyst", id(quant): "quant", id(risk): "risk", id(manager): "manager"}
    task_ids = {id(research): "analyst", id(valuation): "quant", id(risk_review): "risk", id(report): "manager"}
    order = ["analyst", "quant", "risk", "manager"]
    return crew, agent_ids, task_ids, order


WORKING_STATUS = {"analyst": "working", "quant": "working", "risk": "working", "manager": "reviewing"}


def explain_error(exc: Exception, leader_key: str, team_key: str, lang: str = "vi") -> str:
    """Đổi các lỗi hay gặp của nhà cung cấp LLM thành câu dễ hiểu (theo ngôn ngữ người dùng)."""
    M = MSG[lang]
    text = str(exc)
    models = " / ".join(dict.fromkeys(MODELS[k]["label"] for k in (leader_key, team_key)))
    low = text.lower()
    if "no credits" in low or "insufficient_quota" in low or "credit balance" in low or "billing" in low and "429" in text:
        return M["no_credit"].format(models=models)
    if "429" in text or "RESOURCE_EXHAUSTED" in text or "quota" in low:
        retry = re.search(r"retry in (\d[\dhms.]*?)\.?\s|'retryDelay': '(\d+)s'", text + " ")
        wait = ""
        if retry:
            amount = retry.group(1) or M["minutes"].format(n=int(retry.group(2)) // 60 + 1)
            wait = M["retry_in"].format(wait=amount)
        key = "quota_day" if "PerDay" in text else "quota_min"
        return M[key].format(models=models, wait=wait)
    if "503" in text or "UNAVAILABLE" in text or "overloaded" in text.lower():
        return M["overloaded"].format(models=models)
    if "404" in text and "NOT_FOUND" in text:
        return M["not_found"].format(models=models)
    if "401" in text or "403" in text or "API key not valid" in text:
        return M["auth"]
    return short(f"{type(exc).__name__}: {exc}", 300)


# Lỗi tạm thời phía nhà cung cấp (quá tải / lỗi máy chủ) – khác với hết hạn mức (429) hay sai key.
TRANSIENT_MARKERS = ("503", "UNAVAILABLE", "overloaded", "500 INTERNAL", "502", "504", "timed out", "Timeout")
RESUME_WAIT = int(os.getenv("RESUME_WAIT", "30"))   # giây chờ trước khi chạy tiếp
RESUME_LIMIT = int(os.getenv("RESUME_LIMIT", "2"))  # số lần chạy tiếp tối đa cho một nhiệm vụ


def is_transient(exc: Exception) -> bool:
    text = str(exc)
    return "429" not in text and any(m in text for m in TRANSIENT_MARKERS)


def kickoff_with_resume(crew: Crew, task_ids: dict[int, str], M: dict) -> Any:
    """Chạy cả đội; nếu gặp lỗi tạm thời giữa chừng thì chờ rồi chạy TIẾP từ bước hỏng.

    Kết quả của các bước đã xong vẫn nằm trên đối tượng Task, và các bước sau đọc ngữ cảnh từ đó,
    nên không phải làm lại từ đầu (đỡ tốn thời gian lẫn hạn mức API).
    """
    tasks = list(crew.tasks)
    current, attempt = crew, 0
    while True:
        try:
            return current.kickoff()
        except Exception as exc:  # noqa: BLE001
            remaining = [t for t in tasks if t.output is None]
            if attempt >= RESUME_LIMIT or not remaining or not is_transient(exc):
                raise
            attempt += 1
            sid = task_ids.get(id(remaining[0]))
            if sid:
                office.status(sid, "thinking", M["resuming"].format(s=RESUME_WAIT, n=attempt, max=RESUME_LIMIT))
            time.sleep(RESUME_WAIT)
            agents = list({id(t.agent): t.agent for t in remaining}.values())
            current = Crew(agents=agents, tasks=remaining, process=Process.sequential, max_rpm=crew.max_rpm)


def run_job(prompt: str, leader_key: str, team_key: str, client: str, lang: str = "vi") -> None:
    try:
        _run_job(prompt, leader_key, team_key, client, lang)
    except Exception as exc:  # noqa: BLE001 – vd. lỗi khi khởi tạo LLM/agent
        for sid in STAFF_IDS:
            office.status(sid, "idle", MSG[lang]["stopped"])
        office.emit({"type": "job", "state": "failed", "error": explain_error(exc, leader_key, team_key, lang)})
    finally:
        office.busy = False
        job_lock.release()


def _run_job(prompt: str, leader_key: str, team_key: str, client: str, lang: str = "vi") -> None:
    M = MSG[lang]
    crew, agent_ids, task_ids, order = build_crew(prompt, leader_key, team_key, client, lang)

    # Ánh xạ theo id() đối tượng; nếu CrewAI có sao chép đối tượng thì rơi về tên vai trò.
    roles = {a.role: sid for a in crew.agents for k, sid in agent_ids.items() if id(a) == k}

    def by_role(agent) -> str | None:
        return roles.get(getattr(agent, "role", None))

    def staff_of_task(event) -> str | None:
        task = getattr(event, "task", None)
        return task_ids.get(id(task)) or by_role(getattr(task, "agent", None))

    def staff_of_llm(event) -> str | None:
        agent = getattr(event, "from_agent", None)
        task = getattr(event, "from_task", None)
        return agent_ids.get(id(agent)) or task_ids.get(id(task)) or by_role(agent) or by_role(getattr(task, "agent", None))

    def on_task_started(source, event):
        sid = staff_of_task(event)
        if sid == "analyst":
            office.status("manager", "idle", M["monitoring"])
        if sid:
            office.status(sid, WORKING_STATUS[sid], M["work"][sid])

    def on_task_completed(source, event):
        sid = staff_of_task(event)
        if not sid:
            return
        office.status(sid, "done", M["done"])
        idx = order.index(sid)
        if idx + 1 < len(order):
            office.emit({
                "type": "handoff", "from": sid, "to": order[idx + 1],
                "message": short(getattr(event.output, "raw", ""), 120),
            })

    def on_task_failed(source, event):
        sid = staff_of_task(event)
        if sid:
            office.status(sid, "error", short(M["task_error"].format(error=event.error)))

    def on_llm_started(source, event):
        sid = staff_of_llm(event)
        if sid:
            office.emit({"type": "activity", "agent": sid, "kind": "thinking"})

    def tool_event(event, key: str):
        agent = getattr(event, "agent", None)
        sid = agent_ids.get(id(agent)) or by_role(agent) or roles.get(getattr(event, "agent_role", None))
        args = getattr(event, "tool_args", {}) or {}
        if isinstance(args, str):
            try:
                args = json.loads(args)
            except ValueError:
                args = {"symbol": args}
        symbol = short(str(args.get("symbol", "")), 20) if isinstance(args, dict) else ""
        name = getattr(event, "tool_name", "")
        text = M["tool"].get(name, name).format(symbol=symbol) if key == "start" else M["tool_error"].format(symbol=symbol)
        return sid, text

    def on_tool_started(source, event):
        sid, text = tool_event(event, "start")
        if sid:
            office.emit({"type": "activity", "agent": sid, "kind": "tool", "message": text})

    def on_tool_error(source, event):
        sid, text = tool_event(event, "error")
        if sid:
            office.emit({"type": "activity", "agent": sid, "kind": "tool_error", "message": text})

    def on_llm_completed(source, event):
        sid = staff_of_llm(event)
        if sid:
            office.emit({"type": "activity", "agent": sid, "kind": "typing",
                         "message": short(getattr(event, "response", ""), 60)})

    handlers = [
        (TaskStartedEvent, on_task_started),
        (TaskCompletedEvent, on_task_completed),
        (TaskFailedEvent, on_task_failed),
        (LLMCallStartedEvent, on_llm_started),
        (LLMCallCompletedEvent, on_llm_completed),
        (ToolUsageStartedEvent, on_tool_started),
        (ToolUsageErrorEvent, on_tool_error),
    ]
    for event_type, handler in handlers:
        crewai_event_bus.on(event_type)(handler)

    try:
        output = kickoff_with_resume(crew, task_ids, M)
        crewai_event_bus.flush(timeout=5)
    finally:
        for event_type, handler in handlers:
            crewai_event_bus.off(event_type, handler)

    office.result = str(output)
    for sid in STAFF_IDS:
        office.status(sid, "idle", M["ready"])
    office.emit({"type": "job", "state": "finished", "result": office.result})


# ---------------------------------------------------------------------------
# HTTP / WebSocket
# ---------------------------------------------------------------------------
class JobInput(BaseModel):
    prompt: str = Field(min_length=1, max_length=8000)
    client_name: str = Field(min_length=1, max_length=60)
    language: Literal["vi", "en", "ja"] = "vi"
    manager_choice: str = Field(default_factory=lambda: default_model(LEADER_PREFERENCE))
    worker_choice: str = Field(default_factory=lambda: default_model(TEAM_PREFERENCE))


@app.get("/")
async def index() -> FileResponse:
    return FileResponse(BASE_DIR / "index.html")


@app.get("/api/models")
async def list_models() -> dict[str, Any]:
    return {
        "models": [
            {"id": key, "label": spec["label"], "available": model_available(key)}
            for key, spec in MODELS.items()
        ],
        "defaults": {"leader": default_model(LEADER_PREFERENCE), "team": default_model(TEAM_PREFERENCE)},
    }


@app.post("/api/tasks", status_code=202)
async def assign_task(job: JobInput):
    M = MSG[job.language]
    for key in (job.manager_choice, job.worker_choice):
        if key not in MODELS:
            return JSONResponse({"detail": M["bad_model"].format(key=key)}, status_code=400)
        if not model_available(key):
            return JSONResponse(
                {"detail": M["no_key"].format(env=MODELS[key]["env"], label=MODELS[key]["label"])},
                status_code=400,
            )
    if not job_lock.acquire(blocking=False):
        return JSONResponse({"detail": M["busy"]}, status_code=409)

    office.busy = True
    office.result = None
    office.emit({"type": "job", "state": "started", "prompt": short(job.prompt, 120)})
    office.status("manager", "thinking", M["assigning"])

    # Thread riêng (daemon) – không phụ thuộc vào việc giữ tham chiếu asyncio.Task.
    threading.Thread(
        target=run_job,
        args=(job.prompt, job.manager_choice, job.worker_choice, job.client_name.strip(), job.language),
        name="office-job",
        daemon=True,
    ).start()
    return {"message": "Nhiệm vụ đã được chuyển tới văn phòng!"}


@app.websocket("/ws")
async def websocket_route(ws: WebSocket) -> None:
    await office.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        office.disconnect(ws)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000)
