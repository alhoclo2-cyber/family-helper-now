import type { ContractDocument } from "./contractDocument";
import type { Request } from "./store";
import { normalizeStoredTerms, PUBLIC_HOLIDAYS, WEEKDAYS } from "./contractTerms";
import { parisDay } from "./contractCalendar";
import { readEmails, sendSimulatedEmail } from "./simulatedEmails";

export type PlanningContract = { id: string; status: string; companion_ref: string; effective_from: string | null; effective_until: string | null; answers: unknown; final_document: ContractDocument | null };
export type PlanningEvent = "established" | "added" | "modified" | "cancelled" | "requested";
const introductions: Record<PlanningEvent, string> = { established: "Votre planning est établi", added: "Une mission a été ajoutée", modified: "Une mission a été modifiée", cancelled: "Une mission a été annulée", requested: "Voici votre planning à jour" };
export function buildContractPlanning(c: PlanningContract, requests: readonly Request[], now = Date.now(), allowEmptyCancellation = false): string | null {
  if (c.status !== "in_force" || !c.final_document) return null;
  const terms = normalizeStoredTerms(c.answers as Record<string, unknown>);
  const missions = requests.filter(r => {
    const start = r.scheduledAt ?? r.arrivalAt ?? 0;
    const day = start ? parisDay(start) : "";
    return r.contractId === c.id && r.status === "accepted" && start > now && (!c.effective_from || day >= c.effective_from) && (!c.effective_until || day <= c.effective_until);
  }).sort((a, b) => (a.scheduledAt ?? a.arrivalAt ?? 0) - (b.scheduledAt ?? b.arrivalAt ?? 0));
  const fixed = terms?.organization?.mode === "fixed" ? terms.organization.days : [];
  if (!missions.length && !fixed.length) return allowEmptyCancellation ? `Contrat ${c.id}\n\nAucune mission à venir pour le moment.` : null;
  const time = (ts: number) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).format(ts);
  const date = (ts: number) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", dateStyle: "full" }).format(ts);
  return [
    `Contrat ${c.id}`,
    "Missions à venir :",
    ...missions.map(r => { const start = r.scheduledAt ?? r.arrivalAt ?? 0; return `${date(start)} : ${time(start)}–${time(start + (r.durationHours ?? 1) * 3_600_000)}\nAdresse : ${r.address}\nBesoin : ${r.need}`; }),
    ...(!missions.length ? ["Aucune mission à venir."] : []),
    ...(fixed.length ? ["Planning fixe :", ...fixed.map(d => `${WEEKDAYS[d.weekday - 1]} : ${d.start}–${d.end}`)] : []),
    `Repos hebdomadaire : ${(terms?.weeklyRestDays ?? []).map(d => WEEKDAYS[d - 1]).join(", ")}`,
    `1er mai : ${terms?.mayFirst === "worked" ? "travaillé" : "chômé"}`,
    `Jours fériés chômés : ${PUBLIC_HOLIDAYS.filter(h => !terms?.workedHolidays?.includes(h.key)).map(h => h.label).join(", ") || "aucun"}`,
  ].join("\n\n");
}
export function planningIsDuplicate(previous: string | null, next: string | null) { return next === null || previous === next; }
export function sendContractPlanning(c: PlanningContract, requests: readonly Request[], event: PlanningEvent, recipient: "companion" | "employer" = "companion", now = Date.now()): boolean {
  if (typeof window === "undefined") return false;
  const content = buildContractPlanning(c, requests, now, event === "cancelled");
  if (!content || !c.final_document) return false;
  const fields = recipient === "companion" ? c.final_document.companion : c.final_document.employer;
  const to = fields.find(f => f.label === "E-mail")?.value;
  if (!to) return false;
  // Compare only the planning, not the introduction: successive identical contents never send twice.
  const last = [...readEmails()].reverse().find(e => e.kind === "contract_planning" && e.to === to && e.body.includes(`Contrat ${c.id}\n`));
  if (event !== "requested" && planningIsDuplicate(last?.body.includes(content) ? content : null, content)) return false;
  sendSimulatedEmail("contract_planning", to, { planningText: `${introductions[event]}.\n\n${content}` });
  return true;
}