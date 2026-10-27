import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export function assertMandataireAccess(hasRole: boolean, claims: unknown) {
  if (!hasRole) throw new Error("Accès réservé au Mandataire Solélia.");
  const amr = (claims as { amr?: { method?: string }[] } | null)?.amr ?? [];
  if (!amr.some(a => a.method && ["otp", "magiclink", "oauth", "mfa/totp", "mfa/phone"].includes(a.method))) throw new Error("Double authentification requise.");
}
export async function requireMandataireAccess(context: { supabase: SupabaseClient<Database>; userId: string; claims: unknown }) {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "mandataire" });
  assertMandataireAccess(!error && data === true, context.claims);
}
