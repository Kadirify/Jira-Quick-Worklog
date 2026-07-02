// Saf bicimleme/ayristirma fonksiyonlari — DOM ve chrome bagimsiz, bu yuzden test edilebilir.

/** Saniyeyi "2sa 30dk" gibi insan-okur metne cevirir. */
export function secToHuman(sec: number): string {
  if (!sec) return "0dk";
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (h && m) return `${h}sa ${m}dk`;
  if (h) return `${h}sa`;
  return `${m}dk`;
}

export function hoursToSec(h: number): number {
  return Math.round(h * 3600);
}

/**
 * Serbest metin sure girdisini saniyeye cevirir.
 * Desteklenenler: "1.5" (saat), "90m"/"90dk", "1h30m"/"1sa 30dk", "2h"/"2sa".
 * Anlasilmazsa 0 doner.
 */
export function parseDuration(input: string): number {
  if (!input) return 0;
  const s = input.toLowerCase().trim().replace(",", ".").replace(/sa/g, "h").replace(/dk/g, "m");
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(parseFloat(s) * 3600); // ciplak sayi = saat
  let sec = 0;
  const h = s.match(/(\d+(?:\.\d+)?)\s*h/);
  const m = s.match(/(\d+)\s*m/);
  if (h) sec += parseFloat(h[1]!) * 3600;
  if (m) sec += parseInt(m[1]!, 10) * 60;
  return Math.round(sec);
}

/** YYYY-MM-DD (yerel tarih). */
export function todayStr(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Jira'nin worklog "started" alaninin bekledigi format:
 * "yyyy-MM-ddTHH:mm:ss.000+0300" (yerel saat dilimi ofsetiyle).
 */
export function jiraStarted(dateStr: string, secondsIntoDay: number): string {
  const [y, mo, d] = dateStr.split("-").map(Number) as [number, number, number];
  const base = new Date(y, mo - 1, d, 0, 0, 0, 0);
  base.setSeconds(secondsIntoDay);
  const offMin = -base.getTimezoneOffset();
  const sign = offMin >= 0 ? "+" : "-";
  const oh = String(Math.floor(Math.abs(offMin) / 60)).padStart(2, "0");
  const om = String(Math.abs(offMin) % 60).padStart(2, "0");
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${base.getFullYear()}-${p(base.getMonth() + 1)}-${p(base.getDate())}` +
    `T${p(base.getHours())}:${p(base.getMinutes())}:${p(base.getSeconds())}.000${sign}${oh}${om}`
  );
}

/** dateStr'in icinde bulundugu haftanin gunleri (Pazartesi..Pazar, YYYY-MM-DD). */
export function weekDates(dateStr: string): string[] {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // haftanin pazartesisine sar
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    return todayStr(x);
  });
}

/** Verilen gunden geriye en yakin is gununu dondurur (Cmt/Paz atlanir). */
export function lastWorkday(from: Date = new Date()): string {
  const d = new Date(from);
  do {
    d.setDate(d.getDate() - 1);
  } while (d.getDay() === 0 || d.getDay() === 6);
  return todayStr(d);
}

/** Tarih cubugu etiketi: "Bugün · 1 Temmuz Salı" gibi. */
export function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const base = d.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" });
  if (dateStr === todayStr()) return "Bugün · " + base;
  if (dateStr === todayStr(new Date(Date.now() - 86_400_000))) return "Dün · " + base;
  return base;
}
