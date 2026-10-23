import { addDays, addMonths, addWeeks, differenceInCalendarDays, format, startOfDay } from "date-fns";
import type { ContractAnswers, ContractKind } from "./contractDecision";

/* ------------------------------------------------------------------
   Questionnaire 2 du contrat : choix du Particulier (fonctions pures,
   sans React, réutilisables côté serveur à la signature).
------------------------------------------------------------------- */

export const CDI_MAX_TRIAL_DAYS = 30;
export const MIN_LEAVE_NOTICE_MONTHS = 2;
export const SPECIAL_CONDITIONS_MAX = 500;
export const WEEKLY_HOURS = { min: 0, max: 48 } as const;
export const CONTRACT_MIN_NOTICE_DAYS = 5;
/** Délai maximal de réponse du compagnon (aligné sur le délai de 8 h des rendez-vous lointains). */
export const CONTRACT_RESPONSE_MARGIN_HOURS = 8;
export const MISSIONS_FREE_TO_REFUSE = true;
export const CONTRACT_REFUSAL_FREE = true;

export const CONTRACT_NOTICE_SENTENCE = "La mission doit être réservée et validée par le compagnon au moins 5 jours avant son début.";

export const PUBLIC_HOLIDAYS = [
  { key: "jan1", label: "1er janvier" },
  { key: "easter_monday", label: "Lundi de Pâques" },
  { key: "may8", label: "8 mai" },
  { key: "ascension", label: "Ascension" },
  { key: "pentecost_monday", label: "Lundi de Pentecôte" },
  { key: "jul14", label: "14 juillet" },
  { key: "aug15", label: "15 août" },
  { key: "nov1", label: "1er novembre" },
  { key: "nov11", label: "11 novembre" },
  { key: "dec25", label: "25 décembre" },
] as const;
export type HolidayKey = (typeof PUBLIC_HOLIDAYS)[number]["key"];

export const WEEKDAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"] as const;
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type FixedDay = { weekday: Weekday; start: string; end: string };
export type MinDuration = { value: number; unit: "days" | "weeks" | "months" };

export type ContractTerms = {
  startDate: string; // AAAA-MM-JJ
  trialDays: number; // 0 = sans période d'essai
  minDuration?: MinDuration;
  organization: { mode: "irregular" } | { mode: "fixed"; days: FixedDay[] };
  weeklyRestDay: Weekday | null;
  mayFirst: "off" | "worked" | null;
  workedHolidays: HolidayKey[];
  /** Obligatoire, sans valeur par défaut : choisi par le Particulier. */
  salaryPayDay: number | null;
  leaveNoticeMonths: number;
  specialConditions?: string;
};

export type TermsContext = { kind: ContractKind; missionTs: number; answers: ContractAnswers };

export type TermsField =
  | "trialDays" | "minDuration" | "days" | "weeklyRestDay" | "mayFirst"
  | "salaryPayDay" | "leaveNoticeMonths" | "specialConditions";
export type TermsError = { field: TermsField; message: string };

const DAY_MS = 86_400_000;

export const toDay = (ts: number) => format(startOfDay(new Date(ts)), "yyyy-MM-dd");
const parseDay = (v: string) => new Date(`${v}T00:00:00`);

export function defaultTerms({ kind, missionTs, answers }: TermsContext): ContractTerms {
  const isReturn = kind === "cdd" && answers.endMode === "return";
  return {
    startDate: toDay(missionTs),
    trialDays: 0,
    ...(isReturn ? { minDuration: { value: 1, unit: "weeks" as const } } : {}),
    organization: { mode: "irregular" },
    weeklyRestDay: 7,
    mayFirst: "off",
    workedHolidays: [],
    salaryPayDay: null,
    leaveNoticeMonths: MIN_LEAVE_NOTICE_MONTHS,
    specialConditions: "",
  };
}

const toMin = (hhmm: string) => {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};

export function fixedWeeklyMinutes(days: FixedDay[]): number {
  return days.reduce((sum, d) => {
    const diff = toMin(d.end) - toMin(d.start);
    return sum + (Number.isFinite(diff) && diff > 0 ? diff : 0);
  }, 0);
}

function addDuration(start: Date, d: MinDuration): Date {
  if (d.unit === "days") return addDays(start, d.value);
  if (d.unit === "weeks") return addWeeks(start, d.value);
  return addMonths(start, d.value);
}

/**
 * Règle du CDD : 1 jour par semaine, 2 semaines maximum jusqu'à 6 mois, 1 mois au-delà ;
 * pour un terme imprécis, calcul sur la durée minimale.
 * Arrondi à la semaine complète : à confirmer par l'avocat.
 */
export function maxTrialDaysCdd({ startDate, endDate, minDuration }: { startDate: string; endDate?: string; minDuration?: MinDuration }): number {
  const start = parseDay(startDate);
  let last: Date | null = null; // dernier jour du contrat (compris)
  if (endDate) last = parseDay(endDate);
  else if (minDuration && minDuration.value > 0) last = addDays(addDuration(start, minDuration), -1);
  if (!last || Number.isNaN(last.getTime())) return 0;
  const days = differenceInCalendarDays(last, start) + 1;
  if (days <= 0) return 0;
  const weeks = Math.floor(days / 7);
  const cap = last.getTime() <= addMonths(start, 6).getTime() ? 14 : 30;
  return Math.min(weeks, cap);
}

export function earliestContractMissionTs(nowTs: number): number {
  return nowTs + CONTRACT_MIN_NOTICE_DAYS * DAY_MS + CONTRACT_RESPONSE_MARGIN_HOURS * 3_600_000;
}

export function meetsContractNotice(missionTs: number, nowTs: number): boolean {
  return missionTs >= earliestContractMissionTs(nowTs);
}

export function cddTrialMax(terms: ContractTerms, ctx: TermsContext): number {
  return maxTrialDaysCdd({
    startDate: terms.startDate,
    endDate: ctx.answers.endMode === "date" ? ctx.answers.endDate : undefined,
    minDuration: ctx.answers.endMode === "return" ? terms.minDuration : undefined,
  });
}

export function validateTerms(terms: ContractTerms, ctx: TermsContext): TermsError[] {
  const errors: TermsError[] = [];
  const t = terms.trialDays;
  if (ctx.kind === "cdd" && ctx.answers.endMode === "return") {
    const md = terms.minDuration;
    if (!md || !Number.isInteger(md.value) || md.value < 1) {
      errors.push({ field: "minDuration", message: "Indiquez une durée minimale du contrat." });
    }
  }
  const maxTrial = ctx.kind === "cdi" ? CDI_MAX_TRIAL_DAYS : cddTrialMax(terms, ctx);
  if (!Number.isInteger(t) || t < 0 || t > maxTrial) {
    errors.push({ field: "trialDays", message: `La période d'essai ne peut pas dépasser ${maxTrial} jour${maxTrial > 1 ? "s" : ""}.` });
  }
  if (terms.organization.mode === "fixed") {
    const days = terms.organization.days;
    if (days.length === 0) errors.push({ field: "days", message: "Choisissez au moins un jour travaillé." });
    else if (days.some((d) => !(toMin(d.end) > toMin(d.start)))) {
      errors.push({ field: "days", message: "Pour chaque jour travaillé, l'heure de fin doit être après l'heure de début." });
    } else if (fixedWeeklyMinutes(days) > WEEKLY_HOURS.max * 60) {
      errors.push({ field: "days", message: "La durée hebdomadaire ne peut pas dépasser 48 heures." });
    }
    if (terms.weeklyRestDay && days.some((d) => d.weekday === terms.weeklyRestDay)) {
      errors.push({ field: "weeklyRestDay", message: "Le jour de repos ne peut pas être un jour travaillé de votre planning." });
    }
  }
  if (!terms.weeklyRestDay) errors.push({ field: "weeklyRestDay", message: "Choisissez le jour de repos hebdomadaire." });
  if (!terms.mayFirst) errors.push({ field: "mayFirst", message: "Indiquez si le 1er mai est chômé ou travaillé." });
  if (!Number.isInteger(terms.leaveNoticeMonths) || terms.leaveNoticeMonths < MIN_LEAVE_NOTICE_MONTHS) {
    errors.push({ field: "leaveNoticeMonths", message: "Le minimum est de 2 mois." });
  }
  const p = terms.salaryPayDay;
  if (p === null || !Number.isInteger(p) || p < 1 || p > 28) {
    errors.push({ field: "salaryPayDay", message: "Choisissez le jour de versement du salaire." });
  }
  if ((terms.specialConditions ?? "").length > SPECIAL_CONDITIONS_MAX) {
    errors.push({ field: "specialConditions", message: "500 caractères au maximum." });
  }
  return errors;
}

export function formatWeekly(minutes: number): string {
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}
