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
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

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
    "gemini-3.1-flash-lite": {"label": "Gemini 3.1 Flash Lite (rẻ nhất)", "model": "gemini/gemini-3.1-flash-lite", "env": "GEMINI_API_KEY"},
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
        extra["client_params"] = {"http_options": {"api_version": "v1beta"}}
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
DATA_RULES = (
    "QUY TẮC DỮ LIỆU: Bạn KHÔNG có dữ liệu thị trường thời gian thực. Chỉ dùng kiến thức bạn chắc chắn, "
    "luôn ghi rõ mốc thời gian của số liệu (vd. 'theo BCTC 2024'), đánh dấu rõ số nào là ƯỚC TÍNH, "
    "và tuyệt đối không bịa giá cổ phiếu hay số liệu tài chính. Nếu không chắc, hãy nói là không chắc."
)


def build_crew(prompt: str, leader_key: str, team_key: str, client: str):
    leader_llm, team_llm = build_llm(leader_key), build_llm(team_key)
    brief = f"Khách hàng: Quý khách {client}\nYêu cầu của khách hàng:\n{prompt}\n\n{DATA_RULES}"

    analyst = Agent(
        role="Chuyên viên phân tích",
        goal="Nghiên cứu cơ bản doanh nghiệp, ngành và bối cảnh vĩ mô liên quan tới yêu cầu của khách hàng",
        backstory="Chuyên viên phân tích cổ phiếu nhiều năm kinh nghiệm, đọc kỹ báo cáo tài chính và luôn ghi nguồn, mốc thời gian.",
        llm=team_llm,
    )
    quant = Agent(
        role="Chuyên viên định lượng",
        goal="Lượng hoá định giá, kịch bản và đề xuất tỷ trọng phân bổ phù hợp khẩu vị rủi ro của khách hàng",
        backstory="Chuyên viên định lượng thận trọng, mọi con số đều kèm giả định rõ ràng và không bao giờ bịa dữ liệu.",
        llm=team_llm,
    )
    risk = Agent(
        role="Quản trị rủi ro",
        goal="Phát hiện rủi ro, lỗ hổng lập luận và đặt quy tắc kiểm soát rủi ro cho khuyến nghị",
        backstory="Chuyên viên quản trị rủi ro khó tính, luôn hỏi 'nếu sai thì mất bao nhiêu?' và soi từng giả định.",
        llm=team_llm,
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
            "gần nhất bạn biết, động lực tăng trưởng, yếu tố ngành/vĩ mô/chính sách ảnh hưởng."
        ),
        expected_output="Bản nghiên cứu cơ bản dạng gạch đầu dòng, mỗi số liệu có mốc thời gian.",
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
            f"{brief}\n\nNhiệm vụ: viết BÁO CÁO ĐẦU TƯ gửi Quý khách {client} bằng Markdown, gồm: "
            "1) Tóm tắt khuyến nghị (Mua / Nắm giữ / Bán / Theo dõi) và mức độ tin cậy; 2) Luận điểm đầu tư; "
            "3) Định giá & kịch bản; 4) Kế hoạch phân bổ vốn; 5) Rủi ro & cách kiểm soát; 6) Việc khách hàng nên kiểm chứng thêm. "
            "Kết thúc bằng mục 'Miễn trừ trách nhiệm': báo cáo do AI tạo, không phải tư vấn đầu tư được cấp phép, "
            "dữ liệu có thể lỗi thời, khách hàng tự chịu trách nhiệm với quyết định của mình."
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


WORKING_TEXT = {
    "analyst": ("working", "Đang nghiên cứu doanh nghiệp"),
    "quant": ("working", "Đang định giá & lập kịch bản"),
    "risk": ("working", "Đang thẩm định rủi ro"),
    "manager": ("reviewing", "Đang viết báo cáo đầu tư"),
}


def explain_error(exc: Exception, leader_key: str, team_key: str) -> str:
    """Đổi các lỗi hay gặp của nhà cung cấp LLM thành câu dễ hiểu."""
    text = str(exc)
    models = " / ".join(dict.fromkeys(MODELS[k]["label"] for k in (leader_key, team_key)))
    if "429" in text or "RESOURCE_EXHAUSTED" in text or "quota" in text.lower():
        retry = re.search(r"retry in (\d[\dhms.]*?)\.?\s|'retryDelay': '(\d+)s'", text + " ")
        wait = ""
        if retry:
            wait = f" Thử lại sau khoảng {retry.group(1) or f'{int(retry.group(2)) // 60 + 1} phút'}."
        if "PerDay" in text:
            return (f"Hết hạn mức MIỄN PHÍ trong ngày của {models}.{wait} "
                    "Mỗi model có hạn mức riêng – hãy chọn model khác (vd. Gemini 3.5 Flash / 3.1 Flash Lite) "
                    "hoặc bật Billing cho API key trong AI Studio.")
        return (f"Gọi {models} quá nhanh so với hạn mức theo phút.{wait} "
                "Đợi một chút rồi gửi lại, hoặc giảm CREW_MAX_RPM trong .env.")
    if "404" in text and "NOT_FOUND" in text:
        return f"Model {models} không tồn tại hoặc API key không có quyền dùng. Hãy chọn model khác."
    if "401" in text or "403" in text or "API key not valid" in text:
        return "API key không hợp lệ hoặc không có quyền. Kiểm tra lại key trong .env rồi khởi động lại backend."
    return short(f"{type(exc).__name__}: {exc}", 300)


def run_job(prompt: str, leader_key: str, team_key: str, client: str) -> None:
    try:
        _run_job(prompt, leader_key, team_key, client)
    except Exception as exc:  # noqa: BLE001 – vd. lỗi khi khởi tạo LLM/agent
        for sid in STAFF_IDS:
            office.status(sid, "idle", "Dừng do lỗi")
        office.emit({"type": "job", "state": "failed", "error": explain_error(exc, leader_key, team_key)})
    finally:
        office.busy = False
        job_lock.release()


def _run_job(prompt: str, leader_key: str, team_key: str, client: str) -> None:
    crew, agent_ids, task_ids, order = build_crew(prompt, leader_key, team_key, client)

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
            office.status("manager", "idle", "Đã giao việc, theo dõi tiến độ")
        if sid:
            status, text = WORKING_TEXT[sid]
            office.status(sid, status, text)

    def on_task_completed(source, event):
        sid = staff_of_task(event)
        if not sid:
            return
        office.status(sid, "done", "Xong phần việc")
        idx = order.index(sid)
        if idx + 1 < len(order):
            office.emit({
                "type": "handoff", "from": sid, "to": order[idx + 1],
                "message": short(getattr(event.output, "raw", ""), 120),
            })

    def on_task_failed(source, event):
        sid = staff_of_task(event)
        if sid:
            office.status(sid, "error", short(f"Lỗi: {event.error}"))

    def on_llm_started(source, event):
        sid = staff_of_llm(event)
        if sid:
            office.emit({"type": "activity", "agent": sid, "kind": "thinking"})

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
    ]
    for event_type, handler in handlers:
        crewai_event_bus.on(event_type)(handler)

    try:
        output = crew.kickoff()
        crewai_event_bus.flush(timeout=5)
    finally:
        for event_type, handler in handlers:
            crewai_event_bus.off(event_type, handler)

    office.result = str(output)
    for sid in STAFF_IDS:
        office.status(sid, "idle", "Sẵn sàng cho việc tiếp theo")
    office.emit({"type": "job", "state": "finished", "result": office.result})


# ---------------------------------------------------------------------------
# HTTP / WebSocket
# ---------------------------------------------------------------------------
class JobInput(BaseModel):
    prompt: str = Field(min_length=1, max_length=8000)
    client_name: str = Field(min_length=1, max_length=60)
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
    for key in (job.manager_choice, job.worker_choice):
        if key not in MODELS:
            return JSONResponse({"detail": f"Model không hợp lệ: {key}"}, status_code=400)
        if not model_available(key):
            return JSONResponse(
                {"detail": f"Chưa có {MODELS[key]['env']} trong .env cho {MODELS[key]['label']}."},
                status_code=400,
            )
    if not job_lock.acquire(blocking=False):
        return JSONResponse({"detail": "Văn phòng đang bận một nhiệm vụ khác."}, status_code=409)

    office.busy = True
    office.result = None
    office.emit({"type": "job", "state": "started", "prompt": short(job.prompt, 120)})
    office.status("manager", "thinking", "Đang phân công công việc")

    # Thread riêng (daemon) – không phụ thuộc vào việc giữ tham chiếu asyncio.Task.
    threading.Thread(
        target=run_job,
        args=(job.prompt, job.manager_choice, job.worker_choice, job.client_name.strip()),
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
