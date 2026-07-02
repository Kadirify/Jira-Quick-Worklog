// Arka plan: son is gununde (Cmt/Paz atlanir) gunluk hedef dolmadiysa
// eklenti ikonuna "!" rozeti koyar. Periyodik alarm + popup tetiklemesiyle tazelenir.

import { JiraClient } from "../lib/api.js";
import { loadConfig, configComplete, resolveSettings } from "../lib/storage.js";
import { lastWorkday } from "../lib/format.js";

const ALARM_NAME = "worklogBadgeCheck";
const CHECK_PERIOD_MIN = 240; // 4 saatte bir yeterli

function setBadge(text: string): void {
  void chrome.action.setBadgeText({ text });
  if (text) {
    void chrome.action.setBadgeBackgroundColor({ color: "#dc2626" });
    void chrome.action.setBadgeTextColor({ color: "#ffffff" });
  }
}

async function refreshBadge(): Promise<void> {
  try {
    const config = await loadConfig();
    if (!configComplete(config)) return setBadge("");

    const settings = resolveSettings(config);
    const client = new JiraClient(settings);
    await client.getMyself(); // worklog filtresi icin accountId gerekir

    const day = lastWorkday();
    const totals = await client.worklogTotalsForRange(day, day);
    const missing = (totals[day] ?? 0) < settings.dailyTargetHours * 3600;
    setBadge(missing ? "!" : "");
  } catch {
    // Ag/kimlik hatasi rozeti yanlis alarma cevirmesin.
    setBadge("");
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void chrome.alarms.create(ALARM_NAME, { periodInMinutes: CHECK_PERIOD_MIN });
  void refreshBadge();
});

chrome.runtime.onStartup.addListener(() => {
  void chrome.alarms.create(ALARM_NAME, { periodInMinutes: CHECK_PERIOD_MIN });
  void refreshBadge();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) void refreshBadge();
});

// Popup, worklog ekleyip sildikce "tekrar bak" der.
chrome.runtime.onMessage.addListener((message: unknown) => {
  if ((message as { type?: string } | null)?.type === "refreshBadge") void refreshBadge();
});
