import { test } from "node:test";
import assert from "node:assert/strict";
import { store, type Request } from "./store";
import { readEmails } from "./simulatedEmails";

test("un seul e-mail simulé par acceptation, réinitialisé après refus, démos et RDV exclus", () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "window", { configurable: true, value: { dispatchEvent: () => true } });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v) } });
  try {
    const base: Request = { id: "sim-notification", need: "Pharmacie", address: "Paris", city: "Paris", phone: "", seniorName: "Vous", createdAt: Date.now(), status: "searching", durationHours: 1 };
    store.setSimulatedRequests([base]);
    assert.equal(store.acceptRequest(base.id), true);
    const first = store.getState().requests.find((r) => r.id === base.id);
    assert.equal(typeof first?.familyNotifiedAt, "number");
    store.notifyFamilyAcceptance(base.id);
    assert.equal(store.acceptRequestBy(base.id, "c2"), false);
    assert.equal(readEmails().filter((e) => e.kind === "family_acceptance_notification").length, 1);

    store.refuseCompanion(base.id, "Heure d'arrivée trop tardive");
    assert.equal(store.getState().requests.find((r) => r.id === base.id)?.familyNotifiedAt, undefined);
    assert.equal(store.acceptRequestBy(base.id, "c2"), true);
    assert.equal(readEmails().filter((e) => e.kind === "family_acceptance_notification").length, 2);
    store.acknowledgeRequest(base.id);
    store.notifyFamilyAcceptance(base.id);
    assert.equal(readEmails().filter((e) => e.kind === "family_acceptance_notification").length, 2);

    for (const patch of [{ demo: true }, { scheduledAt: Date.now() + 86_400_000 }]) {
      store.setSimulatedRequests([{ ...base, ...patch }]);
      assert.equal(store.acceptRequestBy(base.id, "c1"), true);
      assert.equal(store.getState().requests.find((r) => r.id === base.id)?.familyNotifiedAt, undefined);
    }
    assert.equal(readEmails().filter((e) => e.kind === "family_acceptance_notification").length, 2);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (previousStorage) Object.defineProperty(globalThis, "localStorage", previousStorage);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});