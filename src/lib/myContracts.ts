import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ContractDocument } from "./contractDocument";

export const myContractsOptions = (userId: string) => queryOptions({
  queryKey: ["my-contracts", userId],
  queryFn: async () => {
    const { data, error } = await supabase.from("work_contracts")
      .select("id,client_id,companion_user_id,companion_ref,status,contract_kind,answers,effective_from,effective_until,employer_signed_at,companion_signed_at,finalized_at,final_document,first_mission_id")
      .or(`client_id.eq.${userId},companion_user_id.eq.${userId}`).neq("status", "draft").order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(c => ({ ...c, final_document: c.status === "in_force" ? c.final_document as unknown as ContractDocument | null : null }));
  },
  refetchInterval: 5000,
});
export type MyContract = Awaited<ReturnType<ReturnType<typeof myContractsOptions>["queryFn"] & (() => Promise<never>)>>;
export function useMyContracts(userId?: string) { return useQuery({ ...myContractsOptions(userId ?? ""), enabled: !!userId }); }