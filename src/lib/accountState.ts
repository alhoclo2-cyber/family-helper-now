// État du compte en mode SIMULATION (localStorage uniquement, aucun accès réseau).
import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export type SimKey = "mission" | "refund" | "payment" | "hours";
export type AccountState = {
  status: "active" | "paused" | "deletion_pending" | "deleted";
  pausedAt?: number;
  deletionRequestedAt?: number;
  deletionEffectiveAt?: number;
  sim: Record<SimKey, boolean>;
};

const KEY = "solelia-account-state:";
const EVT = "solelia-account-state-changed";
const DAY = 24 * 60 * 60 * 1000;

export const defaultAccountState = (): AccountState => ({
  status: "active",
  sim: { mission: false, refund: false, payment: false, hours: false },
});

let deletionSignOutInProgress = false;
let authListenerReady = false;
function ensureAuthListener() {
  if (authListenerReady || typeof window === "undefined") return;
  authListenerReady = true;
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT" || !session) deletionSignOutInProgress = false;
  });
}

function read(userId: string): AccountState {
  try {
    const raw = localStorage.getItem(KEY + userId);
    if (!raw) return defaultAccountState();
    const p = JSON.parse(raw) as Partial<AccountState>;
    return { ...defaultAccountState(), ...p, sim: { ...defaultAccountState().sim, ...(p.sim ?? {}) } };
  } catch {
    return defaultAccountState();
  }
}
function write(userId: string, s: AccountState) {
  localStorage.setItem(KEY + userId, JSON.stringify(s));
  window.dispatchEvent(new Event(EVT));
}

export const formatDateFr = (ts?: number) =>
  ts ? new Intl.DateTimeFormat("fr-FR").format(new Date(ts)) : "";

export function useAccountState(userId: string | undefined) {
  const [state, setState] = useState<AccountState>(defaultAccountState);
  const qc = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    ensureAuthListener();
    if (!userId) {
      setState(defaultAccountState());
      return;
    }
    const sync = () => {
      const s = read(userId);
      if (s.status === "deleted" && !deletionSignOutInProgress) {
        // Réinscription simulée : le compte redevient actif à la connexion suivante.
        const fresh = defaultAccountState();
        localStorage.setItem(KEY + userId, JSON.stringify(fresh));
        setState(fresh);
        return;
      }
      setState(s);
    };
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(EVT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(EVT, sync);
    };
  }, [userId]);

  const update = useCallback(
    (fn: (s: AccountState) => AccountState) => {
      if (!userId) return;
      write(userId, fn(read(userId)));
    },
    [userId],
  );

  return {
    state,
    pause: () => update((s) => ({ ...s, status: "paused", pausedAt: Date.now() })),
    reactivate: () => update((s) => ({ ...s, status: "active", pausedAt: undefined })),
    requestDeletion: () =>
      update((s) => ({
        ...s,
        status: "deletion_pending",
        deletionRequestedAt: Date.now(),
        deletionEffectiveAt: Date.now() + 14 * DAY,
      })),
    cancelDeletion: () =>
      update((s) => ({ ...s, status: "active", deletionRequestedAt: undefined, deletionEffectiveAt: undefined })),
    resetAll: () => update(() => defaultAccountState()),
    setSim: (key: SimKey, value: boolean) => update((s) => ({ ...s, sim: { ...s.sim, [key]: value } })),
    setDeletionInDays: (days: number) => {
      const at = Date.now() + days * DAY;
      update((s) => ({ ...s, deletionEffectiveAt: at }));
      return at;
    },
    advanceDays: async () => {
      if (!userId || read(userId).status !== "deletion_pending") return;
      deletionSignOutInProgress = true;
      update((s) => ({ ...s, status: "deleted", deletionEffectiveAt: Date.now() }));
      await qc.cancelQueries();
      qc.clear();
      await supabase.auth.signOut();
      navigate({ to: "/" });
    },
  };
}
