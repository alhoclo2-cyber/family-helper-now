import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getContractPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { contractId: string }) => {
    if (!data || !/^[0-9a-f-]{36}$/i.test(data.contractId)) throw new Error("Contrat invalide.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { checkContractPdf, contractHash } = await import("./contractPdf");
    // RLS read plus explicit party check; even a Mandataire cannot download another party's PDF.
    const { data: c, error } = await context.supabase.from("work_contracts")
      .select("id,client_id,companion_user_id,status,final_document,final_document_hash,document_hash,pdf_path")
      .eq("id", data.contractId).maybeSingle();
    if (error) throw new Error("Impossible de lire le contrat.");
    const accessError = checkContractPdf(c, context.userId, c?.final_document ? await contractHash(c.final_document) : "");
    if (accessError || !c || !c.final_document || !c.final_document_hash || !c.document_hash) throw new Error(accessError ?? "Contrat incomplet.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { downloadFinalContractPdf } = await import("./contractFileStorage.server");
    return downloadFinalContractPdf(supabaseAdmin, c);
  });