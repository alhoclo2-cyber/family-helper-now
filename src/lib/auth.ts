import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { bootstrapAccount } from "@/lib/account.functions";

export const MANDATAIRE_EMAIL = "solelia.accompagnement@gmail.com";

/** Session courante (côté navigateur). */
export function useSession() {
  const [state, setState] = useState<{ session: Session | null; loading: boolean }>({
    session: null,
    loading: true,
  });
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setState({ session, loading: false });
    });
    supabase.auth
      .getSession()
      .then(({ data }) => setState({ session: data.session, loading: false }));
    return () => sub.subscription.unsubscribe();
  }, []);
  return state;
}

/** Droits du compte connecté (rôle Mandataire, force de l'authentification). */
export function useAccess(userId: string | undefined) {
  const bootstrap = useServerFn(bootstrapAccount);
  return useQuery({
    queryKey: ["access", userId],
    queryFn: () => bootstrap(),
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export async function signOutEverywhere() {
  await supabase.auth.signOut();
}

export const inputCls =
  "w-full px-4 py-3 rounded-2xl border-2 border-border bg-card text-base focus:border-primary outline-none";
