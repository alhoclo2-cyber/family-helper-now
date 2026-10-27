import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { ContractDocument } from "./contractDocument";
import { checkContractPdf, contractHash, generateContractPdf } from "./contractPdf";

type PdfContract = Pick<Database["public"]["Tables"]["work_contracts"]["Row"], "id" | "client_id" | "companion_user_id" | "status" | "final_document" | "final_document_hash" | "document_hash" | "pdf_path">;
export async function downloadFinalContractPdf(supabaseAdmin: SupabaseClient<Database>, c: PdfContract) {
  // Authorization is performed by the caller; integrity and status are shared by both access paths.
  const error = checkContractPdf(c, c.client_id, c.final_document ? await contractHash(c.final_document) : "");
  if (error || !c.final_document || !c.final_document_hash || !c.document_hash) throw new Error(error ?? "Contrat incomplet.");
    const path = `${c.id}/contrat-final.pdf`;
    const storage = supabaseAdmin.storage.from("contract-pdfs");
    let file = await storage.download(path);
    if (file.error) {
      const { data: events, error: logError } = await supabaseAdmin.from("contract_signature_log")
        .select("event,occurred_at,auth_method").eq("contract_id", c.id).in("event", ["employer_signed", "companion_signed"]).order("occurred_at");
      if (logError) throw new Error("Impossible de lire le certificat de signature.");
      const bytes = await generateContractPdf({ contractId: c.id, document: c.final_document as unknown as ContractDocument, employerHash: c.document_hash, finalHash: c.final_document_hash, events: events ?? [], generatedAt: new Date().toISOString() });
      const uploaded = await storage.upload(path, bytes, { contentType: "application/pdf", upsert: false });
      // A concurrent download may have already created this immutable file; reuse it, never overwrite.
      file = await storage.download(path);
      if (file.error) throw new Error(uploaded.error ? "Le PDF n'a pas pu être enregistré. Réessayez." : "Le PDF n'a pas pu être téléchargé.");
    }
    const { error: updateError } = await supabaseAdmin.from("work_contracts").update({ pdf_path: path }).eq("id", c.id).eq("status", c.status);
    if (updateError || !file.data) throw new Error("Impossible de finaliser le téléchargement.");
    return { filename: "contrat-final.pdf", bytes: Array.from(new Uint8Array(await file.data.arrayBuffer())) };
}
