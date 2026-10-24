import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { checkEmployerSignature, companionAnswerDeadline, type SignatureCheckInput } from "./contractSignature";

const DAY = 86_400_000;
const now = new Date("2026-11-02T09:00:00").getTime();
const missionTs = now + 10 * DAY;
const base: SignatureCheckInput = {
  callerId: "u1",
  draft: {
    client_id: "u1",
    status: "draft",
    contract_kind: "cdi",
    answers: { hasEnd: "no", decision_version: 1, certified_at: "2026-11-02", terms_version: 3, terms: { weeklyRestDays: [7], mayFirst: "off", leaveNoticeMonths: 2, trialDays: 0, organization: { mode: "irregular" }, workedHolidays: [] } },
  },
  missionTs,
  nowTs: now,
  cesu: { has_cesu_number: true, cesu_number: "123" },
  otherActive: false,
  salaryNet: 11.5,
};
const code = (patch: Partial<SignatureCheckInput>) => {
  const r = checkEmployerSignature({ ...base, ...patch });
  return r.ok ? "ok" : r.code;
};

describe("checkEmployerSignature", () => {
  test("brouillon valide accepté", () => assert.equal(code({}), "ok"));
  test("refus sans numéro CESU", () => {
    assert.equal(code({ cesu: { has_cesu_number: false, cesu_number: "123" } }), "no_cesu");
    assert.equal(code({ cesu: { has_cesu_number: true, cesu_number: " " } }), "no_cesu");
  });
  test("refus à moins de 5 jours (+ 8 h)", () => {
    assert.equal(code({ missionTs: now + 5 * DAY }), "notice");
    assert.equal(code({ missionTs: now + 5 * DAY + 8 * 3_600_000 }), "ok");
  });
  test("refus d'un brouillon qui n'est pas au particulier connecté", () => assert.equal(code({ callerId: "u2" }), "not_owner"));
  test("refus d'un contrat déjà signé", () => assert.equal(code({ draft: { ...base.draft!, status: "awaiting_companion" } }), "not_draft"));
  test("refus si un autre contrat est actif pour ce binôme", () => assert.equal(code({ otherActive: true }), "pair_active"));
  test("refus si le type enregistré ne correspond pas à la décision", () => assert.equal(code({ draft: { ...base.draft!, contract_kind: "cdd" } }), "decision_invalid"));
  test("refus si les choix du questionnaire 2 sont invalides", () => {
    const answers = { ...(base.draft!.answers as object), terms: { weeklyRestDays: [], mayFirst: "off", leaveNoticeMonths: 1 } };
    assert.equal(code({ draft: { ...base.draft!, answers } }), "terms_invalid");
  });
});

describe("companionAnswerDeadline", () => {
  test("8 h après la signature", () => assert.equal(companionAnswerDeadline(now, now + 10 * DAY), now + 8 * 3_600_000));
  test("4 h si la mission est dans moins de 48 h", () => assert.equal(companionAnswerDeadline(now, now + DAY), now + 4 * 3_600_000));
});
