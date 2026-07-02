// Jira alan modelleri ve uygulama ayarlari (tip tanimlari).

/** Tek bir Jira hesabi (kimlik). */
export interface Account {
  id: string;
  label: string;
  email: string;
  token: string;
}

/** Tum yapilandirma: birden cok hesap + aktif hesap + genel ayarlar. */
export interface Config {
  baseUrl: string;
  accounts: Account[];
  activeAccountId: string;
  dailyTargetHours: number;
  startHour: number;
  jql: string;
  /** Sure cipine basinca aciklama penceresi sorulsun mu? */
  askComment: boolean;
}

/** JiraClient'in kullandigi, aktif hesaptan cozumlenmis ayar. */
export interface Settings {
  baseUrl: string;
  email: string;
  token: string;
  dailyTargetHours: number;
  startHour: number;
  jql: string;
  askComment: boolean;
}

export interface JiraUser {
  accountId: string;
  displayName: string;
  emailAddress?: string;
}

export interface JiraIssueFields {
  summary: string;
  status?: { name: string; statusCategory?: { key: string } };
  issuetype?: { name: string };
  priority?: { name: string };
  project?: { key: string };
}

export interface JiraIssue {
  key: string;
  fields: JiraIssueFields;
}

/** Ekranda gosterdigimiz, normalize edilmis worklog kaydi. */
export interface WorklogEntry {
  id: string;
  issueKey: string;
  summary: string;
  timeSpentSeconds: number;
  started: string;
  comment: string;
}

/** Jira'nin worklog POST yanitindan ihtiyac duydugumuz alanlar. */
export interface CreatedWorklog {
  id: string;
  started: string;
  timeSpentSeconds: number;
}

export interface AddWorklogInput {
  seconds: number;
  dateStr: string;
  startSeconds?: number;
  comment?: string;
}
