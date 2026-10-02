import { isBirthComplete } from "@/components/BirthFields";
import type { Database } from "@/integrations/supabase/types";

type AppRow = Database["public"]["Tables"]["companion_applications"]["Row"];

/** Liste des éléments obligatoires manquants d'une candidature Compagnon. */
export function missingCompanionItems(a: AppRow): string[] {
  const m: string[] = [];
  const f = (v: string | null | undefined) => !!v?.trim();
  if (!f(a.first_name) || !f(a.last_name)) m.push("prénom et nom");
  if (!f(a.address)) m.push("adresse");
  if (!f(a.email)) m.push("e-mail");
  if (!f(a.phone)) m.push("téléphone");
  if (!f(a.situation)) m.push("situation");
  if ((a.nir ?? "").replace(/\D/g, "").length !== 15) m.push("NIR");
  if (
    !isBirthComplete({
      birthDate: a.birth_date ?? "",
      birthPlace: a.birth_place ?? "",
      birthDepartment: a.birth_department ?? "",
    })
  )
    m.push("date, lieu et département de naissance");
  if (!(a.has_cesu_number === false || (a.has_cesu_number === true && f(a.cesu_number)))) m.push("numéro CESU");
  if (a.id_type === "passport") {
    if (!a.id_passport_path) m.push("passeport");
  } else if (a.id_type === "id_card") {
    if (!a.id_card_path || !a.id_card_back_path) m.push("pièce d'identité recto et verso");
  } else m.push("type de pièce d'identité");
  if (!a.vitale_card_path) m.push("carte Vitale");
  if (!a.criminal_record_path) m.push("casier judiciaire B3");
  if (!a.iban_path) m.push("RIB");
  if (a.housing_status === "hosted") {
    if (!a.host_attestation_path || !a.host_address_proof_path || !a.host_id_path) m.push("dossier d'hébergement");
  } else if (!a.address_proof_path) m.push("justificatif de domicile");
  if (!a.selfie_path) m.push("selfie");
  return m;
}
