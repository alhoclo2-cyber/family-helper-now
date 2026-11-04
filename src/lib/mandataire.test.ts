import { test } from "node:test";
import assert from "node:assert/strict";
import { assertMandataireAccess } from "./mandataireAccess";
import { contractsForPerson, mandataireDocument, dossierLogMatches, isCompanionSelfiePath, sortContractsByDate, sortMissionsByStartDesc, sortPaymentsByChargeDesc } from "./mandataireModel";
import { recordMandataireAccess } from "./mandataireLog.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { checkContractPdf } from "./contractPdf";
test("non-Mandataire refused even with strong authentication", () => assert.throws(() => assertMandataireAccess(false, { amr: [{ method: "otp" }] }), /réservé/));
test("Mandataire without strong authentication refused", () => assert.throws(() => assertMandataireAccess(true, { amr: [{ method: "password" }] }), /authentification/));
test("Mandataire with OTP allowed", () => assert.doesNotThrow(() => assertMandataireAccess(true, { amr: [{ method: "otp" }] })));
for (const status of ["awaiting_companion", "refused", "expired", "draft"]) test(`${status} returns no contract content`, () => assert.equal(mandataireDocument(status, { secret: "family" }), null));
for (const status of ["in_force", "ended", "terminated", "closed"]) test(`${status} permits final PDF with matching hash only`, () => {
  const c = { client_id: "family", companion_user_id: "lea", status, final_document: {}, final_document_hash: "hash" };
  assert.equal(checkContractPdf(c, "family", "hash"), null);
  assert.notEqual(checkContractPdf(c, "family", "invalid"), null);
});
test("contracts attach to both dossiers, excluding drafts and fictitious companions", () => {
  const rows = [{ client_id: "a", companion_user_id: "b", status: "in_force" }, { client_id: "a", companion_user_id: null, status: "in_force" }, { client_id: "a", companion_user_id: "b", status: "draft" }];
  assert.equal(contractsForPerson(rows, "a", "client").length, 2);
  assert.equal(contractsForPerson(rows, "b", "companion").length, 1);
  assert.equal(contractsForPerson(rows, "c1", "companion").length, 0);
});
test("dossier journal matches document ownership and both contract parties", () => {
  assert.equal(dossierLogMatches({ object_type: "document", object_id: "a/file.pdf" }, "a", []), true);
  assert.equal(dossierLogMatches({ object_type: "document", object_id: "b/file.pdf" }, "a", []), false);
  assert.equal(dossierLogMatches({ object_type: "contract", object_id: "c" }, "a", ["c"]), true);
});
const logAdmin = (recent: unknown[], saved: unknown[], insertError: unknown = null) => ({
  from: () => ({
    select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ gte: () => ({ limit: async () => ({ data: recent, error: null }) }) }) }) }) }),
    insert: async (row: unknown) => { saved.push(row); return { error: insertError }; },
  }),
}) as unknown as SupabaseClient<Database>;
test("access logging persists action, actor and object and refuses failed logging", async () => {
  const saved: unknown[] = [];
  await recordMandataireAccess(logAdmin([], saved), "actor", "contract_view", "contract", "c");
  assert.deepEqual(saved, [{ actor_id: "actor", action: "contract_view", object_type: "contract", object_id: "c" }]);
  const denied: unknown[] = [];
  await assert.rejects(recordMandataireAccess(logAdmin([], denied, { message: "failed" }), "actor", "pdf_download", "contract", "c"), /enregistrer/);
});
test("access logging skips a duplicate identical row less than 10 minutes old", async () => {
  const saved: unknown[] = [];
  await recordMandataireAccess(logAdmin([{ id: "recent" }], saved), "actor", "document_open", "document", "a/file.pdf");
  assert.equal(saved.length, 0);
});
test("selfie thumbnail URL is only served for an existing application selfie path", () => {
  assert.equal(isCompanionSelfiePath("u1/selfie.jpg", ["u1/selfie.jpg", "u2/selfie.jpg"]), true);
  assert.equal(isCompanionSelfiePath("u1/rib.pdf", ["u1/selfie.jpg"]), false);
  assert.equal(isCompanionSelfiePath("", ["u1/selfie.jpg"]), false);
  assert.equal(isCompanionSelfiePath("u1/selfie.jpg", [null]), false);
});
test("contracts sort: no start date first by creation desc, then start date desc", () => {
  const rows = [
    { id: "old-start", effective_from: "2026-01-10", created_at: "2026-01-01" },
    { id: "no-start-old", effective_from: null, created_at: "2026-02-01" },
    { id: "new-start", effective_from: "2026-03-01", created_at: "2026-01-15" },
    { id: "no-start-new", effective_from: null, created_at: "2026-02-10" },
  ];
  assert.deepEqual(sortContractsByDate(rows).map(r => r.id), ["no-start-new", "no-start-old", "new-start", "old-start"]);
});
test("missions sort by start desc and payments by scheduled charge desc", () => {
  const missions = [{ id: "a", start: 100 }, { id: "b", start: 300 }, { id: "c", start: null }];
  assert.deepEqual(sortMissionsByStartDesc(missions, m => m.start).map(m => m.id), ["b", "a", "c"]);
  const payments = [{ id: "a", scheduled_charge_at: "2026-01-05T10:00:00Z" }, { id: "b", scheduled_charge_at: "2026-02-01T10:00:00Z" }, { id: "c", scheduled_charge_at: null }];
  assert.deepEqual(sortPaymentsByChargeDesc(payments).map(p => p.id), ["b", "a", "c"]);
});