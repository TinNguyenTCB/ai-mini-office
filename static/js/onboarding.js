// Màn chào lần đầu + Đơn cam kết (ký tên, đóng mộc đỏ).

import { applyI18n, setLang, t } from "./i18n.js";

const $ = id => document.getElementById(id);
const CLIENT_KEY = "ai-office-client";
const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
export const delay = ms => new Promise(r => setTimeout(r, ms));

export function loadClient() {
  try {
    const c = JSON.parse(localStorage.getItem(CLIENT_KEY) || "null");
    return c && typeof c.name === "string" && c.name.trim() ? c : null;
  } catch { return null; }
}
export function saveClient(client) {
  try { localStorage.setItem(CLIENT_KEY, JSON.stringify(client)); return true; } catch { return false; }
}
export function clearClient() {
  try { localStorage.removeItem(CLIENT_KEY); } catch { /* bỏ qua */ }
}

// ---------------------------------------------------------------------------
// Màn chào: logo vẽ dần + tên công ty + lời chào. Trả về khi màn chào đã tắt.
// ---------------------------------------------------------------------------
export function playIntro() {
  return new Promise(resolve => {
    const el = $("intro");
    el.hidden = false;
    el.classList.remove("leaving");
    // Khởi động lại animation CSS khi xem lại.
    el.querySelectorAll("*").forEach(n => { n.style.animation = "none"; void n.getBoundingClientRect(); n.style.animation = ""; });
    let done = false;
    const finish = async () => {
      if (done) return;
      done = true;
      el.classList.add("leaving");
      await delay(900);
      el.hidden = true;
      resolve();
    };
    applyI18n(el);
    el.querySelectorAll("[data-lang]").forEach(btn => { btn.onclick = () => setLang(btn.dataset.lang); });
    $("introEnter").onclick = finish;
    const onKey = e => { if (e.key === "Enter" && !el.hidden) { document.removeEventListener("keydown", onKey); finish(); } };
    document.addEventListener("keydown", onKey);
    setTimeout(() => $("introEnter").focus({ preventScroll: true }), reduceMotion() ? 200 : 2600);
  });
}

// ---------------------------------------------------------------------------
// Đơn cam kết
// ---------------------------------------------------------------------------
const newDocNo = d => `${t("pledge.no")} MC-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;

function cleanName(raw) {
  return raw.replace(/\s+/g, " ").trim();
}

// Tiếng "cộp" khi đóng dấu – tạo bằng WebAudio, không cần file âm thanh.
function thud() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(150, ac.currentTime);
    o.frequency.exponentialRampToValueAtTime(42, ac.currentTime + 0.18);
    g.gain.setValueAtTime(0.4, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.28);
    o.connect(g).connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + 0.3);
    setTimeout(() => ac.close(), 500);
  } catch { /* trình duyệt không hỗ trợ âm thanh – bỏ qua */ }
}

/**
 * mode "sign": bắt buộc ký (lần đầu). mode "resign": ký lại, có nút Huỷ. mode "view": xem đơn đã ký.
 * Trả về Promise<client | null>.
 */
export function openPledge({ mode = "sign", client = null } = {}) {
  const modal = $("pledge"), paper = $("pledgeForm"), stamp = $("stamp");
  const sig = $("clientSignature"), printed = $("clientPrinted");
  const nameInput = $("clientName"), agree = $("pledgeAgree"), error = $("pledgeError");
  const submit = $("pledgeSubmit"), close = $("pledgeClose");

  const when = client ? new Date(client.signedAt) : new Date();
  $("pledgeNo").textContent = client?.docNo || newDocNo(when);
  $("pledgeDate").textContent = t("pledge.date", when);
  paper.classList.remove("leaving", "thud");
  stamp.classList.remove("stamped", "static");
  sig.classList.remove("written");
  error.textContent = "";
  modal.hidden = false;

  if (mode === "view") {
    $("pledgeFields").hidden = true;
    sig.textContent = client.name;
    printed.textContent = client.name;
    sig.style.transition = "none";
    sig.classList.add("written");
    requestAnimationFrame(() => { sig.style.transition = ""; });
    stamp.classList.add("static");
    submit.hidden = true;
    close.hidden = false;
    close.textContent = t("pledge.close");
  } else {
    $("pledgeFields").hidden = false;
    nameInput.value = "";
    nameInput.disabled = false;
    agree.checked = false;
    agree.disabled = false;
    sig.textContent = "";
    printed.textContent = "";
    submit.hidden = false;
    submit.disabled = false;
    close.hidden = mode !== "resign";
    close.textContent = t("pledge.cancel");
    setTimeout(() => nameInput.focus(), 350);
  }

  return new Promise(resolve => {
    const hide = async result => {
      paper.classList.remove("thud");
      paper.classList.add("leaving");
      await delay(550);
      modal.hidden = true;
      paper.onsubmit = null;
      close.onclick = null;
      document.removeEventListener("keydown", onKey);
      resolve(result);
    };
    const onKey = e => { if (e.key === "Escape" && !close.hidden) hide(null); };
    document.addEventListener("keydown", onKey);
    close.onclick = () => hide(null);

    paper.onsubmit = async event => {
      event.preventDefault();
      const name = cleanName(nameInput.value);
      if (name.length < 2 || !/\p{L}/u.test(name)) { error.textContent = t("pledge.errName"); nameInput.focus(); return; }
      if (!agree.checked) { error.textContent = t("pledge.errAgree"); agree.focus(); return; }
      error.textContent = "";
      submit.disabled = true;
      nameInput.disabled = true;
      agree.disabled = true;
      close.hidden = true;

      // 1) Ký tên – chữ ký hiện dần theo nét
      sig.textContent = name;
      printed.textContent = name;
      void sig.getBoundingClientRect();
      sig.classList.add("written");
      await delay(reduceMotion() ? 200 : 1300);
      // 2) Đóng mộc đỏ
      stamp.classList.add("stamped");
      await delay(260);
      thud();
      paper.classList.add("thud");
      await delay(1400);

      const signed = { name, signedAt: new Date().toISOString(), docNo: $("pledgeNo").textContent };
      saveClient(signed);
      hide(signed);
    };
  });
}
