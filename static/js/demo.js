// Chạy mô phỏng một nhiệm vụ trọn vẹn mà KHÔNG gọi API: phát lại đúng chuỗi sự kiện backend sẽ gửi.
// Mã cổ phiếu "AIX" và mọi con số trong báo cáo mẫu đều là HƯ CẤU.

import { clientName, getLang } from "./i18n.js";

const TEXT = {
  vi: {
    prompt: "Phân tích cổ phiếu AIX cho danh mục dài hạn", tag: "[MÔ PHỎNG]",
    assigning: "Đang phân công công việc", monitoring: "Đã giao việc, theo dõi tiến độ",
    work: { analyst: "Đang nghiên cứu doanh nghiệp", quant: "Đang định giá & lập kịch bản", risk: "Đang thẩm định rủi ro", manager: "Đang viết báo cáo đầu tư" },
    done: "Xong phần việc", ready: "Sẵn sàng cho việc tiếp theo",
    typing: { analyst: "Doanh thu tăng đều 3 năm, biên gộp ~28%…", quant: "Kịch bản cơ sở: giá trị hợp lý 52.000…", risk: "Stress test: doanh thu −15% → định giá −22%", manager: "Khuyến nghị: NẮM GIỮ / TÍCH LUỸ DẦN…" },
    handoff: { quant: "Hồ sơ doanh nghiệp AIX + số liệu 3 năm", risk: "3 kịch bản định giá + đề xuất tỷ trọng 15%", manager: "Báo cáo rủi ro + quy tắc cắt lỗ" },
    report: c => `## BÁO CÁO ĐẦU TƯ MẪU – Cổ phiếu AIX (hư cấu)

> ⚠️ Đây là **báo cáo mô phỏng** để xem trước giao diện. Doanh nghiệp, mã cổ phiếu và mọi con số đều **hư cấu**.

- **Gửi:** ${c}
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
**Miễn trừ trách nhiệm:** Báo cáo do AI tạo, không phải tư vấn đầu tư được cấp phép. Dữ liệu có thể lỗi thời hoặc sai lệch. Quý khách tự chịu trách nhiệm với quyết định của mình.`,
  },

  en: {
    prompt: "Analyse AIX stock for a long-term portfolio", tag: "[SIMULATION]",
    assigning: "Assigning tasks", monitoring: "Tasks assigned, monitoring progress",
    work: { analyst: "Researching the company", quant: "Valuing & building scenarios", risk: "Reviewing risks", manager: "Writing the investment report" },
    done: "Part done", ready: "Ready for the next task",
    typing: { analyst: "Revenue up 3 years in a row, gross margin ~28%…", quant: "Base case: fair value 52.00…", risk: "Stress test: revenue −15% → valuation −22%", manager: "Recommendation: HOLD / ACCUMULATE…" },
    handoff: { quant: "AIX company profile + 3 years of figures", risk: "3 valuation scenarios + 15% weighting proposal", manager: "Risk report + stop-loss rules" },
    report: c => `## SAMPLE INVESTMENT REPORT – AIX stock (fictional)

> ⚠️ This is a **simulated report** for previewing the interface. The company, ticker and every figure are **fictional**.

- **To:** ${c}
- **Recommendation:** HOLD / ACCUMULATE GRADUALLY – confidence: *medium*

### 1. Investment thesis
- Revenue has grown steadily for 3 years; gross margin stable around 28%.
- Healthy balance sheet: net cash, no long-term debt.
- The main risk is input material prices.

### 2. Valuation & scenarios
| Scenario | Growth assumption | Fair value | vs. current price |
|---|---|---|---|
| Bear | 3%/yr | 41.00 | ▼ 12% |
| Base | 10%/yr | 52.00 | ▲ 11% |
| Bull | 16%/yr | 63.00 | ▲ 34% |

### 3. Allocation plan
1. Maximum weighting **15%** of the portfolio.
2. Invest in **3 tranches**, 2–3 weeks apart.
3. Keep **20%** cash in reserve.

### 4. Risks & controls
- Stress test: revenue −15% → fair value about −22%.
- Stop-loss if the price closes below **38.00** for two consecutive sessions.

### 5. What you should verify
- The latest financial statements on the company / exchange website.
- The current market price at your brokerage.

---
**Disclaimer:** This report is AI-generated and is not licensed investment advice. Data may be outdated or inaccurate. You are solely responsible for your decisions.`,
  },

  ja: {
    prompt: "長期ポートフォリオ向けにAIX株を分析", tag: "【シミュレーション】",
    assigning: "タスクを割り振り中", monitoring: "割り振り完了、進捗を確認中",
    work: { analyst: "企業を調査中", quant: "バリュエーションとシナリオ作成中", risk: "リスクを審査中", manager: "投資レポートを作成中" },
    done: "担当完了", ready: "次のタスクの準備OK",
    typing: { analyst: "3年連続の増収、粗利率は約28%…", quant: "基本シナリオ：適正価格 5,200円…", risk: "ストレステスト：売上−15% → 評価−22%", manager: "推奨：保有／段階的買い増し…" },
    handoff: { quant: "AIXの企業概要と3年分の数値", risk: "3つのバリュエーションシナリオと比率15%の提案", manager: "リスク報告書と損切りルール" },
    report: c => `## 投資レポート（サンプル）– AIX株（架空）

> ⚠️ これは画面確認用の**シミュレーションレポート**です。企業・銘柄・数値はすべて**架空**です。

- **宛先：** ${c}
- **推奨：** 保有／段階的に買い増し – 確信度：*中*

### 1. 投資テーマ
- 3年連続で売上が安定的に成長し、粗利率は約28%で安定。
- 健全な財務：ネットキャッシュで長期借入金なし。
- 主なリスクは原材料価格。

### 2. バリュエーションとシナリオ
| シナリオ | 成長率の前提 | 適正価格 | 現在値との比較 |
|---|---|---|---|
| 弱気 | 年3% | 4,100円 | ▼ 12% |
| 基本 | 年10% | 5,200円 | ▲ 11% |
| 強気 | 年16% | 6,300円 | ▲ 34% |

### 3. 資金配分計画
1. 組入比率は最大 **15%**。
2. **3回**に分けて、2〜3週間おきに投資。
3. 現金を **20%** 確保。

### 4. リスクと管理
- ストレステスト：売上−15% → 適正価格は約−22%。
- 終値が **3,800円** を2営業日連続で下回ったら損切り。

### 5. お客様にご確認いただきたいこと
- 企業／取引所のウェブサイトにある最新の決算書。
- お取引先の証券会社での現在の株価。

---
**免責事項：** 本レポートはAIが作成したもので、認可を受けた投資助言ではありません。データは古い、または不正確な可能性があります。最終的な投資判断はお客様ご自身の責任でお願いいたします。`,
  },
};

function script(prompt) {
  const L = TEXT[getLang()] || TEXT.vi;
  const st = (agent, status, message) => ({ type: "status", agent, status, message });
  const act = (agent, kind) => ({ type: "activity", agent, kind, message: kind === "typing" ? L.typing[agent] : undefined });
  const steps = [[0, { type: "job", state: "started", prompt: `${L.tag} ${prompt || L.prompt}`.slice(0, 140) }],
    [300, st("manager", "thinking", L.assigning)],
    [5500, st("manager", "idle", L.monitoring)]];
  const order = ["analyst", "quant", "risk", "manager"];
  order.forEach((agent, i) => {
    steps.push([0, st(agent, agent === "manager" ? "reviewing" : "working", L.work[agent])]);
    steps.push([agent === "analyst" ? 1500 : 2000, act(agent, "thinking")]);
    steps.push([agent === "manager" ? 7000 : agent === "analyst" ? 6000 : 5000, act(agent, "typing")]);
    steps.push([agent === "manager" ? 3000 : 3500, st(agent, "done", L.done)]);
    const next = order[i + 1];
    if (next) steps.push([0, { type: "handoff", from: agent, to: next, message: L.handoff[next] }]);
  });
  return { steps, L };
}

let running = null;

export function isDemoRunning() { return !!running; }

export async function runDemo(emit, name, prompt = null) {
  if (running) return;
  const token = { cancelled: false };
  running = token;
  const { steps, L } = script(prompt);
  try {
    for (const [wait, msg] of steps) {
      if (wait) await new Promise(r => setTimeout(r, wait));
      if (token.cancelled) return;
      emit(msg);
    }
    await new Promise(r => setTimeout(r, 800));
    if (token.cancelled) return;
    for (const agent of ["manager", "analyst", "quant", "risk"]) emit({ type: "status", agent, status: "idle", message: L.ready });
    emit({ type: "job", state: "finished", result: L.report(clientName(name)), demo: true });
  } finally {
    if (running === token) running = null;
  }
}

export function cancelDemo() {
  if (running) running.cancelled = true;
  running = null;
}
