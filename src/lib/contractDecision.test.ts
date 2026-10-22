import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { addMonths, format, startOfDay, subDays } from "date-fns";
import { decideContractKind, validateAnswers, END_DATE_TOO_EARLY, END_DATE_TOO_LATE, type ContractAnswers } from "./contractDecision";

const missionTs = new Date(2026, 9, 21, 10).getTime(); // 21/10/2026
const day = (d: Date) => format(d, "yyyy-MM-dd");
const missionDay = day(startOfDay(new Date(missionTs)));
const maxEnd = day(addMonths(startOfDay(new Date(missionTs)), 18));
const beyondMax = day(addMonths(startOfDay(new Date(missionTs)), 18).getTime() + 86_400_000 as unknown as Date);

const replaced = { firstName: "Marie", lastName: "Dupont", role: "aide à domicile" };
const cddBase: ContractAnswers = { hasEnd: "yes", replacesAbsentEmployee: true, replaced };

describe("decideContractKind", () => {
  test("question 1 « Non » : CDI", () => {
    assert.equal(decideContractKind({ hasEnd: "no" }, { missionTs }), "cdi");
  });
  test("question 1 « Je ne sais pas » : CDI", () => {
    assert.equal(decideContractKind({ hasEnd: "unknown" }, { missionTs }), "cdi");
  });
  test("oui + question 2 « Non » : CDI", () => {
    assert.equal(decideContractKind({ hasEnd: "yes", replacesAbsentEmployee: false }, { missionTs }), "cdi");
  });
  test("remplacement complet + date précise dans les 18 mois : CDD", () => {
    assert.equal(decideContractKind({ ...cddBase, endMode: "date", endDate: missionDay }, { missionTs }), "cdd");
  });
  test("exactement 18 mois : CDD", () => {
    assert.equal(decideContractKind({ ...cddBase, endMode: "date", endDate: maxEnd }, { missionTs }), "cdd");
  });
  test("18 mois plus un jour : CDI", () => {
    assert.equal(decideContractKind({ ...cddBase, endMode: "date", endDate: day(new Date(addMonths(startOfDay(new Date(missionTs)), 18).getTime() + 86_400_000)) }, { missionTs }), "cdi");
  });
  test("« Au retour du salarié remplacé » : CDD", () => {
    assert.equal(decideContractKind({ ...cddBase, endMode: "return" }, { missionTs }), "cdd");
  });
  test("réponse manquante (pas de fin de contrat) : CDI", () => {
    assert.equal(decideContractKind(cddBase, { missionTs }), "cdi");
  });
  test("salarié remplacé incomplet : CDI", () => {
    assert.equal(decideContractKind({ hasEnd: "yes", replacesAbsentEmployee: true, replaced: { firstName: "", lastName: "Dupont", role: "aide" }, endMode: "return" }, { missionTs }), "cdi");
  });
});

describe("validateAnswers", () => {
  test("CDI : aucune erreur", () => {
    assert.deepEqual(validateAnswers({ hasEnd: "no" }, { missionTs }), []);
  });
  test("date de fin le jour de la mission : valide", () => {
    assert.deepEqual(validateAnswers({ ...cddBase, endMode: "date", endDate: missionDay }, { missionTs }), []);
  });
  test("date de fin la veille de la mission : invalide", () => {
    const errs = validateAnswers({ ...cddBase, endMode: "date", endDate: day(subDays(new Date(missionTs), 1)) }, { missionTs });
    assert.equal(errs.some((e) => e.field === "endDate" && e.message === END_DATE_TOO_EARLY), true);
  });
  test("date de fin au-delà de 18 mois : invalide", () => {
    const errs = validateAnswers({ ...cddBase, endMode: "date", endDate: day(new Date(addMonths(startOfDay(new Date(missionTs)), 18).getTime() + 86_400_000)) }, { missionTs });
    assert.equal(errs.some((e) => e.field === "endDate" && e.message === END_DATE_TOO_LATE), true);
  });
  test("champs obligatoires vides : erreurs", () => {
    const errs = validateAnswers({ hasEnd: "yes", replacesAbsentEmployee: true, endMode: "return" }, { missionTs });
    assert.equal(errs.some((e) => e.field === "firstName"), true);
    assert.equal(errs.some((e) => e.field === "lastName"), true);
    assert.equal(errs.some((e) => e.field === "role"), true);
  });
});
