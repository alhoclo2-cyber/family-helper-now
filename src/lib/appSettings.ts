import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";

export type AppSettingKey = "contract_flow_enabled" | "contract_convalescence_enabled";
export const appSettingKey = (key: AppSettingKey, userId?: string) => ["app-setting", key, userId] as const;

export function useAppSetting(key: AppSettingKey, defaultValue: boolean) {
  const { session } = useSession();
  return useQuery({
    queryKey: appSettingKey(key, session?.user.id),
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("value").eq("key", key).maybeSingle();
      if (error) throw error;
      return typeof data?.value === "boolean" ? data.value : defaultValue;
    },
  });
}

export function useUpdateAppSetting() {
  const qc = useQueryClient();
  const { session } = useSession();
  return useMutation({
    mutationFn: async ({ key, value }: { key: AppSettingKey; value: boolean }) => {
      if (!session) throw new Error("Connexion requise.");
      // La politique RLS réserve cette écriture au Mandataire.
      const { error } = await supabase.from("app_settings")
        .upsert({ key, value, updated_by: session.user.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["app-setting"] }),
  });
}