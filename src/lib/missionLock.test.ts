import { describe, test as it } from "node:test";
import assert from "node:assert/strict";
const expect = (v: unknown) => ({ toBe: (e: unknown) => assert.equal(v, e), toHaveLength: (n: number) => assert.equal((v as unknown[]).length, n), toBeUndefined: () => assert.equal(v, undefined) });
import { store } from "./store";

const mk = (offsetMs: number) => {
  const id = store.createRequest({ need: "companionship", address: "1 rue, Laon", scheduledAt: Date.now() + offsetMs, durationHours: 2 } as never);
  store.acceptRequest(id);
  return id;
};
const get = (id: string) => store.getState().requests.find((r) => r.id === id)!;

describe("verrouillage des missions", () => {
  it("mission commencée : annulation refusée", () => {
    const id = mk(-60_000);
    store.cancelRequest(id, false, "x");
    expect(get(id).status).toBe("accepted");
  });
  it("mission commencée : horaire non modifiable, suivi modifiable", () => {
    const id = mk(-60_000);
    const before = get(id).scheduledAt;
    store.updateRequest(id, { scheduledAt: 1, acknowledged: true });
    expect(get(id).scheduledAt).toBe(before);
    expect(get(id).acknowledged).toBe(true);
  });
  it("mission commencée : désistement compagnon refusé", () => {
    const id = mk(-60_000);
    store.releaseRequest(id);
    expect(get(id).status).toBe("accepted");
  });
  it("mission à plus de 24 h : annulation possible", () => {
    const id = mk(48 * 3600_000);
    store.cancelRequest(id, true, "x");
    expect(get(id).status).toBe("cancelled");
  });
  it("incident : ne clôture pas la mission", () => {
    const id = mk(-60_000);
    store.addIncident(id, { by: "family", reason: "Autre raison", createdAt: Date.now() });
    store.addIncident(id, { by: "companion", reason: "Autre raison", createdAt: Date.now() });
    expect(get(id).incidents).toHaveLength(2);
    expect(get(id).completion).toBeUndefined();
    expect(get(id).status).toBe("accepted");
  });
  it("test : décalage horaire possible même commencée", () => {
    const id = mk(-60_000);
    store.shiftMissionTimeForTest(id, { scheduledAt: 5 });
    expect(get(id).scheduledAt).toBe(5);
  });
});
