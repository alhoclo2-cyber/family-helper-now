// Code d'accès aux archives (SIMULATION, localStorage).
import { archiveIsExpired, getArchive, type Archive } from "@/lib/archive";
import { sendSimulatedEmail } from "@/lib/simulatedEmails";

const KEY = "solelia-archive-code:";
const SENT = "solelia-archive-code-sent:";
type Stored = { code: string; expiresAt: number; attempts: number; sentAt: number };
const norm = (e: string) => e.trim().toLowerCase();
export const RESEND_DELAY_MS = 60_000;

export function requestArchiveCode(email: string): { sent: true } {
  const e = norm(email);
  if (!e) return { sent: true };
  const last = Number(localStorage.getItem(SENT + e) || 0);
  if (Date.now() - last < RESEND_DELAY_MS) return { sent: true };
  localStorage.setItem(SENT + e, String(Date.now()));
  const a = getArchive(e);
  if (a && !archiveIsExpired(a)) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const s: Stored = { code, expiresAt: Date.now() + 10 * 60_000, attempts: 0, sentAt: Date.now() };
    localStorage.setItem(KEY + e, JSON.stringify(s));
    sendSimulatedEmail("archive_code", e, { code });
  }
  return { sent: true };
}

export function verifyArchiveCode(
  email: string,
  code: string,
): { ok: true; archive: Archive } | { ok: false; reason: "expired" | "wrong" | "locked" | "none" } {
  const e = norm(email);
  let s: Stored | null = null;
  try { s = JSON.parse(localStorage.getItem(KEY + e) || "null"); } catch { s = null; }
  if (!s) return { ok: false, reason: "none" };
  if (Date.now() > s.expiresAt) {
    localStorage.removeItem(KEY + e);
    return { ok: false, reason: "expired" };
  }
  if (s.code !== code.trim()) {
    s.attempts += 1;
    if (s.attempts >= 5) {
      localStorage.removeItem(KEY + e);
      return { ok: false, reason: "locked" };
    }
    localStorage.setItem(KEY + e, JSON.stringify(s));
    return { ok: false, reason: "wrong" };
  }
  localStorage.removeItem(KEY + e);
  const archive = getArchive(e);
  if (!archive) return { ok: false, reason: "none" };
  return { ok: true, archive };
}
