// Kompozisyon koku: store ve render'i birbirine baglar, DOM olaylarini yonetir.
// Burasi "kirli" ucu tutar; is mantigi store'da, goruntu render'da.

import { JiraApiError } from "../lib/api.js";
import { loadConfig, configComplete } from "../lib/storage.js";
import { todayStr } from "../lib/format.js";
import { Store } from "./store.js";
import { renderApp, toast, showError, type RenderHandlers } from "./render.js";
import type { WorklogEntry } from "../lib/types.js";

const $ = (id: string): HTMLElement => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`#${id} bulunamadı`);
  return node;
};
const showScreen = (id: "setup" | "main" | "loading"): void => {
  for (const s of ["setup", "main", "loading"] as const) {
    $(s).classList.toggle("hidden", s !== id);
  }
};
const errMsg = (e: unknown): string =>
  e instanceof JiraApiError ? e.message : e instanceof Error ? e.message : String(e);

async function main(): Promise<void> {
  const config = await loadConfig();
  if (!configComplete(config)) {
    showScreen("setup");
    $("goOptions").addEventListener("click", () => chrome.runtime.openOptionsPage());
    return;
  }

  const store = new Store(config, todayStr());

  const handlers: RenderHandlers = {
    onLog: (key, seconds, comment) => {
      store
        .logTime(key, seconds, comment)
        .then((entry: WorklogEntry) => {
          toast(`${key} · kaydedildi`, "Geri al", () => void store.removeWorklog(entry).catch(onError));
          refreshBadge();
        })
        .catch(onError);
    },
    onDelete: (entry) =>
      void store.removeWorklog(entry).then(refreshBadge).catch(onError),
    onToggleFav: (key) => void store.toggleFavorite(key).catch(onError),
    onPickDate: (dateStr) => void store.goToDate(dateStr).catch(onError),
  };

  store.subscribe((state) => renderApp(state, handlers));

  bindChrome(store);

  showScreen("loading");
  try {
    await store.init();
    showScreen("main");
  } catch (e) {
    showScreen("main");
    onError(e);
  }
}

function onError(e: unknown): void {
  showError(errMsg(e));
}

/** Arka plandaki rozet denetimini tetikler (dinleyici yoksa sessizce gecilir). */
function refreshBadge(): void {
  void chrome.runtime.sendMessage({ type: "refreshBadge" }).catch(() => undefined);
}

function bindChrome(store: Store): void {
  const withReload = async (fn: () => Promise<void>): Promise<void> => {
    showScreen("loading");
    try {
      await fn();
    } catch (e) {
      onError(e);
    } finally {
      showScreen("main");
    }
  };

  $("settings").addEventListener("click", () => chrome.runtime.openOptionsPage());

  const acct = $("accountSelect") as HTMLSelectElement;
  acct.addEventListener("change", () => void withReload(() => store.switchAccount(acct.value)));

  $("prevDay").addEventListener("click", () => void withReload(() => store.changeDay(-1)));
  $("nextDay").addEventListener("click", () => void withReload(() => store.changeDay(1)));
  $("dateLabel").addEventListener("click", () => void withReload(() => store.goToDate(todayStr())));

  const search = $("search") as HTMLInputElement;
  search.addEventListener("keydown", (e) => {
    if (e.key === "Enter") store.search(search.value).catch(onError);
  });
  search.addEventListener("input", () => {
    if (!search.value.trim()) store.clearSearch();
  });

  const head = $("entriesToggle");
  head.addEventListener("click", () => {
    const open = head.getAttribute("aria-expanded") === "true";
    head.setAttribute("aria-expanded", String(!open));
    $("entriesBody").classList.toggle("hidden", open);
  });
}

void main();
