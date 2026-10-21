import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { startOfWeek, subWeeks } from "date-fns";
import { checkContractRequirement } from "./contractCompliance";
import { getPairState } from "./contractEligibility";
import { COMPANIONS, type Request } from "./store";
import { matchesCompanionSearch } from "./companionLabel";

const lea = COMPANIONS[0];
const booking = new Date(2026, 9, 21, 10).getTime(); // mercredi
const weekStart = startOfWeek(new Date(booking), { weekStartsOn: 1 });
const req = (id: string, ts: number, h = 1): Request => ({
  id, need: "Présence et Compagnie", address: "x", city: "x", phone: "", seniorName: "x",
  createdAt: ts, scheduledAt: ts, durationHours: h, status: "accepted", student: lea,
});
const pastWeeks = (n: number) =>
  Array.from({ length: n }, (_, i) => req(`w${i}`, subWeeks(weekStart, i + 1).getTime() + 86_400_000));

describe("Seuil de contrat écrit", () => {
  test("3 h pile dans la semaine : pas de contrat", () => {
    assert.equal(checkContractRequirement(lea.id, booking, 1, [req("a", weekStart.getTime() + 3_600_000, 2)]).requiresContract, false);
  });
  test("3,5 h dans la semaine : contrat", () => {
    assert.equal(checkContractRequirement(lea.id, booking, 1.5, [req("a", weekStart.getTime() + 3_600_000, 2)]).requiresContract, true);
  });
  test("4ᵉ semaine consécutive : pas de contrat", () => {
    assert.equal(checkContractRequirement(lea.id, booking, 1, pastWeeks(3)).requiresContract, false);
  });
  test("5ᵉ semaine consécutive : contrat", () => {
    assert.equal(checkContractRequirement(lea.id, booking, 1, pastWeeks(4)).requiresContract, true);
  });
});

describe("getPairState", () => {
  const base = { companionId: lea.id, bookingTs: booking, durationHours: 1 };
  test("contrat en vigueur", () => {
    assert.equal(getPairState({ ...base, requests: pastWeeks(4), inForceRefs: new Set([lea.id]) }), "in_force");
  });
  test("seuil atteint", () => {
    assert.equal(getPairState({ ...base, requests: pastWeeks(4), inForceRefs: new Set() }), "threshold_reached");
  });
  test("libre", () => {
    assert.equal(getPairState({ ...base, requests: pastWeeks(3), inForceRefs: new Set() }), "free");
  });
  test("la demande en cours, exclue, ne compte pas", () => {
    const current = req("current", booking, 3);
    const all = [current, req("a", weekStart.getTime() + 3_600_000, 1)];
    assert.equal(getPairState({ ...base, requests: all, inForceRefs: new Set() }), "threshold_reached");
    assert.equal(getPairState({ ...base, requests: all.filter((r) => r.id !== "current"), inForceRefs: new Set() }), "free");
  });
});

describe("Recherche d'un compagnon", () => {
  const names = (q: string) => COMPANIONS.filter((c) => matchesCompanionSearch(c, q)).map((c) => c.firstName);
  test("prénom sans accents ni majuscules", () => {
    assert.deepEqual(names("lea"), ["Léa"]);
    assert.ok(names("ma").includes("Malik"));
  });
  test("numéro avec ou sans zéros ni n°", () => {
    for (const q of ["3", "0003", "n°3", "n° 0003"]) assert.deepEqual(names(q), ["Camille"]);
  });
  test("nom de famille non recherché", () => {
    assert.deepEqual(names("Martin"), []);
  });
});
