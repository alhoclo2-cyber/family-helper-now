// Archives de sortie (SIMULATION, localStorage uniquement). Aucune suppression réelle.
import { supabase } from "@/integrations/supabase/client";
import { formatDateFr } from "@/lib/accountState";
import { sendSimulatedEmail } from "@/lib/simulatedEmails";

export type ArchiveDoc = { id: string; title: string; html: string; createdAt: number };
export type Archive = {
  email: string;
  role: "family" | "companion";
  createdAt: number;
  accessUntil: number;
  documents: ArchiveDoc[];
};

const KEY = "solelia-archive:";
export const OPEN_DOC_EVT = "solelia-open-archive-doc";
const norm = (e: string) => e.trim().toLowerCase();
const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const euro = (n: number) => n.toFixed(2).replace(".", ",") + " €";
const DEMO = "Modèle de démonstration : le contenu réel de ce document sera ajouté à l'ouverture de la plateforme.";

function page(title: string, content: string, at: number) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>body{font-family:sans-serif;padding:16px;font-size:16px;color:#222}table{border-collapse:collapse;width:100%;font-size:14px}td,th{border:1px solid #ccc;padding:6px;text-align:left}.logo{font-weight:900;color:#4A1525}</style></head>
<body><p class="logo">Solélia Accompagnement</p><h1>${esc(title)}</h1><p>Date : ${formatDateFr(at)}</p>${content}</body></html>`;
}
function doc(title: string, content: string, at: number): ArchiveDoc {
  return { id: crypto.randomUUID(), title, html: page(title, content, at), createdAt: at };
}
function table(head: string[], rows: unknown[][]) {
  return `<table><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
    .join("")}</table>`;
}

type LocalOrder = {
  date: number; need: string; address: string; hours: number;
  serviceFee: number; salaireNetHoraire: number; studentName?: string;
};
function localOrders(): LocalOrder[] {
  try {
    const v = JSON.parse(localStorage.getItem("sos-family-orders") || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function getArchive(email: string): Archive | null {
  if (typeof window === "undefined" || !email) return null;
  try {
    const raw = localStorage.getItem(KEY + norm(email));
    return raw ? (JSON.parse(raw) as Archive) : null;
  } catch {
    return null;
  }
}
export function saveArchive(a: Archive) {
  localStorage.setItem(KEY + norm(a.email), JSON.stringify(a));
}
export function removeArchive(email: string) {
  localStorage.removeItem(KEY + norm(email));
}
export const archiveIsExpired = (a: Archive) => Date.now() > a.accessUntil;

export async function createExitArchive({
  userId, email, role,
}: { userId: string; email: string; role?: "family" | "companion" }) {
  const now = Date.now();
  let r: "family" | "companion" = role ?? "family";
  try {
    const { data, error } = await supabase.from("companion_applications").select("id").eq("user_id", userId).limit(1);
    if (error) throw error;
    r = data?.length ? "companion" : "family";
  } catch {
    /* rôle de secours */
  }
  const docs: ArchiveDoc[] = [];
  try {
    if (r === "family") {
      const orders = localOrders();
      docs.push(doc("Récapitulatif de mes missions", orders.length
        ? table(["Date", "Service", "Adresse", "Durée", "Salaire net horaire", "Compagnon"],
            orders.map((o) => [formatDateFr(o.date), o.need, o.address, `${o.hours} h`, euro(Number(o.salaireNetHoraire) || 0), o.studentName ?? "—"]))
        : "<p>Aucune mission enregistrée.</p>", now));
      const total = orders.reduce((s, o) => s + (Number(o.serviceFee) || 0), 0);
      docs.push(doc("Reçus des frais de service", orders.length
        ? table(["Date", "Frais de service"], orders.map((o) => [formatDateFr(o.date), euro(Number(o.serviceFee) || 0)])) +
          `<p><strong>Total : ${euro(total)}</strong></p>`
        : "<p>Aucune mission enregistrée.</p>", now));
      const year = new Date().getFullYear();
      const yearTotal = orders.filter((o) => new Date(o.date).getFullYear() === year)
        .reduce((s, o) => s + (Number(o.serviceFee) || 0), 0);
      let name = email;
      try {
        const { data } = await supabase.from("profiles").select("first_name,last_name").eq("id", userId).maybeSingle();
        const n = [data?.first_name, data?.last_name].filter(Boolean).join(" ").trim();
        if (n) name = n;
      } catch { /* e-mail par défaut */ }
      docs.push(doc(`Attestation des frais de service ${year}`,
        `<p>Solélia atteste que ${esc(name)} a réglé ${euro(yearTotal)} de frais de service sur l'année ${year}.</p>`, now));
    } else {
      let rows: { mission_at: string | null; mission_id: string }[] = [];
      try {
        const { data, error } = await supabase.from("mission_payments").select("mission_at,mission_id").eq("companion_user_id", userId);
        if (!error) rows = data ?? [];
      } catch { /* vide */ }
      docs.push(doc("Récapitulatif de mes missions et de mes heures", rows.length
        ? table(["Date", "Référence de mission"], rows.map((x) => [x.mission_at ? formatDateFr(new Date(x.mission_at).getTime()) : "—", x.mission_id]))
        : "<p>Aucune mission enregistrée.</p>", now));
    }
  } catch { /* on continue */ }
  docs.push(doc("Mandat Solélia", `<p>${DEMO}</p>`, now));
  docs.push(doc("Contrat(s) de travail", `<p>${DEMO}</p>`, now));
  const until = new Date(now);
  until.setMonth(until.getMonth() + 12);
  const archive: Archive = { email: norm(email), role: r, createdAt: now, accessUntil: until.getTime(), documents: docs };
  saveArchive(archive);
  sendSimulatedEmail("exit_dossier", archive.email, { date: archive.accessUntil });
  return archive;
}

export function downloadArchiveDoc(d: ArchiveDoc) {
  const blob = new Blob([d.html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = d.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") + ".html";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Ouvre le document dans la fenêtre ArchiveDocDialog montée sur la page. */
export function openArchiveDoc(d: ArchiveDoc) {
  window.dispatchEvent(new CustomEvent<ArchiveDoc>(OPEN_DOC_EVT, { detail: d }));
}
