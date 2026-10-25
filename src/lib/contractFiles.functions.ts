import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ContractDocument } from "./contractDocument";

export const getContractPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { contractId: string }) => {
    if (!data || !/^[0-9a-f-]{36}$/i.test(data.contractId)) throw new Error("Contrat invalide.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { checkContractPdf, contractHash, generateContractPdf } = await import("./contractPdf");
    // RLS read plus explicit party check; even a Mandataire cannot download another party's PDF.
    const { data: c, error } = await context.supabase.from("work_contracts")
      .select("id,client_id,companion_user_id,status,final_document,final_document_hash,document_hash,pdf_path")
      .eq("id", data.contractId).maybeSingle();
    if (error) throw new Error("Impossible de lire le contrat.");
    const accessError = checkContractPdf(c, context.userId, c?.final_document ? await contractHash(c.final_document) : "");
    if (accessError || !c || !c.final_document || !c.final_document_hash || !c.document_hash) throw new Error(accessError ?? "Contrat incomplet.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const path = `${c.id}/contrat-final.pdf`;
    const storage = supabaseAdmin.storage.from("contract-pdfs");
    let file = await storage.download(path);
    if (file.error) {
      const { data: events, error: logError } = await context.supabase.from("contract_signature_log")
        .select("event,occurred_at,auth_method").eq("contract_id", c.id).in("event", ["employer_signed", "companion_signed"]).order("occurred_at");
      if (logError) throw new Error("Impossible de lire le certificat de signature.");
      const bytes = await generateContractPdf({ contractId: c.id, document: c.final_document as unknown as ContractDocument, employerHash: c.document_hash, finalHash: c.final_document_hash, events: events ?? [], generatedAt: new Date().toISOString() });
      const uploaded = await storage.upload(path, bytes, { contentType: "application/pdf", upsert: false });
      // A concurrent download may have already created this immutable file; reuse it, never overwrite.
      file = await storage.download(path);
      if (file.error) throw new Error(uploaded.error ? "Le PDF n'a pas pu être enregistré. Réessayez." : "Le PDF n'a pas pu être téléchargé.");
    }
    const { error: updateError } = await supabaseAdmin.from("work_contracts").update({ pdf_path: path }).eq("id", c.id).eq("status", "in_force");
    if (updateError || !file.data) throw new Error("Impossible de finaliser le téléchargement.");
    // File bytes avoid exposing a sandbox-only storage URL and remain usable after publishing.
    return { filename: "contrat-final.pdf", bytes: Array.from(new Uint8Array(await file.data.arrayBuffer())) };
  });