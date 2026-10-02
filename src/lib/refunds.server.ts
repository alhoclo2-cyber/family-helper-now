/**
 * Point d'entrée UNIQUE vers Stripe pour les remboursements.
 * Simulé tant qu'aucun compte Stripe n'est branché : le jour venu, seul le
 * contenu de cette fonction change (stripe.refunds.create avec la même clé
 * d'idempotence).
 */
export async function issueStripeRefund(params: {
  paymentIntentRef: string;
  amountCents: number;
  idempotencyKey: string;
}): Promise<{ ok: true; refundId: string } | { ok: false; error: string }> {
  if (params.amountCents <= 0) return { ok: false, error: "Montant invalide" };
  // Simulation : identifiant déterministe dérivé de la clé d'idempotence.
  return { ok: true, refundId: `re_sim_${params.idempotencyKey}` };
}
