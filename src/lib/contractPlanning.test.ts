import { test } from "node:test";
import assert from "node:assert/strict";
import { buildContractPlanning, planningIsDuplicate, type PlanningContract } from "./contractPlanning";
import { COMPANIONS, type Request } from "./store";
const c: PlanningContract = { id: "contract", companion_ref: "c1", status: "in_force", effective_from: "2026-10-01", effective_until: null, answers: { terms: { organization: { mode: "irregular" }, weeklyRestDays: [7], mayFirst: "off", workedHolidays: [] } }, final_document: { version: 1, title: "CDI", kind: "cdi", idcc: "3239", employer: [], companion: [], sections: [], emploiPending: false } };
const req = (id: string, day: string): Request => ({ id, contractId: c.id, student: COMPANIONS[0], scheduledAt: Date.parse(day), status: "accepted", durationHours: 1, address: "12 rue des Lilas, Paris", need: "Présence et Compagnie", city: "Paris", seniorName: "Famille", phone: "", createdAt: 0 });
test("no planning means no email", () => assert.equal(buildContractPlanning(c, [], 0), null));
test("fixed planning exists without missions", () => assert.match(buildContractPlanning({ ...c, answers: { terms: { organization: { mode: "fixed", days: [{ weekday: 1, start: "10:00", end: "11:00" }] } } } }, [], 0) ?? "", /Lundi : 10:00/));
test("complete mission planning is sorted by date", () => {
  const body = buildContractPlanning(c, [req("later", "2026-11-04T10:00:00Z"), req("earlier", "2026-11-02T10:00:00Z")], 0) ?? "";
  assert.ok(body.indexOf("lundi 2 novembre") < body.indexOf("mercredi 4 novembre"));
  assert.ok(body.includes("12 rue des Lilas, Paris")); assert.ok(body.includes("Dimanche")); assert.ok(body.includes("1er mai : chômé"));
});
test("cancelled and other contract missions are omitted", () => assert.equal(buildContractPlanning(c, [{ ...req("a", "2026-11-02T10:00:00Z"), status: "cancelled" }, { ...req("b", "2026-11-02T10:00:00Z"), contractId: "other" }], 0), null));
test("successive identical planning is suppressed", () => { assert.equal(planningIsDuplicate("same", "same"), true); assert.equal(planningIsDuplicate("old", "new"), false); assert.equal(planningIsDuplicate("old", null), true); });