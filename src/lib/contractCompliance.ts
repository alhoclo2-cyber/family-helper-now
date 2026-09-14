import { startOfWeek, subWeeks } from "date-fns";
import type { Request } from "@/lib/store";

/* ------------------------------------------------------------------
   Vérification de l'obligation de contrat de travail écrit
   (Art. L. 1271-5 du Code du travail)

   Un contrat écrit devient obligatoire pour un binôme (famille, compagnon)
   dès que l'une des deux conditions est remplie :
   - plus de 3 h sur une même semaine civile (lundi → dimanche)
   - 4 semaines civiles consécutives ou plus avec ce compagnon
------------------------------------------------------------------- */

export const WEEKLY_HOURS_THRESHOLD = 3;
export const CONSECUTIVE_WEEKS_THRESHOLD = 4;

export interface ContractCheckResult {
  requiresContract: boolean;
  weeklyHoursExceeded: boolean;
  consecutiveWeeksReached: boolean;
  weeklyHours: number;
  consecutiveWeeks: number;
}

const weekKey = (ts: number) => startOfWeek(new Date(ts), { weekStartsOn: 1 }).getTime();

export function checkContractRequirement(
  companionId: string,
  newBookingTimestamp: number,
  durationHours: number,
  pastRequests: Request[],
): ContractCheckResult {
  const relevant = pastRequests.filter(
    (r) => r.status === "accepted" && r.student?.id === companionId,
  );

  // Heures regroupées par semaine civile (lundi comme premier jour).
  const hoursByWeek = new Map<number, number>();
  for (const r of relevant) {
    const key = weekKey(r.scheduledAt ?? r.createdAt);
    hoursByWeek.set(key, (hoursByWeek.get(key) ?? 0) + (r.durationHours ?? 1));
  }

  const bookingWeek = weekKey(newBookingTimestamp);
  const weeklyHours = (hoursByWeek.get(bookingWeek) ?? 0) + durationHours;

  // Semaines consécutives en remontant depuis la semaine de la nouvelle réservation.
  let consecutiveWeeks = 1;
  let cursor = subWeeks(new Date(bookingWeek), 1).getTime();
  while (hoursByWeek.has(weekKey(cursor))) {
    consecutiveWeeks += 1;
    cursor = subWeeks(new Date(cursor), 1).getTime();
  }

  const weeklyHoursExceeded = weeklyHours > WEEKLY_HOURS_THRESHOLD;
  const consecutiveWeeksReached = consecutiveWeeks >= CONSECUTIVE_WEEKS_THRESHOLD;

  return {
    requiresContract: weeklyHoursExceeded || consecutiveWeeksReached,
    weeklyHoursExceeded,
    consecutiveWeeksReached,
    weeklyHours,
    consecutiveWeeks,
  };
}
