import { decideContractKind, validateAnswers, type ContractAnswers, type ContractKind } from "./contractDecision";
import { defaultTerms, meetsContractNotice, normalizeStoredTerms, validateTerms, type ContractTerms } from "./contractTerms";

/* ------------------------------------------------------------------
   Contrôles de la signature employeur (fonctions pures).
   Appelés par la fonction serveur : le navigateur ne fait jamais foi.
------------------------------------------------------------------- */

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 10 * 60_000;
export const OTP_MAX_ATTEMPTS = 3;
const HOUR = 3_600_000;

export type SignatureRefusal =
  | "not_owner" | "not_draft" | "decision_invalid" | "terms_invalid" | "no_cesu" | "notice" | "pair_active" | "salary";

export const SIGNATURE_MESSAGES: Record<SignatureRefusal, string> = {
  not_owner: "Ce contrat ne vous appartient pas.",
  not_draft: "Ce contrat a déjà été signé ou n'est plus modifiable.",
  decision_invalid: "Les réponses sur le type de contrat sont incomplètes : reprenez le premier questionnaire.",
  terms_invalid: "Certains choix du contrat sont incomplets ou invalides : vérifiez le questionnaire.",
  no_cesu: "Votre numéro CESU est nécessaire pour signer un contrat de travail.",
  notice: "La mission doit être réservée au moins 5 jours avant son début.",
  pair_active: "Un contrat est déjà actif ou en attente avec ce compagnon.",
  salary: "Le salaire horaire net est invalide.",
};

export type SignatureCheckInput = {
  callerId: string;
  draft: { client_id: string; status: string; contract_kind: string | null; answers: unknown } | null;
  missionTs: number;
  nowTs: number;
  cesu: { has_cesu_number: boolean | null; cesu_number: string | null } | null;
  otherActive: boolean;
  salaryNet: number;
};

export type SignatureCheck =
  | { ok: true; kind: ContractKind; answers: ContractAnswers; terms: ContractTerms }
  | { ok: false; code: SignatureRefusal };

export function checkEmployerSignature(i: SignatureCheckInput): SignatureCheck {
  const d = i.draft;
  if (!d || d.client_id !== i.callerId) return { ok: false, code: "not_owner" };
  if (d.status !== "draft") return { ok: false, code: "not_draft" };
  if (!(i.cesu?.has_cesu_number === true && !!i.cesu.cesu_number?.trim())) return { ok: false, code: "no_cesu" };
  if (!meetsContractNotice(i.missionTs, i.nowTs)) return { ok: false, code: "notice" };
  if (i.otherActive) return { ok: false, code: "pair_active" };
  if (!Number.isFinite(i.salaryNet) || i.salaryNet <= 0) return { ok: false, code: "salary" };

  const raw = (d.answers ?? {}) as Record<string, unknown>;
  const { terms: _t, terms_version: _v, decision_version, certified_at, ...rest } = raw;
  const answers = rest as ContractAnswers;
  if (!decision_version || !certified_at) return { ok: false, code: "decision_invalid" };
  if (validateAnswers(answers, { missionTs: i.missionTs }).length > 0) return { ok: false, code: "decision_invalid" };
  const kind = decideContractKind(answers, { missionTs: i.missionTs });
  if (kind !== d.contract_kind) return { ok: false, code: "decision_invalid" };

  const stored = normalizeStoredTerms(raw);
  if (!stored) return { ok: false, code: "terms_invalid" };
  const ctx = { kind, missionTs: i.missionTs, answers };
  const terms = { ...defaultTerms(ctx), ...stored } as ContractTerms;
  if (terms.startDate !== defaultTerms(ctx).startDate) return { ok: false, code: "terms_invalid" };
  if (validateTerms(terms, ctx).length > 0) return { ok: false, code: "terms_invalid" };
  return { ok: true, kind, answers, terms };
}

/** Échéance de réponse du compagnon : toujours 8 h après la signature de l'employeur. */
export function companionAnswerDeadline(signedTs: number, _missionTs?: number): number {
  return signedTs + 8 * HOUR;
}

export function maskValue(v: string | null | undefined): string {
  return v && v.trim() ? "••••" : "";
}
