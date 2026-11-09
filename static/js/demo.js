// Chạy mô phỏng một nhiệm vụ trọn vẹn mà KHÔNG gọi API: phát lại đúng chuỗi sự kiện backend sẽ gửi.
// Mã cổ phiếu "AIX" và mọi con số trong báo cáo mẫu đều là HƯ CẤU.

export function sampleReport(client) {
  return `## BÁO CÁO ĐẦU TƯ MẪU – Cổ phiếu AIX (hư cấu)

> ⚠️ Đây là **báo cáo mô phỏng** để xem trước giao diện. Doanh nghiệp, mã cổ phiếu và mọi con số đều **hư cấu**.

- **Gửi:** Quý khách ${client}
- **Khuyến nghị:** NẮM GIỮ / TÍCH LUỸ DẦN – mức độ tin cậy: *trung bình*

### 1. Luận điểm đầu tư
- Doanh thu tăng đều 3 năm, biên lợi nhuận gộp ổn định quanh 28%.
- Bảng cân đối lành mạnh: tiền mặt ròng, không vay nợ dài hạn.
- Rủi ro chính đến từ giá nguyên liệu đầu vào.

### 2. Định giá & kịch bản
| Kịch bản | Giả định tăng trưởng | Giá trị hợp lý | So với giá hiện tại |
|---|---|---|---|
| Xấu | 3%/năm | 41.000 | ▼ 12% |
| Cơ sở | 10%/năm | 52.000 | ▲ 11% |
| Tốt | 16%/năm | 63.000 | ▲ 34% |

### 3. Kế hoạch phân bổ vốn
1. Tỷ trọng tối đa **15%** danh mục.
2. Giải ngân **3 đợt**, mỗi đợt cách nhau 2–3 tuần.
3. Giữ **20%** tiền mặt dự phòng.

### 4. Rủi ro & kiểm soát
- Stress test: doanh thu giảm 15% → giá trị hợp lý giảm ~22%.
- Cắt lỗ nếu giá đóng cửa dưới **38.000** hai phiên liên tiếp.

### 5. Quý khách nên kiểm chứng thêm
- Báo cáo tài chính gần nhất trên website doanh nghiệp / sở giao dịch.
- Giá thị trường hiện tại tại công ty chứng khoán của Quý khách.

---
**Miễn trừ trách nhiệm:** Báo cáo do AI tạo, không phải tư vấn đầu tư được cấp phép. Dữ liệu có thể lỗi thời hoặc sai lệch. Quý khách tự chịu trách nhiệm với quyết định của mình.`;
}

const SCRIPT = [
  [0, { type: "job", state: "started", prompt: "[MÔ PHỎNG] Phân tích cổ phiếu AIX cho danh mục dài hạn" }],
  [300, { type: "status", agent: "manager", status: "thinking", message: "Đang phân công công việc" }],
  [5500, { type: "status", agent: "manager", status: "idle", message: "Đã giao việc, theo dõi tiến độ" }],
  [0, { type: "status", agent: "analyst", status: "working", message: "Đang nghiên cứu doanh nghiệp" }],
  [1500, { type: "activity", agent: "analyst", kind: "thinking" }],
  [6000, { type: "activity", agent: "analyst", kind: "typing", message: "Doanh thu tăng đều 3 năm, biên gộp ~28%…" }],
  [3500, { type: "status", agent: "analyst", status: "done", message: "Xong phần việc" }],
  [0, { type: "handoff", from: "analyst", to: "quant", message: "Hồ sơ doanh nghiệp AIX + số liệu 3 năm" }],
  [0, { type: "status", agent: "quant", status: "working", message: "Đang định giá & lập kịch bản" }],
  [2000, { type: "activity", agent: "quant", kind: "thinking" }],
  [5000, { type: "activity", agent: "quant", kind: "typing", message: "Kịch bản cơ sở: giá trị hợp lý 52.000…" }],
  [3500, { type: "status", agent: "quant", status: "done", message: "Xong phần việc" }],
  [0, { type: "handoff", from: "quant", to: "risk", message: "3 kịch bản định giá + đề xuất tỷ trọng 15%" }],
  [0, { type: "status", agent: "risk", status: "working", message: "Đang thẩm định rủi ro" }],
  [2000, { type: "activity", agent: "risk", kind: "thinking" }],
  [5000, { type: "activity", agent: "risk", kind: "typing", message: "Stress test: doanh thu −15% → định giá −22%" }],
  [3500, { type: "status", agent: "risk", status: "done", message: "Xong phần việc" }],
  [0, { type: "handoff", from: "risk", to: "manager", message: "Báo cáo rủi ro + quy tắc cắt lỗ" }],
  [0, { type: "status", agent: "manager", status: "reviewing", message: "Đang viết báo cáo đầu tư" }],
  [2500, { type: "activity", agent: "manager", kind: "thinking" }],
  [7000, { type: "activity", agent: "manager", kind: "typing", message: "Khuyến nghị: NẮM GIỮ / TÍCH LUỸ DẦN…" }],
  [3000, { type: "status", agent: "manager", status: "done", message: "Xong phần việc" }],
];

let running = null;

export function isDemoRunning() { return !!running; }

export async function runDemo(emit, client, prompt = null) {
  if (running) return;
  const token = { cancelled: false };
  running = token;
  try {
    for (const [wait, base] of SCRIPT) {
      const msg = prompt && base.type === "job" ? { ...base, prompt: `[MÔ PHỎNG] ${prompt}`.slice(0, 140) } : base;
      if (wait) await new Promise(r => setTimeout(r, wait));
      if (token.cancelled) return;
      emit(msg);
    }
    await new Promise(r => setTimeout(r, 800));
    if (token.cancelled) return;
    for (const agent of ["manager", "analyst", "quant", "risk"]) {
      emit({ type: "status", agent, status: "idle", message: "Sẵn sàng cho việc tiếp theo" });
    }
    emit({ type: "job", state: "finished", result: sampleReport(client), demo: true });
  } finally {
    if (running === token) running = null;
  }
}

export function cancelDemo() {
  if (running) running.cancelled = true;
  running = null;
}
