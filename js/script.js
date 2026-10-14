// ===== Helpers =====
const KEYS = {
  tasks: "dashboard_tasks", links: "dashboard_links", name: "dashboard_name", theme: "dashboard_theme",
  timer: "dashboard_timer", stats: "dashboard_stats", notes: "dashboard_notes", active: "dashboard_active",
};
const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) k.includes("-") ? e.setAttribute(k, v) : (e[k] = v);
  e.append(...kids);
  return e;
};
const todayKey = (d = new Date()) => d.toLocaleDateString("sv-SE"); // YYYY-MM-DD (waktu lokal)

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}
function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    toast("Gagal menyimpan: penyimpanan browser penuh atau dinonaktifkan.");
  }
}

// ===== Toast (pengganti alert, bisa dengan tombol Urungkan) =====
let toastTimer;
function toast(msg, label, fn) {
  const t = $("toast");
  t.replaceChildren(el("span", { textContent: msg }));
  if (label) t.append(el("button", { className: "btn btn-small", textContent: label, onclick: () => { fn(); t.classList.remove("show"); } }));
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 5000);
}

// ===== Confetti =====
function confetti(x, y, n = 22) {
  const colors = ["#f59e0b", "#ef4444", "#10b981", "#3b82f6", "#a855f7"];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, d = 50 + Math.random() * 90;
    const p = el("i", { className: "confetti" });
    p.style.cssText = `left:${x}px;top:${y}px;background:${colors[i % 5]};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 40}px;--r:${Math.random() * 540}deg`;
    document.body.append(p);
    setTimeout(() => p.remove(), 950);
  }
}

// ===== Statistik harian =====
let stats = load(KEYS.stats, {});
function bump(field, n) {
  const s = stats[todayKey()] || (stats[todayKey()] = { pomos: 0, min: 0, done: 0 });
  s[field] = Math.max(0, s[field] + n);
  save(KEYS.stats, stats);
  renderStats();
}
function renderStats() {
  const s = stats[todayKey()] || { pomos: 0, min: 0, done: 0 };
  $("st-pomos").textContent = s.pomos;
  $("st-min").textContent = s.min;
  $("st-done").textContent = s.done;
  let streak = 0; const d0 = new Date();
  const active = (k) => { const x = stats[k] || {}; return x.done || x.pomos; };
  if (!active(todayKey())) d0.setDate(d0.getDate() - 1);
  while (active(todayKey(d0))) { streak++; d0.setDate(d0.getDate() - 1); }
  $("streak").textContent = streak ? `🔥 ${streak} hari beruntun` : "Selesaikan satu hal untuk mulai streak";
  const days = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d; });
  const vals = days.map((d) => (stats[todayKey(d)] || {}).min || 0);
  const max = Math.max(...vals, 25);
  $("chart").replaceChildren(...days.map((d, i) => el("div", { className: "bar-col", title: `${vals[i]} menit fokus` },
    el("div", { className: "bar", style: `height:${Math.max(4, (vals[i] / max) * 80)}%` }),
    el("span", { textContent: d.toLocaleDateString("id-ID", { weekday: "short" }) }))));
}

// ===== Sapaan, jam, nama =====
const QUOTES = [
  "Mulai dari yang kecil, asal hari ini bergerak.",
  "Satu tugas selesai lebih baik dari sepuluh tugas direncanakan.",
  "Fokus 25 menit, lalu istirahat. Sederhana, tapi bekerja.",
  "Progres kecil tiap hari menumpuk jadi hasil besar.",
  "Kerjakan yang paling penting dulu, sisanya menyusul.",
  "Istirahat bukan tanda malas, itu bagian dari kerja.",
  "Tidak perlu sempurna, yang penting selesai dan diperbaiki.",
];
let userName = load(KEYS.name, "");
const nameForm = $("name-form"), nameInput = $("name-input");

function periodOf(h) {
  if (h < 4) return "malam";
  if (h < 11) return "pagi";
  if (h < 15) return "siang";
  if (h < 18) return "sore";
  return "malam";
}
function updateClock() {
  const now = new Date(), p = periodOf(now.getHours());
  $("clock").textContent = now.toLocaleTimeString("en-GB");
  $("date").textContent = now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  $("greeting-text").textContent = `Selamat ${p}${userName ? ", " + userName : ""}`;
  document.body.dataset.period = p;
}
function syncNameUI() {
  $("name-btn").textContent = userName ? "Ubah nama" : "Tambah nama";
  updateClock();
}
$("name-btn").addEventListener("click", () => {
  nameForm.hidden = !nameForm.hidden;
  if (!nameForm.hidden) { nameInput.value = userName; nameInput.focus(); }
});
nameForm.addEventListener("submit", (e) => {
  e.preventDefault();
  userName = nameInput.value.trim();
  save(KEYS.name, userName);
  nameForm.hidden = true;
  syncNameUI();
});
const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 864e5);
let qi = dayOfYear;
const showQuote = () => ($("quote").textContent = QUOTES[qi % QUOTES.length]);
$("quote").title = "Klik untuk kutipan lain";
$("quote").addEventListener("click", () => { qi++; showQuote(); });
showQuote();
syncNameUI();
setInterval(updateClock, 1000);

// ===== Timer fokus (berbasis timestamp: akurat & tahan refresh) =====
const MODES = { focus: { label: "Fokus", min: 25 }, short: { label: "Istirahat", min: 5 }, long: { label: "Istirahat panjang", min: 15 } };
let tm = load(KEYS.timer, null);
if (!tm || !MODES[tm.mode]) tm = { mode: "focus", left: 1500, endAt: null };
let loop = null;

const secLeft = () => (tm.endAt ? Math.max(0, Math.round((tm.endAt - Date.now()) / 1000)) : tm.left);

function renderTimer() {
  const s = secLeft(), total = tm.total || MODES[tm.mode].min * 60;
  const txt = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  $("timer").textContent = txt;
  document.body.classList.toggle("running", !!tm.endAt);
  document.body.dataset.mode = tm.mode;
  $("ring").style.strokeDashoffset = 339.3 * (1 - s / total);
  $("timer-start").textContent = tm.endAt ? "Jeda" : s < total ? "Lanjut" : "Mulai";
  document.title = tm.endAt ? `${txt} · ${MODES[tm.mode].label}` : "Life Dashboard";
  document.querySelectorAll("[data-mode]").forEach((b) => b.classList.toggle("on", b.dataset.mode === tm.mode));
}
function startLoop() {
  clearInterval(loop);
  loop = setInterval(() => { if (secLeft() <= 0) finishTimer(); renderTimer(); }, 250);
}
function toggleTimer() {
  if (tm.endAt) {
    tm.left = secLeft(); tm.endAt = null;
    clearInterval(loop); loop = null;
  } else {
    if (secLeft() <= 0) tm.left = MODES[tm.mode].min * 60;
    tm.endAt = Date.now() + tm.left * 1000;
    startLoop();
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
  }
  save(KEYS.timer, tm);
  renderTimer();
}
function setMode(m) {
  clearInterval(loop); loop = null;
  tm = { mode: m, left: MODES[m].min * 60, total: MODES[m].min * 60, endAt: null };
  save(KEYS.timer, tm);
  renderTimer();
}
function beep() {
  try {
    const c = new AudioContext(), o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination); o.frequency.value = 880;
    g.gain.setValueAtTime(0.2, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 1);
    o.start(); o.stop(c.currentTime + 1);
  } catch (e) { /* audio tidak tersedia */ }
}
function finishTimer() {
  const was = tm.mode;
  if (was === "focus") {
    bump("pomos", 1); bump("min", Math.round((tm.total || 1500) / 60));
    const t = tasks.find((x) => x.id === activeId);
    if (t) { t.pomos++; saveTasks(); renderTasks(); }
  }
  const n = (stats[todayKey()] || {}).pomos || 0;
  const next = was === "focus" ? (n % 4 === 0 ? "long" : "short") : "focus";
  setMode(next);
  beep();
  if (was === "focus") confetti(innerWidth / 2, innerHeight / 3, 50);
  const msg = was === "focus" ? `Sesi fokus selesai. Istirahat ${MODES[next].min} menit.` : "Istirahat selesai. Siap fokus lagi?";
  toast(msg);
  if ("Notification" in window && Notification.permission === "granted") new Notification("Life Dashboard", { body: msg });
}
$("timer-start").addEventListener("click", toggleTimer);
function adjust(min) {
  const s = secLeft() + min * 60;
  if (s < 60 || s > 7200) return;
  tm.total = (tm.total || MODES[tm.mode].min * 60) + min * 60;
  if (tm.endAt) tm.endAt += min * 60000; else tm.left = s;
  save(KEYS.timer, tm); renderTimer();
}
$("t-minus").addEventListener("click", () => adjust(-5));
$("t-plus").addEventListener("click", () => adjust(5));
$("focus-mode").addEventListener("click", () => document.body.classList.toggle("zen"));
$("timer-reset").addEventListener("click", () => setMode(tm.mode));
$("modes").addEventListener("click", (e) => { if (e.target.dataset.mode) setMode(e.target.dataset.mode); });

// ===== Tugas =====
let tasks = load(KEYS.tasks, []);
if (!Array.isArray(tasks)) tasks = [];
tasks.forEach((t) => { t.pri = t.pri || "m"; t.due = t.due || ""; t.pomos = t.pomos || 0; }); // migrasi data lama
let query = "", newId = null, filter = "all", editingId = null, dragId = null, activeId = load(KEYS.active, null);
const PRI = { h: "Tinggi", m: "Sedang", l: "Rendah" };

const saveTasks = () => save(KEYS.tasks, tasks);
const setError = (m) => ($("task-error").textContent = m);
const isDuplicate = (text, ignoreId = null) => {
  const x = text.trim().toLowerCase();
  return tasks.some((t) => t.id !== ignoreId && t.text.trim().toLowerCase() === x);
};
function dueInfo(due) {
  if (!due) return null;
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const label = due === todayKey() ? "Hari ini" : due === todayKey(tomorrow) ? "Besok"
    : new Date(due + "T00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  return { label, late: due < todayKey() };
}
const iconBtn = (sym, label, fn) => el("button", { className: "icon-btn", type: "button", textContent: sym, title: label, "aria-label": label, onclick: fn });

function setActive(id) {
  activeId = id;
  save(KEYS.active, id);
  renderActive();
  renderTasks();
}
function renderActive() {
  const t = tasks.find((x) => x.id === activeId);
  $("timer-task").textContent = t ? `Fokus pada: ${t.text}` : "Klik 🎯 pada tugas untuk mengaitkannya ke timer";
}
function removeTask(id) {
  const idx = tasks.findIndex((t) => t.id === id);
  const [removed] = tasks.splice(idx, 1);
  if (activeId === id) setActive(null);
  saveTasks(); renderTasks();
  toast("Tugas dihapus", "Urungkan", () => { tasks.splice(Math.min(idx, tasks.length), 0, removed); saveTasks(); renderTasks(); });
}
function moveTask(from, to) {
  if (from == null || from === to) return;
  const fi = tasks.findIndex((t) => t.id === from), ti = tasks.findIndex((t) => t.id === to);
  if (fi < 0 || ti < 0) return;
  const [m] = tasks.splice(fi, 1);
  tasks.splice(ti, 0, m);
  saveTasks(); renderTasks();
}

function taskRow(task) {
  const li = el("li", { className: "task" + (task.done ? " done" : "") + (task.id === activeId ? " active" : "") + (task.id === newId ? " enter" : ""), draggable: editingId !== task.id });
  li.dataset.pri = task.pri;
  li.addEventListener("dragstart", (e) => { dragId = task.id; e.dataTransfer.effectAllowed = "move"; li.classList.add("dragging"); });
  li.addEventListener("dragend", () => li.classList.remove("dragging"));
  li.addEventListener("dragover", (e) => e.preventDefault());
  li.addEventListener("drop", (e) => { e.preventDefault(); moveTask(dragId, task.id); });

  const cb = el("input", { type: "checkbox", checked: task.done, "aria-label": `Tandai selesai: ${task.text}` });
  cb.addEventListener("change", () => {
    const r = cb.getBoundingClientRect();
    task.done = cb.checked;
    if (task.done) confetti(r.left + 10, r.top + 10);
    bump("done", task.done ? 1 : -1);
    saveTasks(); renderTasks();
    if (task.done && tasks.every((t) => t.done)) { toast("Semua tugas selesai. Kerja bagus! 🎉"); confetti(innerWidth / 2, innerHeight / 3, 70); }
  });

  if (editingId === task.id) {
    const inp = el("input", { type: "text", className: "grow", value: task.text, maxLength: 100, "aria-label": "Edit tugas" });
    const commit = () => {
      const v = inp.value.trim();
      if (!v) return;
      if (isDuplicate(v, task.id)) return setError("Tugas dengan nama itu sudah ada.");
      task.text = v; editingId = null; setError("");
      saveTasks(); renderTasks(); renderActive();
    };
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") commit();
      if (e.key === "Escape") { editingId = null; setError(""); renderTasks(); }
    });
    li.append(cb, inp, el("button", { className: "btn btn-primary btn-small", type: "button", textContent: "Simpan", onclick: commit }));
    setTimeout(() => inp.focus(), 0);
    return li;
  }

  const due = dueInfo(task.due);
  const meta = el("div", { className: "meta" }, el("button", { className: "chip pri-" + task.pri, type: "button", textContent: PRI[task.pri], title: "Klik untuk ganti prioritas", onclick: () => { task.pri = { h: "m", m: "l", l: "h" }[task.pri]; saveTasks(); renderTasks(); } }));
  if (due) meta.append(el("span", { className: "chip" + (due.late && !task.done ? " late" : ""), textContent: "📅 " + due.label }));
  if (task.pomos) meta.append(el("span", { className: "chip", textContent: "🍅 " + task.pomos }));
  const edit = () => { editingId = task.id; setError(""); renderTasks(); };
  const body = el("div", { className: "grow" }, el("span", { className: "task-text", textContent: task.text, ondblclick: edit }), meta);
  const isActive = task.id === activeId;
  li.append(cb, body, el("div", { className: "actions" },
    iconBtn("🎯", isActive ? "Lepas dari timer" : "Fokus pada tugas ini", () => setActive(isActive ? null : task.id)),
    iconBtn("✎", "Edit tugas", edit),
    iconBtn("🗑", "Hapus tugas", () => { li.classList.add("leaving"); setTimeout(() => removeTask(task.id), 200); })));
  return li;
}

function renderTasks() {
  const shown = tasks.filter((t) => (filter === "all" || (filter === "done") === t.done) && t.text.toLowerCase().includes(query));
  const done = tasks.filter((t) => t.done).length;
  $("task-count").textContent = tasks.length ? `${done} dari ${tasks.length} selesai` : "";
  $("progress-bar").style.width = tasks.length ? `${(done / tasks.length) * 100}%` : "0%";
  $("clear-done").hidden = !done;
  $("task-list").replaceChildren(...(shown.length ? shown.map(taskRow) : [el("li", {
    className: "empty",
    textContent: tasks.length ? "Tidak ada tugas yang cocok." : "Belum ada tugas. Tulis yang pertama di atas, atau tekan / untuk mulai mengetik.",
  })]));
  newId = null;
}

function parseQuick(raw) {
  let text = " " + raw, pri = null, due = null;
  const p = text.match(/\s!(tinggi|sedang|rendah)\b/i);
  if (p) { pri = { t: "h", s: "m", r: "l" }[p[1][0].toLowerCase()]; text = text.replace(p[0], ""); }
  const d = text.match(/\s(hari ini|besok|lusa)\b/i);
  if (d) {
    const dt = new Date(); dt.setDate(dt.getDate() + { "hari ini": 0, besok: 1, lusa: 2 }[d[1].toLowerCase()]);
    due = todayKey(dt); text = text.replace(d[0], "");
  }
  return { text: text.trim(), pri, due };
}
$("task-search").addEventListener("input", (e) => { query = e.target.value.trim().toLowerCase(); renderTasks(); });

$("task-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = parseQuick($("task-input").value.trim()), text = q.text;
  if (!text) return;
  if (isDuplicate(text)) return setError("Tugas dengan nama itu sudah ada.");
  newId = Date.now();
  tasks.push({ id: newId, text, done: false, pri: q.pri || $("task-pri").value, due: q.due || $("task-due").value, pomos: 0 });
  setError("");
  $("task-input").value = ""; $("task-due").value = "";
  saveTasks(); renderTasks();
  $("task-input").focus();
});
$("task-input").addEventListener("input", () => setError(""));
$("filters").addEventListener("click", (e) => {
  if (!e.target.dataset.filter) return;
  filter = e.target.dataset.filter;
  document.querySelectorAll("#filters button").forEach((b) => b.classList.toggle("on", b === e.target));
  renderTasks();
});
$("clear-done").addEventListener("click", () => {
  const removed = tasks.filter((t) => t.done);
  tasks = tasks.filter((t) => !t.done);
  saveTasks(); renderTasks();
  toast(`${removed.length} tugas selesai dihapus`, "Urungkan", () => { tasks = tasks.concat(removed); saveTasks(); renderTasks(); });
});

// ===== Link cepat =====
const defaultLinks = [
  { id: 1, name: "Google", url: "https://www.google.com" },
  { id: 2, name: "Gmail", url: "https://mail.google.com" },
  { id: 3, name: "Calendar", url: "https://calendar.google.com" },
];
let links = load(KEYS.links, defaultLinks);
if (!Array.isArray(links)) links = defaultLinks;

const hostOf = (u) => { try { return new URL(u).hostname; } catch (e) { return ""; } };

function renderLinks() {
  $("link-list").replaceChildren(...links.map((l) => {
    const icon = el("img", { src: `https://www.google.com/s2/favicons?domain=${hostOf(l.url)}&sz=64`, alt: "", width: 20, height: 20, onerror: (e) => e.target.remove() });
    const a = el("a", { className: "link-btn", href: l.url, target: "_blank", rel: "noopener noreferrer" }, icon, el("span", { textContent: l.name }));
    const remove = el("button", { className: "link-remove", type: "button", textContent: "×", "aria-label": `Hapus ${l.name}` });
    remove.addEventListener("click", () => {
      const idx = links.findIndex((x) => x.id === l.id);
      links.splice(idx, 1);
      save(KEYS.links, links); renderLinks();
      toast(`Link ${l.name} dihapus`, "Urungkan", () => { links.splice(Math.min(idx, links.length), 0, l); save(KEYS.links, links); renderLinks(); });
    });
    return el("div", { className: "link-item" }, a, remove);
  }));
}
$("link-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("link-name").value.trim();
  let url = $("link-url").value.trim();
  if (!name || !url) return;
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  let parsed;
  try { parsed = new URL(url); } catch (err) { return toast("URL tidak valid. Contoh: github.com"); }
  if (!/^https?:$/.test(parsed.protocol) || !parsed.hostname.includes(".")) return toast("URL tidak valid. Contoh: github.com");
  links.push({ id: Date.now(), name, url });
  save(KEYS.links, links);
  $("link-name").value = ""; $("link-url").value = "";
  renderLinks();
});

// ===== Catatan cepat =====
const notesEl = $("notes");
let noteTimer;
notesEl.value = load(KEYS.notes, "");
notesEl.addEventListener("input", () => {
  $("note-status").textContent = "Menyimpan…";
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => { save(KEYS.notes, notesEl.value); $("note-status").textContent = "Tersimpan"; }, 400);
});

// ===== Tema terang / gelap =====
let theme = load(KEYS.theme, window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
function applyTheme() {
  document.documentElement.setAttribute("data-theme", theme);
  $("theme-toggle").textContent = theme === "dark" ? "☀️" : "🌙";
}
$("theme-toggle").addEventListener("click", () => { theme = theme === "dark" ? "light" : "dark"; save(KEYS.theme, theme); applyTheme(); });
applyTheme();

// ===== Ekspor / impor data =====
$("export").addEventListener("click", () => {
  const data = {};
  for (const [k, v] of Object.entries(KEYS)) data[k] = load(v, null);
  const a = el("a", { href: URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })), download: `dashboard-${todayKey()}.json` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast("Data diekspor ke file JSON");
});
$("import").addEventListener("click", () => $("import-file").click());
$("import-file").addEventListener("change", (e) => {
  const f = e.target.files[0];
  if (!f) return;
  f.text().then((txt) => {
    const d = JSON.parse(txt);
    for (const [k, v] of Object.entries(KEYS)) if (d[k] !== undefined && d[k] !== null) save(v, d[k]);
    location.reload();
  }).catch(() => toast("File tidak valid. Pilih file hasil ekspor dari dashboard ini."));
});

// ===== Pintasan keyboard =====
document.addEventListener("keydown", (e) => {
  if (e.target.matches("input, textarea, select") || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === "/") { e.preventDefault(); $("task-input").focus(); }
  if (e.key === "s") toggleTimer();
  if (e.key === "d") $("theme-toggle").click();
  if (e.key === "f") document.body.classList.toggle("zen");
  if (e.key === "Escape") document.body.classList.remove("zen");
});

// ===== Init =====
renderTasks(); renderActive(); renderLinks(); renderTimer(); renderStats();
if (tm.endAt) startLoop();
