type Labelled = { firstName: string; lastInitial?: string; registrationNumber?: number };

/** « Prénom X. » — jamais le nom complet. */
export const companionLabel = (c: Labelled) =>
  c.lastInitial ? `${c.firstName} ${c.lastInitial.charAt(0).toUpperCase()}.` : c.firstName;

/** « n° 0001 », vide si aucun numéro. */
export const formatNumber = (c: Labelled) =>
  c.registrationNumber != null ? `n° ${String(c.registrationNumber).padStart(4, "0")}` : "";

/** Libellé complet « Léa M. · n° 0001 ». */
export const companionFullLabel = (c: Labelled) =>
  [companionLabel(c), formatNumber(c)].filter(Boolean).join(" · ");

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Recherche sur le prénom ou le numéro d'inscription uniquement. */
export function matchesCompanionSearch(c: Labelled, query: string): boolean {
  const q = norm(query);
  if (!q) return true;
  const digits = q.replace(/^n\s*°?\s*/, "").replace(/^no\s*/, "");
  if (/^\d+$/.test(digits)) return c.registrationNumber != null && Number(digits) === c.registrationNumber;
  return norm(c.firstName).startsWith(q);
}
