import { test } from "node:test";
import assert from "node:assert/strict";
import { store, type Request } from "./store";
import { runUnconfirmedExpiry, unconfirmedCancellationCode } from "./unconfirmedExpiry";

const at = (time: string) => Date.parse(`2026-10-18T${time}+02:00`);
const request = (patch: Partial<Request> = {}): Request => ({
  id: "sim-expiry", need: "Pharmacie", address: "Paris", city: "Paris", phone: "", seniorName: "Vous",
  createdAt: at("18:00:00"), status: "searching", durationHours: 2, ...patch,
});

test("recherche et acceptation non confirmée : fin à 21 h pile autorisée, une milliseconde après annulée", () => {
  for (const status of ["searching", "accepted"] as const) {
    const r = request({ status });
    assert.equal(unconfirmedCancellationCode(r, at("19:00:00")), undefined);
    assert.equal(unconfirmedCancellationCode(r, at("19:00:00") + 1), "out_of_hours");
  }
});
test("limite de fin calculée sur le jour courant à Paris, été et hiver", () => {
  for (const now of [Date.parse("2026-10-18T19:00:00+02:00"), Date.parse("2026-12-18T19:00:00+01:00")]) {
    assert.equal(unconfirmedCancellationCode(request(), now), undefined);
    assert.equal(unconfirmedCancellationCode(request(), now + 60_000), "out_of_hours");
  }
});
test("démo, rendez-vous, missions confirmées et annulées exclus du contrôle", () => {
  const now = at("22:00:00");
  for (const patch of [{ demo: true }, { scheduledAt: at("23:00:00") }, { acknowledged: true }, { status: "cancelled" as const }]) {
    assert.equal(unconfirmedCancellationCode(request(patch), now), undefined);
  }
});
test("expiration de réponse conservée : au-delà de 5 minutes, pas à 5 minutes pile", () => {
  const acceptedAt = at("10:00:00");
  const r = request({ status: "accepted", acceptedAt });
  assert.equal(unconfirmedCancellationCode(r, acceptedAt + 5 * 60_000), undefined);
  assert.equal(unconfirmedCancellationCode(r, acceptedAt + 5 * 60_000 + 1), "no_response");
});
test("balayage : annulation système hors horaires et compagnon libéré de l'attente", () => {
  const r = request({ status: "accepted", student: { ...store.getState().requests[0]?.student } as Request["student"] });
  store.setSimulatedRequests([r]);
  runUnconfirmedExpiry(at("19:01:00"));
  const cancelled = store.getState().requests.find((x) => x.id === r.id);
  assert.equal(cancelled?.status, "cancelled");
  assert.equal(cancelled?.cancelledBy, "system");
  assert.equal(cancelled?.cancelCode, "out_of_hours");
});