import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const LATE_REFUND_CENTS = 500; // 5,00 € remboursés, 1,00 € retenu
const WINDOW_MS = 24 * 60 * 60 * 1000;

/** État du remboursement d'une mission, pour le client propriétaire. */
export const getRefundState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { requestId: string }) => {
    if (!input?.requestId) throw new Error("Identifiant manquant");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("mission_payments")
      .select("refund_status, refund_amount_cents, refunded_at")
      .eq("mission_id", data.requestId)
      .eq("client_id", context.userId)
      .maybeSingle();
    return row ?? null;
  });

export const requestLateRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { requestId: string; reason: string }) => {
    if (!input?.requestId) throw new Error("Identifiant de mission manquant.");
    return { requestId: String(input.requestId), reason: String(input.reason ?? "").trim().slice(0, 300) };
  })
  .handler(async ({ data, context }) => {
    if (!data.reason) throw new Error("Le motif de l'annulation est obligatoire.");

    const { data: row, error } = await context.supabase
      .from("mission_payments")
      .select("id, client_id, status, refund_status, mission_at, scheduled_charge_at, stripe_payment_method_id")
      .eq("mission_id", data.requestId)
      .maybeSingle();
    if (error) throw new Error("Impossible de vérifier le paiement.");
    if (!row || row.client_id !== context.userId) throw new Error("Paiement introuvable pour ce compte.");
    if (row.status !== "debit_reussi") throw new Error("Aucun frais n'a été débité pour cette mission.");
    if (row.refund_status !== "aucun") throw new Error("Un remboursement a déjà été demandé pour cette mission.");

    const missionAt = row.mission_at
      ? new Date(row.mission_at).getTime()
      : row.scheduled_charge_at
        ? new Date(row.scheduled_charge_at).getTime() + WINDOW_MS
        : null;
    if (!missionAt) throw new Error("Date de mission inconnue.");
    if (missionAt - Date.now() > WINDOW_MS)
      throw new Error("La mission est à plus de 24 h : aucun frais n'a été prélevé.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verrou : passe en « demande » uniquement si aucun remboursement n'existe encore.
    const { data: locked } = await supabaseAdmin
      .from("mission_payments")
      .update({ refund_status: "demande", refund_reason: data.reason, refund_amount_cents: LATE_REFUND_CENTS })
      .eq("id", row.id)
      .eq("refund_status", "aucun")
      .select("id");
    if (!locked?.length) throw new Error("Un remboursement a déjà été demandé pour cette mission.");

    const { issueStripeRefund } = await import("@/lib/refunds.server");
    const result = await issueStripeRefund({
      paymentIntentRef: row.stripe_payment_method_id ?? row.id,
      amountCents: LATE_REFUND_CENTS,
      idempotencyKey: `refund_${row.id}`,
    });

    if (!result.ok) {
      await supabaseAdmin.from("mission_payments").update({ refund_status: "echec" }).eq("id", row.id);
      throw new Error("Le remboursement a échoué. Contactez Solélia.");
    }

    const refundedAt = new Date().toISOString();
    await supabaseAdmin
      .from("mission_payments")
      .update({ refund_status: "rembourse", refunded_at: refundedAt, stripe_refund_id: result.refundId })
      .eq("id", row.id);

    return { refundStatus: "rembourse" as const, amountCents: LATE_REFUND_CENTS, refundedAt };
  });
