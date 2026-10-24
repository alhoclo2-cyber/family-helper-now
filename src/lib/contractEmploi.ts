import type { NeedType } from "./store";

/* ------------------------------------------------------------------
   Emploi-repère (IDCC 3239) par service de la plateforme.
   Valeurs à compléter par Solélia : tant qu'une valeur vaut
   EMPLOI_TO_CONFIRM, la relecture affiche un avertissement.
------------------------------------------------------------------- */

export const EMPLOI_TO_CONFIRM = "Emploi-repère à confirmer";

export type EmploiRepere = { intitule: string; classification: string };

const pending: EmploiRepere = { intitule: EMPLOI_TO_CONFIRM, classification: EMPLOI_TO_CONFIRM };

export const CONTRACT_EMPLOI: Record<NeedType, EmploiRepere> = {
  "Présence et Compagnie": pending,
  "Courses urgentes": pending,
  Pharmacie: pending,
  "Aide à la préparation des repas": pending,
  "Ménage / rangement intérieur": pending,
  "Jardinage extérieur": pending,
  "Rangement extérieur": pending,
  "Petit bricolage": pending,
  "Aide administrative": pending,
  "Aide informatique & smartphone": pending,
  "Accompagnement d'un adulte": pending,
  "Enfants de plus de 3 ans": pending,
  "Sortir ou nourrir animal de compagnie": pending,
  "Arroser les plantes": pending,
  "Retrait ou dépôt d'un colis": pending,
  "Garde d'enfants": pending,
  "Aide aux devoirs": pending,
};

export function emploiFor(need: string): EmploiRepere {
  return CONTRACT_EMPLOI[need as NeedType] ?? pending;
}

export function isEmploiPending(e: EmploiRepere): boolean {
  return e.intitule === EMPLOI_TO_CONFIRM || e.classification === EMPLOI_TO_CONFIRM;
}
