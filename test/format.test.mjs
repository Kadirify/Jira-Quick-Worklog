// Saf format/ayristirma fonksiyonlari icin testler.
// Calistirma: npm test  (once tsc derler, sonra bu calisir)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  secToHuman,
  parseDuration,
  jiraStarted,
  todayStr,
  hoursToSec,
  weekDates,
  lastWorkday,
} from "../dist/lib/format.js";

test("secToHuman", () => {
  assert.equal(secToHuman(0), "0dk");
  assert.equal(secToHuman(2700), "45dk");
  assert.equal(secToHuman(3600), "1sa");
  assert.equal(secToHuman(8100), "2sa 15dk");
  assert.equal(secToHuman(13 * 3600), "13sa");
});

test("parseDuration — saat/dakika/karisik", () => {
  assert.equal(parseDuration("1.5"), 5400);
  assert.equal(parseDuration("1,5"), 5400);
  assert.equal(parseDuration("90m"), 5400);
  assert.equal(parseDuration("90dk"), 5400);
  assert.equal(parseDuration("1h30m"), 5400);
  assert.equal(parseDuration("1sa 30dk"), 5400);
  assert.equal(parseDuration("2h"), 7200);
  assert.equal(parseDuration("2sa"), 7200);
  assert.equal(parseDuration("45m"), 2700);
});

test("parseDuration — gecersiz girdi 0 doner", () => {
  assert.equal(parseDuration(""), 0);
  assert.equal(parseDuration("abc"), 0);
  assert.equal(parseDuration("saat"), 0);
});

test("hoursToSec", () => {
  assert.equal(hoursToSec(8), 28800);
  assert.equal(hoursToSec(0.25), 900);
});

test("jiraStarted — format ve ofset", () => {
  const s = jiraStarted("2026-07-01", 9 * 3600);
  // "2026-07-01T09:00:00.000+0300" gibi (yerel ofset cihaza gore)
  assert.match(s, /^2026-07-01T09:00:00\.000[+-]\d{4}$/);
});

test("jiraStarted — saniye gun icine yayilir", () => {
  const s = jiraStarted("2026-07-01", 9 * 3600 + 2 * 3600);
  assert.match(s, /^2026-07-01T11:00:00\.000[+-]\d{4}$/);
});

test("todayStr — YYYY-MM-DD bicimi", () => {
  assert.match(todayStr(new Date(2026, 6, 1)), /^2026-07-01$/);
  assert.match(todayStr(), /^\d{4}-\d{2}-\d{2}$/);
});

test("weekDates — Pazartesi'den Pazar'a 7 gun", () => {
  // 2026-07-01 Carsamba → hafta 2026-06-29 (Pzt) .. 2026-07-05 (Paz)
  const days = weekDates("2026-07-01");
  assert.equal(days.length, 7);
  assert.equal(days[0], "2026-06-29");
  assert.equal(days[6], "2026-07-05");
});

test("weekDates — Pazartesi kendisi ilk gun", () => {
  assert.equal(weekDates("2026-06-29")[0], "2026-06-29");
});

test("lastWorkday — hafta ici bir onceki gun", () => {
  // 2026-07-01 Carsamba → Sali 2026-06-30
  assert.equal(lastWorkday(new Date(2026, 6, 1, 12)), "2026-06-30");
});

test("lastWorkday — Pazartesi'den Cuma'ya atlar", () => {
  // 2026-06-29 Pazartesi → Cuma 2026-06-26
  assert.equal(lastWorkday(new Date(2026, 5, 29, 12)), "2026-06-26");
});
