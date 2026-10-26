import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { checkContractPdf, contractHash, generateContractPdf, pdfText } from "./contractPdf";
import type { ContractDocument } from "./contractDocument";
import { readableFinalDocument } from "./contractFinalStatus";
const doc: ContractDocument = { version: 1, kind: "cdi", title: "Contrat final", idcc: "3239", employer: [{ label: "Prénom", value: "Alice" }], companion: [{ label: "Prénom", value: "Léa" }], sections: [{ number: 1, key: "engagement", title: "Engagement", paragraphs: ["Texte français → retour\nDeuxième ligne 🏠"] }], emploiPending: false, signatureLine: "Signé par les deux parties" };
const c = { client_id: "family", companion_user_id: "lea", status: "in_force", final_document_hash: "hash", final_document: doc };
test("PDF denies a non-party", () => assert.match(checkContractPdf(c, "other", "hash") ?? "", /appartient/));
test("PDF denies non in-force contracts", () => assert.match(checkContractPdf({ ...c, status: "awaiting_companion" }, "family", "hash") ?? "", /vigueur/));
test("PDF denies hash mismatch", () => assert.match(checkContractPdf(c, "lea", "changed") ?? "", /empreinte/));
test("PDF allows each party with matching final hash", () => { assert.equal(checkContractPdf(c, "family", "hash"), null); assert.equal(checkContractPdf(c, "lea", "hash"), null); });
for (const status of ["ended", "terminated", "closed"]) {
  test(`${status}: both parties retain final document and PDF access`, () => {
    assert.equal(readableFinalDocument(status, doc), doc);
    for (const user of ["family", "lea"]) assert.equal(checkContractPdf({ ...c, status }, user, "hash"), null);
    assert.notEqual(checkContractPdf({ ...c, status, final_document: null }, "family", "hash"), null);
    assert.notEqual(checkContractPdf({ ...c, status }, "lea", "changed"), null);
    assert.notEqual(checkContractPdf({ ...c, status }, "other", "hash"), null);
  });
}
for (const status of ["awaiting_companion", "refused", "expired", "draft"]) {
  test(`${status}: no final content or PDF even if supplied`, () => {
    assert.equal(readableFinalDocument(status, doc), null);
    assert.notEqual(checkContractPdf({ ...c, status }, "family", "hash"), null);
  });
}
test("PDF normalizes ligatures and bullet", () => assert.equal(pdfText("œ Œ • cœur Œuvre"), "oe OE - coeur OEuvre"));
test("hash changes if final content changes", async () => assert.notEqual(await contractHash(doc), await contractHash({ ...doc, title: "Changed" })));
test("PDF is valid and includes dedicated certificate page with safe encoding", async () => {
  const bytes = await generateContractPdf({ contractId: "test-contract", document: doc, employerHash: "a".repeat(64), finalHash: await contractHash(doc), events: ["employer_signed", "companion_signed"].map(event => ({ event, occurred_at: "2026-10-25T08:03:00Z", auth_method: "email_otp" })), generatedAt: "2026-10-25T08:04:00Z" });
  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), "%PDF");
  const pdf = await PDFDocument.load(bytes);
  assert.ok(pdf.getPageCount() >= 2);
  assert.equal(pdf.getTitle(), "Contrat final");
  assert.equal(pdfText("français → 🏠"), "français -> ?");
});
test("PDF refuses missing signature log", async () => assert.rejects(generateContractPdf({ contractId: "c", document: doc, employerHash: "a", finalHash: "b", events: [], generatedAt: "2026-10-25T08:03:00Z" }), /incomplet/));