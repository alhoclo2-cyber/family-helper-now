// Restrictions de démonstration uniquement : aucun droit serveur ni donnée réelle modifiés.
import { useEffect, useState } from "react";
import { createExitArchive } from "./archive";
import { sendSimulatedEmail } from "./simulatedEmails";
import { CLOSURE_REMINDER_MS, ARCHIVE_RETENTION_YEARS, emptyRestriction, transitionRestriction, type CompanionRestriction, type RestrictionAction } from "./companionRestrictionModel";
export * from "./companionRestrictionModel";
const KEY = "solelia-mandataire-restrictions";
const EVT = "solelia-mandataire-restrictions-changed";
export function readRestrictions(): Record<string, CompanionRestriction> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { return {}; }
}
function save(id: string, s: CompanionRestriction) {
  const all = readRestrictions(); all[id] = s;
  localStorage.setItem(KEY, JSON.stringify(all));
  window.dispatchEvent(new Event(EVT));
}
export function changeRestriction(id: string, action: RestrictionAction, actor: string, reason = "", email = "") {
  const s = readRestrictions()[id] ?? emptyRestriction();
  const next = transitionRestriction(s, action, actor, reason, Date.now());
  next.email = email || s.email;
  save(id, next);
  if (action === "closure_requested") sendSimulatedEmail("companion_closure_confirmation", next.email, { date: next.closureAt, reason: next.reason });
}
const running = new Set<string>();
export async function processRestrictionDeadlines() {
  for (const [id, s] of Object.entries(readRestrictions())) {
    if (s.status !== "closure_pending" || s.closureAt == null || running.has(id)) continue;
    const now = Date.now();
    if (now < s.closureAt && now >= s.closureAt - CLOSURE_REMINDER_MS && !s.reminderAt) {
      save(id, { ...s, reminderAt: now });
      sendSimulatedEmail("companion_closure_reminder", s.email, { date: s.closureAt });
    }
    if (now >= s.closureAt) {
      running.add(id);
      try {
        await createExitArchive({ userId: id, email: s.email, role: "companion", retentionYears: ARCHIVE_RETENTION_YEARS });
        const current = readRestrictions()[id];
        if (current?.status === "closure_pending" && current.closureAt === s.closureAt) {
          changeRestriction(id, "closure_effective", "Système (simulation)");
        }
      } finally { running.delete(id); }
    }
  }
}
export function useCompanionRestrictions() {
  const [all, setAll] = useState<Record<string, CompanionRestriction>>({});
  useEffect(() => {
    const sync = () => setAll(readRestrictions());
    sync();
    window.addEventListener(EVT, sync); window.addEventListener("storage", sync);
    const tick = () => { void processRestrictionDeadlines().catch(() => {}); };
    tick(); const timer = setInterval(tick, 30_000);
    return () => { clearInterval(timer); window.removeEventListener(EVT, sync); window.removeEventListener("storage", sync); };
  }, []);
  return all;
}