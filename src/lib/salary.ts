/** Rapport net / brut utilisé partout sur la plateforme (estimation). */
export const NET_TO_GROSS_RATIO = 0.78;

/** Salaire horaire brut estimé à partir du net. */
export function grossHourlyFromNet(net: number): number {
  return net / NET_TO_GROSS_RATIO;
}

/** Salaire horaire net hors congés payés : le net saisi inclut déjà 10 % de congés payés. */
export function hourlyNetWithoutPaidLeave(net: number): number {
  return Math.round((net / 1.1) * 100) / 100;
}
