// Kurulum sayfasi: ayarlari yukle/dogrula/kaydet.

import { JiraClient } from "../lib/api.js";
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from "../lib/storage.js";
import type { Settings } from "../lib/types.js";

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`#${id} bulunamadı`);
  return node as T;
};

function setStatus(message: string, kind?: "ok" | "err"): void {
  const el = $("status");
  el.textContent = message;
  el.className = "status" + (kind ? " " + kind : "");
}

function readForm(): Settings {
  return {
    baseUrl: $<HTMLInputElement>("baseUrl").value.trim(),
    email: $<HTMLInputElement>("email").value.trim(),
    token: $<HTMLInputElement>("token").value.trim(),
    dailyTargetHours: Number($<HTMLInputElement>("dailyTargetHours").value) || 8,
    startHour: Number($<HTMLInputElement>("startHour").value) || 9,
    jql: $<HTMLInputElement>("jql").value.trim() || DEFAULT_SETTINGS.jql,
  };
}

function fillForm(s: Settings): void {
  $<HTMLInputElement>("baseUrl").value = s.baseUrl;
  $<HTMLInputElement>("email").value = s.email;
  $<HTMLInputElement>("token").value = s.token;
  $<HTMLInputElement>("dailyTargetHours").value = String(s.dailyTargetHours);
  $<HTMLInputElement>("startHour").value = String(s.startHour);
  $<HTMLInputElement>("jql").value = s.jql;
}

function requireCore(s: Settings): boolean {
  if (!s.baseUrl || !s.email || !s.token) {
    setStatus("Adres, e-posta ve token zorunlu.", "err");
    return false;
  }
  return true;
}

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

$("toggleToken").addEventListener("click", () => {
  const t = $<HTMLInputElement>("token");
  t.type = t.type === "password" ? "text" : "password";
});

$("test").addEventListener("click", async () => {
  const s = readForm();
  if (!requireCore(s)) return;
  setStatus("Bağlanılıyor…");
  try {
    const me = await new JiraClient(s).getMyself();
    setStatus(`✓ Bağlantı başarılı — ${me.displayName}`, "ok");
  } catch (e) {
    setStatus("✗ " + errMsg(e), "err");
  }
});

$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const s = readForm();
  if (!requireCore(s)) return;
  setStatus("Test ediliyor ve kaydediliyor…");
  try {
    await new JiraClient(s).getMyself();
    await saveSettings(s);
    setStatus("✓ Kaydedildi. Artık araç çubuğundaki ikondan worklog girebilirsin.", "ok");
  } catch (err) {
    setStatus("✗ Kaydedilmedi — " + errMsg(err), "err");
  }
});

void loadSettings().then(fillForm);
