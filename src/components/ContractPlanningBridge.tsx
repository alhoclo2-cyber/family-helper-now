import { useEffect, useRef } from "react";
import { useSession } from "@/lib/auth";
import { useMyContracts, myContractsOptions } from "@/lib/myContracts";
import { useQueryClient } from "@tanstack/react-query";
import { store, type Request } from "@/lib/store";
import { sendContractPlanning, type PlanningEvent } from "@/lib/contractPlanning";
import { setCalendarContracts } from "@/lib/contractCalendar";

/** Root-mounted: account navigation cannot pause contract/calendar and planning checks. */
export function ContractPlanningBridge() {
  const { session } = useSession();
  const userId = session?.user.id;
  const contracts = useMyContracts(userId);
  const qc = useQueryClient();
  const queue = useRef(Promise.resolve());
  const statuses = useRef(new Map<string, string>());
  useEffect(() => { setCalendarContracts(userId ?? "", contracts.data ?? []); }, [userId, contracts.data]);
  useEffect(() => {
    for (const c of contracts.data ?? []) {
      if (statuses.current.get(c.id) === "awaiting_companion" && c.status === "in_force") sendContractPlanning(c, store.getState().requests, "established");
      statuses.current.set(c.id, c.status);
    }
  }, [contracts.data]);
  useEffect(() => {
    if (!userId) return;
    let previous = store.getState().requests;
    const unsubscribe = store.subscribe(() => {
      const next = store.getState().requests;
      const events: { contractId: string; event: PlanningEvent; requests: Request[] }[] = [];
      for (const r of next) {
        if (!r.contractId) continue;
        const old = previous.find(p => p.id === r.id);
        if (r.status === "accepted" && old?.status !== "accepted") events.push({ contractId: r.contractId, event: r.contractAnswerDeadline ? "established" : "added", requests: next });
        else if (old?.status === "accepted" && r.status !== "accepted") events.push({ contractId: r.contractId, event: "cancelled", requests: next });
        else if (r.status === "accepted" && old && ["scheduledAt", "arrivalAt", "durationHours", "address", "need"].some(k => old[k as keyof Request] !== r[k as keyof Request])) events.push({ contractId: r.contractId, event: "modified", requests: next });
      }
      for (const old of previous) if (old.contractId && old.status === "accepted" && !next.some(r => r.id === old.id)) events.push({ contractId: old.contractId, event: "cancelled", requests: next });
      previous = next;
      for (const event of events) queue.current = queue.current.then(async () => {
        const list = await qc.fetchQuery({ ...myContractsOptions(userId), staleTime: 0 });
        const c = list.find(c => c.id === event.contractId);
        if (c) sendContractPlanning(c, event.requests, event.event);
      }).catch(() => undefined);
    });
    return () => { unsubscribe(); };
  }, [userId, qc]);
  return null;
}