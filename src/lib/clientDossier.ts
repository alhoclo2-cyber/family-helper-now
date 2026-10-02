import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isTaxNumberValid } from "@/components/TaxCesuFields";
import { isBirthComplete } from "@/components/BirthFields";

export type DossierItem = { key: string; label: string; ok: boolean; note?: string };

export const clientDossierKey = (userId: string | undefined) => ["client-dossier", userId] as const;

/** Lecture du dossier Particulier (profil + documents) et checklist de complétude. */
export function useClientDossier(userId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: clientDossierKey(userId),
    enabled: !!userId && enabled,
    queryFn: async () => {
      const [p, d, a] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "first_name,last_name,address_line,postal_code,city,phone,tax_number,has_cesu_number,cesu_number,birth_date,birth_place,birth_department",
          )
          .eq("id", userId!)
          .maybeSingle(),
        supabase.from("client_documents").select("doc_type,file_path,status,reject_reason").eq("user_id", userId!),
        supabase.from("companion_applications").select("id").eq("user_id", userId!).maybeSingle(),
      ]);
      if (p.error) throw p.error;
      if (d.error) throw d.error;
      const prof = p.data;
      const docs = new Map((d.data ?? []).map((r) => [r.doc_type, r]));
      // Un document refusé compte comme manquant tant qu'il n'est pas redéposé
      const has = (t: string) => {
        const r = docs.get(t as never);
        return !!r?.file_path && r.status !== "rejected";
      };
      const reason = (t: string) => {
        const r = docs.get(t as never);
        return r?.status === "rejected" && r.reject_reason ? `Refusé : ${r.reject_reason}` : undefined;
      };
      const filled = (v: string | null | undefined) => !!v?.trim();
      const idOk = (has("identity_front") && has("identity_back")) || has("identity_passport");
      const idNote = reason("identity_front") ?? reason("identity_back") ?? reason("identity_passport");
      const items: DossierItem[] = [
        { key: "name", label: "Prénom et nom", ok: filled(prof?.first_name) && filled(prof?.last_name) },
        {
          key: "address",
          label: "Adresse, code postal, ville",
          ok: filled(prof?.address_line) && filled(prof?.postal_code) && filled(prof?.city),
        },
        { key: "phone", label: "Téléphone", ok: filled(prof?.phone) },
        { key: "tax", label: "Numéro fiscal (13 chiffres)", ok: isTaxNumberValid(prof?.tax_number ?? "") },
        {
          key: "cesu",
          label: "Numéro CESU (réponse Oui / Non)",
          ok: prof?.has_cesu_number === false || (prof?.has_cesu_number === true && filled(prof?.cesu_number)),
        },
        {
          key: "birth",
          label: "Date, lieu et département de naissance",
          ok: isBirthComplete({
            birthDate: prof?.birth_date ?? "",
            birthPlace: prof?.birth_place ?? "",
            birthDepartment: prof?.birth_department ?? "",
          }),
        },
        { key: "rib", label: "RIB", ok: has("rib"), note: reason("rib") },
        {
          key: "proof",
          label: "Justificatif de domicile",
          ok: has("proof_of_address"),
          note: reason("proof_of_address"),
        },
        {
          key: "identity",
          label: "Pièce d'identité (recto + verso, ou passeport)",
          ok: idOk,
          note: idOk ? undefined : idNote,
        },
      ];
      return { items, complete: items.every((i) => i.ok), isCompanion: !!a.data };
    },
  });
}
