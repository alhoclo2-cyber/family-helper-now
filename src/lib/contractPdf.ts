import { PDFDocument, StandardFonts } from "pdf-lib";
import { stableStringify, type ContractDocument } from "./contractDocument";
import { formatContractAsText } from "./contractCompanion";

export async function contractHash(doc: unknown) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stableStringify(doc)));
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, "0")).join("");
}
export function checkContractPdf(c: { client_id: string; companion_user_id: string | null; status: string; final_document_hash: string | null } | null, userId: string, recomputedHash: string): string | null {
  if (!c || (userId !== c.client_id && userId !== c.companion_user_id)) return "Ce contrat ne vous appartient pas.";
  if (c.status !== "in_force") return "Le PDF est réservé aux contrats en vigueur.";
  if (!c.final_document_hash || c.final_document_hash !== recomputedHash) return "L'empreinte du contrat final ne correspond pas. Téléchargement refusé.";
  return null;
}
export function pdfText(text: string): string {
  return text.replace(/[\u00a0\u202f]/g, " ").replace(/[→⇒]/g, "->").replace(/[←⇐]/g, "<-").replace(/[‐‑‒–—]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, "...").replace(/[^\x20-\x7e\xa0-\xff\n\r€]/g, "?");
}
export type SignatureEvent = { event: string; occurred_at: string; auth_method: string | null };
export async function generateContractPdf(input: { contractId: string; document: ContractDocument; employerHash: string; finalHash: string; events: SignatureEvent[]; generatedAt: string }) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const width = 595.28, height = 841.89, margin = 42, lineHeight = 16;
  let page = pdf.addPage([width, height]);
  let y = height - margin;
  const newPage = () => { page = pdf.addPage([width, height]); y = height - margin; };
  const write = (text: string, heading = false) => {
    const usedFont = heading ? bold : font;
    const size = heading ? 14 : 11;
    for (const paragraph of pdfText(text).split(/\r?\n/)) {
      let line = "";
      const flush = () => { if (y < 65) newPage(); page.drawText(line, { x: margin, y, size, font: usedFont }); y -= lineHeight; line = ""; };
      for (const word of paragraph.split(/ +/)) {
        const candidate = line ? `${line} ${word}` : word;
        if (usedFont.widthOfTextAtSize(candidate, size) > width - 2 * margin) {
          if (line) flush();
          // Long hashes/identifiers are wrapped too, never allowed beyond the page edge.
          for (const char of word) { if (usedFont.widthOfTextAtSize(line + char, size) > width - 2 * margin) flush(); line += char; }
        } else line = candidate;
      }
      flush();
    }
  };
  write(input.document.title, true);
  y -= 10;
  // Preserve every field, article and the final signature line; never rebuild the signed content.
  const text = formatContractAsText(input.document).split("\n\n").slice(1).join("\n\n");
  write(text);
  newPage();
  write("Certificat de signature", true);
  y -= 10;
  write(`Numéro du contrat : ${input.contractId}`);
  const paris = (iso: string) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", dateStyle: "long", timeStyle: "long" }).format(new Date(iso));
  const name = (fields: ContractDocument["employer"]) => ["Prénom", "Nom d'usage"].map(label => fields.find(f => f.label === label)?.value ?? "").join(" ");
  for (const [event, role, fields] of [["employer_signed", "Employeur", input.document.employer], ["companion_signed", "Salarié", input.document.companion]] as const) {
    const log = input.events.find(e => e.event === event);
    if (!log) throw new Error("Journal de signature incomplet. PDF non généré.");
    y -= 10;
    write(`${role} : ${name(fields)}`);
    write(`Signé le ${paris(log.occurred_at)} (heure de Paris)`);
    write("Moyen : code à usage unique reçu par e-mail");
  }
  y -= 15;
  write(`Empreinte SHA-256 du contrat signé par l'employeur :\n${input.employerHash}`);
  y -= 10;
  write(`Empreinte SHA-256 du contrat final :\n${input.finalHash}`);
  y -= 10;
  write(`PDF généré le ${paris(input.generatedAt)} (heure de Paris)`);
  const pages = pdf.getPages();
  pages.forEach((p, index) => p.drawText(pdfText(`Page ${index + 1} / ${pages.length} - Contrat ${input.contractId}`), { x: margin, y: 30, size: 8, font }));
  pdf.setTitle(input.document.title);
  pdf.setSubject(`Contrat ${input.contractId} - IDCC ${input.document.idcc}`);
  return pdf.save();
}