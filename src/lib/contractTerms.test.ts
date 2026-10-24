import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { addDays, addMonths, format } from "date-fns";
import {
  defaultTerms, maxTrialDaysCdd, meetsContractNotice, earliestContractMissionTs, validateTerms,
  type ContractTerms, type TermsContext,
} from "./contractTerms";

const missionTs = new Date("2026-11-02T10:00:00").getTime();
const start = "2026-11-02";
const d = (n: number) => format(addDays(new Date(`${start}T00:00:00`), n), "yyyy-MM-dd");
const m = (n: number, extra = 0) => format(addDays(addMonths(new Date(`${start}T00:00:00`), n), extra), "yyyy-MM-dd");
const cdi: TermsContext = { kind: "cdi", missionTs, answers: { hasEnd: "no" } };
const cddReturn: TermsContext = { kind: "cdd", missionTs, answers: { hasEnd: "yes", replacesAbsentEmployee: true, endMode: "return" } };
const valid = (ctx: TermsContext): ContractTerms => ({ ...defaultTerms(ctx), salaryPayDay: 5 });
const fields = (t: ContractTerms, ctx: TermsContext) => validateTerms(t, ctx).map((e) => e.field);

describe("defaultTerms", () => {
  test("CDI", () => {
    const t = defaultTerms(cdi);
    assert.equal(t.startDate, start);
    assert.equal(t.trialDays, 0);
    assert.deepEqual(t.organization, { mode: "irregular" });
    assert.deepEqual(t.weeklyRestDays, [7]);
    assert.equal(t.mayFirst, "off");
    assert.deepEqual(t.workedHolidays, []);
    assert.equal(t.salaryPayDay, null);
    assert.equal(t.leaveNoticeMonths, 2);
    assert.equal(t.minDuration, undefined);
  });
  test("CDD au retour : durée minimale 1 semaine", () => {
    assert.deepEqual(defaultTerms(cddReturn).minDuration, { value: 1, unit: "weeks" });
  });
});

describe("maxTrialDaysCdd", () => {
  test("10 jours → 1", () => assert.equal(maxTrialDaysCdd({ startDate: start, endDate: d(9) }), 1));
  test("3 mois → semaines complètes plafonnées à 14", () => assert.equal(maxTrialDaysCdd({ startDate: start, endDate: m(3, -1) }), 13));
  test("exactement 6 mois → 14", () => assert.equal(maxTrialDaysCdd({ startDate: start, endDate: m(6) }), 14));
  test("6 mois et 1 jour → plafond 30 (26 semaines complètes)", () => assert.equal(maxTrialDaysCdd({ startDate: start, endDate: m(6, 1) }), 26));
  test("12 mois → 30", () => assert.equal(maxTrialDaysCdd({ startDate: start, endDate: m(12) }), 30));
  test("moins de 7 jours → 0", () => assert.equal(maxTrialDaysCdd({ startDate: start, endDate: d(5) }), 0));
  test("terme imprécis 1 semaine → 1", () => assert.equal(maxTrialDaysCdd({ startDate: start, minDuration: { value: 1, unit: "weeks" } }), 1));
  test("terme imprécis 2 mois → 8", () => assert.equal(maxTrialDaysCdd({ startDate: start, minDuration: { value: 2, unit: "months" } }), 8));
});

describe("validateTerms", () => {
  test("valeurs valides", () => assert.deepEqual(validateTerms(valid(cdi), cdi), []));
  test("jour de versement absent invalide", () => assert.ok(fields(defaultTerms(cdi), cdi).includes("salaryPayDay")));
  test("jour de versement 29 invalide", () => assert.ok(fields({ ...valid(cdi), salaryPayDay: 29 }, cdi).includes("salaryPayDay")));
  test("essai CDI 30 ok, 31 invalide", () => {
    assert.deepEqual(fields({ ...valid(cdi), trialDays: 30 }, cdi), []);
    assert.ok(fields({ ...valid(cdi), trialDays: 31 }, cdi).includes("trialDays"));
  });
  test("essai CDD au-delà du maximum invalide", () => {
    assert.deepEqual(fields({ ...valid(cddReturn), trialDays: 1 }, cddReturn), []);
    assert.ok(fields({ ...valid(cddReturn), trialDays: 2 }, cddReturn).includes("trialDays"));
  });
  test("durée minimale obligatoire au retour", () => {
    assert.ok(fields({ ...valid(cddReturn), minDuration: undefined }, cddReturn).includes("minDuration"));
  });
  test("planning 48 h valide, 48 h 1 min invalide", () => {
    const days = [1, 2, 3, 4].map((w) => ({ weekday: w as 1, start: "08:00", end: "20:00" }));
    assert.deepEqual(fields({ ...valid(cdi), organization: { mode: "fixed", days } }, cdi), []);
    const over = [...days.slice(0, 3), { weekday: 4 as const, start: "08:00", end: "20:01" }];
    assert.ok(fields({ ...valid(cdi), organization: { mode: "fixed", days: over } }, cdi).includes("days"));
  });
  test("planning vide ou fin avant début invalide", () => {
    assert.ok(fields({ ...valid(cdi), organization: { mode: "fixed", days: [] } }, cdi).includes("days"));
    assert.ok(fields({ ...valid(cdi), organization: { mode: "fixed", days: [{ weekday: 1, start: "10:00", end: "09:00" }] } }, cdi).includes("days"));
  });
  test("jour de repos travaillé invalide", () => {
    const t: ContractTerms = { ...valid(cdi), weeklyRestDays: [1], organization: { mode: "fixed", days: [{ weekday: 1, start: "09:00", end: "12:00" }] } };
    assert.ok(fields(t, cdi).includes("weeklyRestDays"));
  });
  test("repos et 1er mai obligatoires", () => {
    const f = fields({ ...valid(cdi), weeklyRestDays: [], mayFirst: null }, cdi);
    assert.ok(f.includes("weeklyRestDays") && f.includes("mayFirst"));
  });
  test("plus de 6 jours de repos invalide", () => {
    assert.ok(fields({ ...valid(cdi), weeklyRestDays: [1, 2, 3, 4, 5, 6, 7] }, cdi).includes("weeklyRestDays"));
  });
  test("plusieurs jours de repos valides", () => {
    assert.deepEqual(fields({ ...valid(cdi), weeklyRestDays: [6, 7] }, cdi), []);
  });
  test("première mission un jour de repos invalide", () => {
    // start = lundi 2026-11-02
    const f = fields({ ...valid(cdi), weeklyRestDays: [1] }, cdi);
    assert.ok(f.includes("weeklyRestDays"));
  });
  test("planning hors 6 h - 21 h refusé", () => {
    const early = { ...valid(cdi), organization: { mode: "fixed" as const, days: [{ weekday: 2 as const, start: "05:59", end: "12:00" }] } };
    assert.ok(fields(early, cdi).includes("days"));
    const late = { ...valid(cdi), organization: { mode: "fixed" as const, days: [{ weekday: 2 as const, start: "12:00", end: "21:01" }] } };
    assert.ok(fields(late, cdi).includes("days"));
  });
  test("planning 6 h 00 - 21 h 00 accepté", () => {
    const t = { ...valid(cdi), organization: { mode: "fixed" as const, days: [{ weekday: 2 as const, start: "06:00", end: "21:00" }] } };
    assert.deepEqual(fields(t, cdi), []);
  });
  test("délai de congés < 2 mois invalide", () => assert.ok(fields({ ...valid(cdi), leaveNoticeMonths: 1 }, cdi).includes("leaveNoticeMonths")));
  test("texte > 500 invalide", () => assert.ok(fields({ ...valid(cdi), specialConditions: "a".repeat(501) }, cdi).includes("specialConditions")));
});

describe("meetsContractNotice", () => {
  const now = new Date("2026-10-23T12:00:00").getTime();
  test("exactement 5 jours et 8 heures : valide", () => {
    assert.equal(earliestContractMissionTs(now), now + (5 * 24 + 8) * 3_600_000);
    assert.equal(meetsContractNotice(now + (5 * 24 + 8) * 3_600_000, now), true);
  });
  test("une minute de moins : invalide", () => assert.equal(meetsContractNotice(now + (5 * 24 + 8) * 3_600_000 - 60_000, now), false));
});
