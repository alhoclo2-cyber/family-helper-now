import { test } from "node:test";
import assert from "node:assert/strict";
import { minHourlyNetFor, levelFor, emploiFor, isEmploiPending, CONTRACT_EMPLOI } from "./contractEmploi";

// Les minimums conventionnels par service vivent uniquement dans contractEmploi.ts.

test("Minimum net horaire par service (congés payés de 10 % inclus)", () => {
  const expected: Record<string, number> = {
    "Présence et Compagnie": 11.07,
    "Courses urgentes": 11.07,
    Pharmacie: 11.07,
    "Retrait ou dépôt d'un colis": 11.07,
    "Sortir ou nourrir animal de compagnie": 11.07,
    "Aide à la préparation des repas": 10.93,
    "Ménage / rangement intérieur": 10.82,
    "Jardinage extérieur": 10.82,
    "Rangement extérieur": 10.82,
    "Petit bricolage": 10.82,
    "Aide administrative": 11.07,
    "Accompagnement d'un adulte": 11.07,
    "Enfants de plus de 3 ans": 11.07,
    "Garde d'enfants": 11.07,
    "Aide aux devoirs": 11.46,
  };
  for (const [need, min] of Object.entries(expected)) {
    assert.equal(minHourlyNetFor(need), min, need);
  }
});

test("Niveau affiché par service", () => {
  assert.equal(levelFor("Aide aux devoirs"), "niveau IV");
  assert.equal(levelFor("Présence et Compagnie"), "niveau III");
  assert.equal(levelFor("Aide à la préparation des repas"), "niveau II");
  assert.equal(levelFor("Ménage / rangement intérieur"), "niveau I");
});

test("Service inconnu : valeur de secours à 11,07 € et emploi marqué à confirmer", () => {
  assert.equal(minHourlyNetFor("Service inexistant"), 11.07);
  assert.ok(isEmploiPending(emploiFor("Service inexistant")));
});

test("Aucun service connu n'est resté à confirmer", () => {
  for (const e of Object.values(CONTRACT_EMPLOI)) {
    assert.equal(isEmploiPending(e), false, e.intitule);
  }
});
