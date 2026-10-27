import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
export async function recordMandataireAccess(admin: SupabaseClient<Database>, actorId: string, action: "contract_view" | "pdf_download" | "document_open", objectType: "contract" | "document", objectId: string) {
  const { error } = await admin.from("mandataire_access_log").insert({ actor_id: actorId, action, object_type: objectType, object_id: objectId });
  if (error) throw new Error("Impossible d'enregistrer cet accès. Réessayez.");
}
