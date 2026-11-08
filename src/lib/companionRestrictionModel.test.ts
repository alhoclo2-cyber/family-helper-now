import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyRestriction, transitionRestriction, CLOSURE_DELAY_MS, ARCHIVE_RETENTION_YEARS, companionClosureBlockers } from "./companionRestrictionModel";
test("suspension requires ten characters and retains date and author", () => {
  assert.throws(() => transitionRestriction(emptyRestriction(), "suspension", "agent", "123456789", 100), /10/);
  const s = transitionRestriction(emptyRestriction(), "suspension", "agent", "1234567890", 100);
  assert.equal(s.status, "suspended"); assert.equal(s.suspendedAt, 100); assert.equal(s.author, "agent");
});
test("closure requires suspension and lasts exactly fourteen days", () => {
  assert.throws(() => transitionRestriction(emptyRestriction(), "closure_requested", "agent", "motif assez long", 100));
  const s = transitionRestriction(emptyRestriction(), "suspension", "agent", "motif assez long", 100);
  const pending = transitionRestriction(s, "closure_requested", "agent", "motif assez long", 200);
  assert.equal(pending.closureAt, 200 + 14 * 86400000);
  assert.throws(() => transitionRestriction(pending, "closure_effective", "system", "", 200 + CLOSURE_DELAY_MS - 1));
  assert.equal(transitionRestriction(pending, "closure_effective", "system", "", 200 + CLOSURE_DELAY_MS).status, "closed");
});
test("closure cancellation returns to suspended and records author", () => {
  const s = transitionRestriction(emptyRestriction(), "suspension", "agent", "motif assez long", 100);
  const pending = transitionRestriction(s, "closure_requested", "agent", "motif assez long", 200);
  const cancelled = transitionRestriction(pending, "closure_cancelled", "agent2", "", 300);
  assert.equal(cancelled.status, "suspended"); assert.equal(cancelled.closureAt, undefined);
  assert.equal(cancelled.history.at(-1)?.actor, "agent2");
});
test("default archive retention is five years", () => assert.equal(ARCHIVE_RETENTION_YEARS, 5));
test("all five unfinished obligation categories block closure", () => {
  assert.deepEqual(companionClosureBlockers([
    { status: "accepted", start: 100, end: 200 },
    { status: "accepted", start: 1, end: 2, completion: "pending" },
    { status: "accepted", start: 1, end: 2, completion: "validated" },
  ], [{ status: "en_attente_debit", refund_status: "demande" }], 150), ["Mission à venir ou en cours", "Heures non confirmées", "Déclaration URSSAF non envoyée", "Paiement en attente ou en échec", "Remboursement en attente"]);
});
test("completed declared missions and settled payments do not block", () => {
  assert.deepEqual(companionClosureBlockers([{ status: "accepted", start: 1, end: 2, completion: "validated", declaredAt: 3 }], [{ status: "debite", refund_status: "aucun" }], 150), []);
});