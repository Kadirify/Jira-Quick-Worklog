// Goruntuleme katmani. Sadece DOM uretir; state ve geri-cagrim (handler) alir.
// API/chrome/storage bilmez — boylece store'dan tamamen ayrik.

import { secToHuman, formatDateLabel, parseDuration, todayStr } from "../lib/format.js";
import type { PopupState } from "./store.js";
import type { JiraIssue, WorklogEntry } from "../lib/types.js";

export interface RenderHandlers {
  onLog: (issueKey: string, seconds: number, comment?: string) => void;
  onDelete: (entry: WorklogEntry) => void;
  onToggleFav: (key: string) => void;
  onPickDate: (dateStr: string) => void;
}

const PRESETS: ReadonlyArray<{ label: string; sec: number }> = [
  { label: "15dk", sec: 900 },
  { label: "30dk", sec: 1800 },
  { label: "1sa", sec: 3600 },
  { label: "2sa", sec: 7200 },
  { label: "4sa", sec: 14400 },
];

// ---- Kucuk DOM yardimcisi ----
type Attrs = Record<string, unknown>;
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: Array<Node | string | null> = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined) continue;
    if (k === "class") node.className = String(v);
    else if (k === "text") node.textContent = String(v);
    else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2), v as EventListener);
    } else node.setAttribute(k, String(v));
  }
  for (const c of children) if (c !== null) node.append(c);
  return node;
}

const $ = (id: string): HTMLElement => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`#${id} bulunamadı`);
  return node;
};

// ---- Ana render ----
export function renderApp(state: PopupState, handlers: RenderHandlers): void {
  wireCalendar(handlers);
  renderAccounts(state);
  $("dateLabel").textContent = formatDateLabel(state.date);
  renderProgress(state);
  renderWeek(state, handlers);
  renderIssues(state, handlers);
  renderEntries(state, handlers);
  refreshCalendar(state);
}

const DAY_NAMES = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"] as const;

/** Haftalik mini grafik: gunluk toplamlar, tiklayinca o gune gider. */
function renderWeek(state: PopupState, handlers: RenderHandlers): void {
  const bar = $("weekBar");
  bar.innerHTML = "";
  const target = state.settings.dailyTargetHours * 3600;
  const today = todayStr();

  state.weekDays.forEach((day, i) => {
    const sec = state.weekTotals[day] ?? 0;
    const pct = target ? Math.min(100, (sec / target) * 100) : 0;
    const fill = el("div", { class: "wd-fill" + (sec >= target ? " full" : "") });
    fill.style.height = pct + "%";

    const cls =
      "wd" +
      (day === state.date ? " sel" : "") +
      (day === today ? " today" : "") +
      (day > today ? " future" : "");
    bar.append(
      el("button", {
        class: cls,
        title: `${DAY_NAMES[i]} · ${secToHuman(sec)}`,
        onclick: () => handlers.onPickDate(day),
      }, [
        el("div", { class: "wd-track" }, [fill]),
        el("span", { class: "wd-name", text: DAY_NAMES[i] ?? "" }),
      ]),
    );
  });
}

function renderAccounts(state: PopupState): void {
  const sel = $("accountSelect") as HTMLSelectElement;
  sel.innerHTML = "";
  for (const a of state.accounts) sel.append(el("option", { value: a.id, text: a.label }));
  sel.value = state.activeAccountId;
  const who = state.me
    ? `${state.me.displayName}${state.me.emailAddress ? " · " + state.me.emailAddress : ""}`
    : "";
  sel.title = who ? `Aktif: ${who}` : "Aktif hesap";
}

function renderProgress(state: PopupState): void {
  const target = state.settings.dailyTargetHours * 3600;
  const pct = Math.min(100, (state.totalSec / target) * 100);
  const fill = $("progressFill");
  fill.style.width = pct + "%";
  fill.classList.toggle("over", state.totalSec >= target);
  $("loggedText").textContent = secToHuman(state.totalSec) + " girildi";
  const remain = target - state.totalSec;
  $("remainText").textContent =
    remain > 0 ? `Hedefe ${secToHuman(remain)} kaldı`
    : remain === 0 ? "Hedef tamam ✓"
    : `Hedef +${secToHuman(-remain)} aşıldı`;
}

function displayedIssues(state: PopupState): JiraIssue[] {
  if (state.searchResults) return state.searchResults;
  const seen = new Set<string>();
  const out: JiraIssue[] = [];
  // Oncelik: favoriler > son loglananlar > JQL listesi (tekrarlar elenir).
  for (const i of [...state.favIssues, ...state.recent, ...state.assigned]) {
    if (seen.has(i.key)) continue;
    seen.add(i.key);
    out.push(i);
  }
  return out;
}

function renderIssues(state: PopupState, handlers: RenderHandlers): void {
  const list = $("issueList");
  list.innerHTML = "";
  const issues = displayedIssues(state);
  $("emptyIssues").classList.toggle("hidden", issues.length > 0);

  const target = state.settings.dailyTargetHours * 3600;
  const remain = Math.max(0, target - state.totalSec);

  for (const issue of issues) {
    list.append(renderIssueCard(issue, state, remain, handlers));
  }
}

function renderIssueCard(
  issue: JiraIssue,
  state: PopupState,
  remain: number,
  handlers: RenderHandlers,
): HTMLElement {
  const key = issue.key;
  const isFav = state.favorites.includes(key);
  const loggedSec = state.loggedByIssue[key] ?? 0;

  const top = el("div", { class: "issue-top" }, [
    el("button", {
      class: "star" + (isFav ? " on" : ""),
      title: isFav ? "Favoriden çıkar" : "Favoriye ekle",
      text: isFav ? "★" : "☆",
      onclick: () => handlers.onToggleFav(key),
    }),
    el("span", { class: "issue-key", text: key }),
    el("span", { class: "issue-sum", text: issue.fields.summary }),
    el("span", {
      class: "issue-logged" + (loggedSec ? " show" : ""),
      text: secToHuman(loggedSec),
    }),
  ]);

  const summary = issue.fields.summary;
  // Ayara gore: aciklama penceresi ac ya da dogrudan kaydet.
  const log = (seconds: number, label: string): void => {
    if (state.settings.askComment) openLogDialog(key, summary, seconds, label, handlers.onLog);
    else handlers.onLog(key, seconds);
  };

  const chips = el("div", { class: "chips" });
  for (const p of PRESETS) {
    chips.append(el("button", { class: "chip", text: p.label, onclick: () => log(p.sec, p.label) }));
  }
  if (remain > 0) {
    const remainLabel = "Kalan " + secToHuman(remain);
    chips.append(
      el("button", {
        class: "chip remain",
        text: remainLabel,
        title: "Günlük hedefe kalanı bu işe ekle",
        onclick: () => log(remain, remainLabel),
      }),
    );
  }
  const custom = renderCustomRow(key, handlers);
  chips.append(
    el("button", {
      class: "chip more",
      text: "⋯",
      title: "Özel süre / not",
      onclick: () => custom.classList.toggle("open"),
    }),
  );

  return el("div", { class: "issue" }, [top, chips, custom]);
}

function renderCustomRow(key: string, handlers: RenderHandlers): HTMLElement {
  const amount = el("input", { class: "amount", type: "text", placeholder: "1.5 / 90m" });
  const note = el("input", { class: "note", type: "text", placeholder: "Not (opsiyonel)" });
  const add = el("button", { type: "button", text: "Ekle" });

  const submit = (): void => {
    const seconds = parseDuration(amount.value);
    if (!seconds) {
      amount.focus();
      return;
    }
    handlers.onLog(key, seconds, note.value || undefined);
    amount.value = "";
    note.value = "";
  };

  add.addEventListener("click", submit);
  const onEnter = (e: Event): void => { if ((e as KeyboardEvent).key === "Enter") submit(); };
  amount.addEventListener("keydown", onEnter);
  note.addEventListener("keydown", onEnter);

  return el("div", { class: "custom" }, [amount, note, add]);
}

function renderEntries(state: PopupState, handlers: RenderHandlers): void {
  $("entriesCount").textContent = String(state.todays.length);
  const body = $("entriesBody");
  body.innerHTML = "";
  if (!state.todays.length) {
    body.append(el("div", { class: "entries-empty", text: "Bu güne henüz kayıt yok." }));
    return;
  }
  for (const w of state.todays) {
    body.append(
      el("div", { class: "entry" }, [
        el("span", { class: "entry-key", text: w.issueKey }),
        el("span", { class: "entry-sum", text: w.summary || state.summaries[w.issueKey] || "" }),
        el("span", { class: "entry-time", text: secToHuman(w.timeSpentSeconds) }),
        el("button", { class: "entry-del", text: "✕", title: "Sil", onclick: () => handlers.onDelete(w) }),
      ]),
    );
  }
}

// ---- Takvim (ay secici) ----
// Tarih etiketine tiklaninca acilir: secilen ayin gunlerini gosterir, herhangi
// bir gune tiklayinca o gune gidilir. Gorulen ay, secili gunden bagimsiz olarak
// yerel modul durumunda tutulur (store'u ilgilendirmez).
let calWired = false;
let calOpen = false;
let calViewYear = 0;
let calViewMonth = 0; // 0-11
let calState: PopupState | null = null;
let calHandlers: RenderHandlers | null = null;

function closeCalendar(): void {
  calOpen = false;
  $("calendar").classList.add("hidden");
}

function openCalendar(state: PopupState): void {
  const d = new Date(state.date + "T12:00:00");
  calViewYear = d.getFullYear();
  calViewMonth = d.getMonth();
  calOpen = true;
  $("calendar").classList.remove("hidden");
  renderCalendarGrid(state);
}

function wireCalendar(handlers: RenderHandlers): void {
  calHandlers = handlers;
  if (calWired) return;
  calWired = true;

  const weekdays = $("calWeekdays");
  for (const n of DAY_NAMES) weekdays.append(el("span", { text: n }));

  $("dateLabel").addEventListener("click", (e) => {
    e.stopPropagation();
    if (!calState) return;
    if (calOpen) closeCalendar();
    else openCalendar(calState);
  });
  $("calPrevMonth").addEventListener("click", (e) => {
    e.stopPropagation();
    calViewMonth -= 1;
    if (calViewMonth < 0) { calViewMonth = 11; calViewYear -= 1; }
    if (calState) renderCalendarGrid(calState);
  });
  $("calNextMonth").addEventListener("click", (e) => {
    e.stopPropagation();
    calViewMonth += 1;
    if (calViewMonth > 11) { calViewMonth = 0; calViewYear += 1; }
    if (calState) renderCalendarGrid(calState);
  });
  $("calToday").addEventListener("click", (e) => {
    e.stopPropagation();
    closeCalendar();
    calHandlers?.onPickDate(todayStr());
  });
  document.addEventListener("click", (e) => {
    if (!calOpen) return;
    const cal = $("calendar");
    if (cal.contains(e.target as Node)) return;
    closeCalendar();
  });
}

function renderCalendarGrid(state: PopupState): void {
  $("calMonthLabel").textContent = new Date(calViewYear, calViewMonth, 1).toLocaleDateString(
    "tr-TR",
    { month: "long", year: "numeric" },
  );

  const grid = $("calGrid");
  grid.innerHTML = "";
  const p = (n: number) => String(n).padStart(2, "0");
  const firstDay = new Date(calViewYear, calViewMonth, 1);
  const leading = (firstDay.getDay() + 6) % 7; // haftanin pazartesisine gore kaydirma
  const daysInMonth = new Date(calViewYear, calViewMonth + 1, 0).getDate();
  const today = todayStr();

  for (let i = 0; i < leading; i++) {
    grid.append(el("button", { class: "cal-day other", disabled: "true" }));
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${calViewYear}-${p(calViewMonth + 1)}-${p(day)}`;
    const cls =
      "cal-day" + (dateStr === today ? " today" : "") + (dateStr === state.date ? " sel" : "");
    grid.append(
      el("button", {
        class: cls,
        text: String(day),
        onclick: () => {
          closeCalendar();
          calHandlers?.onPickDate(dateStr);
        },
      }),
    );
  }
}

function refreshCalendar(state: PopupState): void {
  calState = state;
  if (calOpen) renderCalendarGrid(state);
}

// ---- Worklog onay penceresi (modal) ----
// Sure cipine basilinca acilir: madde + secilen sure gosterilir, opsiyonel
// aciklama alinir. "Kaydet" ile onaylanir, bos birakilabilir.
type LogFn = (issueKey: string, seconds: number, comment?: string) => void;
let modalWired = false;
let onConfirm: ((comment: string) => void) | null = null;

function closeLogDialog(): void {
  $("logModal").classList.add("hidden");
  onConfirm = null;
}

function wireLogDialog(): void {
  if (modalWired) return;
  modalWired = true;
  const overlay = $("logModal");
  const comment = $("lmComment") as HTMLTextAreaElement;

  const save = (): void => {
    const fn = onConfirm;
    if (!fn) return;
    const text = comment.value.trim();
    closeLogDialog();
    fn(text);
  };

  $("lmSave").addEventListener("click", save);
  $("lmCancel").addEventListener("click", closeLogDialog);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeLogDialog(); });
  comment.addEventListener("keydown", (e) => {
    const ke = e as KeyboardEvent;
    if (ke.key === "Enter" && (ke.metaKey || ke.ctrlKey)) { e.preventDefault(); save(); }
  });
  document.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Escape" && !overlay.classList.contains("hidden")) closeLogDialog();
  });
}

export function openLogDialog(
  key: string, summary: string, seconds: number, durationLabel: string, onLog: LogFn,
): void {
  wireLogDialog();
  $("lmKey").textContent = key;
  $("lmDur").textContent = durationLabel;
  $("lmSum").textContent = summary;
  const comment = $("lmComment") as HTMLTextAreaElement;
  comment.value = "";
  onConfirm = (text) => onLog(key, seconds, text || undefined);
  $("logModal").classList.remove("hidden");
  comment.focus();
}

// ---- Toast & hata (DOM yardimcilari) ----
let toastTimer: number | undefined;
export function toast(message: string, actionLabel?: string, actionFn?: () => void): void {
  clearTimeout(toastTimer);
  $("toastMsg").textContent = message;
  const btn = $("toastAction") as HTMLButtonElement;
  btn.textContent = actionLabel ?? "";
  btn.style.display = actionLabel ? "" : "none";
  btn.onclick = actionFn ? () => { actionFn(); hideToast(); } : null;
  $("toast").classList.remove("hidden");
  toastTimer = window.setTimeout(hideToast, 6000);
}
export function hideToast(): void {
  $("toast").classList.add("hidden");
}
export function showError(message: string): void {
  const bar = $("error");
  bar.textContent = "Hata: " + message;
  bar.classList.remove("hidden");
  window.setTimeout(() => bar.classList.add("hidden"), 7000);
}
