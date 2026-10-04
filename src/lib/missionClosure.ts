import { useEffect } from "react";
import { store, type Request } from "@/lib/store";

/** Temps laissé au compagnon pour se déplacer lors d'une urgence (minutes). */
export const DELAI_DEPLACEMENT_URGENCE_MIN = 30;
export const DEFAULT_DURATION_MIN = 60;
export const AUTO_VALIDATION_DELAY_MS = 48 * 60 * 60 * 1000;
export const CLOSURE_OPEN_BEFORE_END_MS = 30 * 60 * 1000;

export const requestDurationMin = (r: { durationHours?: number }) =>
  r.durationHours ? r.durationHours * 60 : DEFAULT_DURATION_MIN;

/** Début : scheduledAt (RDV) ou acceptedAt + délai de déplacement (urgence). */
export function getMissionStart(r: Request): number | null {
  if (r.scheduledAt) return r.scheduledAt;
  if (r.acceptedAt) return r.acceptedAt + DELAI_DEPLACEMENT_URGENCE_MIN * 60_000;
  return null;
}

export function getMissionEnd(r: Request): number | null {
  const start = getMissionStart(r);
  return start == null ? null : start + requestDurationMin(r) * 60_000;
}

export const isCompletionClosed = (r: Request) =>
  r.completion === "validated" || r.completion === "auto_validated" || r.completion === "problem";

/** Vérifie toutes les 60 s si la validation automatique (fin + 48 h) doit s'appliquer. */
export function useMissionClosure(request: Request | undefined) {
  const id = request?.id;
  useEffect(() => {
    if (!id) return;
    const check = () => {
      const r = store.getState().requests.find((x) => x.id === id);
      if (!r || r.status !== "accepted" || isCompletionClosed(r)) return;
      const end = getMissionEnd(r);
      if (end != null && Date.now() > end + AUTO_VALIDATION_DELAY_MS) store.autoValidate(r.id);
    };
    check();
    const t = setInterval(check, 60000);
    return () => clearInterval(t);
  }, [id, request?.scheduledAt, request?.acceptedAt]);
}

/** Panneau de test : décale la mission pour que sa fin tombe à `now - offsetMs`. */
export function shiftMissionEnd(r: Request, offsetMs: number) {
  const end = getMissionEnd(r);
  if (end == null) return;
  const delta = Date.now() - offsetMs - end;
  if (r.scheduledAt) store.updateRequest(r.id, { scheduledAt: r.scheduledAt + delta });
  else if (r.acceptedAt) store.updateRequest(r.id, { acceptedAt: r.acceptedAt + delta });
}
