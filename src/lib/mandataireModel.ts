import { readableFinalDocument } from "./contractFinalStatus";
export const CONTRACT_LIST_COLUMNS = "id,client_id,companion_user_id,companion_ref,status,contract_kind,employer_signed_at,companion_signed_at,companion_answer_deadline,effective_from,effective_until,created_at,updated_at" as const;
export const contractStateLabel: Record<string, string> = { awaiting_companion: "En attente de réponse", in_force: "En vigueur", ended: "Terminé", terminated: "Résilié", closed: "Clos", refused: "Refusé", expired: "Expiré", withdrawn: "Retiré par le particulier" };
export function contractsForPerson<T extends { client_id: string; companion_user_id: string | null; status: string }>(contracts: T[], personId: string, role: "client" | "companion") {
  return contracts.filter(c => c.status !== "draft" && (role === "client" ? c.client_id === personId : c.companion_user_id === personId));
}
export function mandataireDocument(status: string, document: unknown) { return readableFinalDocument(status, document); }
export function dossierLogMatches(log: { object_type: string; object_id: string }, personId: string, contractIds: string[]) {
  return log.object_type === "contract" ? contractIds.includes(log.object_id) : log.object_type === "document" && log.object_id.split("/")[0] === personId;
}
/** Une vignette n'est servie que si le chemin est le selfie d'une candidature existante. */
export function isCompanionSelfiePath(path: string, selfiePaths: (string | null)[]): boolean {
  return !!path && selfiePaths.some(p => p === path);
}
/** Contrats : sans date de début d'abord (création décroissante), puis date de début décroissante. */
export function sortContractsByDate<T extends { effective_from: string | null; created_at: string }>(contracts: T[]): T[] {
  return [...contracts].sort((a, b) => {
    if (!a.effective_from && !b.effective_from) return b.created_at.localeCompare(a.created_at);
    if (!a.effective_from) return -1;
    if (!b.effective_from) return 1;
    return b.effective_from.localeCompare(a.effective_from);
  });
}
/** Missions : date et heure de début décroissantes. */
export function sortMissionsByStartDesc<T>(rows: T[], start: (r: T) => number | null): T[] {
  return [...rows].sort((a, b) => (start(b) ?? 0) - (start(a) ?? 0));
}
/** Frais de service : date de prélèvement prévue décroissante. */
export function sortPaymentsByChargeDesc<T extends { scheduled_charge_at: string | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => (b.scheduled_charge_at ?? "").localeCompare(a.scheduled_charge_at ?? ""));
}
