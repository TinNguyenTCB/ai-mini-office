// Nhân vật pixel-art với 8 hướng nhìn.
// Gốc toạ độ khi vẽ = điểm chân chạm sàn, nên thứ tự chiều sâu khớp với vị trí thật.
//
// Hướng (theo màn hình): S = chính diện, N = sau lưng, E/W = nghiêng hẳn, SE/SW = 3/4 phía trước, NE/NW = 3/4 phía sau.
// Mọi hướng "trái" (W, SW, NW) được vẽ bằng cách lật ngang hướng "phải" tương ứng.

import { getContext, shade } from "./iso.js";

export const SCALE = 1.25;
const BODY_Y = -27; // khoảng cách từ chân tới "thắt lưng" của sprite gốc

export const LOOKS = {
  manager: {
    skin: "#e8b98f", hair: "#3b3836", style: "swept", glasses: false, tie: true,
    outfit: { jacket: "#2d3a4f", shirt: "#e9edf2", trim: "#b8433a", pants: "#232c3b" },
  },
  analyst: {
    skin: "#f2cfae", hair: "#6b3e22", style: "bun", glasses: true,
    outfit: { jacket: "#7a5c8e", shirt: "#efe6d8", trim: "#d9b44a", pants: "#3a3f4a" },
  },
  quant: {
    skin: "#c68b5e", hair: "#1a1a1a", style: "hood", glasses: false,
    outfit: { jacket: "#2f6f5a", shirt: "#244f42", trim: "#9bd78c", pants: "#2b2f36" },
  },
  risk: {
    skin: "#8d5a3b", hair: "#1b1410", style: "beard", glasses: true,
    outfit: { jacket: "#b5623b", shirt: "#f0e3cf", trim: "#3a6fb0", pants: "#34404d" },
  },
};

const VIEWS = {
  S: ["front", false], SE: ["front34", false], SW: ["front34", true],
  E: ["side", false], W: ["side", true],
  NE: ["back34", false], NW: ["back34", true], N: ["back", false],
};
export const isBackView = facing => facing === "N" || facing === "NE" || facing === "NW";

const R = (ctx, color, x, y, w, h) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };

// Một đoạn tay xoay quanh vai – dùng cho góc nghiêng, nơi tay vung trước/sau.
function swingArm(ctx, sx, sy, angle, sleeve, skin, length = 12) {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(angle);
  R(ctx, sleeve, -2, 0, 4, length);
  R(ctx, skin, -2, length - 1, 4, 4);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Đầu
// ---------------------------------------------------------------------------
function headFront(ctx, L, s) {
  const { x, y } = s;
  if (L.style === "hood") { R(ctx, shade(L.outfit.jacket, -0.25), x - 13, y - 33, 26, 25); R(ctx, L.outfit.jacket, x - 11, y - 31, 22, 21); }
  if (L.style === "bun") R(ctx, L.hair, x - 4, y - 42, 8, 7);
  R(ctx, s.faceShadow, x - 9, y - 31, 18, 20);
  R(ctx, L.skin, x - 8, y - 32, 16, 18);
  R(ctx, s.faceLight, x - 6, y - 30, 10, 12);
  R(ctx, L.skin, x - 12, y - 26, 4, 7); R(ctx, L.skin, x + 8, y - 26, 4, 7);
  R(ctx, s.faceShadow, x - 11, y - 25, 2, 4); R(ctx, s.faceShadow, x + 9, y - 25, 2, 4);
  hairTop(ctx, L, x, y, 0);
  if (!s.blink) {
    R(ctx, "#2a1d16", x - 5, y - 25, 3, 2); R(ctx, "#2a1d16", x + 2, y - 25, 3, 2);
  } else R(ctx, "#2a1d16", x - 6, y - 25, 12, 1);
  R(ctx, "#2a1d16", x - 5, y - 27, 4, 1); R(ctx, "#2a1d16", x + 1, y - 27, 4, 1);
  R(ctx, s.faceShadow, x, y - 23, 2, 4);
  mouth(ctx, L, s, x - 3, 6);
  if (L.style === "beard") { R(ctx, L.hair, x - 7, y - 19, 14, 5); R(ctx, L.hair, x - 5, y - 14, 10, 3); mouth(ctx, L, s, x - 2, 5); }
  if (L.glasses && !s.blink) {
    ctx.strokeStyle = "#1b1f1d"; ctx.lineWidth = 1.5;
    ctx.strokeRect(x - 7, y - 27, 6, 5); ctx.strokeRect(x + 1, y - 27, 6, 5);
    R(ctx, "#1b1f1d", x - 1, y - 25, 2, 1);
  }
}

function headFront34(ctx, L, s) {
  const { x, y } = s;
  if (L.style === "hood") { R(ctx, shade(L.outfit.jacket, -0.25), x - 13, y - 33, 25, 25); R(ctx, L.outfit.jacket, x - 12, y - 31, 21, 21); }
  if (L.style === "bun") R(ctx, L.hair, x - 7, y - 42, 8, 7);
  R(ctx, s.faceShadow, x - 8, y - 31, 17, 20);
  R(ctx, L.skin, x - 7, y - 32, 15, 18);
  R(ctx, s.faceLight, x - 2, y - 30, 9, 12);
  R(ctx, L.skin, x + 8, y - 24, 2, 3); // mũi nhô ra
  R(ctx, L.skin, x - 11, y - 26, 4, 7); R(ctx, s.faceShadow, x - 10, y - 25, 2, 4); // tai gần
  hairTop(ctx, L, x, y, 1);
  if (L.style !== "hood") R(ctx, L.hair, x - 9, y - 31, 4, L.style === "bun" ? 10 : 7);
  if (!s.blink) { R(ctx, "#2a1d16", x - 1, y - 25, 3, 2); R(ctx, "#2a1d16", x + 5, y - 25, 2, 2); }
  else R(ctx, "#2a1d16", x - 1, y - 25, 9, 1);
  R(ctx, "#2a1d16", x - 1, y - 27, 4, 1); R(ctx, "#2a1d16", x + 5, y - 27, 3, 1);
  R(ctx, s.faceShadow, x + 4, y - 23, 2, 4);
  mouth(ctx, L, s, x + 1, 5);
  if (L.style === "beard") { R(ctx, L.hair, x - 5, y - 19, 13, 5); R(ctx, L.hair, x - 3, y - 14, 10, 3); mouth(ctx, L, s, x + 1, 5); }
  if (L.glasses && !s.blink) {
    ctx.strokeStyle = "#1b1f1d"; ctx.lineWidth = 1.5;
    ctx.strokeRect(x - 2, y - 27, 6, 5); ctx.strokeRect(x + 4, y - 27, 5, 5);
    R(ctx, "#1b1f1d", x - 8, y - 26, 6, 1);
  }
}

function headSide(ctx, L, s) {
  const { x, y } = s;
  if (L.style === "hood") { R(ctx, shade(L.outfit.jacket, -0.25), x - 11, y - 33, 21, 25); R(ctx, L.outfit.jacket, x - 10, y - 31, 18, 21); }
  if (L.style === "bun") R(ctx, L.hair, x - 12, y - 39, 7, 7);
  R(ctx, s.faceShadow, x - 6, y - 31, 14, 20);
  R(ctx, L.skin, x - 5, y - 32, 13, 18);
  R(ctx, s.faceLight, x + 1, y - 30, 6, 11);
  R(ctx, L.skin, x + 8, y - 25, 2, 3); R(ctx, s.faceShadow, x + 8, y - 22, 1, 1); // mũi
  R(ctx, L.skin, x - 3, y - 26, 4, 6); R(ctx, s.faceShadow, x - 2, y - 25, 2, 4); // tai
  if (L.style !== "hood") {
    R(ctx, L.hair, x - 7, y - 36, 15, 6);
    R(ctx, L.hair, x - 5, y - 38, 11, 3);
    R(ctx, L.hair, x - 7, y - 31, 4, L.style === "bun" ? 11 : 8);
    if (L.style === "swept") R(ctx, L.hair, x + 3, y - 31, 5, 2);
    R(ctx, shade(L.hair, 0.3), x - 3, y - 37, 4, 1);
  }
  if (!s.blink) R(ctx, "#2a1d16", x + 4, y - 25, 2, 2); else R(ctx, "#2a1d16", x + 3, y - 25, 3, 1);
  R(ctx, "#2a1d16", x + 3, y - 27, 4, 1);
  mouth(ctx, L, s, x + 4, 3);
  if (L.style === "beard") { R(ctx, L.hair, x - 1, y - 20, 9, 6); R(ctx, L.hair, x + 1, y - 15, 6, 3); mouth(ctx, L, s, x + 5, 3); }
  if (L.glasses && !s.blink) {
    ctx.strokeStyle = "#1b1f1d"; ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 2, y - 27, 6, 5);
    R(ctx, "#1b1f1d", x - 2, y - 26, 4, 1);
  }
}

function headBack34(ctx, L, s) {
  const { x, y } = s;
  if (L.style === "hood") {
    R(ctx, shade(L.outfit.jacket, -0.25), x - 13, y - 33, 25, 25); R(ctx, L.outfit.jacket, x - 12, y - 31, 22, 21);
    R(ctx, L.skin, x + 6, y - 27, 3, 8);
    return;
  }
  R(ctx, s.faceShadow, x - 8, y - 31, 17, 20);
  R(ctx, L.skin, x + 3, y - 30, 6, 14); // má phía xa
  R(ctx, L.skin, x + 2, y - 26, 4, 6); R(ctx, s.faceShadow, x + 3, y - 25, 2, 4); // tai
  R(ctx, L.hair, x - 9, y - 36, 17, 6);
  R(ctx, L.hair, x - 7, y - 38, 13, 3);
  R(ctx, L.hair, x - 9, y - 31, 11, 15);
  R(ctx, shade(L.hair, 0.18), x - 6, y - 33, 9, 2);
  if (L.style === "bun") R(ctx, L.hair, x - 5, y - 42, 8, 7);
  if (L.style === "beard") R(ctx, L.hair, x + 5, y - 19, 4, 5);
  if (L.glasses) R(ctx, "#1b1f1d", x + 5, y - 26, 4, 1);
}

function headBack(ctx, L, s) {
  const { x, y } = s;
  if (L.style === "hood") { R(ctx, shade(L.outfit.jacket, -0.25), x - 13, y - 33, 26, 25); R(ctx, L.outfit.jacket, x - 11, y - 31, 22, 21); return; }
  R(ctx, s.faceShadow, x - 9, y - 31, 18, 20);
  R(ctx, L.hair, x - 8, y - 33, 16, 18);
  R(ctx, L.hair, x - 10, y - 29, 4, 12); R(ctx, L.hair, x + 6, y - 29, 4, 12);
  R(ctx, L.hair, x - 9, y - 36, 18, 6);
  R(ctx, shade(L.hair, 0.18), x - 6, y - 34, 12, 3);
  R(ctx, s.faceShadow, x - 11, y - 25, 2, 4); R(ctx, s.faceShadow, x + 9, y - 25, 2, 4);
  if (L.style === "bun") R(ctx, L.hair, x - 4, y - 42, 8, 7);
}

function hairTop(ctx, L, x, y, shift) {
  if (L.style === "hood") return;
  if (L.style === "bun") {
    R(ctx, L.hair, x - 10 + shift, y - 36, 20, 7);
    if (!shift) { R(ctx, L.hair, x - 10, y - 30, 3, 8); R(ctx, L.hair, x + 7, y - 30, 3, 8); }
  } else {
    R(ctx, L.hair, x - 9 + shift, y - 36, 18, 6);
    R(ctx, L.hair, x - 7 + shift, y - 38, 14, 3);
    if (L.style === "swept") R(ctx, L.hair, x + 1 + shift, y - 31, 8, 3);
  }
  R(ctx, shade(L.hair, 0.3), x - 5 + shift, y - 37, 4, 1);
}

function mouth(ctx, L, s, mx, w) {
  const talking = s.talking && s.tick % 24 < 12;
  R(ctx, "#7a3f33", mx, s.y - 17, talking ? w + 1 : w, talking ? 3 : 1);
}

// ---------------------------------------------------------------------------
// Thân
// ---------------------------------------------------------------------------
function legs(ctx, L, s) {
  const { x, y, step, view } = s;
  const P = L.outfit.pants, shoe = "#1a1d1c";
  ctx.globalAlpha = 1 - s.seat;
  if (view === "side") {
    const far = -step * 1.3, near = step * 1.3;
    R(ctx, shade(P, -0.25), x - 2 + far, y + 10, 4, 13); R(ctx, shoe, x - 3 + far, y + 21, 7, 4);
    R(ctx, P, x - 2 + near, y + 10, 4, 13); R(ctx, shoe, x - 3 + near, y + 21, 7, 4);
  } else if (view === "front34" || view === "back34") {
    const k = view === "front34" ? 1 : -1;
    R(ctx, shade(P, -0.15), x + 1 - step * 0.6 * k, y + 10 - step * 0.4, 5, 13);
    R(ctx, shoe, x + 1 - step * 0.6 * k, y + 21 - step * 0.4, 6, 4);
    R(ctx, P, x - 5 + step * 0.6 * k, y + 10 + step * 0.4, 5, 13);
    R(ctx, shoe, x - 5 + step * 0.6 * k, y + 21 + step * 0.4, 6, 4);
  } else {
    R(ctx, P, x - 6, y + 10 + step, 5, 13); R(ctx, P, x + 1, y + 10 - step, 5, 13);
    R(ctx, shoe, x - 7, y + 21 + step, 7, 4); R(ctx, shoe, x + 1, y + 21 - step, 7, 4);
  }
  // Ngồi: chân bị thân/ghế che khi quay lưng.
  ctx.globalAlpha = s.seat;
  if (view === "front") {
    R(ctx, P, x - 8, y + 8, 8, 4); R(ctx, P, x + 1, y + 8, 8, 4);
    R(ctx, P, x - 10, y + 11, 10, 4); R(ctx, P, x + 1, y + 11, 10, 4);
    R(ctx, shoe, x - 11, y + 13, 8, 4); R(ctx, shoe, x + 3, y + 13, 8, 4);
  } else if (view === "front34") {
    R(ctx, P, x - 6, y + 8, 11, 4); R(ctx, P, x, y + 10, 11, 4);
    R(ctx, shoe, x + 4, y + 12, 7, 4); R(ctx, shoe, x + 9, y + 14, 7, 4);
  } else if (view === "side") {
    R(ctx, P, x - 3, y + 8, 13, 5); R(ctx, P, x + 7, y + 8, 4, 10); R(ctx, shoe, x + 7, y + 16, 7, 3);
  }
  ctx.globalAlpha = 1;
}

function torso(ctx, L, s) {
  const { x, y, view } = s;
  const O = L.outfit;
  const h = 20 - Math.round(s.seat * 4);
  if (view === "side") {
    R(ctx, O.jacket, x - 5, y - 8, 11, h);
    R(ctx, shade(O.jacket, -0.2), x - 5, y - 8, 2, h);
    R(ctx, O.shirt, x + 4, y - 7, 2, 9);
    return;
  }
  if (view === "front34" || view === "back34") {
    R(ctx, O.jacket, x - 8, y - 8, 16, h);
    R(ctx, shade(O.jacket, -0.2), x + 5, y - 8, 3, h);
    if (view === "front34") {
      R(ctx, O.shirt, x - 1, y - 7, 6, 15 - Math.round(s.seat * 3));
      if (L.tie) { R(ctx, O.trim, x + 1, y - 6, 2, 9); R(ctx, O.trim, x, y + 2, 4, 2); }
      else R(ctx, O.trim, x - 3, y - 6, 2, 13);
    } else R(ctx, shade(O.jacket, -0.15), x, y - 6, 2, 14);
    return;
  }
  R(ctx, O.jacket, x - 9, y - 8, 18, h);
  if (view === "back") { R(ctx, shade(O.jacket, -0.15), x - 1, y - 6, 2, 14); return; }
  R(ctx, O.shirt, x - 4, y - 7, 8, 15 - Math.round(s.seat * 3));
  if (L.tie) { R(ctx, O.trim, x - 1, y - 6, 2, 9); R(ctx, O.trim, x - 2, y + 2, 4, 2); }
  else { R(ctx, O.trim, x - 8, y - 6, 2, 13); R(ctx, O.trim, x + 6, y - 6, 2, 13); }
}

// Tay phía xa: vẽ trước thân (bị thân che một phần).
function farArm(ctx, L, s) {
  const { x, y, view, arm } = s;
  const sleeve = shade(L.outfit.jacket, -0.25), skin = shade(L.skin, -0.2);
  ctx.globalAlpha = 1 - s.seat;
  if (view === "side") swingArm(ctx, x, y - 6, arm * 0.09, sleeve, skin);
  else if (view === "front34" || view === "back34") { R(ctx, sleeve, x + 6, y - 6 - arm * 0.6, 4, 11); R(ctx, skin, x + 6, y + 4 - arm * 0.6, 4, 4); }
  ctx.globalAlpha = 1;
}

function nearArms(ctx, L, s) {
  const { x, y, view, arm, typing } = s;
  const sleeve = L.outfit.jacket, skin = L.skin;
  const waving = s.holding === "wave" && (view === "front" || view === "front34");
  // Đứng / đi
  ctx.globalAlpha = 1 - s.seat;
  if (view === "side") swingArm(ctx, x, y - 6, -arm * 0.09, sleeve, skin);
  else if (view === "front34" || view === "back34") { R(ctx, sleeve, x - 11, y - 6 + arm * 0.6, 4, 12); R(ctx, skin, x - 11, y + 5 + arm * 0.6, 4, 4); }
  else {
    R(ctx, sleeve, x - 12, y - 6 + arm, 4, 12); R(ctx, skin, x - 12, y + 5 + arm, 4, 4);
    if (!waving) { R(ctx, sleeve, x + 8, y - 6 - arm, 4, 12); R(ctx, skin, x + 8, y + 5 - arm, 4, 4); }
  }
  if (waving) swingArm(ctx, x + 9, y - 5, Math.PI - 0.5 + Math.sin(s.tick * 0.25) * 0.35, sleeve, skin, 11);
  // Ngồi gõ phím
  ctx.globalAlpha = s.seat;
  if (view === "front") {
    R(ctx, sleeve, x - 12, y - 6, 4, 8); R(ctx, sleeve, x + 8, y - 6, 4, 8);
    R(ctx, sleeve, x - 9, y - 1 + typing, 8, 3); R(ctx, sleeve, x + 1, y - 1 - typing, 8, 3);
    R(ctx, skin, x - 3, y - 1 + typing, 3, 3); R(ctx, skin, x + 1, y - 1 - typing, 3, 3);
  } else if (view === "front34") {
    R(ctx, sleeve, x - 11, y - 6, 4, 8);
    R(ctx, sleeve, x - 8, y - 1 + typing, 10, 3); R(ctx, skin, x + 2, y - 1 + typing, 3, 3);
    R(ctx, sleeve, x + 2, y - 2 - typing, 8, 3); R(ctx, skin, x + 9, y - 2 - typing, 3, 3);
  } else if (view === "side") {
    R(ctx, sleeve, x - 1, y - 6, 4, 8); R(ctx, sleeve, x + 1, y + typing, 10, 3); R(ctx, skin, x + 10, y - 1 + typing, 3, 3);
  } else {
    R(ctx, sleeve, x - 12, y - 6, 4, 8); R(ctx, sleeve, x - 12, y + 1 + typing, 4, 3);
    if (view === "back") { R(ctx, sleeve, x + 8, y - 6, 4, 8); R(ctx, sleeve, x + 8, y + 1 - typing, 4, 3); }
  }
  ctx.globalAlpha = 1;
}

function heldItem(ctx, s) {
  const { x, y, view, holding, tick } = s;
  if (!holding || holding === "wave" || view === "back" || view === "back34") return;
  const hx = view === "side" ? x + 6 : view === "front34" ? x + 7 : x + 9;
  if (holding === "cup") {
    const sip = Math.sin(tick * 0.09) > 0.82 ? -5 : 0;
    R(ctx, "#e9e4d8", hx, y - 1 + sip, 6, 7); R(ctx, "#5a3a22", hx + 1, y - 1 + sip, 4, 1);
  } else if (holding === "paper") {
    R(ctx, "#f7f7f0", hx - 1, y - 2, 9, 11);
    R(ctx, "#4fbf7f", hx + 1, y + 4, 5, 1); R(ctx, "#9aa3a0", hx + 1, y + 1, 5, 1); R(ctx, "#d5463a", hx + 1, y + 6, 3, 1);
  } else if (holding === "book") {
    R(ctx, "#4f7cac", view === "side" ? x + 3 : x - 6, y - 4, view === "side" ? 8 : 12, 9);
    R(ctx, "#f1f0e8", view === "side" ? x + 4 : x - 5, y - 3, view === "side" ? 6 : 10, 1);
  }
}

const HEADS = { front: headFront, front34: headFront34, side: headSide, back34: headBack34, back: headBack };

export function drawAgent(agent, p, tick) {
  const ctx = getContext();
  const L = LOOKS[agent.id];
  const [view, flip] = VIEWS[agent.facing] || VIEWS.S;
  const moving = agent.moving;
  const step = moving ? Math.sin(tick * 0.22) * 3 : 0;
  const working = agent.working;
  const arm = moving ? step * 0.9
    : agent.talking ? Math.sin(tick * 0.16) * 3.5
      : working ? Math.abs(Math.sin(tick * 0.4)) * 2 : Math.sin(tick * 0.08) * 1.2;

  ctx.save();
  ctx.translate(Math.round(p.x), Math.round(p.y));
  ctx.fillStyle = `rgba(0,0,0,${0.38 * (1 - agent.seatBlend * 0.5)})`;
  ctx.beginPath();
  ctx.ellipse(0, 0, 12, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.scale(flip ? -SCALE : SCALE, SCALE);

  const s = {
    x: 0,
    y: BODY_Y + (moving ? -Math.abs(Math.sin(tick * 0.22)) : Math.sin(tick * 0.04) * 0.5) + agent.seatBlend * 5 - agent.lift / SCALE,
    view, step, arm, tick, seat: agent.seatBlend, holding: agent.holding, talking: agent.talking,
    typing: working ? Math.abs(Math.sin(tick * 0.35)) * 1.5 : Math.sin(tick * 0.07) * 0.5,
    blink: (tick + Math.round(agent.animationSeed)) % 280 > 273,
    faceShadow: shade(L.skin, -0.22), faceLight: shade(L.skin, 0.12),
  };

  farArm(ctx, L, s);
  legs(ctx, L, s);
  torso(ctx, L, s);
  nearArms(ctx, L, s);
  const neck = view === "back" || view === "back34" ? shade(L.skin, -0.1) : L.skin;
  R(ctx, neck, view === "side" ? s.x - 2 : s.x - 3, s.y - 14, view === "side" ? 5 : 6, 7);
  HEADS[view](ctx, L, s);
  heldItem(ctx, s);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Bảng tên + bong bóng thoại
// ---------------------------------------------------------------------------
const ROLE_COLOR = { manager: "#d9b44a", analyst: "#b48ad6", quant: "#75d899", risk: "#e59a6b" };
export const roleColor = id => ROLE_COLOR[id];

function wrap(ctx, text, maxWidth, maxLines = 3) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].replace(/.{0,2}$/, "…"); }
  return lines;
}

// Đặt một hình chữ nhật nhãn sao cho không đè lên các nhãn đã vẽ (đẩy dần lên trên).
function place(taken, x0, y0, w, h) {
  let y = y0;
  for (let guard = 0; guard < 12; guard++) {
    const hit = taken.find(r => x0 < r.x + r.w && r.x < x0 + w && y < r.y + r.h && r.y < y + h);
    if (!hit) break;
    y = hit.y - h - 2;
  }
  taken.push({ x: x0, y, w, h });
  return y;
}

const FONT = "\"Segoe UI\", system-ui, sans-serif";

export function drawOverlay(agent, p, bubble, taken = []) {
  const ctx = getContext();
  const headTop = Math.round(p.y + (BODY_Y - 42) * SCALE + agent.seatBlend * 5 * SCALE - agent.lift);
  const x = Math.round(p.x);
  ctx.font = `bold 10px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const nameW = ctx.measureText(agent.name).width;
  const nameTop = place(taken, x - nameW / 2 - 6, headTop - 15, nameW + 12, 14);
  ctx.fillStyle = "rgba(5,14,9,.88)";
  ctx.beginPath();
  ctx.roundRect(x - nameW / 2 - 6, nameTop, nameW + 12, 14, 7);
  ctx.fill();
  ctx.fillStyle = ROLE_COLOR[agent.id];
  ctx.fillRect(x - nameW / 2 - 3, nameTop + 5, 4, 4);
  ctx.fillStyle = "#e6f3e6";
  ctx.fillText(agent.name, x + 3, nameTop + 10.5);

  if (!bubble) return;
  ctx.font = `600 10px ${FONT}`;
  // Lời nói (speech) được hiển thị trọn câu; bong bóng trạng thái thì gọn 3 dòng.
  const speech = bubble.tone === "speech";
  const lines = wrap(ctx, bubble.text, speech ? 170 : 140, speech ? 8 : 3);
  const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 14;
  const h = lines.length * 12 + 7;
  const top = place(taken, x - w / 2, nameTop - 5 - h, w, h + 4);
  ctx.fillStyle = bubble.tone === "error" ? "rgba(48,12,12,.96)" : bubble.tone === "speech" ? "rgba(250,250,240,.97)" : "rgba(7,18,12,.95)";
  ctx.strokeStyle = bubble.tone === "error" ? "#e0675a" : bubble.tone === "work" ? "#c5df76" : bubble.tone === "speech" ? "#c9cfc0" : "#75d899";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, top, w, h, 5);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 4, top + h);
  ctx.lineTo(x, top + h + 4);
  ctx.lineTo(x + 4, top + h);
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fill();
  ctx.fillStyle = bubble.tone === "speech" ? "#1d2620" : "#eef8ea";
  lines.forEach((l, i) => ctx.fillText(l, x, top + 12 + i * 12));
}
