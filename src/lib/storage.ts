// Ayar/favori kaliciligi — chrome.storage.local'i tek noktadan yonetir.

import type { Settings } from "./types.js";

const SETTINGS_KEY = "jiraSettings";
const FAVORITES_KEY = "favorites";

export const DEFAULT_SETTINGS: Settings = {
  baseUrl: "",
  email: "",
  token: "",
  dailyTargetHours: 8,
  startHour: 9,
  jql: "assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC",
};

export async function loadSettings(): Promise<Settings> {
  const data = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...(data[SETTINGS_KEY] ?? {}) };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await loadSettings()), ...patch };
  await chrome.storage.local.set({ [SETTINGS_KEY]: next });
  return next;
}

export function settingsComplete(s: Settings): boolean {
  return Boolean(s.baseUrl && s.email && s.token);
}

export async function loadFavorites(): Promise<string[]> {
  const data = await chrome.storage.local.get(FAVORITES_KEY);
  return Array.isArray(data[FAVORITES_KEY]) ? (data[FAVORITES_KEY] as string[]) : [];
}

export async function saveFavorites(list: string[]): Promise<void> {
  await chrome.storage.local.set({ [FAVORITES_KEY]: list });
}
