/** Rapport net / brut utilisé partout sur la plateforme (estimation). */
export const NET_TO_GROSS_RATIO = 0.78;

/** Salaire horaire brut estimé à partir du net : à valider par l'avocat / l'URSSAF. */
export function grossHourlyFromNet(net: number): number {
  return net / NET_TO_GROSS_RATIO;
}
