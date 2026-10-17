import { MISSION_START_LIMIT_MIN, MISSION_END_LIMIT_MIN } from "./missionHours";

export type Arrival = { arrivalAt: number; travelMinutes: number };
const MINUTE = 60_000;
export const formatArrivalTime = (at: number) => new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
}).format(at);
const minutesInParis = (at: number) => {
  const [h, m] = formatArrivalTime(at).split(":").map(Number);
  return h * 60 + m;
};
const parisDay = (at: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(at);
const limitTime = (min: number) => `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;

export function checkArrival({ arrivalAt, travelMinutes, durationHours, now }: Arrival & { durationHours: number; now: number }) {
  const departAt = arrivalAt - travelMinutes * MINUTE;
  const endAt = arrivalAt + durationHours * 60 * MINUTE;
  let error: string | null = null;
  if (!Number.isFinite(arrivalAt) || !Number.isInteger(travelMinutes) || travelMinutes < 0 || !Number.isFinite(durationHours) || durationHours <= 0 || !Number.isFinite(now)) {
    error = "Indiquez une heure d'arrivée et un temps de trajet entier en minutes (minimum 0).";
  } else if (departAt < now + 5 * MINUTE) {
    error = "Vous devez partir au plus tôt dans 5 minutes, pour laisser au particulier le temps de répondre. Indiquez une heure d'arrivée plus tardive.";
  } else if (minutesInParis(arrivalAt) < MISSION_START_LIMIT_MIN) {
    error = `Solélia Accompagnement ne propose pas de mission avant ${limitTime(MISSION_START_LIMIT_MIN)}.`;
  } else if (parisDay(endAt) !== parisDay(arrivalAt) || minutesInParis(endAt) > MISSION_END_LIMIT_MIN || (minutesInParis(endAt) === MISSION_END_LIMIT_MIN && endAt % MINUTE !== 0)) {
    error = `Vous arrivez à ${formatArrivalTime(arrivalAt)} : cette mission dure ${String(durationHours).replace(".", ",")} h et se terminerait à ${formatArrivalTime(endAt)}. Solélia Accompagnement ne propose pas de mission au-delà de ${limitTime(MISSION_END_LIMIT_MIN)}, vous ne pouvez donc pas l'accepter.`;
  }
  return { ok: error === null, error, departAt, endAt };
}

export function simulatedArrival(distanceKm: number, durationHours: number, now = Date.now()): Arrival | undefined {
  const travelMinutes = Math.round(5 + 3 * distanceKm);
  const arrivalAt = now + (8 + travelMinutes) * MINUTE;
  return checkArrival({ arrivalAt, travelMinutes, durationHours, now }).ok ? { arrivalAt, travelMinutes } : undefined;
}