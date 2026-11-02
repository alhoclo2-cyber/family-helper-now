import type { NeedType } from "./store";

/* ------------------------------------------------------------------
   Emploi-repère (IDCC 3239) par service de la plateforme.
   SEUL endroit où les minimums conventionnels sont définis :
   ils changent à chaque avenant de la convention collective.
   EMPLOI_TO_CONFIRM / isEmploiPending ne servent plus que de valeur
   de secours pour un service inconnu (minimum de repli : 11,07 €).
------------------------------------------------------------------- */

export const EMPLOI_TO_CONFIRM = "Emploi-repère à confirmer";

export type EmploiRepere = {
  intitule: string;
  classification: string;
  /** Libellé du niveau affiché au particulier, ex. « niveau III ». */
  level: string;
  /** Minimum net horaire, congés payés de 10 % inclus. */
  minNet: number;
};

const pending: EmploiRepere = {
  intitule: EMPLOI_TO_CONFIRM,
  classification: EMPLOI_TO_CONFIRM,
  level: EMPLOI_TO_CONFIRM,
  minNet: 11.07,
};

const ASSISTANT_VIE_A: EmploiRepere = { intitule: "Assistant(e) de vie A", classification: "niveau III", level: "niveau III", minNet: 11.07 };
const EMPLOYE_FAMILIAL_B: EmploiRepere = { intitule: "Employé(e) familial(e) B", classification: "niveau II", level: "niveau II", minNet: 10.93 };
const EMPLOYE_FAMILIAL_A: EmploiRepere = { intitule: "Employé(e) familial(e) A", classification: "niveau I", level: "niveau I", minNet: 10.82 };
const ENTRETIEN_A: EmploiRepere = { intitule: "Employé(e) d'entretien et petits travaux / Homme-Femme toutes mains A", classification: "niveau I", level: "niveau I", minNet: 10.82 };

export const CONTRACT_EMPLOI: Record<NeedType, EmploiRepere> = {
  "Présence et Compagnie": ASSISTANT_VIE_A,
  // Activités complémentaires de la présence : mêmes valeurs.
  "Courses urgentes": ASSISTANT_VIE_A,
  Pharmacie: ASSISTANT_VIE_A,
  "Retrait ou dépôt d'un colis": ASSISTANT_VIE_A,
  "Sortir ou nourrir animal de compagnie": ASSISTANT_VIE_A,
  "Aide à la préparation des repas": EMPLOYE_FAMILIAL_B,
  "Ménage / rangement intérieur": EMPLOYE_FAMILIAL_A,
  "Jardinage extérieur": ENTRETIEN_A,
  "Rangement extérieur": ENTRETIEN_A,
  "Petit bricolage": ENTRETIEN_A,
  "Aide administrative": { intitule: "Secrétaire particulier(ère)", classification: "niveau III", level: "niveau III", minNet: 11.07 },
  "Accompagnement d'un adulte": ASSISTANT_VIE_A,
  "Enfants de plus de 3 ans": { intitule: "Garde d'enfant(s) A", classification: "niveau III", level: "niveau III", minNet: 11.07 },
  "Garde d'enfants": { intitule: "Garde d'enfant(s) A", classification: "niveau III", level: "niveau III", minNet: 11.07 },
  "Aide aux devoirs": { intitule: "Garde d'enfant(s) B", classification: "niveau IV", level: "niveau IV", minNet: 11.46 },
};

export function emploiFor(need: string): EmploiRepere {
  return CONTRACT_EMPLOI[need as NeedType] ?? pending;
}

export function isEmploiPending(e: EmploiRepere): boolean {
  return e.intitule === EMPLOI_TO_CONFIRM || e.classification === EMPLOI_TO_CONFIRM;
}

/** Minimum net horaire du service (congés payés inclus) ; 11,07 € pour un service inconnu. */
export function minHourlyNetFor(need: string): number {
  return emploiFor(need).minNet;
}

/** Libellé du niveau du service, ex. « niveau II ». */
export function levelFor(need: string): string {
  return emploiFor(need).level;
}
