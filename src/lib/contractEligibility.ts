import { checkContractRequirement } from "./contractCompliance";
import type { Request } from "./store";

/* Seule source de décision : un compagnon peut-il être attribué automatiquement ? */
export type PairState = "in_force" | "threshold_reached" | "free";

export function getPairState({
  companionId,
  bookingTs,
  durationHours,
  requests,
  inForceRefs,
}: {
  companionId: string;
  bookingTs: number;
  durationHours: number;
  /** Historique, en excluant la demande en cours. */
  requests: Request[];
  inForceRefs: ReadonlySet<string>;
}): PairState {
  if (inForceRefs.has(companionId)) return "in_force";
  if (checkContractRequirement(companionId, bookingTs, durationHours, requests).requiresContract)
    return "threshold_reached";
  return "free";
}
