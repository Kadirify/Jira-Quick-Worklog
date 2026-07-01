// Popup durum yonetimi. UI'dan bagimsiz: veriyi tutar, mutasyonlari sıraya alir,
// degisiklikte abonelere haber verir. (DOM/render bilmez.)

import { JiraClient } from "../lib/api.js";
import { loadFavorites, saveFavorites } from "../lib/storage.js";
import type { Settings, JiraUser, JiraIssue, WorklogEntry } from "../lib/types.js";

export interface PopupState {
  me: JiraUser | null;
  date: string;
  settings: Settings;
  favorites: string[];
  favIssues: JiraIssue[];
  assigned: JiraIssue[];
  searchResults: JiraIssue[] | null;
  todays: WorklogEntry[];
  loggedByIssue: Record<string, number>;
  totalSec: number;
  summaries: Record<string, string>;
}

type Listener = (state: PopupState) => void;

export class Store {
  readonly state: PopupState;
  private readonly client: JiraClient;
  private readonly listeners = new Set<Listener>();
  /** Worklog ekleme/silmeyi seri hale getiren kuyruk (yaris kosulunu onler). */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(client: JiraClient, settings: Settings, date: string) {
    this.client = client;
    this.state = {
      me: null,
      date,
      settings,
      favorites: [],
      favIssues: [],
      assigned: [],
      searchResults: null,
      todays: [],
      loggedByIssue: {},
      totalSec: 0,
      summaries: {},
    };
  }

  subscribe(fn: Listener): void {
    this.listeners.add(fn);
  }
  private notify(): void {
    for (const fn of this.listeners) fn(this.state);
  }

  /** Islemleri tek tek, sirayla calistirir; bir oncekinin sonucu islenmeden digeri baslamaz. */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private remember(issues: JiraIssue[]): void {
    for (const i of issues) this.state.summaries[i.key] = i.fields.summary;
  }

  private recomputeDay(logs: WorklogEntry[]): void {
    this.state.todays = logs;
    this.state.loggedByIssue = {};
    this.state.totalSec = 0;
    for (const w of logs) {
      this.state.summaries[w.issueKey] = w.summary;
      this.state.loggedByIssue[w.issueKey] = (this.state.loggedByIssue[w.issueKey] ?? 0) + w.timeSpentSeconds;
      this.state.totalSec += w.timeSpentSeconds;
    }
  }

  private async safeIssuesByKeys(keys: string[]): Promise<JiraIssue[]> {
    try {
      return await this.client.issuesByKeys(keys);
    } catch {
      return []; // silinmis/erisimsiz favori, listeyi bozmasin
    }
  }

  async init(): Promise<void> {
    this.state.me = await this.client.getMyself();
    this.state.favorites = await loadFavorites();
    await this.reloadIssues();
    await this.reloadDay();
    this.notify();
  }

  private async reloadIssues(): Promise<void> {
    const [favIssues, assigned] = await Promise.all([
      this.safeIssuesByKeys(this.state.favorites),
      this.client.listIssues(this.state.settings.jql, 30),
    ]);
    this.state.favIssues = favIssues;
    this.state.assigned = assigned;
    this.remember([...favIssues, ...assigned]);
  }

  private async reloadDay(): Promise<void> {
    this.recomputeDay(await this.client.worklogsForDate(this.state.date));
  }

  async changeDay(deltaDays: number): Promise<void> {
    const d = new Date(this.state.date + "T12:00:00");
    d.setDate(d.getDate() + deltaDays);
    const p = (n: number) => String(n).padStart(2, "0");
    this.state.date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    await this.reloadDay();
    this.notify();
  }

  async goToDate(dateStr: string): Promise<void> {
    if (dateStr === this.state.date) return;
    this.state.date = dateStr;
    await this.reloadDay();
    this.notify();
  }

  async search(term: string): Promise<void> {
    const t = term.trim();
    if (!t) {
      this.clearSearch();
      return;
    }
    const results = await this.client.findIssues(t, 25);
    this.remember(results);
    this.state.searchResults = results;
    this.notify();
  }

  clearSearch(): void {
    if (this.state.searchResults === null) return;
    this.state.searchResults = null;
    this.notify();
  }

  /** Worklog ekler; basariliysa olusan kaydi (geri-al icin) doner. */
  logTime(issueKey: string, seconds: number, comment?: string): Promise<WorklogEntry> {
    return this.enqueue(async () => {
      // Kuyruk sayesinde totalSec guncel; baslangic saatleri ust uste binmez.
      const startSeconds = this.state.settings.startHour * 3600 + this.state.totalSec;
      const created = await this.client.addWorklog(issueKey, {
        seconds,
        dateStr: this.state.date,
        startSeconds,
        ...(comment ? { comment } : {}),
      });
      const entry: WorklogEntry = {
        id: created.id,
        issueKey,
        summary: this.state.summaries[issueKey] ?? "",
        timeSpentSeconds: seconds,
        started: created.started,
        comment: comment ?? "",
      };
      this.state.todays.push(entry);
      this.state.loggedByIssue[issueKey] = (this.state.loggedByIssue[issueKey] ?? 0) + seconds;
      this.state.totalSec += seconds;
      this.notify();
      return entry;
    });
  }

  removeWorklog(entry: WorklogEntry): Promise<void> {
    return this.enqueue(async () => {
      await this.client.deleteWorklog(entry.issueKey, entry.id);
      this.state.todays = this.state.todays.filter((w) => w.id !== entry.id);
      this.state.loggedByIssue[entry.issueKey] = Math.max(
        0,
        (this.state.loggedByIssue[entry.issueKey] ?? 0) - entry.timeSpentSeconds,
      );
      this.state.totalSec = Math.max(0, this.state.totalSec - entry.timeSpentSeconds);
      this.notify();
    });
  }

  async toggleFavorite(key: string): Promise<void> {
    const favs = this.state.favorites;
    this.state.favorites = favs.includes(key) ? favs.filter((k) => k !== key) : [key, ...favs];
    await saveFavorites(this.state.favorites);
    this.state.favIssues = await this.safeIssuesByKeys(this.state.favorites);
    this.remember(this.state.favIssues);
    this.notify();
  }
}
