export const CLOSURE_DELAY_MS = 14 * 24 * 60 * 60 * 1000;
export const CLOSURE_REMINDER_MS = 3 * 24 * 60 * 60 * 1000;
export const ARCHIVE_RETENTION_YEARS = 5;
export type RestrictionStatus = "active" | "suspended" | "closure_pending" | "closed";
export type RestrictionAction = "suspension" | "reactivation" | "closure_requested" | "closure_cancelled" | "closure_effective" | "archive_view";
export const RESTRICTION_LABELS: Record<string, string> = {
  suspended: "⛔ Suspendu", closure_pending: "Clôture programmée", closed: "Clôturé",
};
export const RESTRICTION_ACTION_LABELS: Record<RestrictionAction, string> = {
  suspension: "Suspension", reactivation: "Réactivation", closure_requested: "Demande de clôture",
  closure_cancelled: "Annulation de clôture", closure_effective: "Clôture effective", archive_view: "Consultation des archives",
};
export type RestrictionEvent = { id: string; action: RestrictionAction; actor: string; reason: string; at: number };
export type CompanionRestriction = {
  status: RestrictionStatus; reason: string; email: string; history: RestrictionEvent[];
  suspendedAt?: number; author?: string; closureAt?: number; reminderAt?: number;
};
export const emptyRestriction = (): CompanionRestriction => ({ status: "active", reason: "", email: "", history: [] });
export function transitionRestriction(s: CompanionRestriction, action: RestrictionAction, actor: string, reason: string, now: number): CompanionRestriction {
  if (!actor.trim()) throw new Error("Auteur obligatoire.");
  const motif = reason.trim();
  if (["suspension", "closure_requested"].includes(action) && motif.length < 10) throw new Error("Motif obligatoire (10 caractères minimum).");
  const allowed: Record<RestrictionAction, RestrictionStatus[]> = {
    suspension: ["active"], reactivation: ["suspended"], closure_requested: ["suspended"],
    closure_cancelled: ["closure_pending"], closure_effective: ["closure_pending"], archive_view: ["closed"],
  };
  if (!allowed[action].includes(s.status)) throw new Error("Action indisponible pour ce statut.");
  if (action === "closure_effective" && (s.closureAt == null || now < s.closureAt)) throw new Error("Le délai de 14 jours n'est pas écoulé.");
  const next = { ...s, history: [...s.history, { id: crypto.randomUUID(), action, actor, reason: motif || s.reason, at: now }] };
  if (action === "suspension") return { ...next, status: "suspended", reason: motif, suspendedAt: now, author: actor };
  if (action === "reactivation") return { ...next, status: "active", closureAt: undefined };
  if (action === "closure_requested") return { ...next, status: "closure_pending", reason: motif, closureAt: now + CLOSURE_DELAY_MS, reminderAt: undefined };
  if (action === "closure_cancelled") return { ...next, status: "suspended", closureAt: undefined, reminderAt: undefined };
  if (action === "closure_effective") return { ...next, status: "closed" };
  return next;
}
export type ClosureMission = { status: string; start: number | null; end: number | null; completion?: string; declaredAt?: number };
export type ClosurePayment = { status: string; refund_status?: string | null; mission_at?: string | null };
export function companionClosureBlockers(missions: ClosureMission[], payments: ClosurePayment[], now: number): string[] {
  const labels: string[] = [];
  const accepted = missions.filter(m => m.status === "accepted");
  if (accepted.some(m => m.end == null || m.end > now)) labels.push("Mission à venir ou en cours");
  if (accepted.some(m => m.end != null && m.end <= now && (!m.completion || m.completion === "pending"))) labels.push("Heures non confirmées");
  if (accepted.some(m => ["validated", "auto_validated"].includes(m.completion ?? "") && !m.declaredAt)) labels.push("Déclaration URSSAF non envoyée");
  if (payments.some(p => ["en_attente_debit", "echec_debit", "debit_echoue"].includes(p.status))) labels.push("Paiement en attente ou en échec");
  if (payments.some(p => ["demande", "echec", "pending", "en_cours"].includes(p.refund_status ?? ""))) labels.push("Remboursement en attente");
  if (payments.some(p => p.mission_at && new Date(p.mission_at).getTime() > now && !p.status.startsWith("annulee")) && !labels.includes("Mission à venir ou en cours")) labels.unshift("Mission à venir ou en cours");
  return labels;
}