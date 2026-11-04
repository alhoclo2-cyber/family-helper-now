import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
const DEDUP_WINDOW_MS = 10 * 60_000;
export async function recordMandataireAccess(admin: SupabaseClient<Database>, actorId: string, action: "contract_view" | "pdf_download" | "document_open", objectType: "contract" | "document", objectId: string) {
  // Anti-doublon : une ligne identique (acteur, action, objet) de moins de 10 minutes n'est pas réenregistrée.
  const since = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString();
  const { data: recent, error: readError } = await admin.from("mandataire_access_log").select("id").eq("actor_id", actorId).eq("action", action).eq("object_id", objectId).gte("created_at", since).limit(1);
  if (readError) throw new Error("Impossible d'enregistrer cet accès. Réessayez.");
  if (recent?.length) return;
  const { error } = await admin.from("mandataire_access_log").insert({ actor_id: actorId, action, object_type: objectType, object_id: objectId });
  if (error) throw new Error("Impossible d'enregistrer cet accès. Réessayez.");
}
