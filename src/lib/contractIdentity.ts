import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ContractIdentity = {
  birth_name?: string | null;
  address_line?: string | null;
  postal_code?: string | null;
  city?: string | null;
};

export function missingContractIdentity(profile: ContractIdentity | null | undefined): string[] {
  const fields = [
    ["birth_name", "nom de naissance"],
    ["address_line", "adresse"],
    ["postal_code", "code postal"],
    ["city", "ville"],
  ] as const;
  return fields.filter(([key]) => !profile?.[key]?.trim()).map(([, label]) => label);
}

export const contractIdentityKey = (userId: string | undefined) => ["contract-identity", userId] as const;

export function useContractIdentity(userId: string | undefined) {
  return useQuery({
    queryKey: contractIdentityKey(userId),
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) throw new Error("Connexion requise.");
      const { data, error } = await supabase.from("profiles")
        .select("birth_name,address_line,postal_code,city").eq("id", userId).maybeSingle();
      if (error) throw error;
      return { profile: data, missing: missingContractIdentity(data) };
    },
  });
}

export const cesuStatusKey = (userId: string | undefined) => ["cesu-status", userId] as const;

/** « CESU renseigné » = has_cesu_number vrai ET cesu_number non vide. */
export function useCesuStatus(userId: string | undefined) {
  return useQuery({
    queryKey: cesuStatusKey(userId),
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) throw new Error("Connexion requise.");
      const { data, error } = await supabase.from("profiles")
        .select("has_cesu_number,cesu_number").eq("id", userId).maybeSingle();
      if (error) throw error;
      return { hasCesu: data?.has_cesu_number === true && !!data.cesu_number?.trim() };
    },
  });
}