import { normalizeStoredTerms, PUBLIC_HOLIDAYS, WEEKDAYS, type ContractTerms, type HolidayKey } from "./contractTerms";

/** Dates are always calendar dates in Europe/Paris, irrespective of the browser/server timezone. */
export function parisDay(ts: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(ts);
  const value = (type: string) => parts.find(p => p.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function publicHolidayDates(year: number): Record<HolidayKey, string> {
  // Meeus/Jones/Butcher Gregorian computus. UTC arithmetic is used only to add calendar days.
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = Date.UTC(year, month - 1, day);
  const after = (days: number) => new Date(easter + days * 86_400_000).toISOString().slice(0, 10);
  return { jan1: `${year}-01-01`, easter_monday: after(1), may8: `${year}-05-08`, ascension: after(39), pentecost_monday: after(50), jul14: `${year}-07-14`, aug15: `${year}-08-15`, nov1: `${year}-11-01`, nov11: `${year}-11-11`, dec25: `${year}-12-25` };
}

export type RestConflict = { kind: "weekly_rest" | "may_first" | "holiday"; label: string };
export function restDayConflict(terms: Partial<ContractTerms>, dayTs: number): RestConflict | null {
  if (!Number.isFinite(dayTs)) return null;
  const date = parisDay(dayTs);
  const jsDay = new Date(`${date}T12:00:00Z`).getUTCDay();
  const weekday = jsDay === 0 ? 7 : jsDay;
  if (terms.weeklyRestDays?.some(d => d === weekday)) return { kind: "weekly_rest", label: WEEKDAYS[weekday - 1].toLowerCase() };
  if (date.endsWith("-05-01") && terms.mayFirst === "off") return { kind: "may_first", label: "1er mai" };
  const holidays = publicHolidayDates(Number(date.slice(0, 4)));
  const holiday = PUBLIC_HOLIDAYS.find(h => holidays[h.key] === date && !terms.workedHolidays?.includes(h.key));
  return holiday ? { kind: "holiday", label: holiday.label } : null;
}

export type CalendarContract = { id: string; client_id: string; companion_ref: string; status: string; answers: unknown; effective_from: string | null; effective_until: string | null };
export function contractRestConflict(contracts: readonly CalendarContract[], clientId: string, companionRef: string, dayTs: number): RestConflict | null {
  if (!Number.isFinite(dayTs)) return null;
  const day = parisDay(dayTs);
  for (const c of contracts) {
    if (c.client_id !== clientId || c.companion_ref !== companionRef || c.status !== "in_force") continue;
    if ((c.effective_from && day < c.effective_from) || (c.effective_until && day > c.effective_until)) continue;
    const terms = normalizeStoredTerms(c.answers as Record<string, unknown>);
    const conflict = terms && restDayConflict(terms, dayTs);
    if (conflict) return conflict;
  }
  return null;
}

export function restConflictMessage(conflict: RestConflict): string {
  const reason = conflict.kind === "weekly_rest" ? `un jour de repos de votre contrat avec ce compagnon (${conflict.label})` : conflict.kind === "may_first" ? "le 1er mai, chômé dans votre contrat" : `un jour férié chômé de votre contrat (${conflict.label})`;
  return `Cette date tombe ${reason}. Choisissez une autre date ou un autre compagnon.`;
}

// Browser-owned cache, cleared at identity transitions; never used as an authorization boundary.
let ownContracts: readonly CalendarContract[] = [];
let owner = "";
export function setCalendarContracts(userId: string, contracts: readonly CalendarContract[]) { owner = userId; ownContracts = contracts; }
export function cachedRestConflict(companionRef: string, dayTs: number) { return contractRestConflict(ownContracts, owner, companionRef, dayTs); }
export function cachedRequestRestConflict(companionRef: string, dayTs: number, contractId?: string) {
  const c = contractId ? ownContracts.find(c => c.id === contractId) : undefined;
  return c ? contractRestConflict([c], c.client_id, c.companion_ref, dayTs) : cachedRestConflict(companionRef, dayTs);
}
export function cachedInForceContract(companionRef: string, dayTs: number) {
  const day = parisDay(dayTs);
  return ownContracts.find(c => c.client_id === owner && c.companion_ref === companionRef && c.status === "in_force" && (!c.effective_from || day >= c.effective_from) && (!c.effective_until || day <= c.effective_until));
}