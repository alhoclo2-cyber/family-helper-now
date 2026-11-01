import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { store } from "./store";
import { checkContractRequirement } from "./contractCompliance";
import { OPEN_CONTRACT_STATUSES } from "./contractWithdrawal";
import { contractsForPerson, mandataireDocument } from "./mandataireModel";
import { checkCompanionAnswer } from "./contractCompanion";

test("autonomous RPC updates only overdue awaiting contracts and records atomic expiry", () => {
  const sql = readFileSync("drizzle/migrations/0018_contract_automatic_expiration.sql", "utf8");
  assert.match(sql, /WHERE status = 'awaiting_companion' AND companion_signed_at IS NULL AND companion_answer_deadline < now\(\)/);
  assert.match(sql, /DELETE FROM public.contract_signature_codes WHERE contract_id = r.id/);
  assert.match(sql, /VALUES\(r.id,'expired',NULL,'system',now\(\)\)/);
  assert.match(sql, /UNIQUE \(contract_id, recipient_role\)/);
  const events = readFileSync("drizzle/migrations/0019_allow_contract_expired_signature_event.sql", "utf8");
  assert.match(events, /CHECK \(event IN \([^;]+'expired'\)\)/);
});
test("expired releases the open pair", () => assert.equal(OPEN_CONTRACT_STATUSES.includes("expired"), false));
test("expired assignment stops counting in weekly hours", () => {
  const start = Date.parse("2099-12-07T10:00:00Z");
  const id = store.createRequest({ id: "expiration-hours", need: "Pharmacie", address: "Paris", phone: "", scheduledAt: start, durationHours: 3, contractId: "expiration-hours-c", contractAnswerDeadline: start - 1 });
  store.acceptRequestBy(id, "c1");
  assert.equal(checkContractRequirement("c1", start + 86400000, 1, store.getState().requests).requiresContract, true);
  store.releaseContractRequest(id, "c1", "expired", false);
  assert.equal(checkContractRequirement("c1", start + 86400000, 1, store.getState().requests).requiresContract, false);
  const r = store.getState().requests.find(r => r.id === id);
  assert.equal(r?.contractId, undefined);
  assert.equal(r?.contractEndedNotice, "expired");
});
test("expired assignment breaks consecutive-week count", () => {
  const start = Date.parse("2099-01-05T10:00:00Z");
  const ids: string[] = [];
  for (let w = 0; w < 4; w++) {
    const id = store.createRequest({ id: `expiration-week-${w}`, need: "Pharmacie", address: "Paris", phone: "", scheduledAt: start + w * 7 * 86400000, durationHours: 1, contractId: `expiration-week-c-${w}`, contractAnswerDeadline: start - 1 });
    store.acceptRequestBy(id, "c2"); ids.push(id);
  }
  assert.equal(checkContractRequirement("c2", start + 28 * 86400000, 1, store.getState().requests).consecutiveWeeksReached, true);
  store.releaseContractRequest(ids[2], "c2", "expired", false);
  assert.equal(checkContractRequirement("c2", start + 28 * 86400000, 1, store.getState().requests).consecutiveWeeksReached, false);
});
test("Mandataire retains expired database status in dossiers without final content", () => {
  const rows = contractsForPerson([{ client_id: "f", companion_user_id: "c", status: "expired" }], "f", "client");
  assert.equal(rows[0]?.status, "expired");
  assert.equal(mandataireDocument("expired", { private: true }), null);
});
test("expired companion contract reports expired rather than generic not_awaiting", () => {
  assert.deepEqual(checkCompanionAnswer({ callerId: "c", contract: { companion_user_id: "c", status: "expired", companion_answer_deadline: "2026-01-01T00:00:00Z", document_hash: "h" }, nowTs: Date.parse("2026-11-01T00:00:00Z"), recomputedHash: "h" }), { ok: false, code: "expired" });
});