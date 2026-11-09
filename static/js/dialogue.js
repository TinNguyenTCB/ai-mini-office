// Lời thoại của nhân viên Mini Capital – công ty nghiên cứu & quản lý cổ phiếu.
// Mã cổ phiếu trong lời thoại (AIX, MNC...) là mã HƯ CẤU, chỉ để trang trí.

export const NAMES = { manager: "Giám đốc", analyst: "Phân tích", quant: "Định lượng", risk: "Rủi ro" };
export const TITLES = {
  manager: "Giám đốc đầu tư",
  analyst: "Chuyên viên phân tích",
  quant: "Chuyên viên định lượng",
  risk: "Quản trị rủi ro",
};
export const DUTIES = {
  manager: "Thẩm định & ký báo cáo",
  analyst: "Nghiên cứu doanh nghiệp, ngành",
  quant: "Định giá, kịch bản, phân bổ",
  risk: "Rủi ro, stress test, cắt lỗ",
};

// Câu nói khi giải lao – mỗi vị trí một giọng riêng.
export const ACTIVITY_LINES = {
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
};

// Câu nói khi bàn giao công việc cho người kế tiếp.
export const HANDOFF_LINES = {
  "analyst>quant": "Số liệu nghiên cứu đây, bạn định giá nhé!",
  "quant>risk": "Mô hình xong rồi, soi giả định giúp mình.",
  "risk>manager": "Báo cáo rủi ro đã in, sếp duyệt giúp.",
};

// Hội thoại khi tán gẫu: mỗi dòng là [người nói (0 = người khởi xướng, 1 = người kia), câu].
const CONVERSATIONS = [
  { roles: ["analyst", "quant"], lines: [
    [0, "Báo cáo quý của AIX vừa ra: doanh thu tăng 18%."],
    [1, "Biên lợi nhuận thì sao? Mình cần cập nhật mô hình."],
    [0, "Biên gộp giảm nhẹ vì giá nguyên liệu tăng."],
    [1, "Vậy kịch bản cơ sở hạ EPS xuống 5%."],
  ] },
  { roles: ["quant", "risk"], lines: [
    [0, "Mô hình định giá ra upside 25% đấy."],
    [1, "Giả định tăng trưởng bao nhiêu?"],
    [0, "15% mỗi năm trong ba năm."],
    [1, "Hơi lạc quan. Chạy thử kịch bản 5% xem."],
  ] },
  { roles: ["risk", "manager"], lines: [
    [0, "Danh mục mẫu đang dồn 40% vào một ngành."],
    [1, "Vượt hạn mức 30% rồi."],
    [0, "Tôi đề xuất giảm dần trong hai tuần."],
    [1, "Đồng ý. Nhớ đặt sẵn điểm cắt lỗ."],
  ] },
  { roles: ["manager", "analyst"], lines: [
    [0, "Khách hàng hay hỏi về nhóm ngân hàng."],
    [1, "Mình đang đọc lại nợ xấu từng nhà băng."],
    [0, "Nhớ ghi rõ mốc thời gian của số liệu."],
    [1, "Vâng, không số nào thiếu nguồn."],
  ] },
  { roles: ["analyst", "risk"], lines: [
    [0, "Ngành bán lẻ đang hồi phục khá rõ."],
    [1, "Tồn kho cao vậy có đáng lo không?"],
    [0, "Có, mình sẽ ghi vào phần rủi ro."],
  ] },
  { roles: ["manager", "quant"], lines: [
    [0, "Tỷ trọng tiền mặt hiện tại bao nhiêu?"],
    [1, "Khoảng 20%, đang chờ điểm giải ngân."],
    [0, "Chia ba đợt giải ngân cho an toàn."],
    [1, "Rõ, mình cập nhật kế hoạch ngay."],
  ] },
  { roles: ["*", "*"], lines: [
    [0, "Hôm nay thị trường đỏ quá."],
    [1, "Kỷ luật quan trọng hơn dự đoán."],
    [0, "Chuẩn, cứ bám kế hoạch thôi."],
  ] },
  { roles: ["*", "*"], lines: [
    [0, "Trưa nay ăn gì nhỉ?"],
    [1, "Phở đầu ngõ đi!"],
    [0, "Chốt! Như chốt lời vậy."],
  ] },
  { roles: ["*", "*"], lines: [
    [0, "Cuối tuần định làm gì?"],
    [1, "Đọc nốt cuốn sách về đầu tư giá trị."],
    [0, "Lại sách đầu tư à? Nghỉ ngơi chút đi!"],
  ] },
];

// Chọn hội thoại phù hợp với cặp vị trí; trả về các dòng đã quy đổi về góc nhìn [a, b].
export function pickConversation(a, b) {
  const specific = [];
  for (const c of CONVERSATIONS) {
    const [r0, r1] = c.roles;
    if (r0 === a && r1 === b) specific.push(c.lines);
    else if (r0 === b && r1 === a) specific.push(c.lines.map(([who, text]) => [1 - who, text]));
  }
  const generic = CONVERSATIONS.filter(c => c.roles[0] === "*").map(c => c.lines);
  const pool = specific.length && Math.random() < 0.7 ? specific : generic;
  return pool[Math.floor(Math.random() * pool.length)];
}

export const pick = list => list[Math.floor(Math.random() * list.length)];
