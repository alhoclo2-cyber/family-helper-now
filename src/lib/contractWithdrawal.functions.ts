import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkEmployerWithdrawal, ALREADY_ANSWERED_MESSAGE } from "./contractWithdrawal";

export const withdrawContractAsEmployer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { contractId: string }) => {
    if (!input || !/^[0-9a-f-]{36}$/i.test(input.contractId)) throw new Error("Contrat manquant.");
    return input;
  })
  .handler(async ({ data, context }) => {
    // Ordinary owner read first. Snapshot is never requested.
    const { data: contract, error: readError } = await context.supabase.from("work_contracts")
      .select("id,client_id,status,companion_signed_at").eq("id", data.contractId).eq("client_id", context.userId).maybeSingle();
    if (readError) return { ok: false as const, message: "Impossible de vérifier la demande. Réessayez." };
    const check = checkEmployerWithdrawal(contract, context.userId);
    if (!check.ok) return { ok: false as const, message: check.code === "already_answered" ? ALREADY_ANSWERED_MESSAGE : "Ce contrat ne vous appartient pas." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // RPC repeats ownership/status checks under FOR UPDATE; a concurrent answer wins safely.
    const { data: missionId, error } = await supabaseAdmin.rpc("withdraw_contract_employer", { _contract_id: data.contractId, _client_id: context.userId });
    if (error) return { ok: false as const, message: error.message.includes("already_answered") ? ALREADY_ANSWERED_MESSAGE : "Le retrait n'a pas pu être enregistré. Réessayez." };
    return { ok: true as const, missionId };
  });