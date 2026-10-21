import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Contrats en vigueur (work_contracts.status = 'in_force') du particulier, par companion_ref. */
export function useContractsInForce(userId?: string) {
  return useQuery({
    queryKey: ["contracts-in-force", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_contracts")
        .select("companion_ref")
        .eq("client_id", userId!)
        .eq("status", "in_force");
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.companion_ref));
    },
  });
}

/* Surcharge de simulation (panneau de test uniquement), en mémoire. */
let simulatedInForce = new Set<string>();
const listeners = new Set<() => void>();
export const getSimulatedInForce = () => simulatedInForce;
export function setSimulatedInForce(next: Set<string>) {
  simulatedInForce = new Set(next);
  listeners.forEach((l) => l());
}
export function subscribeSimulatedInForce(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
export const useSimulatedInForce = () =>
  useSyncExternalStore(subscribeSimulatedInForce, getSimulatedInForce, getSimulatedInForce);

export function getInForceRefs(dbRefs?: ReadonlySet<string>): Set<string> {
  return new Set([...(dbRefs ?? []), ...simulatedInForce]);
}
