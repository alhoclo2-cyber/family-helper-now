/**
 * Débit simulé des frais de service Solélia à J-24 h.
 * Aucun appel Stripe réel : le résultat est simulé (succès par défaut,
 * échec si la ligne est marquée `simulate_failure`).
 */
export async function processDuePayments() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date();

  const { data: due, error } = await supabaseAdmin
    .from("mission_payments")
    .select("id, mission_id, simulate_failure")
    .eq("status", "en_attente_debit")
    .lte("scheduled_charge_at", now.toISOString())
    .limit(200);

  if (error) throw new Error(error.message);

  let succeeded = 0;
  let failed = 0;

  for (const row of due ?? []) {
    const ok = !row.simulate_failure;
    const { error: upErr } = await supabaseAdmin
      .from("mission_payments")
      .update({
        status: ok ? "debit_reussi" : "debit_echoue",
        charged_at: ok ? now.toISOString() : null,
        failure_reason: ok ? null : "Simulation : moyen de paiement refusé",
        last_run_at: now.toISOString(),
      })
      .eq("id", row.id)
      .eq("status", "en_attente_debit");
    if (upErr) continue;
    if (ok) succeeded += 1;
    else failed += 1;
  }

  return { processed: (due ?? []).length, succeeded, failed, ranAt: now.toISOString() };
}
