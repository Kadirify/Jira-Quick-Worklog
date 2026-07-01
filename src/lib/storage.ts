// Yapilandirma/favori kaliciligi — chrome.storage.local. Coklu hesap destegi.

import type { Settings, Account, Config } from "./types.js";

const CONFIG_KEY = "jiraConfig";
const OLD_KEY = "jiraSettings"; // eski tekil ayar (goc icin)
const FAVORITES_KEY = "favorites";

const DEFAULT_JQL = "assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC";

export const DEFAULT_CONFIG: Config = {
  baseUrl: "",
  accounts: [],
  activeAccountId: "",
  dailyTargetHours: 8,
  startHour: 9,
  jql: DEFAULT_JQL,
};

function uid(): string {
  return crypto.randomUUID();
}

export function newAccount(label: string, email: string, token: string): Account {
  const e = email.trim();
  return { id: uid(), label: label.trim() || e, email: e, token: token.trim() };
}

export async function loadConfig(): Promise<Config> {
  const raw = await chrome.storage.local.get([CONFIG_KEY, OLD_KEY]);
  if (raw[CONFIG_KEY]) return { ...DEFAULT_CONFIG, ...(raw[CONFIG_KEY] as Config) };

  // Eski tek-hesap ayarindan goc
  const old = raw[OLD_KEY] as Partial<Settings> | undefined;
  if (old && (old.email || old.token)) {
    const acc = newAccount(old.email ?? "Hesap", old.email ?? "", old.token ?? "");
    const cfg: Config = {
      baseUrl: old.baseUrl ?? "",
      accounts: [acc],
      activeAccountId: acc.id,
      dailyTargetHours: old.dailyTargetHours ?? 8,
      startHour: old.startHour ?? 9,
      jql: old.jql ?? DEFAULT_JQL,
    };
    await saveConfig(cfg);
    return cfg;
  }
  return { ...DEFAULT_CONFIG };
}

export async function saveConfig(config: Config): Promise<Config> {
  await chrome.storage.local.set({ [CONFIG_KEY]: config });
  return config;
}

export function activeAccount(config: Config): Account | undefined {
  return config.accounts.find((a) => a.id === config.activeAccountId) ?? config.accounts[0];
}

/** Aktif hesabi JiraClient'in bekledigi Settings'e cozumler. */
export function resolveSettings(config: Config): Settings {
  const acc = activeAccount(config);
  return {
    baseUrl: config.baseUrl,
    email: acc?.email ?? "",
    token: acc?.token ?? "",
    dailyTargetHours: config.dailyTargetHours,
    startHour: config.startHour,
    jql: config.jql,
  };
}

export function configComplete(config: Config): boolean {
  const acc = activeAccount(config);
  return Boolean(config.baseUrl && acc && acc.email && acc.token);
}

// ---- Favoriler (degismedi) ----
export async function loadFavorites(): Promise<string[]> {
  const data = await chrome.storage.local.get(FAVORITES_KEY);
  return Array.isArray(data[FAVORITES_KEY]) ? (data[FAVORITES_KEY] as string[]) : [];
}
export async function saveFavorites(list: string[]): Promise<void> {
  await chrome.storage.local.set({ [FAVORITES_KEY]: list });
}
