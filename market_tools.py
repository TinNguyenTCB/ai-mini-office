"""Công cụ tra dữ liệu thị trường cho đội AI (nguồn: Yahoo Finance qua thư viện yfinance – miễn phí, không cần key).

Phạm vi: cổ phiếu sàn HOSE (mã có đuôi .VN, vd. VNM.VN), Mỹ (AAPL), Nhật (mã 4 số + .T, vd. 7203.T).
Không có: sàn HNX / UPCoM, tin tức cổ phiếu Việt Nam.

Kết quả trả về là văn bản gọn (đã kèm nguồn + thời điểm lấy) để mô hình AI đọc; lỗi mạng / mã sai được
trả về thành câu thông báo chứ không ném lỗi, để một lần tra hỏng không làm hỏng cả báo cáo.
"""

from __future__ import annotations

import logging
import math
import re
import threading
import time
from datetime import datetime, timezone
from typing import Any

from crewai.tools import BaseTool
from pydantic import BaseModel, Field

try:
    import yfinance as yf

    logging.getLogger("yfinance").setLevel(logging.CRITICAL)
except ImportError:  # pragma: no cover – backend vẫn chạy được khi chưa cài
    yf = None

SOURCE = "Yahoo Finance"
CACHE_TTL = 600  # giây
_cache: dict[tuple[str, str], tuple[float, str]] = {}
_cache_lock = threading.Lock()


def _now() -> str:
    return datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d %H:%M (UTC%z)")


def _cached(kind: str, symbol: str, build) -> str:
    key = (kind, symbol)
    with _cache_lock:
        hit = _cache.get(key)
        if hit and time.time() - hit[0] < CACHE_TTL:
            return hit[1]
    text = build()
    with _cache_lock:
        _cache[key] = (time.time(), text)
    return text


def normalize_symbol(raw: str) -> list[str]:
    """Các cách viết mã sẽ thử theo thứ tự. 'VNM' -> ['VNM.VN', 'VNM']; '7203' -> ['7203.T']."""
    s = raw.strip().upper().replace(" ", "")
    s = re.sub(r"^(HOSE|HSX|VN)[:.]", "", s)
    if s.endswith((".VN", ".T", ".HN")) or "." in s:
        return [s]
    if re.fullmatch(r"\d{4}", s):
        return [f"{s}.T"]
    if re.fullmatch(r"[A-Z]{3}", s):  # mã 3 chữ cái thường là cổ phiếu Việt Nam; thử thêm bản không đuôi (Mỹ)
        return [f"{s}.VN", s]
    return [s]


def _num(v: Any) -> float | None:
    try:
        f = float(v)
        return None if math.isnan(f) or math.isinf(f) else f
    except (TypeError, ValueError):
        return None


def _big(v: Any, cur: str = "") -> str:
    f = _num(v)
    if f is None:
        return "n/a"
    for div, unit in ((1e12, "T"), (1e9, "B"), (1e6, "M")):
        if abs(f) >= div:
            return f"{f / div:,.2f}{unit} {cur}".strip()
    return f"{f:,.2f} {cur}".strip()


def _pct(v: Any, already_percent: bool = False) -> str:
    f = _num(v)
    if f is None:
        return "n/a"
    return f"{f if already_percent else f * 100:.2f}%"


def _plain(v: Any, digits: int = 2) -> str:
    f = _num(v)
    return "n/a" if f is None else f"{f:,.{digits}f}"


def _resolve(raw: str):
    """Trả về (mã, Ticker, lịch sử 1 năm) của cách viết đầu tiên có dữ liệu, hoặc (None, None, None)."""
    for sym in normalize_symbol(raw):
        t = yf.Ticker(sym)
        try:
            hist = t.history(period="1y", auto_adjust=True)
        except Exception:  # noqa: BLE001
            continue
        if hist is not None and not hist.empty:
            return sym, t, hist
    return None, None, None


def _not_found(raw: str) -> str:
    return (f"Không tìm thấy dữ liệu cho mã '{raw}' trên {SOURCE}. Gợi ý: cổ phiếu sàn HOSE dùng đuôi .VN (vd. VNM.VN), "
            f"Nhật dùng 4 số + .T (vd. 7203.T), Mỹ dùng mã gốc (vd. AAPL). Sàn HNX/UPCoM không có trong nguồn này.")


def stock_snapshot(raw: str) -> str:
    if yf is None:
        return "Công cụ dữ liệu chưa sẵn sàng (thiếu thư viện yfinance trên máy chủ)."

    def build() -> str:
        sym, t, hist = _resolve(raw)
        if not sym:
            return _not_found(raw)
        try:
            info = t.info or {}
        except Exception:  # noqa: BLE001
            info = {}
        close = hist["Close"].dropna()
        last = float(close.iloc[-1])
        cur = info.get("currency") or ""

        def change(days: int) -> str:
            if len(close) <= days:
                return "n/a"
            return f"{(last / float(close.iloc[-1 - days]) - 1) * 100:+.2f}%"

        rets = close.pct_change().dropna()
        vol = float(rets.std() * math.sqrt(252) * 100) if len(rets) > 20 else None
        drawdown = float(((close / close.cummax()) - 1).min() * 100) if len(close) > 1 else None
        lines = [
            f"# {sym} – {info.get('longName') or info.get('shortName') or sym}",
            f"Nguồn: {SOURCE}, lấy lúc {_now()}; giá đóng cửa gần nhất ngày {close.index[-1].date()}.",
            f"Ngành: {info.get('sector', 'n/a')} / {info.get('industry', 'n/a')} · Tiền tệ: {cur or 'n/a'}",
            f"Giá: {_plain(last)} {cur} (phiên trước {_plain(info.get('previousClose'))}) · 52 tuần: "
            f"{_plain(info.get('fiftyTwoWeekLow'))} – {_plain(info.get('fiftyTwoWeekHigh'))}",
            f"Thay đổi giá: 1 tháng {change(21)} · 3 tháng {change(63)} · 1 năm {change(len(close) - 1)}",
            f"Độ biến động năm (từ giá ngày, 1 năm): {_plain(vol)}% · Mức sụt giảm lớn nhất 1 năm: {_plain(drawdown)}% · Beta: {_plain(info.get('beta'))}",
            f"Vốn hoá: {_big(info.get('marketCap'), cur)} · Số cổ phiếu: {_big(info.get('sharesOutstanding'))}",
            f"P/E (trailing): {_plain(info.get('trailingPE'))} · P/E (forward): {_plain(info.get('forwardPE'))} · "
            f"P/B: {_plain(info.get('priceToBook'))} · EPS (trailing): {_plain(info.get('trailingEps'))} {cur}",
            f"ROE: {_pct(info.get('returnOnEquity'))} · Biên lợi nhuận ròng: {_pct(info.get('profitMargins'))} · "
            f"Tăng trưởng doanh thu (YoY): {_pct(info.get('revenueGrowth'))}",
            f"Nợ/Vốn chủ (D/E, %): {_plain(info.get('debtToEquity'))} · Tỷ suất cổ tức: {_pct(info.get('dividendYield'), already_percent=True)}",
            f"Doanh thu (TTM): {_big(info.get('totalRevenue'), cur)} · Lợi nhuận ròng (TTM): {_big(info.get('netIncomeToCommon'), cur)}",
            "Ghi chú: 'n/a' = nguồn không có số liệu; số liệu do bên thứ ba cung cấp, có thể trễ hoặc sai lệch – cần đối chiếu.",
        ]
        return "\n".join(lines)

    try:
        return _cached("snapshot", raw.strip().upper(), build)
    except Exception as exc:  # noqa: BLE001
        return f"Lỗi khi tra dữ liệu '{raw}' từ {SOURCE}: {type(exc).__name__}: {str(exc)[:200]}"


INCOME_ROWS = [("Total Revenue", "Doanh thu"), ("Gross Profit", "Lợi nhuận gộp"), ("Operating Income", "Lợi nhuận hoạt động"),
               ("Net Income", "Lợi nhuận ròng"), ("Diluted EPS", "EPS pha loãng")]
BALANCE_ROWS = [("Total Assets", "Tổng tài sản"), ("Total Debt", "Tổng nợ vay"),
                ("Stockholders Equity", "Vốn chủ sở hữu"), ("Cash And Cash Equivalents", "Tiền & tương đương")]


def _table(df, rows, cur: str, years: int = 4) -> list[str]:
    if df is None or getattr(df, "empty", True):
        return ["(không có dữ liệu)"]
    cols = list(df.columns[:years])
    out = ["| Chỉ tiêu | " + " | ".join(str(c)[:10] for c in cols) + " |", "|---|" + "---|" * len(cols)]
    for key, label in rows:
        if key not in df.index:
            continue
        vals = [(_plain(df.at[key, c]) if "EPS" in key else _big(df.at[key, c])) for c in cols]
        out.append(f"| {label} | " + " | ".join(vals) + " |")
    out.append(f"(Đơn vị tiền tệ: {cur or 'n/a'}; T = nghìn tỷ, B = tỷ, M = triệu)")
    return out


def financial_statements(raw: str) -> str:
    if yf is None:
        return "Công cụ dữ liệu chưa sẵn sàng (thiếu thư viện yfinance trên máy chủ)."

    def build() -> str:
        sym, t, _ = _resolve(raw)
        if not sym:
            return _not_found(raw)
        try:
            cur = (t.fast_info or {}).get("currency") or ""
        except Exception:  # noqa: BLE001
            cur = ""
        lines = [f"# Báo cáo tài chính năm – {sym}", f"Nguồn: {SOURCE}, lấy lúc {_now()}.", "", "## Kết quả kinh doanh"]
        lines += _table(t.income_stmt, INCOME_ROWS, cur)
        lines += ["", "## Bảng cân đối kế toán"]
        lines += _table(t.balance_sheet, BALANCE_ROWS, cur)
        return "\n".join(lines)

    try:
        return _cached("statements", raw.strip().upper(), build)
    except Exception as exc:  # noqa: BLE001
        return f"Lỗi khi tra báo cáo tài chính '{raw}' từ {SOURCE}: {type(exc).__name__}: {str(exc)[:200]}"


# ---------------------------------------------------------------------------
# Công cụ CrewAI
# ---------------------------------------------------------------------------
class SymbolInput(BaseModel):
    symbol: str = Field(..., description="Mã cổ phiếu. HOSE: thêm đuôi .VN (VNM.VN, FPT.VN); Nhật: 4 số + .T (7203.T); Mỹ: mã gốc (AAPL).")


class StockSnapshotTool(BaseTool):
    name: str = "stock_snapshot"
    description: str = (
        "Tra dữ liệu thị trường MỚI NHẤT của một cổ phiếu: giá, vùng giá 52 tuần, thay đổi giá 1 tháng/3 tháng/1 năm, "
        "độ biến động, mức sụt giảm lớn nhất, vốn hoá, P/E, P/B, EPS, ROE, D/E, cổ tức. "
        "Dùng cho cổ phiếu HOSE (đuôi .VN), Mỹ, Nhật (.T). Mỗi lần tra một mã."
    )
    args_schema: type[BaseModel] = SymbolInput

    def _run(self, symbol: str) -> str:
        return stock_snapshot(symbol)


class FinancialStatementsTool(BaseTool):
    name: str = "financial_statements"
    description: str = (
        "Tra báo cáo tài chính NĂM gần nhất (tối đa 4 năm) của một cổ phiếu: doanh thu, lợi nhuận gộp, lợi nhuận "
        "hoạt động, lợi nhuận ròng, EPS, tổng tài sản, nợ vay, vốn chủ, tiền mặt. Mỗi lần tra một mã."
    )
    args_schema: type[BaseModel] = SymbolInput

    def _run(self, symbol: str) -> str:
        return financial_statements(symbol)


def data_tools_available() -> bool:
    return yf is not None
