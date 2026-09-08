import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MANDATAIRE_EMAIL = "solelia.accompagnement@gmail.com";
const STRONG_METHODS = ["otp", "magiclink", "oauth", "mfa/totp", "mfa/phone"];

type Claims = Record<string, unknown>;

function strongAuthFromClaims(claims: Claims) {
  const amr = (claims["amr"] as { method?: string }[] | undefined) ?? [];
  return amr.some((a) => a.method && STRONG_METHODS.includes(a.method));
}

/**
 * Crée le profil s'il manque, attribue le rôle Mandataire à l'adresse Solélia
 * (email vérifié uniquement) et renvoie les droits du compte.
 */
export const bootstrapAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const claims = context.claims as unknown as Claims;
    const meta = (claims["user_metadata"] as Record<string, string> | undefined) ?? {};
    const email = ((claims["email"] as string | undefined) ?? "").toLowerCase();

    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    if (!existing) {
      await supabase.from("profiles").insert({
        id: userId,
        email,
        first_name: meta["first_name"] ?? meta["given_name"] ?? "",
        last_name: meta["last_name"] ?? meta["family_name"] ?? "",
        address_line: meta["address_line"] ?? "",
        postal_code: meta["postal_code"] ?? "",
        city: meta["city"] ?? "",
        phone: meta["phone"] ?? "",
      });
    }

    const { data: hasRole } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "mandataire",
    });
    let isMandataire = !!hasRole;

    if (!isMandataire && email === MANDATAIRE_EMAIL) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId);
      const verified =
        !!u.user?.email_confirmed_at && u.user.email?.toLowerCase() === MANDATAIRE_EMAIL;
      if (verified) {
        const { error } = await supabaseAdmin
          .from("user_roles")
          .upsert({ user_id: userId, role: "mandataire" }, { onConflict: "user_id,role" });
        if (!error) isMandataire = true;
      }
    }

    return { isMandataire, strongAuth: strongAuthFromClaims(claims), email };
  });

async function requireMandataire(context: {
  supabase: SupabaseClient<Database>;
  userId: string;
  claims: unknown;
}) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "mandataire",
  });
  if (!data) throw new Error("Accès réservé au Mandataire Solélia.");
  if (!strongAuthFromClaims(context.claims as Claims))
    throw new Error("Double authentification requise.");
}

export const listApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireMandataire(context);
    const { data, error } = await context.supabase
      .from("companion_applications")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const getDocumentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { path: string }) => {
    if (typeof input?.path !== "string" || !input.path) throw new Error("Chemin invalide");
    return input;
  })
  .handler(async ({ data, context }) => {
    await requireMandataire(context);
    const { data: signed, error } = await context.supabase.storage
      .from("companion-docs")
      .createSignedUrl(data.path, 600);
    if (error || !signed) throw new Error(error?.message ?? "Document introuvable");
    return { url: signed.signedUrl };
  });

export const reviewApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { id: string; status: "pending" | "approved" | "rejected"; rejectReason?: string }) => {
      if (!input?.id || !["pending", "approved", "rejected"].includes(input.status))
        throw new Error("Données invalides");
      if (input.status === "rejected" && !input.rejectReason?.trim())
        throw new Error("Motif de refus requis");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    await requireMandataire(context);
    const { error } = await context.supabase
      .from("companion_applications")
      .update({
        status: data.status,
        reject_reason: data.status === "rejected" ? data.rejectReason!.trim() : null,
        reviewed_at: data.status === "pending" ? null : new Date().toISOString(),
        reviewed_by: data.status === "pending" ? null : context.userId,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
