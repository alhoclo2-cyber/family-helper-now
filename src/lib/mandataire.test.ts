import { test } from "node:test";
import assert from "node:assert/strict";
import { assertMandataireAccess } from "./mandataireAccess";
import { contractsForPerson, mandataireDocument, dossierLogMatches } from "./mandataireModel";
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
test("access logging persists action, actor and object and refuses failed logging", async () => {
  const saved: unknown[] = [];
  const admin = { from: () => ({ insert: async (row: unknown) => { saved.push(row); return { error: null }; } }) } as unknown as SupabaseClient<Database>;
  await recordMandataireAccess(admin, "actor", "contract_view", "contract", "c");
  assert.deepEqual(saved, [{ actor_id: "actor", action: "contract_view", object_type: "contract", object_id: "c" }]);
  const denied = { from: () => ({ insert: async () => ({ error: { message: "failed" } }) }) } as unknown as SupabaseClient<Database>;
  await assert.rejects(recordMandataireAccess(denied, "actor", "pdf_download", "contract", "c"), /enregistrer/);
});