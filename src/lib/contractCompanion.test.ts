import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  buildFinalContractDocument,
  buildCompanionContractResponse,
  checkCompanionAnswer,
  formatContractAsText,
  maskEmployerForCompanion,
  maskStreetNumber,
  type CompanionAnswerInput,
} from "./contractCompanion";
import type { ContractDocument } from "./contractDocument";

const now = new Date("2026-11-02T09:00:00").getTime();
const base: CompanionAnswerInput = {
  callerId: "comp-1",
  contract: {
    companion_user_id: "comp-1",
    status: "awaiting_companion",
    companion_answer_deadline: new Date(now + 3_600_000).toISOString(),
    document_hash: "abc123",
  },
  nowTs: now,
  recomputedHash: "abc123",
};
const code = (patch: Partial<CompanionAnswerInput>) => {
  const r = checkCompanionAnswer({ ...base, ...patch });
  return r.ok ? "ok" : r.code;
};

describe("checkCompanionAnswer", () => {
  test("réponse valide acceptée", () => assert.equal(code({}), "ok"));
  test("refus si ce n'est pas le compagnon du contrat", () => {
    assert.equal(code({ callerId: "autre" }), "not_companion");
    assert.equal(code({ contract: { ...base.contract!, companion_user_id: null } }), "not_companion");
  });
  test("refus si le statut n'est pas awaiting_companion", () => {
    assert.equal(code({ contract: { ...base.contract!, status: "draft" } }), "not_awaiting");
    assert.equal(code({ contract: { ...base.contract!, status: "in_force" } }), "not_awaiting");
  });
  test("refus si l'échéance est dépassée", () => {
    assert.equal(code({ nowTs: now + 3_600_001 }), "expired");
    assert.equal(code({ contract: { ...base.contract!, companion_answer_deadline: null } }), "expired");
  });
  test("refus si l'empreinte recalculée diffère", () => {
    assert.equal(code({ recomputedHash: "autre" }), "hash_mismatch");
    assert.equal(code({ contract: { ...base.contract!, document_hash: null } }), "hash_mismatch");
  });
});

describe("maskStreetNumber", () => {
  test("retire le numéro de voie", () => {
    assert.equal(maskStreetNumber("12 rue des Lilas, 75014 Paris"), "rue des Lilas, 75014 Paris");
    assert.equal(maskStreetNumber("3 bis avenue Foch, 69006 Lyon"), "avenue Foch, 69006 Lyon");
    assert.equal(maskStreetNumber("rue de la Paix, 75002 Paris"), "rue de la Paix, 75002 Paris");
  });
});

const doc: ContractDocument = {
  version: 1,
  kind: "cdi",
  title: "Contrat de travail à durée indéterminée",
  idcc: "3239",
  employer: [
    { label: "Nom de naissance", value: "Dupont" },
    { label: "Adresse", value: "12 rue des Lilas, 75014 Paris" },
    { label: "Téléphone", value: "0612345678" },
    { label: "E-mail", value: "famille@example.fr" },
    { label: "N° CESU", value: "1234567" },
  ],
  companion: [
    { label: "Nom de naissance", value: "••••" },
    { label: "N° de sécurité sociale", value: "••••" },
  ],
  sections: [
    { number: 3, key: "lieu", title: "Lieu de travail", paragraphs: ["Adresse : 12 rue des Lilas, 75014 Paris.", "Déplacements ponctuels."] },
    { number: 9, key: "remuneration", title: "Rémunération", paragraphs: ["Salaire horaire net de base : 11,50 €."] },
  ],
  emploiPending: false,
};

describe("maskEmployerForCompanion", () => {
  test("masque numéro de voie, téléphone, e-mail et CESU, garde rue et ville", () => {
    const m = maskEmployerForCompanion(doc);
    const get = (l: string) => m.employer.find((f) => f.label === l)?.value;
    assert.equal(get("Adresse"), "rue des Lilas, 75014 Paris");
    assert.equal(get("Téléphone"), "••••");
    assert.equal(get("E-mail"), "••••");
    assert.equal(get("N° CESU"), "••••");
    assert.equal(get("Nom de naissance"), "Dupont");
    assert.equal(m.sections[0].paragraphs[0], "Adresse : rue des Lilas, 75014 Paris.");
    assert.equal(m.sections[1].paragraphs[0], "Salaire horaire net de base : 11,50 €.");
  });
});

describe("getContractForCompanion response", () => {
  test("renvoie uniquement le document employeur masqué sans modifier le snapshot signé", () => {
    const before = JSON.stringify(doc);
    const response = buildCompanionContractResponse({
      document: doc,
      deadline: "2026-11-02T17:00:00.000Z",
      kind: "cdi",
      firstMissionId: "mission-1",
      companion: { birthName: "Nguyen", lastName: "Nguyen", firstName: "Léa", address: "5 rue de la Paix", phone: "0698765432", email: "lea@example.fr", nir: "123456789012345" },
    });
    const fields = Object.fromEntries(response.document.employer.map((f) => [f.label, f.value]));
    assert.equal(fields.Adresse, "rue des Lilas, 75014 Paris");
    assert.equal(fields.Téléphone, "••••");
    assert.equal(fields["E-mail"], "••••");
    assert.equal(fields["N° CESU"], "••••");
    assert.doesNotMatch(JSON.stringify(response.document), /12 rue des Lilas|0612345678|famille@example.fr|1234567/);
    assert.deepEqual(Object.keys(response).sort(), ["companion", "deadline", "document", "firstMissionId", "kind"]);
    assert.equal(JSON.stringify(doc), before);
  });
});

describe("buildFinalContractDocument", () => {
  const employer = {
    birthName: "Dupont", lastName: "Martin", firstName: "Claire",
    birthDate: "1980-04-12", birthPlace: "Lyon", birthDepartment: "69",
    address: "12 rue des Lilas, 75014 Paris", phone: "0612345678", email: "famille@example.fr",
    taxNumber: "1234567890123", cesuNumber: "1234567",
  };
  const companion = {
    birthName: "Nguyen", lastName: "Nguyen", firstName: "Léa",
    birthDate: "2002-09-30", birthPlace: "Paris", birthDepartment: "75",
    address: "5 rue de la Paix, 75002 Paris", phone: "0698765432", email: "lea@example.fr",
    nir: "123456789012345",
  };
  const finalDoc = buildFinalContractDocument(
    { document: doc, signedAt: "2026-11-02T09:00:00.000Z" },
    employer,
    companion,
    "2026-11-02T14:30:00.000Z",
  );

  test("les deux identités sont en clair", () => {
    const text = formatContractAsText(finalDoc);
    assert.match(text, /12 rue des Lilas, 75014 Paris/);
    assert.match(text, /123456789012345/);
    assert.match(text, /1234567890123/);
    assert.doesNotMatch(text, /••••/);
  });
  test("mention de signature électronique des deux parties", () => {
    assert.match(finalDoc.signatureLine ?? "", /Signé électroniquement par Claire Martin le 02\/11\/2026 à 09:00 et par Léa Nguyen le 02\/11\/2026 à 14:30\./);
  });
  test("les sections du document signé sont reprises à l'identique", () => {
    assert.deepEqual(finalDoc.sections, doc.sections);
  });
  test("l'e-mail contient le contrat complet sans masquage", () => {
    const text = formatContractAsText(finalDoc);
    assert.match(text, /Contrat de travail à durée indéterminée/);
    assert.match(text, /3\. Lieu de travail/);
    assert.match(text, /9\. Rémunération/);
    assert.match(text, /L'employeur :/);
    assert.match(text, /Le salarié :/);
  });
});

test("shortNotice is passed through for the companion warning", () => {
  const doc = { version: 2, kind: "cdi" as const, title: "Contrat", idcc: "3239", employer: [{ label: "Téléphone", value: "0600" }], companion: [], sections: [], emploiPending: false };
  const companion = { birthName: "", lastName: "", firstName: "", address: "", phone: "", email: "", nir: "" };
  assert.equal(buildCompanionContractResponse({ document: doc, deadline: "2026-10-30T08:00:00Z", kind: "cdi", firstMissionId: null, companion, shortNotice: true }).shortNotice, true);
  assert.equal(buildCompanionContractResponse({ document: doc, deadline: "2026-10-30T08:00:00Z", kind: "cdi", firstMissionId: null, companion, shortNotice: false }).shortNotice, false);
});
