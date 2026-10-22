import { addMonths, startOfDay } from "date-fns";

/* ------------------------------------------------------------------
   Décision CDI / CDD (fonction pure, sans React ni navigateur).
   Rappelée côté serveur à la signature : le résultat enregistré
   par le navigateur ne fait jamais foi.
   Le CDD n'est proposé que pour remplacer un salarié habituel absent.
------------------------------------------------------------------- */

export const CDD_MAX_MONTHS_FIXED_END = 18;

export type ContractAnswers = {
  hasEnd: "no" | "unknown" | "yes";
  replacesAbsentEmployee?: boolean;
  replaced?: { firstName: string; lastName: string; role: string };
  endMode?: "date" | "return";
  endDate?: string; // AAAA-MM-JJ
};

export type ContractKind = "cdi" | "cdd";

export type DecisionContext = { missionTs: number };

export type ValidationError = {
  field: "firstName" | "lastName" | "role" | "endMode" | "endDate";
  message: string;
};

export const END_DATE_TOO_EARLY = "La date de fin doit être au plus tôt le jour de la mission.";
export const END_DATE_TOO_LATE =
  "Un contrat à durée déterminée ne peut pas dépasser 18 mois. Choisissez une date plus proche, ou « Au retour du salarié remplacé » si la fin dépend de son retour.";

function parseDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const missionDay = (missionTs: number) => startOfDay(new Date(missionTs));
export const maxFixedEndDate = (missionTs: number) => addMonths(missionDay(missionTs), CDD_MAX_MONTHS_FIXED_END);

function replacedComplete(answers: ContractAnswers): boolean {
  const r = answers.replaced;
  return !!r && !!r.firstName.trim() && !!r.lastName.trim() && !!r.role.trim();
}

function fixedEndValid(answers: ContractAnswers, missionTs: number): boolean {
  const end = answers.endDate ? parseDay(answers.endDate) : null;
  if (!end) return false;
  const start = missionDay(missionTs);
  return end.getTime() >= start.getTime() && end.getTime() <= maxFixedEndDate(missionTs).getTime();
}

/** Décide du type de contrat ; au moindre doute ou réponse incohérente : CDI. */
export function decideContractKind(answers: ContractAnswers, { missionTs }: DecisionContext): ContractKind {
  if (answers.hasEnd !== "yes") return "cdi";
  if (answers.replacesAbsentEmployee !== true) return "cdi";
  if (!replacedComplete(answers)) return "cdi";
  if (answers.endMode === "return") return "cdd";
  if (answers.endMode === "date") return fixedEndValid(answers, missionTs) ? "cdd" : "cdi";
  return "cdi";
}

/** Erreurs de saisie bloquantes du questionnaire (champs obligatoires, bornes de date). */
export function validateAnswers(answers: ContractAnswers, { missionTs }: DecisionContext): ValidationError[] {
  const errors: ValidationError[] = [];
  if (answers.hasEnd !== "yes" || answers.replacesAbsentEmployee !== true) return errors;
  const r = answers.replaced;
  if (!r?.firstName.trim()) errors.push({ field: "firstName", message: "Le prénom du salarié remplacé est obligatoire." });
  if (!r?.lastName.trim()) errors.push({ field: "lastName", message: "Le nom du salarié remplacé est obligatoire." });
  if (!r?.role.trim()) errors.push({ field: "role", message: "L'emploi ou la qualification du salarié remplacé est obligatoire." });
  if (!answers.endMode) {
    errors.push({ field: "endMode", message: "Choisissez la fin du contrat." });
  } else if (answers.endMode === "date") {
    const end = answers.endDate ? parseDay(answers.endDate) : null;
    if (!end) {
      errors.push({ field: "endDate", message: "Choisissez une date de fin." });
    } else if (end.getTime() < missionDay(missionTs).getTime()) {
      errors.push({ field: "endDate", message: END_DATE_TOO_EARLY });
    } else if (end.getTime() > maxFixedEndDate(missionTs).getTime()) {
      errors.push({ field: "endDate", message: END_DATE_TOO_LATE });
    }
  }
  return errors;
}
