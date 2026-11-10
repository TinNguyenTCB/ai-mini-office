// Bộ icon SVG nét mảnh dùng chung cho toàn bộ giao diện (thay cho emoji/ký tự: luôn cân giữa,
// cùng độ dày nét, ăn theo màu chữ qua currentColor). Khung vẽ 24×24.

// Bánh răng sinh bằng toạ độ cực: 8 răng, lỗ tròn ở giữa.
function gear() {
  const pts = [];
  const pt = (deg, r) => {
    const a = (deg * Math.PI) / 180;
    return `${(12 + Math.cos(a) * r).toFixed(2)} ${(12 + Math.sin(a) * r).toFixed(2)}`;
  };
  for (let i = 0; i < 8; i++) {
    const a = i * 45;
    pts.push(pt(a - 15, 7.4), pt(a - 8, 10), pt(a + 8, 10), pt(a + 15, 7.4));
  }
  return `<path d="M${pts.join("L")}Z"/><circle cx="12" cy="12" r="3"/>`;
}

const P = {
  // Điều khiển chung
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  minus: '<path d="M5 12h14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  reset: '<path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4v5h5"/>',
  rotate: '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  shrink: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  alert: '<path d="M12 3.5L2.5 20h19z"/><path d="M12 10v4.5M12 17.5h.01"/>',
  play: '<path d="M8 5v14l11-7z"/>',
  pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  spinner: '<path d="M12 3a9 9 0 1 0 9 9"/>',
  send: '<path d="M21 3L3 10.5l7 2.5 2.5 7z"/><path d="M10 13L21 3"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  save: '<path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
  move: '<path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/>',
  // Khu vực / chủ đề
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18"/>',
  settings: gear(),
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>',
  team: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 14.1c2.6.4 4.5 2.8 4.5 5.9"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  report: '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  folder: '<path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
  cabinet: '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M5 9h14M5 15h14M10.5 6h3M10.5 12h3M10.5 18h3"/>',
  // Nội thất (danh mục sắp xếp)
  "f-desk": '<path d="M3 11h18M5 11v9M19 11v9"/><rect x="8.5" y="3" width="7" height="5" rx="0.8"/><path d="M12 8v3"/>',
  "f-meeting": '<ellipse cx="12" cy="10" rx="9" ry="3.5"/><path d="M7 13v6M17 13v6M12 13.5V21"/>',
  "f-bookshelf": '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M4 12h16M7.5 5.5v4M10.5 5.5v4M14 6.5v3M8 14.5v4M11 14.5v4M15.5 15v3.5"/>',
  "f-whiteboard": '<rect x="3" y="4" width="18" height="12" rx="1"/><path d="M8 21l2-5M16 21l-2-5M7.5 13v-2.5M11 13V8M14.5 13v-3.5"/>',
  "f-printer": '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="1.5"/><path d="M7 14h10v7H7z"/>',
  "f-watercooler": '<rect x="9" y="2.5" width="6" height="6" rx="1"/><rect x="7" y="9" width="10" height="12.5" rx="1"/><path d="M10.5 13h3"/>',
  "f-vending": '<rect x="5" y="2.5" width="14" height="19" rx="1.5"/><path d="M8 5.5h5v10H8zM16 6v4M8 18.5h5"/>',
  "f-sofa": '<path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3"/><path d="M3 11a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v6H3z"/><path d="M6 17v2.5M18 17v2.5"/>',
  "f-plant": '<path d="M7 14h10l-1.5 7h-7z"/><path d="M12 14V8M12 9c0-3 2-5 5-5 0 3-2 5-5 5zM12 11c0-3-2-5-5-5 0 3 2 5 5 5z"/>',
  "f-chair": '<path d="M8 3h8v9H8zM6 12h12v3H6zM7.5 15v6M16.5 15v6"/>',
  "f-cabinet": "",
  "f-trash": "",
};
P["f-cabinet"] = P.cabinet;
P["f-trash"] = P.trash;

export const hasIcon = name => !!P[name];

export function icon(name, cls = "") {
  const extra = name === "spinner" ? " spin" : "";
  return `<svg class="ico${extra}${cls ? ` ${cls}` : ""}" viewBox="0 0 24 24" aria-hidden="true">${P[name] || ""}</svg>`;
}

// <i data-icon="globe"></i> trong HTML -> thay bằng SVG tương ứng.
export function applyIcons(root = document) {
  root.querySelectorAll("i[data-icon]").forEach(el => { el.outerHTML = icon(el.dataset.icon); });
}

// Đặt nội dung "icon + chữ" cho một phần tử (nút, huy hiệu, thông báo...).
export function setLabel(el, name, text) {
  const key = `${name || ""}|${text}`;
  if (el.dataset.label === key && el.querySelector(":scope > span")) return; // không đổi -> giữ nguyên (vòng quay không bị giật)
  el.dataset.label = key;
  el.classList.add("has-ico");
  el.innerHTML = name && P[name] ? icon(name) : "";
  const span = document.createElement("span");
  span.textContent = text;
  el.append(span);
}
