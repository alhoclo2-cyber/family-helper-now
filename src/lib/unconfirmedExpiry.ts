import { useEffect } from "react";
import { exceedsMissionEnd } from "./arrival";
import { FAMILY_RESPONSE_DELAY_MS, store, type Request } from "./store";

export function unconfirmedCancellationCode(r: Request, now: number): "out_of_hours" | "no_response" | undefined {
  if (r.demo || r.scheduledAt || r.acknowledged || (r.status !== "searching" && r.status !== "accepted")) return;
  if (exceedsMissionEnd(now, r.durationHours ?? 1)) return "out_of_hours";
  if (r.status === "accepted" && r.acceptedAt != null && now - r.acceptedAt > FAMILY_RESPONSE_DELAY_MS) return "no_response";
}

export function runUnconfirmedExpiry(now = Date.now()) {
  for (const r of store.getState().requests) {
    const code = unconfirmedCancellationCode(r, now);
    if (code) store.autoCancelRequest(r.id, code);
    else store.notifyFamilyAcceptance(r.id);
  }
}

export function useUnconfirmedExpiry() {
  useEffect(() => {
    runUnconfirmedExpiry();
    const interval = setInterval(runUnconfirmedExpiry, 15_000);
    return () => clearInterval(interval);
  }, []);
}