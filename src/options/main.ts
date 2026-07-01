// Kurulum sayfasi: coklu hesap yonetimi (ekle/sil/test/aktif) + genel ayarlar.

import { JiraClient, detectCurrentJiraUser } from "../lib/api.js";
import { loadConfig, saveConfig, newAccount } from "../lib/storage.js";
import type { Config, Account, Settings } from "../lib/types.js";

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`#${id} bulunamadı`);
  return node as T;
};

type Attrs = Record<string, unknown>;
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: Array<Node | string> = [],
): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined) continue;
    if (k === "class") n.className = String(v);
    else if (k === "text") n.textContent = String(v);
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v as EventListener);
    else n.setAttribute(k, String(v));
  }
  for (const c of children) n.append(c);
  return n;
}

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));
let config: Config;

function setStatus(message: string, kind?: "ok" | "err"): void {
  const el2 = $("status");
  el2.textContent = message;
  el2.className = "status" + (kind ? " " + kind : "");
}

function baseUrl(): string {
  return $<HTMLInputElement>("baseUrl").value.trim();
}

/** Genel alanlari config'e yaz, sonra kalici kaydet. */
async function persist(): Promise<void> {
  config.baseUrl = baseUrl();
  config.dailyTargetHours = Number($<HTMLInputElement>("dailyTargetHours").value) || 8;
  config.startHour = Number($<HTMLInputElement>("startHour").value) || 9;
  config.jql = $<HTMLInputElement>("jql").value.trim() ||
    "assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC";
  await saveConfig(config);
}

function settingsFor(acc: Account): Settings {
  return {
    baseUrl: baseUrl(),
    email: acc.email,
    token: acc.token,
    dailyTargetHours: 8,
    startHour: 9,
    jql: "",
  };
}

function renderAccounts(): void {
  const list = $("accountsList");
  list.innerHTML = "";
  $("accountsEmpty").classList.toggle("hidden", config.accounts.length > 0);

  for (const acc of config.accounts) {
    const active = acc.id === config.activeAccountId;
    const radio = el("input", {
      type: "radio", name: "active", ...(active ? { checked: "checked" } : {}),
      title: "Aktif hesap yap",
      onchange: () => void setActive(acc.id),
    });
    const info = el("div", { class: "acc-info" }, [
      el("b", { text: acc.label }),
      el("span", { text: acc.email }),
    ]);
    const test = el("button", { type: "button", class: "acc-test", text: "Test", onclick: () => void testAccount(acc) });
    const del = el("button", { type: "button", class: "acc-del", text: "Sil", onclick: () => void deleteAccount(acc.id) });
    list.append(el("div", { class: "account-row" + (active ? " active" : "") }, [radio, info, test, del]));
  }
}

async function setActive(id: string): Promise<void> {
  config.activeAccountId = id;
  await persist();
  renderAccounts();
  setStatus("Aktif hesap değiştirildi.", "ok");
}

async function deleteAccount(id: string): Promise<void> {
  config.accounts = config.accounts.filter((a) => a.id !== id);
  if (config.activeAccountId === id) config.activeAccountId = config.accounts[0]?.id ?? "";
  await persist();
  renderAccounts();
  setStatus("Hesap silindi.", "ok");
}

async function testAccount(acc: Account): Promise<void> {
  if (!baseUrl()) return setStatus("Önce Jira adresini gir.", "err");
  setStatus(`"${acc.label}" test ediliyor…`);
  try {
    const me = await new JiraClient(settingsFor(acc)).getMyself();
    setStatus(`✓ ${acc.label} → ${me.displayName} (${me.emailAddress ?? ""})`, "ok");
  } catch (e) {
    setStatus(`✗ ${acc.label}: ${errMsg(e)}`, "err");
  }
}

async function detectUser(): Promise<void> {
  if (!baseUrl()) return setStatus("Önce Jira adresini gir.", "err");
  setStatus("Açık Jira oturumu okunuyor…");
  try {
    const me = await detectCurrentJiraUser(baseUrl());
    $<HTMLInputElement>("newLabel").value = me.displayName;
    $<HTMLInputElement>("newEmail").value = me.emailAddress ?? "";
    $<HTMLInputElement>("newToken").focus();
    setStatus(`Algılandı: ${me.displayName}. Şimdi bu hesabın token'ını girip "Test & Ekle"ye bas.`, "ok");
  } catch (e) {
    setStatus("✗ " + errMsg(e), "err");
  }
}

async function addAccount(): Promise<void> {
  const label = $<HTMLInputElement>("newLabel").value.trim();
  const email = $<HTMLInputElement>("newEmail").value.trim();
  const token = $<HTMLInputElement>("newToken").value.trim();
  if (!baseUrl()) return setStatus("Önce Jira adresini gir.", "err");
  if (!email || !token) return setStatus("Hesap için e-posta ve token zorunlu.", "err");

  setStatus("Test ediliyor…");
  try {
    const acc = newAccount(label, email, token);
    const me = await new JiraClient(settingsFor(acc)).getMyself();
    acc.label = label || me.displayName; // etiket boşsa gerçek adı kullan
    config.accounts.push(acc);
    if (!config.activeAccountId) config.activeAccountId = acc.id;
    await persist();
    renderAccounts();
    $<HTMLInputElement>("newLabel").value = "";
    $<HTMLInputElement>("newEmail").value = "";
    $<HTMLInputElement>("newToken").value = "";
    setStatus(`✓ Eklendi: ${acc.label} → ${me.displayName}`, "ok");
  } catch (e) {
    setStatus("✗ Eklenemedi — " + errMsg(e), "err");
  }
}

function fillGlobals(): void {
  $<HTMLInputElement>("baseUrl").value = config.baseUrl;
  $<HTMLInputElement>("dailyTargetHours").value = String(config.dailyTargetHours);
  $<HTMLInputElement>("startHour").value = String(config.startHour);
  $<HTMLInputElement>("jql").value = config.jql;
}

// ---- Olaylar ----
$("toggleNewToken").addEventListener("click", () => {
  const t = $<HTMLInputElement>("newToken");
  t.type = t.type === "password" ? "text" : "password";
});
$("detectUser").addEventListener("click", () => void detectUser());
$("addAccount").addEventListener("click", () => void addAccount());
$("save").addEventListener("click", async () => {
  if (!baseUrl()) return setStatus("Jira adresi zorunlu.", "err");
  await persist();
  setStatus("✓ Kaydedildi.", "ok");
});

async function init(): Promise<void> {
  config = await loadConfig();
  fillGlobals();
  renderAccounts();
}
void init();
