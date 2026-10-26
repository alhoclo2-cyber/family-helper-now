import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { store, COMPANIONS } from "./store";
import { setCalendarContracts } from "./contractCalendar";

describe("Isolation des demandes d'exemple", () => {
  for (const id of ["seed-1", "seed-2"]) {
    test(`${id} est exclusivement une mission démo`, () => {
      const request = store.getState().requests.find((r) => r.id === id);
      assert.equal(request?.demo, true);
      const outsideTest = store.getState().requests.filter((r) => !r.demo);
      assert.equal(outsideTest.some((r) => r.id === id), false);
    });
  }
});
test("createRequest n'enregistre jamais une durée inférieure à 1 h", () => {
  const id = store.createRequest({ need: "Pharmacie", address: "1 rue A, Paris", phone: "0600000000", durationHours: 0 });
  assert.equal(store.getState().requests.find((r) => r.id === id)?.durationHours, 1);
});

for (const method of ["acceptRequest", "acceptRequestBy"] as const) {
  for (const flow of ["scheduled", "rapid"] as const) {
    test(`${method}: ${flow} attaches the covering pair contract in the acceptance emission`, () => {
      const start = Date.parse("2099-10-26T10:00:00+01:00");
      setCalendarContracts("family", [{ id: "pair-contract", client_id: "family", companion_ref: "c1", status: "in_force", answers: {}, effective_from: "2099-10-26", effective_until: "2099-10-26" }]);
      const id = store.createRequest({ id: `attach-${method}-${flow}`, need: "Pharmacie", address: "Paris", phone: "", autoSearch: true, ...(flow === "scheduled" ? { scheduledAt: start } : {}) });
      const observed: (string | undefined)[] = [];
      const unsubscribe = store.subscribe(() => {
        const r = store.getState().requests.find(r => r.id === id);
        if (r?.status === "accepted") observed.push(r.contractId);
      });
      try {
        const arrival = flow === "rapid" ? { arrivalAt: start, travelMinutes: 10 } : undefined;
        assert.equal(method === "acceptRequest" ? store.acceptRequest(id, 0, COMPANIONS[0], arrival) : store.acceptRequestBy(id, "c1", arrival), true);
        assert.deepEqual(observed, ["pair-contract"]);
      } finally { unsubscribe(); setCalendarContracts("", []); }
    });
  }
  test(`${method}: other pair, dates outside contract, and unsigned contract do not attach`, () => {
    const start = Date.parse("2099-10-26T10:00:00+01:00");
    const base = { id: "irrelevant", client_id: "family", companion_ref: "c1", status: "in_force", answers: {}, effective_from: "2099-10-26", effective_until: "2099-10-26" };
    try {
      for (const patch of [{ client_id: "other" }, { companion_ref: "c2" }, { effective_from: "2099-10-27" }, { effective_until: "2099-10-25" }, { status: "awaiting_companion" }]) {
        setCalendarContracts("family", [{ ...base, ...patch }]);
        const id = store.createRequest({ need: "Pharmacie", address: "Paris", phone: "", scheduledAt: start });
        assert.equal(method === "acceptRequest" ? store.acceptRequest(id) : store.acceptRequestBy(id, "c1"), true);
        assert.equal(store.getState().requests.find(r => r.id === id)?.contractId, undefined);
      }
    } finally { setCalendarContracts("", []); }
  });
}
