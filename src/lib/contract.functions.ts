import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import type { CompanionIdentity, EmployerIdentity } from "./contractDocument";

/* ------------------------------------------------------------------
   Signature employeur : tout est revérifié ici, le navigateur ne fait
   jamais foi. Les données personnelles du compagnon ne sortent jamais
   en clair avant la signature des deux parties.
------------------------------------------------------------------- */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPEN = ["draft", "awaiting_companion", "in_force"];

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

type Ctx = { supabase: import("@supabase/supabase-js").SupabaseClient<import("@/integrations/supabase/types").Database>; userId: string; claims: { email?: string } };

async function readOwnDraft(ctx: Ctx, draftId: string) {
  if (!UUID.test(draftId)) return null;
  const { data } = await ctx.supabase
    .from("work_contracts")
    .select("id, client_id, companion_ref, status, contract_kind, answers")
    .eq("id", draftId)
    .maybeSingle();
  return data && data.client_id === ctx.userId ? data : null;
}

async function loadEmployer(ctx: Ctx): Promise<EmployerIdentity & { hasCesu: boolean | null; rawCesu: string | null }> {
  const { data: p } = await ctx.supabase
    .from("profiles")
    .select("first_name,last_name,birth_name,address_line,postal_code,city,phone,email,has_cesu_number,cesu_number")
    .eq("id", ctx.userId)
    .maybeSingle();
  return {
    birthName: p?.birth_name ?? "",
    lastName: p?.last_name ?? "",
    firstName: p?.first_name ?? "",
    address: [p?.address_line, [p?.postal_code, p?.city].filter(Boolean).join(" ")].filter(Boolean).join(", "),
    phone: p?.phone ?? "",
    email: p?.email || ctx.claims.email || "",
    cesuNumber: p?.cesu_number ?? "",
    hasCesu: p?.has_cesu_number ?? null,
    rawCesu: p?.cesu_number ?? null,
  };
}

/** Identité du compagnon, déjà masquée : seuls nom, prénom, nom de naissance et cesuActive sont en clair. */
async function loadMaskedCompanion(companionRef: string, companionUserIdOut: { id: string | null }): Promise<CompanionIdentity> {
  const { maskValue } = await import("./contractSignature");
  if (UUID.test(companionRef)) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: app } = await supabaseAdmin
      .from("companion_applications")
      .select("user_id,first_name,last_name,email,phone,nir,address,has_cesu_number,cesu_number,status")
      .eq("user_id", companionRef)
      .eq("status", "approved")
      .maybeSingle();
    if (app) {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("birth_name,last_name,address_line")
        .eq("id", app.user_id)
        .maybeSingle();
      companionUserIdOut.id = app.user_id;
      return {
        birthName: prof?.birth_name || app.last_name,
        lastName: prof?.last_name || app.last_name,
        firstName: app.first_name,
        address: maskValue(prof?.address_line || app.address),
        phone: maskValue(app.phone),
        email: maskValue(app.email),
        nir: maskValue(app.nir),
        cesuActive: app.has_cesu_number === true && !!app.cesu_number?.trim(),
      };
    }
  }
  const { COMPANIONS } = await import("./store");
  const demo = COMPANIONS.find((c) => c.id === companionRef);
  if (!demo) throw new Error("Compagnon introuvable.");
  companionUserIdOut.id = null;
  const tag = "[DONNÉES DE DÉMONSTRATION]";
  return {
    birthName: `${tag} ${demo.lastInitial}.`,
    lastName: `${tag} ${demo.lastInitial}.`,
    firstName: demo.firstName,
    address: "••••",
    phone: "••••",
    email: "••••",
    nir: "••••",
    cesuActive: demo.cesuActive,
    demo: true,
  };
}

export const getContractParties = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { draftId: string }) => {
    if (typeof input?.draftId !== "string") throw new Error("Brouillon manquant.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const draft = await readOwnDraft(context as Ctx, data.draftId);
    if (!draft) throw new Error("Ce contrat ne vous appartient pas.");
    const { hasCesu: _h, rawCesu: _r, ...employer } = await loadEmployer(context as Ctx);
    const companion = await loadMaskedCompanion(draft.companion_ref, { id: null });
    return { employer, companion };
  });

/**
 * Envoie un code à usage unique (6 chiffres, 10 min, 3 essais).
 * SIMULATION : en attendant l'envoi réel par e-mail, le code est renvoyé au
 * navigateur qui l'affiche dans les e-mails simulés. Seule son empreinte est stockée.
 */
export const requestEmployerSignatureCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { draftId: string }) => {
    if (typeof input?.draftId !== "string") throw new Error("Brouillon manquant.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { OTP_TTL_MS, SIGNATURE_MESSAGES } = await import("./contractSignature");
    const draft = await readOwnDraft(context as Ctx, data.draftId);
    if (!draft) throw new Error(SIGNATURE_MESSAGES.not_owner);
    if (draft.status !== "draft") throw new Error(SIGNATURE_MESSAGES.not_draft);
    const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
    const code = String(n).padStart(6, "0");
    const expiresAt = Date.now() + OTP_TTL_MS;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("contract_signature_codes").upsert({
      contract_id: draft.id,
      user_id: context.userId,
      code_hash: await sha256Hex(`${draft.id}:${code}`),
      expires_at: new Date(expiresAt).toISOString(),
      attempts: 0,
    });
    if (error) throw new Error("Impossible d'envoyer le code, réessayez.");
    const employer = await loadEmployer(context as Ctx);
    return { email: employer.email, code, expiresAt };
  });

export type SignContractInput = {
  draftId: string;
  code: string;
  missionId: string;
  missionTs: number;
  durationHours: number;
  address: string;
  need: string;
  salaryNet: number;
};

export const signContractAsEmployer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SignContractInput) => {
    if (!input || typeof input.draftId !== "string" || !/^\d{6}$/.test(String(input.code ?? ""))) throw new Error("Code invalide.");
    if (typeof input.missionId !== "string" || !input.missionId || input.missionId.length > 100) throw new Error("Mission invalide.");
    if (!Number.isFinite(input.missionTs) || !Number.isFinite(input.durationHours)) throw new Error("Mission invalide.");
    if (typeof input.address !== "string" || input.address.length > 300 || typeof input.need !== "string" || input.need.length > 100) throw new Error("Mission invalide.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const sig = await import("./contractSignature");
    const { buildContractDocument, stableStringify } = await import("./contractDocument");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const fail = (code: keyof typeof sig.SIGNATURE_MESSAGES) => ({ ok: false as const, message: sig.SIGNATURE_MESSAGES[code] });

    const draft = await readOwnDraft(ctx, data.draftId);
    if (!draft) return fail("not_owner");

    // Code à usage unique.
    const { data: otp } = await supabaseAdmin.from("contract_signature_codes").select("*").eq("contract_id", draft.id).maybeSingle();
    if (!otp || otp.user_id !== ctx.userId) return { ok: false as const, message: "Demandez un nouveau code." };
    if (new Date(otp.expires_at).getTime() < Date.now()) return { ok: false as const, message: "Ce code a expiré : demandez un nouveau code." };
    if (otp.attempts >= sig.OTP_MAX_ATTEMPTS) return { ok: false as const, message: "Nombre d'essais dépassé : demandez un nouveau code." };
    if ((await sha256Hex(`${draft.id}:${data.code}`)) !== otp.code_hash) {
      const attempts = otp.attempts + 1;
      await supabaseAdmin.from("contract_signature_codes").update({ attempts }).eq("contract_id", draft.id);
      const left = sig.OTP_MAX_ATTEMPTS - attempts;
      return { ok: false as const, message: left > 0 ? `Code incorrect. Il vous reste ${left} essai${left > 1 ? "s" : ""}.` : "Nombre d'essais dépassé : demandez un nouveau code." };
    }

    const employerFull = await loadEmployer(ctx);
    const { data: others } = await ctx.supabase
      .from("work_contracts")
      .select("id")
      .eq("client_id", ctx.userId)
      .eq("companion_ref", draft.companion_ref)
      .neq("id", draft.id)
      .in("status", OPEN);
    const now = Date.now();
    const check = sig.checkEmployerSignature({
      callerId: ctx.userId,
      draft,
      missionTs: data.missionTs,
      nowTs: now,
      cesu: { has_cesu_number: employerFull.hasCesu, cesu_number: employerFull.rawCesu },
      otherActive: (others?.length ?? 0) > 0,
      salaryNet: data.salaryNet,
    });
    if (!check.ok) return fail(check.code);

    const companionUser = { id: null as string | null };
    const companion = await loadMaskedCompanion(draft.companion_ref, companionUser);
    const { hasCesu: _h, rawCesu: _r, ...employer } = employerFull;
    const document = buildContractDocument({
      kind: check.kind,
      answers: check.answers,
      terms: check.terms,
      employer,
      companion,
      mission: { address: data.address, needs: [data.need] },
      salary: { netHourly: data.salaryNet },
    });
    const snapshot = {
      document,
      mission: { id: data.missionId, startsAt: new Date(data.missionTs).toISOString(), durationHours: data.durationHours, need: data.need },
      signedAt: new Date(now).toISOString(),
    };
    const hash = await sha256Hex(stableStringify(snapshot));
    const deadline = sig.companionAnswerDeadline(now, data.missionTs);
    const effectiveUntil = check.kind === "cdd" && check.answers.endMode === "date" ? check.answers.endDate ?? null : null;

    // Une seule transaction côté base : statut, empreinte, échéance et journal.
    const { error } = await supabaseAdmin.rpc("sign_contract_employer", {
      _contract_id: draft.id,
      _client_id: ctx.userId,
      _snapshot: snapshot as unknown as Json,
      _hash: hash,
      _deadline: new Date(deadline).toISOString(),
      _companion_user_id: companionUser.id as string,
      _first_mission_id: data.missionId,
      _contract_kind: check.kind,
      _effective_from: check.terms.startDate,
      _effective_until: effectiveUntil as string,
    });
    if (error) {
      const m = error.message;
      if (m.includes("not_owner")) return fail("not_owner");
      if (m.includes("not_draft")) return fail("not_draft");
      if (m.includes("pair_active") || m.includes("work_contracts_one_active_pair")) return fail("pair_active");
      return { ok: false as const, message: "La signature n'a pas pu être enregistrée. Rien n'a été modifié, réessayez." };
    }
    return { ok: true as const, contractId: draft.id, deadline, hash };
  });
