import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkEmployerWithdrawal, OPEN_CONTRACT_STATUSES, withdrawalEditRequest } from "./contractWithdrawal";
import { checkContractRequirement } from "./contractCompliance";
import { store } from "./store";

test("withdrawal allowed only for owner awaiting companion", () => {
  assert.deepEqual(checkEmployerWithdrawal({ client_id: "f", status: "awaiting_companion", companion_signed_at: null }, "f"), { ok: true });
  assert.equal(checkEmployerWithdrawal({ client_id: "x", status: "awaiting_companion", companion_signed_at: null }, "f").ok, false);
});
for (const status of ["in_force", "refused", "expired", "withdrawn"]) test(`race with ${status} gives already_answered`, () => {
  assert.deepEqual(checkEmployerWithdrawal({ client_id: "f", status, companion_signed_at: null }, "f"), { ok: false, code: "already_answered" });
});
test("withdrawn releases pair and RPC serializes concurrent answers", () => {
  assert.equal(OPEN_CONTRACT_STATUSES.includes("withdrawn"), false);
  const sql = readFileSync("drizzle/migrations/0011_contract_foundation.sql", "utf8");
  assert.match(sql, /one_active_pair[^;]+WHERE status IN \('draft','awaiting_companion','in_force'\)/);
  const rpc = readFileSync("drizzle/migrations/0017_contract_employer_withdrawal.sql", "utf8");
  assert.match(rpc, /FOR UPDATE/); assert.match(rpc, /employer_withdrawn/); assert.match(rpc, /TO service_role/);
});
test("withdrawn mission no longer counts toward 3 h threshold", () => {
  const start = Date.parse("2099-11-02T10:00:00Z");
  const id = store.createRequest({ id: "withdraw-threshold", need: "Pharmacie", address: "Paris", phone: "", scheduledAt: start, durationHours: 3, contractId: "withdraw-c", contractAnswerDeadline: start - 1 });
  store.acceptRequestBy(id, "c1");
  assert.equal(checkContractRequirement("c1", start + 86400000, 1, store.getState().requests).requiresContract, true);
  store.withdrawContractRequest("withdraw-c");
  const r = store.getState().requests.find(x => x.id === id);
  assert.ok(r); assert.equal(r.status, "cancelled"); assert.equal(r.paid, false);
  assert.equal(checkContractRequirement("c1", start + 86400000, 1, store.getState().requests).requiresContract, false);
  assert.equal(withdrawalEditRequest(r).contractId, undefined);
});