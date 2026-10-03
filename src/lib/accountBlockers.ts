import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";
import type { AccountState, SimKey } from "@/lib/accountState";

export type Blocker = { key: SimKey; label: string };
export const BLOCKER_LABELS: Record<SimKey, string> = {
  mission: "Vous avez une mission à venir ou en cours",
  refund: "Un remboursement est en cours",
  payment: "Un paiement est en cours ou impayé",
  hours: "Des heures de mission restent à confirmer",
};

/** Rôle du compte : Compagnon si une candidature existe. */
export function useAccountRole(userId: string | undefined) {
  return useQuery({
    queryKey: ["account-role", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companion_applications")
        .select("id")
        .eq("user_id", userId!)
        .limit(1);
      if (error) throw error;
      return (data?.length ? "companion" : "family") as "companion" | "family";
    },
  });
}

export function useAccountBlockers(
  userId: string | undefined,
  role: "family" | "companion" | undefined,
  sim: AccountState["sim"],
) {
  const requests = useStore((s) => s.requests);
  const q = useQuery({
    queryKey: ["account-blockers", userId, role],
    enabled: !!userId && !!role,
    queryFn: async () => {
      const col = role === "companion" ? "companion_user_id" : "client_id";
      const { data, error } = await supabase
        .from("mission_payments")
        .select("mission_id, mission_at, status, refund_status")
        .eq(col, userId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const found = new Set<SimKey>();
  const now = Date.now();
  const rows = q.data ?? [];
  if (rows.some((r) => r.mission_at && new Date(r.mission_at).getTime() > now)) found.add("mission");
  if (role === "family") {
    if (requests.some((r) => r.seniorName === "Vous" && (r.status === "searching" || r.status === "accepted")))
      found.add("mission");
    if (rows.some((r) => r.refund_status === "demande" || r.refund_status === "echec")) found.add("refund");
    const cancelled = new Set(requests.filter((r) => r.status === "cancelled").map((r) => r.id));
    if (
      rows.some(
        (r) => (r.status === "en_attente_debit" || r.status === "debit_echoue") && !cancelled.has(r.mission_id),
      )
    )
      found.add("payment");
  }
  (Object.keys(sim) as SimKey[]).forEach((k) => sim[k] && found.add(k));

  const order: SimKey[] = ["mission", "refund", "payment", "hours"];
  return {
    loading: q.isLoading,
    error: q.isError,
    blockers: order.filter((k) => found.has(k)).map((key) => ({ key, label: BLOCKER_LABELS[key] })),
  };
}
