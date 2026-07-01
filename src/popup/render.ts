// Goruntuleme katmani. Sadece DOM uretir; state ve geri-cagrim (handler) alir.
// API/chrome/storage bilmez — boylece store'dan tamamen ayrik.

import { secToHuman, formatDateLabel, parseDuration } from "../lib/format.js";
import type { PopupState } from "./store.js";
import type { JiraIssue, WorklogEntry } from "../lib/types.js";

export interface RenderHandlers {
  onLog: (issueKey: string, seconds: number, comment?: string) => void;
  onDelete: (entry: WorklogEntry) => void;
  onToggleFav: (key: string) => void;
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
  renderAccounts(state);
  $("dateLabel").textContent = formatDateLabel(state.date);
  renderProgress(state);
  renderIssues(state, handlers);
  renderEntries(state, handlers);
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
  for (const i of [...state.favIssues, ...state.assigned]) {
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

  const chips = el("div", { class: "chips" });
  for (const p of PRESETS) {
    chips.append(el("button", { class: "chip", text: p.label, onclick: () => handlers.onLog(key, p.sec) }));
  }
  if (remain > 0) {
    chips.append(
      el("button", {
        class: "chip remain",
        text: "Kalan " + secToHuman(remain),
        title: "Günlük hedefe kalanı bu işe ekle",
        onclick: () => handlers.onLog(key, remain),
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
