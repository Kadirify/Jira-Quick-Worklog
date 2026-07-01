// Jira REST API v3 istemcisi. Tek sorumluluk: HTTP + JQL kurma/kacis + tip donusumu.

import type {
  Settings, JiraUser, JiraIssue, WorklogEntry, CreatedWorklog, AddWorklogInput,
} from "./types.js";
import { jiraStarted } from "./format.js";

const ISSUE_FIELDS = "summary,status,issuetype,priority,project";

/** JQL string literali icin kacis: ters bolu ve cift tirnak. */
export function escapeJql(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** "DEV-142" gibi gecerli bir issue anahtari mi? */
export function isIssueKey(value: string): boolean {
  return /^[A-Za-z][A-Za-z0-9]+-\d+$/.test(value.trim());
}

export class JiraApiError extends Error {
  status: number;
  detail: string;
  constructor(message: string, status: number, detail = "") {
    super(message);
    this.name = "JiraApiError";
    this.status = status;
    this.detail = detail;
  }
}

interface SearchResponse {
  issues?: JiraIssue[];
}
interface WorklogListResponse {
  worklogs?: RawWorklog[];
}
interface RawWorklog {
  id: string;
  started: string;
  timeSpentSeconds?: number;
  author?: { accountId?: string };
  comment?: unknown;
}

export class JiraClient {
  private readonly baseUrl: string;
  private readonly authHeader: string;
  private readonly settings: Settings;
  private me: JiraUser | null = null;

  constructor(settings: Settings) {
    this.settings = settings;
    this.baseUrl = settings.baseUrl.replace(/\/+$/, "");
    this.authHeader = "Basic " + btoa(`${settings.email}:${settings.token}`);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: this.authHeader,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      const message =
        res.status === 401
          ? "Kimlik doğrulama başarısız (401). Mail/token yanlış ya da token süresi dolmuş."
          : res.status === 403
          ? "Yetki yok (403). Bu işlem için Jira izinlerin yetersiz."
          : `${res.status} ${res.statusText}`;
      throw new JiraApiError(message, res.status, detail);
    }

    if (res.status === 204) return undefined as T;
    const ct = res.headers.get("content-type") ?? "";
    return (ct.includes("application/json") ? await res.json() : await res.text()) as T;
  }

  async getMyself(): Promise<JiraUser> {
    this.me = await this.request<JiraUser>("GET", "/rest/api/3/myself");
    return this.me;
  }

  /** Ham JQL ile arama (dahili). Cagiranlar guvenli yardimcilari kullanmali. */
  private async search(jql: string, max: number): Promise<JiraIssue[]> {
    const params = new URLSearchParams({
      jql,
      maxResults: String(max),
      fields: ISSUE_FIELDS,
    });
    const data = await this.request<SearchResponse>("GET", `/rest/api/3/search/jql?${params}`);
    return data.issues ?? [];
  }

  /** Kullanicinin ayarladigi JQL ile is listesi. */
  async listIssues(jql: string, max = 30): Promise<JiraIssue[]> {
    return this.search(jql, max);
  }

  /** Anahtarlarla toplu getirme — gecersiz anahtarlar elenir, JQL kacisi uygulanir. */
  async issuesByKeys(keys: string[]): Promise<JiraIssue[]> {
    const valid = keys.filter(isIssueKey);
    if (!valid.length) return [];
    const list = valid.map((k) => `"${escapeJql(k)}"`).join(", ");
    return this.search(`key in (${list})`, valid.length);
  }

  /** Kullanici aramasi: anahtar gibiyse key eslesmesi, degilse metin aramasi (kacisli). */
  async findIssues(term: string, max = 25): Promise<JiraIssue[]> {
    const t = term.trim();
    if (!t) return [];
    const jql = isIssueKey(t)
      ? `key = "${escapeJql(t.toUpperCase())}"`
      : `text ~ "${escapeJql(t)}" ORDER BY updated DESC`;
    return this.search(jql, max);
  }

  /** Belirli gunde, bana ait worklog kayitlari (issue ozeti birlestirilmis). */
  async worklogsForDate(dateStr: string): Promise<WorklogEntry[]> {
    const issues = await this.search(
      `worklogAuthor = currentUser() AND worklogDate = "${escapeJql(dateStr)}"`,
      50,
    );
    const myId = this.me?.accountId;
    const out: WorklogEntry[] = [];
    for (const issue of issues) {
      const data = await this.request<WorklogListResponse>(
        "GET",
        `/rest/api/3/issue/${encodeURIComponent(issue.key)}/worklog?maxResults=200`,
      );
      for (const w of data.worklogs ?? []) {
        if (w.author?.accountId !== myId) continue;
        if (!String(w.started).startsWith(dateStr)) continue;
        out.push({
          id: w.id,
          issueKey: issue.key,
          summary: issue.fields.summary,
          timeSpentSeconds: w.timeSpentSeconds ?? 0,
          started: w.started,
          comment: adfToText(w.comment),
        });
      }
    }
    out.sort((a, b) => a.started.localeCompare(b.started));
    return out;
  }

  async addWorklog(issueKey: string, input: AddWorklogInput): Promise<CreatedWorklog> {
    const body: Record<string, unknown> = {
      timeSpentSeconds: input.seconds,
      started: jiraStarted(input.dateStr, input.startSeconds ?? this.settings.startHour * 3600),
    };
    const comment = input.comment?.trim();
    if (comment) {
      body.comment = {
        type: "doc",
        version: 1,
        content: [{ type: "paragraph", content: [{ type: "text", text: comment }] }],
      };
    }
    return this.request<CreatedWorklog>(
      "POST",
      `/rest/api/3/issue/${encodeURIComponent(issueKey)}/worklog`,
      body,
    );
  }

  async deleteWorklog(issueKey: string, worklogId: string): Promise<void> {
    await this.request<void>(
      "DELETE",
      `/rest/api/3/issue/${encodeURIComponent(issueKey)}/worklog/${encodeURIComponent(worklogId)}`,
    );
  }
}

/** ADF (Atlassian Document Format) yorumu duz metne indirger. */
function adfToText(comment: unknown): string {
  if (!comment) return "";
  if (typeof comment === "string") return comment;
  const texts: string[] = [];
  const walk = (node: any): void => {
    if (node?.type === "text" && typeof node.text === "string") texts.push(node.text);
    if (Array.isArray(node?.content)) node.content.forEach(walk);
  };
  walk(comment);
  return texts.join(" ");
}
