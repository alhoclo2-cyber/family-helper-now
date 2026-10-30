import type { Request } from "./store";

export const WITHDRAWN_MESSAGE = "Cette demande a été retirée par le particulier";
export const ALREADY_ANSWERED_MESSAGE = "Le compagnon a déjà répondu";
export const OPEN_CONTRACT_STATUSES = ["draft", "awaiting_companion", "in_force"];
let pendingEdit: Request | null = null;
export const setPendingWithdrawalEdit = (r: Request) => { pendingEdit = r; };
export const takePendingWithdrawalEdit = () => { const r = pendingEdit; pendingEdit = null; return r; };
export function checkEmployerWithdrawal(contract: { client_id: string; status: string; companion_signed_at: string | null } | null, callerId: string) {
  if (!contract || contract.client_id !== callerId) return { ok: false as const, code: "not_owner" as const };
  if (contract.status !== "awaiting_companion" || contract.companion_signed_at !== null) return { ok: false as const, code: "already_answered" as const };
  return { ok: true as const };
}
/** New booking, never reuse the withdrawn contract, payment or request identifier. */
export function withdrawalEditRequest(request: Request): Request {
  return { ...request, id: "", status: "searching", contractId: undefined, contractAnswerDeadline: undefined, contractEndedNotice: undefined, student: undefined, acceptedAt: undefined, arrivalAt: undefined, travelMinutes: undefined, paid: false, deferredCharge: false, scheduledChargeAt: undefined, acknowledged: false, familyNotifiedAt: undefined, cancelledBy: undefined, cancelReason: undefined, refunded: undefined, refundAmount: undefined };
}