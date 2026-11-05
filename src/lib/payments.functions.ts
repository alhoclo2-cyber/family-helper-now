import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function requireMandataire(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "mandataire",
  });
  if (!data) throw new Error("Accès réservé au Mandataire Solélia.");
}

/** Liste des paiements différés (outil de suivi et de test du débit à J-24 h). */
export const listMissionPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId?: string } | undefined) =>
    z.object({ clientId: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data: input, context }) => {
    await requireMandataire(context);
    let query = context.supabase
      .from("mission_payments")
      .select("*");
    if (input.clientId) query = query.eq("client_id", input.clientId);
    const { data, error } = await query
      .order("scheduled_charge_at", { ascending: false, nullsFirst: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data;
  });

export const countFailedMissionPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireMandataire(context);
    const { count, error } = await context.supabase
      .from("mission_payments")
      .select("id", { count: "exact", head: true })
      .in("status", ["debit_echoue", "annulee_echec_paiement"]);
    if (error) throw new Error(error.message);
    return count ?? 0;
  });

/** Outil de test : rend le prélèvement immédiatement exigible, ou force un échec simulé. */
export const updatePaymentSimulation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; dueNow?: boolean; simulateFailure?: boolean }) => {
    if (!input?.id) throw new Error("Identifiant manquant");
    return input;
  })
  .handler(async ({ data, context }) => {
    await requireMandataire(context);
    const patch: Database["public"]["Tables"]["mission_payments"]["Update"] = {};
    if (data.dueNow) {
      const nowIso = new Date().toISOString();
      const { data: row } = await context.supabase
        .from("mission_payments")
        .select("status")
        .eq("id", data.id)
        .maybeSingle();
      if (row?.status === "debit_echoue") {
        // Ligne en échec : on rend la prochaine relance immédiatement exigible.
        patch["next_retry_at"] = nowIso;
      } else {
        patch["scheduled_charge_at"] = nowIso;
        patch["status"] = "en_attente_debit";
        patch["charged_at"] = null;
        patch["failure_reason"] = null;
      }
    }
    if (typeof data.simulateFailure === "boolean") patch["simulate_failure"] = data.simulateFailure;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await context.supabase.from("mission_payments").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Outil de test : exécute immédiatement le traitement des débits dus. */
export const runDuePaymentsNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireMandataire(context);
    const { processDuePayments } = await import("@/lib/payments.server");
    return await processDuePayments();
  });
