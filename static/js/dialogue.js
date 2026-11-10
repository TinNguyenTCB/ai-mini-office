// Lời thoại của nhân viên Mini Capital theo từng ngôn ngữ.
// Mã cổ phiếu trong lời thoại (AIX...) là mã HƯ CẤU, chỉ để trang trí.

import { getLang } from "./i18n.js";

const D = {
  vi: {
    names: { manager: "Giám đốc", analyst: "Phân tích", quant: "Định lượng", risk: "Rủi ro" },
    titles: { manager: "Giám đốc đầu tư", analyst: "Chuyên viên phân tích", quant: "Chuyên viên định lượng", risk: "Quản trị rủi ro" },
    duties: {
      manager: "Thẩm định & ký báo cáo", analyst: "Nghiên cứu doanh nghiệp, ngành",
      quant: "Định giá, kịch bản, phân bổ", risk: "Rủi ro, stress test, cắt lỗ",
    },
    activity: {
      coffee: {
        manager: ["Một ly trước phiên chiều", "Cà phê đen, không đường – như thị trường"],
        analyst: ["Cần caffeine để đọc BCTC", "Thêm ly nữa là đọc xong thuyết minh"],
        quant: ["Nạp năng lượng chạy mô hình", "Cà phê là biến số quan trọng nhất"],
        risk: ["Bình tĩnh là quản trị rủi ro tốt nhất", "Ít đường thôi – kiểm soát rủi ro mà"],
      },
      window: {
        manager: ["Nhìn xa mới thấy xu hướng", "Thị trường dài hạn luôn đi lên…"],
        analyst: ["Trời đẹp như biểu đồ tăng", "Phố đông thế, bán lẻ chắc ổn"],
        quant: ["Đếm xe ngoài kia để đoán GDP…", "Mây cũng có chu kỳ nhỉ"],
        risk: ["Mây đen kìa… phòng hờ thôi", "Trời quang chưa chắc đã an toàn"],
      },
      read: {
        manager: ["Đọc lại thư gửi cổ đông", "Sách cũ, bài học không cũ"],
        analyst: ["Đọc báo cáo thường niên", "Báo cáo ngành quý này"],
        quant: ["Sách về định giá doanh nghiệp", "Lại một cuốn về thống kê"],
        risk: ["Lịch sử các cuộc khủng hoảng", "Đọc lại vụ bong bóng năm nào"],
      },
      sofa: {
        manager: ["Nghỉ năm phút rồi duyệt tiếp", "Ngồi chút cho đầu óc thông"],
        analyst: ["Nghỉ mắt khỏi màn hình", "Năm phút thôi…"],
        quant: ["Để mô hình tự chạy một lúc", "Chờ backtest xong"],
        risk: ["Nghỉ ngơi cũng là phòng ngừa", "Thở sâu, quan sát"],
      },
    },
    handoff: {
      "analyst>quant": "Số liệu nghiên cứu đây, bạn định giá nhé!",
      "quant>risk": "Mô hình xong rồi, soi giả định giúp mình.",
      "risk>manager": "Báo cáo rủi ro đã in, sếp duyệt giúp.",
    },
    conversations: [
      { roles: ["analyst", "quant"], lines: [[0, "Báo cáo quý của AIX vừa ra: doanh thu tăng 18%."], [1, "Biên lợi nhuận thì sao? Mình cần cập nhật mô hình."], [0, "Biên gộp giảm nhẹ vì giá nguyên liệu tăng."], [1, "Vậy kịch bản cơ sở hạ EPS xuống 5%."]] },
      { roles: ["quant", "risk"], lines: [[0, "Mô hình định giá ra upside 25% đấy."], [1, "Giả định tăng trưởng bao nhiêu?"], [0, "15% mỗi năm trong ba năm."], [1, "Hơi lạc quan. Chạy thử kịch bản 5% xem."]] },
      { roles: ["risk", "manager"], lines: [[0, "Danh mục mẫu đang dồn 40% vào một ngành."], [1, "Vượt hạn mức 30% rồi."], [0, "Tôi đề xuất giảm dần trong hai tuần."], [1, "Đồng ý. Nhớ đặt sẵn điểm cắt lỗ."]] },
      { roles: ["manager", "analyst"], lines: [[0, "Khách hàng hay hỏi về nhóm ngân hàng."], [1, "Mình đang đọc lại nợ xấu từng nhà băng."], [0, "Nhớ ghi rõ mốc thời gian của số liệu."], [1, "Vâng, không số nào thiếu nguồn."]] },
      { roles: ["analyst", "risk"], lines: [[0, "Ngành bán lẻ đang hồi phục khá rõ."], [1, "Tồn kho cao vậy có đáng lo không?"], [0, "Có, mình sẽ ghi vào phần rủi ro."]] },
      { roles: ["manager", "quant"], lines: [[0, "Tỷ trọng tiền mặt hiện tại bao nhiêu?"], [1, "Khoảng 20%, đang chờ điểm giải ngân."], [0, "Chia ba đợt giải ngân cho an toàn."], [1, "Rõ, mình cập nhật kế hoạch ngay."]] },
      { roles: ["*", "*"], lines: [[0, "Hôm nay thị trường đỏ quá."], [1, "Kỷ luật quan trọng hơn dự đoán."], [0, "Chuẩn, cứ bám kế hoạch thôi."]] },
      { roles: ["*", "*"], lines: [[0, "Trưa nay ăn gì nhỉ?"], [1, "Phở đầu ngõ đi!"], [0, "Chốt! Như chốt lời vậy."]] },
      { roles: ["*", "*"], lines: [[0, "Cuối tuần định làm gì?"], [1, "Đọc nốt cuốn sách về đầu tư giá trị."], [0, "Lại sách đầu tư à? Nghỉ ngơi chút đi!"]] },
    ],
  },

  en: {
    names: { manager: "Director", analyst: "Analyst", quant: "Quant", risk: "Risk" },
    titles: { manager: "Chief Investment Officer", analyst: "Research Analyst", quant: "Quantitative Analyst", risk: "Risk Manager" },
    duties: {
      manager: "Reviews & signs reports", analyst: "Company & industry research",
      quant: "Valuation, scenarios, allocation", risk: "Risk, stress tests, stop-loss",
    },
    activity: {
      coffee: {
        manager: ["One cup before the afternoon session", "Black, no sugar – like the market"],
        analyst: ["Need caffeine for these financial statements", "One more cup and I'll finish the notes"],
        quant: ["Refuelling to run the model", "Coffee is the most important variable"],
        risk: ["Staying calm is good risk management", "Less sugar – risk control, you know"],
      },
      window: {
        manager: ["Step back to see the trend", "Long term, the market goes up…"],
        analyst: ["Lovely weather, like an uptrend", "Busy streets – retail looks fine"],
        quant: ["Counting cars to estimate GDP…", "Clouds have cycles too"],
        risk: ["Dark clouds… just in case", "Clear skies aren't always safe"],
      },
      read: {
        manager: ["Re-reading the shareholder letter", "Old book, timeless lessons"],
        analyst: ["Reading the annual report", "This quarter's industry report"],
        quant: ["A book on company valuation", "Yet another statistics book"],
        risk: ["A history of financial crises", "Re-reading the bubble chapter"],
      },
      sofa: {
        manager: ["Five minutes, then back to reviews", "A short break clears the mind"],
        analyst: ["Resting my eyes", "Just five minutes…"],
        quant: ["Letting the model run for a bit", "Waiting for the backtest"],
        risk: ["Rest is prevention too", "Breathe, observe"],
      },
    },
    handoff: {
      "analyst>quant": "Here's the research – over to you for valuation!",
      "quant>risk": "Model's done – please check my assumptions.",
      "risk>manager": "The risk report is printed, ready for your review.",
    },
    conversations: [
      { roles: ["analyst", "quant"], lines: [[0, "AIX's quarterly report is out: revenue up 18%."], [1, "What about margins? I need to update the model."], [0, "Gross margin dipped on higher input costs."], [1, "Then I'll trim base-case EPS by 5%."]] },
      { roles: ["quant", "risk"], lines: [[0, "The valuation model shows 25% upside."], [1, "What growth rate did you assume?"], [0, "15% a year for three years."], [1, "A bit optimistic. Try a 5% scenario."]] },
      { roles: ["risk", "manager"], lines: [[0, "The model portfolio has 40% in one sector."], [1, "That's over our 30% limit."], [0, "I suggest trimming it over two weeks."], [1, "Agreed. Set stop-losses in advance."]] },
      { roles: ["manager", "analyst"], lines: [[0, "Clients keep asking about banks."], [1, "I'm re-reading each bank's bad debt."], [0, "Always note the date of your figures."], [1, "Will do – no number without a source."]] },
      { roles: ["analyst", "risk"], lines: [[0, "Retail is clearly recovering."], [1, "Should we worry about high inventory?"], [0, "Yes, I'll add it to the risk section."]] },
      { roles: ["manager", "quant"], lines: [[0, "What's our cash weighting now?"], [1, "About 20%, waiting for entry points."], [0, "Deploy it in three tranches to be safe."], [1, "Got it, updating the plan now."]] },
      { roles: ["*", "*"], lines: [[0, "The market's deep red today."], [1, "Discipline beats prediction."], [0, "Exactly – stick to the plan."]] },
      { roles: ["*", "*"], lines: [[0, "What's for lunch?"], [1, "Noodles down the street?"], [0, "Deal! Locking that in like a profit."]] },
      { roles: ["*", "*"], lines: [[0, "Any plans for the weekend?"], [1, "Finishing a book on value investing."], [0, "Another investing book? Take a break!"]] },
    ],
  },

  ja: {
    names: { manager: "部長", analyst: "アナリスト", quant: "クオンツ", risk: "リスク" },
    titles: { manager: "運用責任者", analyst: "リサーチアナリスト", quant: "クオンツアナリスト", risk: "リスク管理担当" },
    duties: {
      manager: "レポートの審査・承認", analyst: "企業・業界リサーチ",
      quant: "バリュエーション・シナリオ・配分", risk: "リスク・ストレステスト・損切り",
    },
    activity: {
      coffee: {
        manager: ["午後の取引前に一杯", "ブラック無糖、相場と同じだ"],
        analyst: ["決算書にはカフェインが必要", "もう一杯で注記を読み終える"],
        quant: ["モデルを回す前に充電", "コーヒーは最重要変数だ"],
        risk: ["冷静さこそ最高のリスク管理", "砂糖は控えめ、リスク管理です"],
      },
      window: {
        manager: ["遠くを見ればトレンドが見える", "長期では相場は上がる…"],
        analyst: ["上昇チャートみたいな良い天気", "人通りが多い、小売は堅調だね"],
        quant: ["車の数でGDPを推計中…", "雲にも周期があるのかな"],
        risk: ["暗い雲…念のため備えよう", "晴天が安全とは限らない"],
      },
      read: {
        manager: ["株主への手紙を読み返す", "古い本、色あせない教訓"],
        analyst: ["年次報告書を読む", "今期の業界レポート"],
        quant: ["企業価値評価の本", "また統計の本"],
        risk: ["金融危機の歴史", "バブルの章を読み返す"],
      },
      sofa: {
        manager: ["5分休んで審査に戻ろう", "少し座って頭を整理"],
        analyst: ["画面から目を休める", "5分だけ…"],
        quant: ["モデルをしばらく回しておく", "バックテスト待ち"],
        risk: ["休息も予防のうち", "深呼吸して観察"],
      },
    },
    handoff: {
      "analyst>quant": "リサーチ資料です。バリュエーションをお願いします！",
      "quant>risk": "モデルができました。前提を確認してください。",
      "risk>manager": "リスク報告書を印刷しました。ご確認ください。",
    },
    conversations: [
      { roles: ["analyst", "quant"], lines: [[0, "AIXの四半期決算が出ました。売上は18%増です。"], [1, "利益率は？モデルを更新しないと。"], [0, "原材料高で粗利率は少し下がりました。"], [1, "じゃあ基本シナリオのEPSを5%下げます。"]] },
      { roles: ["quant", "risk"], lines: [[0, "バリュエーションでは25%の上値余地です。"], [1, "成長率の前提は？"], [0, "3年間、年15%です。"], [1, "少し楽観的ですね。5%のケースも試しましょう。"]] },
      { roles: ["risk", "manager"], lines: [[0, "モデルポートフォリオの40%が一業種に集中しています。"], [1, "上限の30%を超えているな。"], [0, "2週間かけて段階的に減らすことを提案します。"], [1, "了解。損切りラインも事前に設定しよう。"]] },
      { roles: ["manager", "analyst"], lines: [[0, "お客様から銀行株の質問が多いね。"], [1, "各行の不良債権を読み直しています。"], [0, "数値の時点は必ず明記してくれ。"], [1, "はい、出典のない数字は使いません。"]] },
      { roles: ["analyst", "risk"], lines: [[0, "小売業界ははっきり回復しています。"], [1, "在庫が多いのは心配では？"], [0, "はい、リスクの項目に書いておきます。"]] },
      { roles: ["manager", "quant"], lines: [[0, "今の現金比率は？"], [1, "約20%です。買い場を待っています。"], [0, "安全のため3回に分けて投資しよう。"], [1, "了解です。計画をすぐ更新します。"]] },
      { roles: ["*", "*"], lines: [[0, "今日は相場が真っ赤だね。"], [1, "予測より規律が大事です。"], [0, "その通り、計画通りにいこう。"]] },
      { roles: ["*", "*"], lines: [[0, "お昼は何にする？"], [1, "角のラーメン屋はどう？"], [0, "決まり！利益確定みたいに即決だ。"]] },
      { roles: ["*", "*"], lines: [[0, "週末の予定は？"], [1, "バリュー投資の本を読み終えるよ。"], [0, "また投資の本？たまには休もうよ！"]] },
    ],
  },
};

const cur = () => D[getLang()] || D.vi;

export const names = () => cur().names;
export const titles = () => cur().titles;
export const duties = () => cur().duties;
export const activityLine = (kind, role) => pick(cur().activity[kind][role]);
export const handoffLine = key => cur().handoff[key];

// Chọn hội thoại phù hợp với cặp vị trí; trả về các dòng đã quy đổi về góc nhìn [a, b].
export function pickConversation(a, b) {
  const list = cur().conversations;
  const specific = [];
  for (const c of list) {
    const [r0, r1] = c.roles;
    if (r0 === a && r1 === b) specific.push(c.lines);
    else if (r0 === b && r1 === a) specific.push(c.lines.map(([who, text]) => [1 - who, text]));
  }
  const generic = list.filter(c => c.roles[0] === "*").map(c => c.lines);
  const pool = specific.length && Math.random() < 0.7 ? specific : generic;
  return pool[Math.floor(Math.random() * pool.length)];
}

export const pick = list => list[Math.floor(Math.random() * list.length)];
