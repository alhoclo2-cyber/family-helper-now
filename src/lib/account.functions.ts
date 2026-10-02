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
      .select("id, tax_number, has_cesu_number, birth_date, birth_place, birth_department")
      .eq("id", userId)
      .maybeSingle();

    // Numéro fiscal / CESU saisis à l'inscription : copiés dans le profil (RLS) puis retirés des métadonnées
    const metaAny = meta as Record<string, unknown>;
    const metaTax = typeof metaAny["tax_number"] === "string" ? (metaAny["tax_number"] as string) : "";
    const metaBirthDate =
      typeof metaAny["birth_date"] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(metaAny["birth_date"] as string)
        ? (metaAny["birth_date"] as string)
        : "";
    const metaBirthPlace = typeof metaAny["birth_place"] === "string" ? (metaAny["birth_place"] as string).trim() : "";
    const metaBirthDep =
      typeof metaAny["birth_department"] === "string" ? (metaAny["birth_department"] as string).trim() : "";
    const birth = {
      ...(metaBirthDate ? { birth_date: metaBirthDate } : {}),
      ...(metaBirthPlace ? { birth_place: metaBirthPlace } : {}),
      ...(metaBirthDep ? { birth_department: metaBirthDep } : {}),
    };
    const hasMetaBirth = Object.keys(birth).length > 0;
    const hasMetaFiscal = /^\d{13}$/.test(metaTax) || typeof metaAny["has_cesu_number"] === "boolean";
    const fiscal = hasMetaFiscal
      ? {
          ...(/^\d{13}$/.test(metaTax) ? { tax_number: metaTax } : {}),
          ...(typeof metaAny["has_cesu_number"] === "boolean"
            ? {
                has_cesu_number: metaAny["has_cesu_number"] as boolean,
                cesu_number: metaAny["has_cesu_number"] ? String(metaAny["cesu_number"] ?? "") : null,
              }
            : {}),
        }
      : {};

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
        ...fiscal,
        ...birth,
      });
    } else {
      const patch = {
        ...(hasMetaFiscal && !existing.tax_number && existing.has_cesu_number === null ? fiscal : {}),
        ...(hasMetaBirth && !existing.birth_date && !existing.birth_place && !existing.birth_department ? birth : {}),
      };
      if (Object.keys(patch).length) await supabase.from("profiles").update(patch).eq("id", userId);
    }
    if (
      hasMetaFiscal ||
      hasMetaBirth ||
      metaAny["tax_number"] != null ||
      metaAny["cesu_number"] != null ||
      metaAny["birth_date"] != null ||
      metaAny["birth_place"] != null ||
      metaAny["birth_department"] != null
    ) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          user_metadata: {
            tax_number: null,
            has_cesu_number: null,
            cesu_number: null,
            birth_date: null,
            birth_place: null,
            birth_department: null,
          },
        });
      } catch {
        /* nettoyage best effort, sans journaliser les valeurs */
      }
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
  .inputValidator((input: { path: string; bucket?: "companion-docs" | "client-docs" }) => {
    if (typeof input?.path !== "string" || !input.path) throw new Error("Chemin invalide");
    const bucket = input.bucket ?? "companion-docs";
    if (!["companion-docs", "client-docs"].includes(bucket)) throw new Error("Bucket invalide");
    return { path: input.path, bucket };
  })
  .handler(async ({ data, context }) => {
    await requireMandataire(context);
    const { data: signed, error } = await context.supabase.storage
      .from(data.bucket)
      .createSignedUrl(data.path, 600);
    if (error || !signed) throw new Error(error?.message ?? "Document introuvable");
    return { url: signed.signedUrl };
  });

/** Comptes Particulier (profils hors candidats Compagnon) et statut de leurs documents. */
export const listClientRegistrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireMandataire(context);
    const [profilesRes, docsRes, appsRes] = await Promise.all([
      context.supabase
        .from("profiles")
        .select(
          "id, first_name, last_name, email, phone, city, created_at, tax_number, has_cesu_number, cesu_number, birth_date, birth_place, birth_department",
        )
        .order("created_at", { ascending: false }),
      context.supabase
        .from("client_documents")
        .select("id, user_id, doc_type, file_path, status, reject_reason, uploaded_at"),
      context.supabase.from("companion_applications").select("user_id"),
    ]);
    if (profilesRes.error) throw new Error(profilesRes.error.message);
    if (docsRes.error) throw new Error(docsRes.error.message);

    const companionIds = new Set((appsRes.data ?? []).map((a) => a.user_id));
    const docs = docsRes.data ?? [];
    return (profilesRes.data ?? [])
      .filter((p) => !companionIds.has(p.id) && p.id !== context.userId)
      .map((p) => ({ ...p, documents: docs.filter((d) => d.user_id === p.id) }));
  });

export const reviewClientDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: "validated" | "rejected"; rejectReason?: string }) => {
    if (!input?.id || !["validated", "rejected"].includes(input.status))
      throw new Error("Données invalides");
    if (input.status === "rejected" && (input.rejectReason?.trim().length ?? 0) < 10)
      throw new Error("Merci de préciser le motif (10 caractères minimum).");
    return input;
  })
  .handler(async ({ data, context }) => {
    await requireMandataire(context);
    const { error } = await context.supabase
      .from("client_documents")
      .update({
        status: data.status,
        reject_reason: data.status === "rejected" ? data.rejectReason!.trim() : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const reviewApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id: string;
      status: "pending" | "approved" | "changes_requested";
      rejectReason?: string;
    }) => {
      if (!input?.id || !["pending", "approved", "changes_requested"].includes(input.status))
        throw new Error("Données invalides");
      if (input.status === "changes_requested" && (input.rejectReason?.trim().length ?? 0) < 10)
        throw new Error("Merci de préciser le motif (10 caractères minimum).");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    await requireMandataire(context);
    const { error } = await context.supabase
      .from("companion_applications")
      .update({
        status: data.status,
        reject_reason: data.status === "changes_requested" ? data.rejectReason!.trim() : null,
        reviewed_at: data.status === "pending" ? null : new Date().toISOString(),
        reviewed_by: data.status === "pending" ? null : context.userId,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
