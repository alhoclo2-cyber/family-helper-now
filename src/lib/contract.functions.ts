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

/* ------------------------------------------------------------------
   Réponse du compagnon : lecture, signature, refus, expiration.
   Même principe : tout est revérifié côté serveur.
------------------------------------------------------------------- */

async function readOwnCompanionContract(ctx: Ctx, contractId: string) {
  if (!UUID.test(contractId)) return null;
  const { data } = await ctx.supabase
    .from("work_contracts")
    .select("id, client_id, companion_user_id, companion_ref, status, companion_answer_deadline, document_hash, contract_snapshot, first_mission_id, contract_kind")
    .eq("id", contractId)
    .maybeSingle();
  return data && data.companion_user_id === ctx.userId ? data : null;
}

/** Identité complète de l'employeur pour le contrat final (lecture privilégiée, jamais renvoyée seule au compagnon). */
async function loadEmployerFinal(clientId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: p } = await supabaseAdmin
    .from("profiles")
    .select("first_name,last_name,birth_name,address_line,postal_code,city,phone,email,cesu_number,tax_number,birth_date,birth_place,birth_department")
    .eq("id", clientId)
    .maybeSingle();
  return {
    birthName: p?.birth_name ?? "",
    lastName: p?.last_name ?? "",
    firstName: p?.first_name ?? "",
    birthDate: p?.birth_date ?? undefined,
    birthPlace: p?.birth_place ?? undefined,
    birthDepartment: p?.birth_department ?? undefined,
    address: [p?.address_line, [p?.postal_code, p?.city].filter(Boolean).join(" ")].filter(Boolean).join(", "),
    phone: p?.phone ?? "",
    email: p?.email ?? "",
    taxNumber: p?.tax_number ?? undefined,
    cesuNumber: p?.cesu_number ?? "",
  };
}

/** Informations du compagnon d'après son compte, au moment de l'appel. */
async function loadCompanionFinal(userId: string, claimsEmail?: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: p } = await supabaseAdmin
    .from("profiles")
    .select("first_name,last_name,birth_name,address_line,postal_code,city,phone,email,birth_date,birth_place,birth_department")
    .eq("id", userId)
    .maybeSingle();
  const { data: app } = await supabaseAdmin
    .from("companion_applications")
    .select("nir,email,phone")
    .eq("user_id", userId)
    .eq("status", "approved")
    .maybeSingle();
  return {
    birthName: p?.birth_name ?? "",
    lastName: p?.last_name ?? "",
    firstName: p?.first_name ?? "",
    birthDate: p?.birth_date ?? undefined,
    birthPlace: p?.birth_place ?? undefined,
    birthDepartment: p?.birth_department ?? undefined,
    address: [p?.address_line, [p?.postal_code, p?.city].filter(Boolean).join(" ")].filter(Boolean).join(", "),
    phone: p?.phone || app?.phone || "",
    email: p?.email || app?.email || claimsEmail || "",
    nir: app?.nir ?? "",
  };
}

/** Lecture du contrat par le compagnon : employeur masqué, informations du compagnon en clair. */
export const getContractForCompanion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { contractId: string }) => {
    if (typeof input?.contractId !== "string") throw new Error("Contrat manquant.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const { maskEmployerForCompanion, COMPANION_ANSWER_MESSAGES } = await import("./contractCompanion");
    const c = await readOwnCompanionContract(ctx, data.contractId);
    if (!c) throw new Error(COMPANION_ANSWER_MESSAGES.not_companion);
    if (c.status !== "awaiting_companion") throw new Error(COMPANION_ANSWER_MESSAGES.not_awaiting);
    if (!c.companion_answer_deadline || new Date(c.companion_answer_deadline).getTime() < Date.now())
      throw new Error(COMPANION_ANSWER_MESSAGES.expired);
    const snapshot = c.contract_snapshot as { document: import("./contractDocument").ContractDocument } | null;
    if (!snapshot?.document) throw new Error("Contrat indisponible.");
    const companion = await loadCompanionFinal(ctx.userId, ctx.claims.email);
    return {
      document: maskEmployerForCompanion(snapshot.document),
      deadline: new Date(c.companion_answer_deadline).getTime(),
      kind: c.contract_kind,
      firstMissionId: c.first_mission_id,
      companion,
    };
  });

/** Code à usage unique pour la signature du compagnon (simulation : renvoyé au navigateur). */
export const requestCompanionSignatureCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { contractId: string }) => {
    if (typeof input?.contractId !== "string") throw new Error("Contrat manquant.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const { OTP_TTL_MS } = await import("./contractSignature");
    const c = await readOwnCompanionContract(ctx, data.contractId);
    if (!c) throw new Error("Ce contrat ne vous est pas adressé.");
    if (c.status !== "awaiting_companion") throw new Error("Ce contrat n'attend plus votre réponse.");
    if (!c.companion_answer_deadline || new Date(c.companion_answer_deadline).getTime() < Date.now())
      throw new Error("Le délai de réponse est dépassé.");
    const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
    const code = String(n).padStart(6, "0");
    const expiresAt = Date.now() + OTP_TTL_MS;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("contract_signature_codes").upsert({
      contract_id: c.id,
      user_id: ctx.userId,
      code_hash: await sha256Hex(`${c.id}:${code}`),
      expires_at: new Date(expiresAt).toISOString(),
      attempts: 0,
    });
    if (error) throw new Error("Impossible d'envoyer le code, réessayez.");
    const companion = await loadCompanionFinal(ctx.userId, ctx.claims.email);
    return { email: companion.email, code, expiresAt };
  });

export const signContractAsCompanion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { contractId: string; code: string }) => {
    if (!input || typeof input.contractId !== "string" || !/^\d{6}$/.test(String(input.code ?? ""))) throw new Error("Code invalide.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const sig = await import("./contractSignature");
    const cc = await import("./contractCompanion");
    const { stableStringify } = await import("./contractDocument");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const fail = (code: keyof typeof cc.COMPANION_ANSWER_MESSAGES) => ({ ok: false as const, message: cc.COMPANION_ANSWER_MESSAGES[code] });

    const c = await readOwnCompanionContract(ctx, data.contractId);
    const snapshot = c?.contract_snapshot as { document: import("./contractDocument").ContractDocument; signedAt: string } | null;
    const recomputedHash = snapshot ? await sha256Hex(stableStringify(snapshot)) : "";
    const check = cc.checkCompanionAnswer({ callerId: ctx.userId, contract: c, nowTs: Date.now(), recomputedHash });
    if (!check.ok) return fail(check.code);

    // Code à usage unique.
    const { data: otp } = await supabaseAdmin.from("contract_signature_codes").select("*").eq("contract_id", c!.id).maybeSingle();
    if (!otp || otp.user_id !== ctx.userId) return { ok: false as const, message: "Demandez un nouveau code." };
    if (new Date(otp.expires_at).getTime() < Date.now()) return { ok: false as const, message: "Ce code a expiré : demandez un nouveau code." };
    if (otp.attempts >= sig.OTP_MAX_ATTEMPTS) return { ok: false as const, message: "Nombre d'essais dépassé : demandez un nouveau code." };
    if ((await sha256Hex(`${c!.id}:${data.code}`)) !== otp.code_hash) {
      const attempts = otp.attempts + 1;
      await supabaseAdmin.from("contract_signature_codes").update({ attempts }).eq("contract_id", c!.id);
      const left = sig.OTP_MAX_ATTEMPTS - attempts;
      return { ok: false as const, message: left > 0 ? `Code incorrect. Il vous reste ${left} essai${left > 1 ? "s" : ""}.` : "Nombre d'essais dépassé : demandez un nouveau code." };
    }

    const employer = await loadEmployerFinal(c!.client_id);
    const companion = await loadCompanionFinal(ctx.userId, ctx.claims.email);
    const signedAt = new Date().toISOString();
    const finalDoc = cc.buildFinalContractDocument(snapshot!, employer, companion, signedAt);
    const finalHash = await sha256Hex(stableStringify(finalDoc));

    const { error } = await supabaseAdmin.rpc("sign_contract_companion", {
      _contract_id: c!.id,
      _companion_user_id: ctx.userId,
      _final_document: finalDoc as unknown as Json,
      _final_hash: finalHash,
      _recomputed_hash: recomputedHash,
    });
    if (error) {
      const m = error.message;
      if (m.includes("not_companion")) return fail("not_companion");
      if (m.includes("not_awaiting")) return fail("not_awaiting");
      if (m.includes("expired")) return fail("expired");
      if (m.includes("hash_mismatch")) return fail("hash_mismatch");
      return { ok: false as const, message: "La signature n'a pas pu être enregistrée. Rien n'a été modifié, réessayez." };
    }
    await supabaseAdmin.from("contract_signature_log").insert({
      contract_id: c!.id,
      event: "contract_emailed",
      actor_id: null,
      actor_role: "system",
      metadata: { recipients: [employer.email, companion.email] },
    });
    return {
      ok: true as const,
      contractId: c!.id,
      firstMissionId: c!.first_mission_id,
      finalHash,
      emailText: cc.formatContractAsText(finalDoc),
      employerEmail: employer.email,
      companionEmail: companion.email,
    };
  });

export const refuseContractAsCompanion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { contractId: string }) => {
    if (typeof input?.contractId !== "string") throw new Error("Contrat manquant.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const cc = await import("./contractCompanion");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const c = await readOwnCompanionContract(ctx, data.contractId);
    if (!c) return { ok: false as const, message: cc.COMPANION_ANSWER_MESSAGES.not_companion };
    const { error } = await supabaseAdmin.rpc("refuse_contract_companion", { _contract_id: c.id, _companion_user_id: ctx.userId });
    if (error) {
      const m = error.message;
      if (m.includes("not_awaiting")) return { ok: false as const, message: cc.COMPANION_ANSWER_MESSAGES.not_awaiting };
      if (m.includes("expired")) return { ok: false as const, message: cc.COMPANION_ANSWER_MESSAGES.expired };
      return { ok: false as const, message: "Le refus n'a pas pu être enregistré. Réessayez." };
    }
    return { ok: true as const, contractId: c.id, firstMissionId: c.first_mission_id };
  });

/** Expire les contrats dont l'échéance est dépassée (en attendant une tâche planifiée). */
export const expireOverdueContracts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("expire_overdue_contracts");
    if (error) return { expired: [] as string[] };
    return { expired: (data ?? []) as string[] };
  });

/** Mode test : réponse simulée d'un compagnon fictif, déclenchée par le particulier propriétaire. */
export const simulateCompanionAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { contractId: string; action: "accept" | "refuse" | "timeout" }) => {
    if (!input || typeof input.contractId !== "string" || !["accept", "refuse", "timeout"].includes(input.action)) throw new Error("Simulation invalide.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const cc = await import("./contractCompanion");
    const { stableStringify } = await import("./contractDocument");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: c } = await ctx.supabase
      .from("work_contracts")
      .select("id, client_id, companion_ref, status, contract_snapshot")
      .eq("id", data.contractId)
      .maybeSingle();
    if (!c || c.client_id !== ctx.userId) return { ok: false as const, message: "Ce contrat ne vous appartient pas." };
    if (UUID.test(c.companion_ref)) return { ok: false as const, message: "La simulation est réservée aux compagnons de démonstration." };
    if (c.status !== "awaiting_companion") return { ok: false as const, message: "Ce contrat n'attend plus de réponse." };

    let finalDoc: import("./contractDocument").ContractDocument | null = null;
    let finalHash = "";
    let emailText = "";
    let employerEmail = "";
    if (data.action === "accept") {
      const snapshot = c.contract_snapshot as { document: import("./contractDocument").ContractDocument; signedAt: string } | null;
      if (!snapshot?.document) return { ok: false as const, message: "Contrat indisponible." };
      const { COMPANIONS } = await import("./store");
      const demo = COMPANIONS.find((x) => x.id === c.companion_ref);
      if (!demo) return { ok: false as const, message: "Compagnon de démonstration introuvable." };
      const tag = "[DONNÉES DE DÉMONSTRATION]";
      const employer = await loadEmployerFinal(c.client_id);
      employerEmail = employer.email;
      finalDoc = cc.buildFinalContractDocument(
        snapshot,
        employer,
        {
          birthName: `${tag} ${demo.lastInitial ?? ""}.`,
          lastName: `${tag} ${demo.lastInitial ?? ""}.`,
          firstName: demo.firstName,
          address: "1 rue de la Démonstration, 75000 Paris",
          phone: "06 00 00 00 00",
          email: "demo@example.fr",
          nir: "000000000000000",
        },
        new Date().toISOString(),
      );
      finalHash = await sha256Hex(stableStringify(finalDoc));
      emailText = cc.formatContractAsText(finalDoc);
    }

    const { error } = await supabaseAdmin.rpc("simulate_companion_answer", {
      _contract_id: c.id,
      _client_id: ctx.userId,
      _action: data.action,
      _final_document: finalDoc as unknown as Json,
      _final_hash: finalHash,
    });
    if (error) {
      const m = error.message;
      if (m.includes("not_owner")) return { ok: false as const, message: "Ce contrat ne vous appartient pas." };
      if (m.includes("not_demo")) return { ok: false as const, message: "La simulation est réservée aux compagnons de démonstration." };
      if (m.includes("not_awaiting")) return { ok: false as const, message: "Ce contrat n'attend plus de réponse." };
      return { ok: false as const, message: "La simulation n'a pas pu être enregistrée. Réessayez." };
    }
    if (data.action === "accept") {
      await supabaseAdmin.from("contract_signature_log").insert({
        contract_id: c.id,
        event: "contract_emailed",
        actor_id: null,
        actor_role: "system",
        metadata: { recipients: [employerEmail, "demo@example.fr"], simulated: true },
      });
    }
    return { ok: true as const, action: data.action, emailText, employerEmail, finalHash };
  });
