/**
 * Débit simulé des frais de service Solélia à J-24 h, avec relances automatiques.
 * Aucun appel Stripe réel : le résultat est simulé (succès par défaut,
 * échec si la ligne est marquée `simulate_failure`).
 *
 * Boucle de relance : 1er échec → nouvelle tentative 6 h plus tard, puis une
 * seconde relance 6 h après. Au 3e échec, la mission est annulée
 * (`annulee_echec_paiement`).
 */
const RETRY_DELAY_MS = 6 * 60 * 60 * 1000;
const MAX_RETRIES = 2;

export async function processDuePayments() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date();
  const nowIso = now.toISOString();
  const nextRetryIso = new Date(now.getTime() + RETRY_DELAY_MS).toISOString();

  const { data: initial, error } = await supabaseAdmin
    .from("mission_payments")
    .select("id, simulate_failure, retry_count, status")
    .eq("status", "en_attente_debit")
    .lte("scheduled_charge_at", nowIso)
    .limit(200);

  if (error) throw new Error(error.message);

  const { data: retries, error: retryErr } = await supabaseAdmin
    .from("mission_payments")
    .select("id, simulate_failure, retry_count, status")
    .eq("status", "debit_echoue")
    .not("next_retry_at", "is", null)
    .lte("next_retry_at", nowIso)
    .limit(200);

  if (retryErr) throw new Error(retryErr.message);

  const rows = [...(initial ?? []), ...(retries ?? [])];

  let succeeded = 0;
  let failed = 0;
  let cancelled = 0;

  for (const row of rows) {
    const ok = !row.simulate_failure;
    const exhausted = !ok && (row.retry_count ?? 0) >= MAX_RETRIES;

    const patch = ok
      ? {
          status: "debit_reussi",
          charged_at: nowIso,
          failure_reason: null,
          next_retry_at: null,
          last_run_at: nowIso,
        }
      : exhausted
        ? {
            status: "annulee_echec_paiement",
            charged_at: null,
            failure_reason: "Mission annulée : paiement impossible après 3 tentatives",
            next_retry_at: null,
            last_run_at: nowIso,
          }
        : {
            status: "debit_echoue",
            charged_at: null,
            failure_reason: "Simulation : moyen de paiement refusé",
            retry_count: (row.retry_count ?? 0) + 1,
            next_retry_at: nextRetryIso,
            last_run_at: nowIso,
          };

    const { error: upErr } = await supabaseAdmin
      .from("mission_payments")
      .update(patch)
      .eq("id", row.id)
      .eq("status", row.status);
    if (upErr) continue;
    if (ok) succeeded += 1;
    else if (exhausted) cancelled += 1;
    else failed += 1;
  }

  return { processed: rows.length, succeeded, failed, cancelled, ranAt: nowIso };
}
