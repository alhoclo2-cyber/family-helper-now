import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ContractAnswers, ContractKind } from "./contractDecision";
import type { Json } from "@/integrations/supabase/types";
import type { ContractTerms } from "./contractTerms";

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
  if (!data?.answers) return null;
  return stripTerms(data.answers as Record<string, unknown>) as StoredContractAnswers;
}

/** Retire les réponses du questionnaire 2 : le questionnaire 1 ne les réinjecte jamais. */
export function stripTerms(answers: Record<string, unknown>): Record<string, unknown> {
  const { terms: _t, terms_version: _v, ...rest } = answers;
  return rest;
}

export async function fetchContractTerms(draftId: string): Promise<Partial<ContractTerms> | null> {
  const { data, error } = await supabase.from("work_contracts").select("answers").eq("id", draftId).maybeSingle();
  if (error) throw error;
  const a = data?.answers as Record<string, unknown> | null;
  const terms = (a?.terms as Record<string, unknown> | undefined) ?? null;
  if (!terms) return null;
  // Version 1 -> 2 : weeklyRestDay (un seul jour) devient weeklyRestDays (liste).
  if ((a?.terms_version ?? 1) === 1 && "weeklyRestDay" in terms) {
    const { weeklyRestDay, ...rest } = terms;
    return { ...rest, weeklyRestDays: typeof weeklyRestDay === "number" ? [weeklyRestDay as ContractTerms["weeklyRestDays"][number]] : [] };
  }
  return terms as Partial<ContractTerms>;
}

export async function saveContractTerms({ draftId, terms, effectiveUntil }: { draftId: string; terms: ContractTerms; effectiveUntil: string | null }) {
  const { data, error: readError } = await supabase.from("work_contracts").select("answers").eq("id", draftId).eq("status", "draft").single();
  if (readError) throw readError;
  const answers = { ...((data.answers as Record<string, unknown>) ?? {}), terms, terms_version: 2 };
  const { error } = await supabase
    .from("work_contracts")
    .update({ answers: answers as unknown as Json, effective_from: terms.startDate, effective_until: effectiveUntil })
    .eq("id", draftId)
    .eq("status", "draft");
  if (error) throw error;
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
  const { data: existing, error: readError } = await supabase
    .from("work_contracts")
    .select("id, answers, contract_kind")
    .eq("client_id", userId)
    .eq("companion_ref", companionRef)
    .eq("status", "draft")
    .maybeSingle();
  if (readError) throw readError;
  if (existing) {
    // Conserve les réponses du questionnaire 2, sauf si le type de contrat change (CDI <-> CDD).
    const prev = (existing.answers as Record<string, unknown>) ?? {};
    const kindChanged = contractKind !== null && existing.contract_kind !== null && existing.contract_kind !== contractKind;
    const merged: Record<string, unknown> = { ...stripTerms(answers as Record<string, unknown>) };
    if (!kindChanged && prev.terms !== undefined) {
      merged.terms = prev.terms;
      merged.terms_version = prev.terms_version;
    }
    const update: { answers: Json; contract_kind?: string; effective_from?: null; effective_until?: null } = { answers: merged as unknown as Json };
    if (contractKind !== null) update.contract_kind = contractKind;
    if (kindChanged) {
      update.effective_from = null;
      update.effective_until = null;
    }
    const { error } = await supabase
      .from("work_contracts")
      .update(update)
      .eq("id", existing.id);
    if (error) throw error;
    return existing.id;
  }
  const { data, error } = await supabase
    .from("work_contracts")
    .insert({ client_id: userId, companion_ref: companionRef, status: "draft", answers: answers as unknown as Json, contract_kind: contractKind })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}
