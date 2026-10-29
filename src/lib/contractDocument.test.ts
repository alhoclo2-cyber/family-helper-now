import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildContractDocument, PAY_CESU_ACTIVE, PAY_CESU_PENDING, type BuildContractInput } from "./contractDocument";
import { defaultTerms, type ContractTerms } from "./contractTerms";
import type { ContractAnswers } from "./contractDecision";

const missionTs = new Date("2026-12-07T10:00:00").getTime(); // lundi
const employer = { birthName: "Durand", lastName: "Martin", firstName: "Claire", address: "1 rue A, 75001 Paris", phone: "0600000000", email: "c@x.fr", cesuNumber: "123" };
const companion = (cesuActive: boolean) => ({ birthName: "Petit", lastName: "Petit", firstName: "Léa", address: "••••", phone: "••••", email: "••••", nir: "••••", cesuActive });

function input(kind: "cdi" | "cdd", answers: ContractAnswers, patch: Partial<ContractTerms>, cesu = true): BuildContractInput {
  const terms = { ...defaultTerms({ kind, missionTs, answers }), ...patch };
  return { kind, answers, terms, employer, companion: companion(cesu), mission: { address: "2 rue B, 75002 Paris", needs: ["Présence et Compagnie"] }, salary: { netHourly: 11.5 } };
}
const text = (doc: ReturnType<typeof buildContractDocument>, n: number) => doc.sections.find((s) => s.number === n)!.paragraphs.join(" ");

describe("buildContractDocument", () => {
  test("CDI complet, durée irrégulière, 1er mai chômé, CESU actif", () => {
    const doc = buildContractDocument(input("cdi", { hasEnd: "no" }, { trialDays: 30 }));
    assert.equal(doc.title, "Contrat de travail à durée indéterminée");
    assert.deepEqual(doc.sections.map((s) => s.number), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    assert.match(text(doc, 2), /Date d'embauche : 07\/12\/2026/);
    assert.match(text(doc, 2), /30 jours/);
    assert.match(text(doc, 3), /2 rue B, 75002 Paris/);
    assert.match(text(doc, 5), /de 0 à 48 heures/);
    assert.match(text(doc, 5), /5 jours calendaires/);
    assert.match(text(doc, 5), /délai plus court \(24 heures minimum\)/);
    assert.match(text(doc, 5), /acceptation vaut accord exprès/);
    assert.match(text(doc, 12), /accord exprès pour cette seule mission, sans modifier le contrat/);
    assert.match(text(doc, 8), /1er mai est chômé/);
    assert.ok(text(doc, 9).includes(PAY_CESU_ACTIVE));
    assert.match(text(doc, 9), /11,50 €/);
    assert.match(text(doc, 9), /14,74 €/); // 11,50 / 0,78
    assert.ok(doc.employer.some((f) => f.label === "N° CESU" && f.value === "123"));
    assert.equal(doc.idcc, "3239");
    assert.equal(doc.emploiPending, true);
  });

  test("CDD complet, planning défini, 1er mai travaillé, sans CESU", () => {
    const answers: ContractAnswers = { hasEnd: "yes", replacesAbsentEmployee: true, replaced: { firstName: "Anne", lastName: "Roy", role: "aide à domicile" }, endMode: "date", endDate: "2027-02-01" };
    const doc = buildContractDocument(input("cdd", answers, {
      trialDays: 5, mayFirst: "worked", workedHolidays: ["jul14"], weeklyRestDays: [6, 7],
      organization: { mode: "fixed", days: [{ weekday: 1, start: "09:00", end: "12:00" }] }, specialConditions: "Clés chez le gardien",
    }, false));
    assert.equal(doc.title, "Contrat de travail à durée déterminée");
    assert.match(text(doc, 2), /remplacement de Anne Roy, aide à domicile/);
    assert.match(text(doc, 2), /01\/02\/2027/);
    assert.match(text(doc, 5), /Lundi : de 09:00 à 12:00/);
    assert.match(text(doc, 5), /sauf accord exprès du salarié donné via la plateforme/);
    assert.match(text(doc, 7), /Samedi, Dimanche/);
    assert.match(text(doc, 8), /majorées de 100 %/);
    assert.match(text(doc, 8), /14 juillet/);
    assert.ok(text(doc, 9).includes(PAY_CESU_PENDING));
    assert.match(text(doc, 12), /Clés chez le gardien/);
    assert.match(text(doc, 12), /numéro Cesu/);
  });

  test("CDD jusqu'au retour avec durée minimale", () => {
    const answers: ContractAnswers = { hasEnd: "yes", replacesAbsentEmployee: true, replaced: { firstName: "A", lastName: "B", role: "C" }, endMode: "return" };
    const doc = buildContractDocument(input("cdd", answers, { minDuration: { value: 3, unit: "months" } }));
    assert.match(text(doc, 2), /au retour du salarié remplacé/);
    assert.match(text(doc, 2), /Durée minimale : 3 mois/);
  });
});
