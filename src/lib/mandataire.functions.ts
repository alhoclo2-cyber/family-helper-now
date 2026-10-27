import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireMandataireAccess } from "./mandataireAccess";
import { CONTRACT_LIST_COLUMNS, mandataireDocument } from "./mandataireModel";
const validateId = (data: { id: string }) => {
  if (!data || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.id)) throw new Error("Contrat invalide.");
  return data;
};
export const listContractsForMandataire = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await requireMandataireAccess(context);
  const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
  const [contracts, profiles, companions] = await Promise.all([
    admin.from("work_contracts").select(CONTRACT_LIST_COLUMNS).neq("status", "draft").order("created_at", { ascending: false }),
    admin.from("profiles").select("id,first_name,last_name"),
    admin.from("companion_applications").select("user_id,first_name,last_name"),
  ]);
  if (contracts.error || profiles.error || companions.error) throw new Error("Impossible de lire les contrats.");
  const name = (p: { first_name: string; last_name: string } | undefined) => p ? `${p.first_name} ${p.last_name}`.trim() : "Dossier indisponible";
  return (contracts.data ?? []).map(c => ({ ...c, client_name: name(profiles.data?.find(p => p.id === c.client_id)), companion_name: c.companion_user_id ? name(companions.data?.find(p => p.user_id === c.companion_user_id) ?? profiles.data?.find(p => p.id === c.companion_user_id)) : `Compagnon fictif (${c.companion_ref})` }));
});
export const getContractForMandataire = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(validateId).handler(async ({ data, context }) => {
  await requireMandataireAccess(context);
  const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
  const { data: c, error } = await admin.from("work_contracts").select(`${CONTRACT_LIST_COLUMNS},final_document`).eq("id", data.id).neq("status", "draft").maybeSingle();
  if (error || !c) throw new Error("Contrat introuvable.");
  const finalDocument = mandataireDocument(c.status, c.final_document);
  const logs = finalDocument ? await admin.from("contract_signature_log").select("id,event,occurred_at,auth_method,actor_role,document_hash").eq("contract_id", c.id).order("occurred_at") : { data: [], error: null };
  if (logs.error) throw new Error("Certificat inaccessible.");
  const { recordMandataireAccess } = await import("./mandataireLog.server");
  await recordMandataireAccess(admin, context.userId, "contract_view", "contract", c.id);
  return { ...c, final_document: finalDocument, signatures: logs.data ?? [] };
});
export const getContractPdfForMandataire = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(validateId).handler(async ({ data, context }) => {
  await requireMandataireAccess(context);
  const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
  const { data: c, error } = await admin.from("work_contracts").select("id,client_id,companion_user_id,status,final_document,final_document_hash,document_hash,pdf_path").eq("id", data.id).maybeSingle();
  if (error || !c) throw new Error("Contrat introuvable.");
  const { downloadFinalContractPdf } = await import("./contractFileStorage.server");
  const result = await downloadFinalContractPdf(admin, c);
  const { recordMandataireAccess } = await import("./mandataireLog.server");
  await recordMandataireAccess(admin, context.userId, "pdf_download", "contract", c.id);
  return result;
});
export const listMandataireAccessLog = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await requireMandataireAccess(context);
  const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await admin.from("mandataire_access_log").select("id,actor_id,action,object_type,object_id,created_at").order("created_at", { ascending: false });
  if (error) throw new Error("Journal inaccessible.");
  return data ?? [];
});
