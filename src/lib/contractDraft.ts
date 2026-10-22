import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ContractAnswers, ContractKind } from "./contractDecision";
import type { Json } from "@/integrations/supabase/types";

/* ------------------------------------------------------------------
   Brouillon de contrat (work_contracts) : les missions vivent en
   mémoire, le binôme est référencé par texte (companion_ref).
   Pas d'upsert : index partiel unique, on lit puis insère/modifie.
------------------------------------------------------------------- */

export type StoredContractAnswers = ContractAnswers & {
  decision_version?: number;
  certified_at?: string;
};

const OPEN_STATUSES = ["draft", "awaiting_companion", "in_force"] as const;

export function useContractDraft(userId?: string, companionRef?: string) {
  return useQuery({
    queryKey: ["contract-draft", userId, companionRef],
    enabled: !!userId && !!companionRef,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_contracts")
        .select("id, status, answers, contract_kind, updated_at")
        .eq("client_id", userId!)
        .eq("companion_ref", companionRef!)
        .in("status", [...OPEN_STATUSES])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Préremplissage : brouillon le plus récent du même particulier avec un autre compagnon. */
export async function fetchLatestDraftAnswers(userId: string, excludeCompanionRef: string): Promise<StoredContractAnswers | null> {
  const { data, error } = await supabase
    .from("work_contracts")
    .select("answers")
    .eq("client_id", userId)
    .eq("status", "draft")
    .neq("companion_ref", excludeCompanionRef)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.answers ?? null) as StoredContractAnswers | null;
}

export async function saveContractDraft({
  userId,
  companionRef,
  answers,
  contractKind,
}: {
  userId: string;
  companionRef: string;
  answers: StoredContractAnswers;
  contractKind: ContractKind | null;
}): Promise<string> {
  const payload = answers as unknown as Json;
  const { data: existing, error: readError } = await supabase
    .from("work_contracts")
    .select("id")
    .eq("client_id", userId)
    .eq("companion_ref", companionRef)
    .eq("status", "draft")
    .maybeSingle();
  if (readError) throw readError;
  if (existing) {
    const { error } = await supabase
      .from("work_contracts")
      .update({ answers: payload, contract_kind: contractKind })
      .eq("id", existing.id);
    if (error) throw error;
    return existing.id;
  }
  const { data, error } = await supabase
    .from("work_contracts")
    .insert({ client_id: userId, companion_ref: companionRef, status: "draft", answers: payload, contract_kind: contractKind })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}
