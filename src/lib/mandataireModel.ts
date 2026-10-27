import { readableFinalDocument } from "./contractFinalStatus";
export const CONTRACT_LIST_COLUMNS = "id,client_id,companion_user_id,companion_ref,status,contract_kind,employer_signed_at,companion_signed_at,companion_answer_deadline,effective_from,effective_until,created_at,updated_at" as const;
export const contractStateLabel: Record<string, string> = { awaiting_companion: "En attente de réponse", in_force: "En vigueur", ended: "Terminé", terminated: "Résilié", closed: "Clos", refused: "Refusé", expired: "Expiré" };
export function contractsForPerson<T extends { client_id: string; companion_user_id: string | null; status: string }>(contracts: T[], personId: string, role: "client" | "companion") {
  return contracts.filter(c => c.status !== "draft" && (role === "client" ? c.client_id === personId : c.companion_user_id === personId));
}
export function mandataireDocument(status: string, document: unknown) { return readableFinalDocument(status, document); }
export function dossierLogMatches(log: { object_type: string; object_id: string }, personId: string, contractIds: string[]) {
  return log.object_type === "contract" ? contractIds.includes(log.object_id) : log.object_type === "document" && log.object_id.split("/")[0] === personId;
}
