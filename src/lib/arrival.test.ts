import { test } from "node:test";
import assert from "node:assert/strict";
import { checkArrival, simulatedArrival, arrivalTimeToday } from "./arrival";
import { store, missionStartedFor, type Request } from "./store";
import { getMissionStart, getMissionEnd, shiftMissionEnd, runClosureCheck } from "./missionClosure";

const at = (time: string) => Date.parse(`2026-10-17T${time}:00+02:00`);
const check = (time: string, durationHours = 1, travelMinutes = 10, now = at("10:00")) => checkArrival({ arrivalAt: at(time), durationHours, travelMinutes, now });
test("départ au moins 5 minutes après maintenant, 5 minutes pile autorisées", () => {
  assert.equal(check("10:14").ok, false);
  assert.equal(check("10:15").ok, true);
  assert.equal(check("10:15").departAt, at("10:05"));
});
test("arrivée avant 6 h refusée, 6 h pile autorisée", () => {
  assert.equal(check("05:59", 1, 0, at("05:00")).ok, false);
  assert.equal(check("06:00", 1, 0, at("05:00")).ok, true);
});
test("fin à 21 h autorisée, au-delà refusée avec fin réelle", () => {
  assert.equal(check("19:00", 2).ok, true);
  const result = check("19:01", 2);
  assert.equal(result.ok, false);
  assert.equal(result.endAt, at("21:01"));
  assert.equal(check("20:00", 5).ok, false);
});
test("trajet entier positif ou nul, sans plafond d'arrivée", () => {
  assert.equal(check("18:00", 1, 0).ok, true);
  assert.equal(check("18:00", 1, -1).ok, false);
  assert.equal(check("18:00", 1, 1.5).ok, false);
});
test("simulation : trajet arrondi 5 + 3 × distance, arrivée +8 minutes + trajet", () => {
  const result = simulatedArrival(1.2, 2, at("10:00"));
  assert.equal(result?.travelMinutes, 9);
  assert.equal(result?.arrivalAt, at("10:17"));
  assert.equal(simulatedArrival(1.2, 2, at("20:00")), undefined);
});
test("saisie HH:MM interprétée en heure de Paris", () => {
  assert.equal(arrivalTimeToday("12:30", at("10:00")), at("12:30"));
});
test("acceptRequest et acceptRequestBy enregistrent arrivée et trajet avec acceptation", () => {
  for (const by of [false, true]) {
    const now = Date.now();
    const arrivalAt = arrivalTimeToday("18:00", now);
    const fakeNow = arrivalTimeToday("10:00", now);
    const original = Date.now;
    Date.now = () => fakeNow;
    try {
      const id = `arrival-accept-${by}`;
      store.setSimulatedRequests([{ id, need: "Pharmacie", address: "Laon", city: "Laon", phone: "", seniorName: "Démo", createdAt: fakeNow, status: "searching", durationHours: 1 }]);
      const arrival = { arrivalAt, travelMinutes: 12 };
      assert.equal(by ? store.acceptRequestBy(id, "c1", arrival) : store.acceptRequest(id, 0, undefined, arrival), true);
      const r = store.getState().requests.find((r) => r.id === id);
      assert.equal(r?.arrivalAt, arrivalAt);
      assert.equal(r?.travelMinutes, 12);
      assert.equal(r?.acceptedAt, fakeNow);
    } finally { Date.now = original; }
  }
});
test("début rapide à arrivalAt, ancien début +30 min en absence, RDV prioritaire", () => {
  const r = { acceptedAt: at("10:00"), arrivalAt: at("11:00"), durationHours: 2 } as Request;
  assert.equal(getMissionStart(r), at("11:00"));
  assert.equal(getMissionEnd(r), at("13:00"));
  assert.equal(missionStartedFor(r, at("10:45")), false);
  assert.equal(missionStartedFor(r, at("11:00")), true);
  assert.equal(getMissionStart({ ...r, arrivalAt: undefined }), at("10:30"));
  assert.equal(getMissionStart({ ...r, scheduledAt: at("12:00") }), at("12:00"));
});
test("panneau de temps décale arrivalAt et acceptedAt ensemble, validation à 48 h", () => {
  const r: Request = { id: "arrival-shift", need: "Pharmacie", address: "Laon", city: "Laon", phone: "", seniorName: "Démo", createdAt: at("10:00"), status: "accepted", acceptedAt: at("10:00"), arrivalAt: at("11:00"), travelMinutes: 10, durationHours: 2 };
  store.setSimulatedRequests([r]);
  shiftMissionEnd(r, 48 * 3600_000 + 60_000);
  const shifted = store.getState().requests.find((x) => x.id === r.id);
  assert.ok(shifted);
  assert.equal((shifted.arrivalAt ?? 0) - (shifted.acceptedAt ?? 0), 3600_000);
  runClosureCheck(r.id);
  assert.equal(store.getState().requests.find((x) => x.id === r.id)?.completion, "auto_validated");
});