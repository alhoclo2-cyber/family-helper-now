import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { ContractDocument, ContractField, PartyIdentity } from "./contractDocument";

/* ------------------------------------------------------------------
   Réponse du compagnon au contrat (fonctions pures, sans React).
   Rappelées côté serveur : le navigateur ne fait jamais foi.
------------------------------------------------------------------- */

export type CompanionAnswerRefusal = "not_companion" | "not_awaiting" | "expired" | "hash_mismatch";

export const COMPANION_ANSWER_MESSAGES: Record<CompanionAnswerRefusal, string> = {
  not_companion: "Ce contrat ne vous est pas adressé.",
  not_awaiting: "Ce contrat n'attend plus votre réponse.",
  expired: "Le délai de réponse est dépassé.",
  hash_mismatch: "Le contrat a changé depuis la signature de l'employeur : demandez une nouvelle version.",
};

export type CompanionAnswerInput = {
  callerId: string;
  contract: {
    companion_user_id: string | null;
    status: string;
    companion_answer_deadline: string | null;
    document_hash: string | null;
  } | null;
  nowTs: number;
  /** Empreinte SHA-256 du snapshot, recalculée côté serveur. */
  recomputedHash: string;
};

export function checkCompanionAnswer(i: CompanionAnswerInput): { ok: true } | { ok: false; code: CompanionAnswerRefusal } {
  const c = i.contract;
  if (!c || c.companion_user_id !== i.callerId) return { ok: false, code: "not_companion" };
  if (c.status !== "awaiting_companion") return { ok: false, code: "not_awaiting" };
  if (!c.companion_answer_deadline || new Date(c.companion_answer_deadline).getTime() < i.nowTs) return { ok: false, code: "expired" };
  if (!c.document_hash || c.document_hash !== i.recomputedHash) return { ok: false, code: "hash_mismatch" };
  return { ok: true };
}

/** Retire le numéro de voie en tête d'adresse (« 12 bis rue des Lilas, 75014 Paris » → « rue des Lilas, 75014 Paris »). */
export function maskStreetNumber(address: string): string {
  return address.replace(/^\s*\d+[a-zA-Z]?(?:\s*(?:bis|ter|quater))?\s+/i, "");
}

const mask = (v: string) => (v.trim() ? "••••" : v);

/**
 * Masque les coordonnées de l'employeur pour la lecture par le compagnon :
 * numéro de voie, téléphone, e-mail et n° CESU remplacés ; rue, code postal
 * et ville restent visibles. La section 3 perd le numéro de voie.
 */
export function maskEmployerForCompanion(doc: ContractDocument): ContractDocument {
  const employer = doc.employer.map((f) => {
    if (f.label === "Adresse") return { ...f, value: maskStreetNumber(f.value) };
    if (f.label === "Téléphone" || f.label === "E-mail" || f.label === "N° CESU") return { ...f, value: mask(f.value) };
    return f;
  });
  const sections = doc.sections.map((s) =>
    s.key === "lieu"
      ? { ...s, paragraphs: s.paragraphs.map((p) => (p.startsWith("Adresse : ") ? `Adresse : ${maskStreetNumber(p.slice("Adresse : ".length))}` : p)) }
      : s,
  );
  return { ...doc, employer, sections };
}

/** Identité complète d'une partie pour le contrat final (aucune donnée masquée). */
export type FinalPartyIdentity = PartyIdentity & {
  birthDate?: string; // AAAA-MM-JJ
  birthPlace?: string;
  birthDepartment?: string;
};
export type FinalEmployerIdentity = FinalPartyIdentity & { taxNumber?: string; cesuNumber: string };
export type FinalCompanionIdentity = FinalPartyIdentity & { nir: string };

const fmtBirth = (p: FinalPartyIdentity) =>
  [p.birthDate ? format(new Date(`${p.birthDate}T00:00:00`), "dd/MM/yyyy") : "", p.birthPlace, p.birthDepartment ? `(${p.birthDepartment})` : ""]
    .filter(Boolean)
    .join(" ");

function finalEmployerFields(e: FinalEmployerIdentity): ContractField[] {
  return [
    { label: "Nom de naissance", value: e.birthName },
    { label: "Nom d'usage", value: e.lastName },
    { label: "Prénom", value: e.firstName },
    { label: "Naissance", value: fmtBirth(e) },
    { label: "Adresse", value: e.address },
    { label: "Téléphone", value: e.phone },
    { label: "E-mail", value: e.email },
    { label: "N° fiscal", value: e.taxNumber ?? "" },
    { label: "N° CESU", value: e.cesuNumber },
  ];
}

function finalCompanionFields(c: FinalCompanionIdentity): ContractField[] {
  return [
    { label: "Nom de naissance", value: c.birthName },
    { label: "Nom d'usage", value: c.lastName },
    { label: "Prénom", value: c.firstName },
    { label: "Naissance", value: fmtBirth(c) },
    { label: "Adresse", value: c.address },
    { label: "Téléphone", value: c.phone },
    { label: "E-mail", value: c.email },
    { label: "N° de sécurité sociale", value: c.nir },
  ];
}

const fmtSign = (iso: string) => format(new Date(iso), "dd/MM/yyyy 'à' HH:mm", { locale: fr });

/**
 * Contrat final en clair : reprend le document signé par l'employeur et
 * remplace les deux blocs d'identité par les coordonnées réelles. Les
 * informations du compagnon sont celles de son compte au moment où il signe.
 * L'empreinte de l'employeur (document_hash) porte sur le snapshot et ne
 * change jamais ; le contrat final a sa propre empreinte.
 */
export function buildFinalContractDocument(
  snapshot: { document: ContractDocument; signedAt: string },
  employer: FinalEmployerIdentity,
  companion: FinalCompanionIdentity,
  companionSignedAt: string,
): ContractDocument {
  return {
    ...snapshot.document,
    employer: finalEmployerFields(employer),
    companion: finalCompanionFields(companion),
    signatureLine: `Signé électroniquement par ${employer.firstName} ${employer.lastName} le ${fmtSign(snapshot.signedAt)} et par ${companion.firstName} ${companion.lastName} le ${fmtSign(companionSignedAt)}.`,
  };
}

/** Contrat complet en texte brut (e-mail envoyé aux deux parties). */
export function formatContractAsText(doc: ContractDocument): string {
  const party = (title: string, fields: ContractField[]) =>
    [`${title} :`, ...fields.filter((f) => f.value.trim()).map((f) => `  ${f.label} : ${f.value}`)].join("\n");
  const parts = [
    doc.title,
    `Convention collective IDCC ${doc.idcc}`,
    party("L'employeur", doc.employer),
    party("Le salarié", doc.companion),
    ...doc.sections.map((s) => [`${s.number}. ${s.title}`, ...s.paragraphs].join("\n")),
  ];
  if (doc.signatureLine) parts.push(doc.signatureLine);
  return parts.join("\n\n");
}
