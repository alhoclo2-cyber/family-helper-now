import { useEffect } from "react";
import { store, type Request } from "@/lib/store";
import { build, sendSimulatedEmail, type EmailKind } from "@/lib/simulatedEmails";

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

export const SOLELIA_EMAIL = "solelia.accompagnement@gmail.com";
export type Party = "family" | "companion";
export type ReminderKey = "preEnd" | "end" | "h24" | "auto";

const REMINDER_KIND: Record<ReminderKey, EmailKind> = {
  preEnd: "mission_pre_end",
  end: "mission_end_reminder",
  h24: "mission_reminder_24",
  auto: "mission_auto_validated",
};
const ORDER: ReminderKey[] = ["preEnd", "end", "h24", "auto"];

/** Format long français : « mardi 6 octobre à 14 h ». */
export function formatMissionDate(r: Request): string {
  const start = getMissionStart(r);
  if (start == null) return "";
  const d = new Date(start);
  const day = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(d);
  const m = d.getMinutes();
  return `${day} à ${d.getHours()} h${m ? ` ${String(m).padStart(2, "0")}` : ""}`;
}

export const missionHours = (r: Request) => requestDurationMin(r) / 60;

const fmtHour = (d: Date) => {
  const m = d.getMinutes();
  return `${d.getHours()} h${m ? ` ${String(m).padStart(2, "0")}` : ""}`;
};

/** « mardi 6 octobre, 14 h – 16 h ». */
export function formatMissionRange(r: Request): string {
  const start = getMissionStart(r);
  const end = getMissionEnd(r);
  if (start == null || end == null) return "Date non définie";
  const s = new Date(start);
  const day = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(s);
  return `${day}, ${fmtHour(s)} – ${fmtHour(new Date(end))}`;
}

/** Adresse simulée de chaque partie (démo : pas d'e-mail réel). */
export function partyAddress(r: Request, p: Party) {
  return p === "family"
    ? `Famille · ${r.seniorName === "Vous" ? "votre compte" : r.seniorName}`
    : `Compagnon · ${r.student?.firstName ?? "compagnon"}`;
}

const hasValidated = (r: Request, p: Party) => (p === "family" ? !!r.familyValidatedAt : !!r.companionValidatedAt);

/** Texte d'un e-mail de clôture pour un rôle donné (affiché aussi dans l'appli). */
export function missionMessage(r: Request, kind: EmailKind, role: Party, reason?: string) {
  return build(kind, { hours: missionHours(r), missionDate: formatMissionDate(r), role, reason }).body;
}

/** Dernière échéance déjà atteinte (marquée) dans remindersSent. */
export function latestReminder(r: Request): ReminderKey | null {
  const sent = r.remindersSent ?? {};
  for (let i = ORDER.length - 1; i >= 0; i--) if (sent[ORDER[i]]) return ORDER[i];
  return null;
}
export const reminderKind = (k: ReminderKey) => REMINDER_KIND[k];

export function runClosureCheck(id: string) {
  let r = store.getState().requests.find((x) => x.id === id);
  if (!r || r.status !== "accepted" || r.completion === "problem") return;
  const end = getMissionEnd(r);
  if (end == null) return;
  const now = Date.now();
  if (!isCompletionClosed(r) && now > end + AUTO_VALIDATION_DELAY_MS) {
    store.autoValidate(r.id);
    r = store.getState().requests.find((x) => x.id === id)!;
  }
  // Clôture par les deux parties : plus aucun rappel.
  if (r.completion === "validated") return;
  const reached = ORDER.filter((k) => {
    if (k === "preEnd") return now >= end - 15 * 60_000;
    if (k === "end") return now >= end;
    if (k === "h24") return now >= end + 24 * 3600_000;
    return r!.completion === "auto_validated";
  });
  const sent = r.remindersSent ?? {};
  const pending = reached.filter((k) => !sent[k]);
  if (!pending.length) return;
  const latest = reached[reached.length - 1];
  if (!sent[latest]) {
    const parties: Party[] = ["family", "companion"];
    const targets =
      latest === "end" || latest === "h24" ? parties.filter((p) => !hasValidated(r!, p)) : parties;
    for (const p of targets) {
      sendSimulatedEmail(REMINDER_KIND[latest], partyAddress(r, p), {
        hours: missionHours(r),
        missionDate: formatMissionDate(r),
        role: p,
      });
    }
  }
  pending.forEach((k) => store.markReminderSent(id, k));
}

/** Signalement « mission non effectuée » + e-mails aux trois destinataires. */
export function reportMissionProblem(r: Request, by: Party, reason: string) {
  store.reportProblem(r.id, by, reason);
  const base = { hours: missionHours(r), missionDate: formatMissionDate(r), reason };
  const other: Party = by === "family" ? "companion" : "family";
  sendSimulatedEmail("mission_problem_other", partyAddress(r, other), { ...base, role: other });
  sendSimulatedEmail("mission_problem_confirmation", partyAddress(r, by), { ...base, role: by });
  sendSimulatedEmail("mission_problem_solelia", SOLELIA_EMAIL, { ...base, role: by });
}

/** Vérifie toutes les 60 s : rappels et validation automatique (fin + 48 h). */
export function useMissionClosure(request: Request | undefined) {
  const id = request?.id;
  useEffect(() => {
    if (!id) return;
    const check = () => runClosureCheck(id);
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
