import { createContext, useContext, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { FinalContractDocument } from "./FinalContractDocument";
import { listContractsForMandataire, getContractForMandataire, getContractPdfForMandataire, listMandataireAccessLog } from "@/lib/mandataire.functions";
import { contractsForPerson, contractStateLabel, dossierLogMatches } from "@/lib/mandataireModel";
import { hasFinalContractStatus } from "@/lib/contractFinalStatus";
import { useStore } from "@/lib/store";
import { formatMissionRange } from "@/lib/missionClosure";
import { Download, ArrowLeft, FileText } from "lucide-react";
export type MandataireContract = Awaited<ReturnType<typeof listContractsForMandataire>>[number];
export type PersonTarget = { type: "client" | "companion" | "contract"; id: string };
export const MandataireContext = createContext<{ contracts: MandataireContract[]; navigate: (target: PersonTarget) => void; clients: { id: string; first_name: string; last_name: string }[]; companions: { user_id: string; first_name: string; last_name: string }[] }>({ contracts: [], navigate: () => {}, clients: [], companions: [] });
export function DossierBlock({ title, children, open = false }: { title: string; children: React.ReactNode; open?: boolean }) {
  return <details open={open} className="min-w-0 border-b border-border py-3"><summary className="cursor-pointer font-bold text-base">{title}</summary><div className="mt-3 flex flex-col gap-3 min-w-0">{children}</div></details>;
}
export function ContractCount({ personId, role }: { personId: string; role: "client" | "companion" }) {
  const { contracts } = useContext(MandataireContext); const own = contractsForPerson(contracts, personId, role);
  return <p className="text-sm font-semibold">{own.length} contrats dont {own.filter(c => c.status === "in_force").length} en vigueur</p>;
}
export function InForceBadge({ personId, role }: { personId: string; role: "client" | "companion" }) {
  const { contracts } = useContext(MandataireContext);
  return contractsForPerson(contracts, personId, role).some(c => c.status === "in_force") ? <span className="text-sm text-success font-bold">● Contrat en vigueur</span> : null;
}
const date = (iso: string | null) => iso ? new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", dateStyle: "medium", timeStyle: iso.includes("T") ? "short" : undefined }).format(new Date(iso)) : "—";
export function PartyLink({ c, role }: { c: MandataireContract; role: "client" | "companion" }) {
  const ctx = useContext(MandataireContext); const id = role === "client" ? c.client_id : c.companion_user_id;
  const exists = role === "client" ? ctx.clients.some(p => p.id === id) : ctx.companions.some(p => p.user_id === id);
  const name = role === "client" ? c.client_name : c.companion_name;
  return exists && id ? <Button variant="link" className="h-auto p-0 whitespace-normal text-left justify-start" onClick={() => ctx.navigate({ type: role, id })}>{name}</Button> : <span>{name}</span>;
}
function PdfButton({ id }: { id: string }) {
  const download = useServerFn(getContractPdfForMandataire); const qc = useQueryClient(); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  return <><Button variant="outline" disabled={busy} className="h-auto whitespace-normal py-2" onClick={async () => { setBusy(true); setError(""); try { const f = await download({ data: { id } }); const url = URL.createObjectURL(new Blob([new Uint8Array(f.bytes)], { type: "application/pdf" })); const a = document.createElement("a"); a.href = url; a.download = f.filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); void qc.invalidateQueries({ queryKey: ["mandataire-log"] }); } catch (e) { setError(e instanceof Error ? e.message : "Téléchargement impossible."); } finally { setBusy(false); } }}><Download />{busy ? "Téléchargement…" : "Télécharger le PDF"}</Button>{error && <p className="text-destructive">{error}</p>}</>;
}
export function ContractCards({ contracts, role }: { contracts: MandataireContract[]; role?: "client" | "companion" }) {
  const ctx = useContext(MandataireContext);
  return <div className="grid gap-3 md:grid-cols-2">{!contracts.length && <p className="text-muted-foreground">Aucun contrat</p>}{contracts.map(c => <article key={c.id} className="border border-border rounded-lg bg-card p-4 min-w-0 flex flex-col gap-2">
    {role !== "client" && <p>Particulier : <PartyLink c={c} role="client" /></p>}{role !== "companion" && <p>Compagnon : <PartyLink c={c} role="companion" /></p>}
    <p className="font-bold">{c.contract_kind?.toUpperCase() ?? "—"} · {contractStateLabel[c.status] ?? c.status}</p><p>Début : {date(c.effective_from)} · Fin : {date(c.effective_until)}</p><p>Signature employeur : {date(c.employer_signed_at)}<br />Signature compagnon : {date(c.companion_signed_at)}</p>
    <Button variant="secondary" onClick={() => ctx.navigate({ type: "contract", id: c.id })}><FileText />Ouvrir le contrat</Button>{hasFinalContractStatus(c.status) && <PdfButton id={c.id} />}
  </article>)}</div>;
}
export function PersonContracts({ personId, role }: { personId: string; role: "client" | "companion" }) { const ctx = useContext(MandataireContext); return <ContractCards contracts={contractsForPerson(ctx.contracts, personId, role)} role={role} />; }
export function ContractsSection({ initialFilter = "all" }: { initialFilter?: string }) {
  const ctx = useContext(MandataireContext); const [q, setQ] = useState(""); const [filter, setFilter] = useState(initialFilter);
  const filtered = ctx.contracts.filter(c => `${c.client_name} ${c.companion_name}`.toLowerCase().includes(q.toLowerCase()) && (filter === "all" || (filter === "ended" ? ["ended", "terminated", "closed"].includes(c.status) : filter === "no_followup" ? ["refused", "expired"].includes(c.status) : c.status === filter)));
  return <div className="space-y-4"><div className="flex flex-wrap gap-2"><input aria-label="Rechercher un contrat par nom" placeholder="Rechercher par nom…" value={q} onChange={e => setQ(e.target.value)} className="border border-border rounded-lg bg-card p-3 flex-1 min-w-0" /><select aria-label="État du contrat" value={filter} onChange={e => setFilter(e.target.value)} className="border border-border rounded-lg bg-card p-3"><option value="all">Tous</option><option value="in_force">En vigueur</option><option value="awaiting_companion">En attente</option><option value="ended">Terminés</option><option value="no_followup">Sans suite</option></select></div><ContractCards contracts={filtered} /></div>;
}
export function DossierMissions({ personId, role, contractId }: { personId?: string; role?: "client" | "companion"; contractId?: string }) {
  const ctx = useContext(MandataireContext); const requests = useStore(s => s.requests); const ids = contractsForPerson(ctx.contracts, personId ?? "", role ?? "client").map(c => c.id);
  // No family identity is stored on legacy demo requests: never match by display name.
  const rows = requests.filter(r => contractId ? r.contractId === contractId : (r.contractId && ids.includes(r.contractId)) || (role === "companion" && r.student?.id === personId));
  return <><p className="text-muted-foreground">Source : missions démo de cette session du navigateur, non enregistrées. Les missions sans rattachement identifiable ne sont pas attribuées à ce dossier.</p>{!rows.length && <p>Aucune mission rattachée</p>}{rows.map(r => <div key={r.id} className="border-b border-border py-2"><p className="font-bold">{r.need}</p><p>{formatMissionRange(r)} · {r.status === "accepted" ? "Acceptée" : r.status === "cancelled" ? "Annulée" : "En recherche"}</p><p>{r.address}</p></div>)}</>;
}
export function ContractDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const fetch = useServerFn(getContractForMandataire); const ctx = useContext(MandataireContext); const qc = useQueryClient();
  const query = useQuery({ queryKey: ["mandataire-contract", id], queryFn: async () => { const result = await fetch({ data: { id } }); void qc.invalidateQueries({ queryKey: ["mandataire-log"] }); return result; }, staleTime: 0 });
  const c = query.data; const list = ctx.contracts.find(c => c.id === id);
  return <div className="space-y-4"><Button variant="ghost" onClick={onBack}><ArrowLeft />Retour</Button><h2 className="text-xl font-bold">Fiche contrat</h2>{query.isPending && <p>Chargement…</p>}{query.isError && <p className="text-destructive">{query.error.message}</p>}{c && <><p className="font-bold">{contractStateLabel[c.status] ?? c.status}</p><p>Signature employeur : {date(c.employer_signed_at)} · Compagnon : {date(c.companion_signed_at)}</p><p>Début : {date(c.effective_from)} · Fin : {date(c.effective_until)}</p>{c.companion_answer_deadline && <p>Réponse avant le {date(c.companion_answer_deadline)} (heure de Paris)</p>}{c.final_document && <>
    {list && <DossierBlock title="Les parties" open><PartyLink c={list} role="client" /><PartyLink c={list} role="companion" /></DossierBlock>}
    <DossierBlock title="Conditions" open><p>Type : {c.contract_kind?.toUpperCase()}</p>{c.final_document.sections.filter(s => [2, 5, 7, 8, 9].includes(s.number)).map(s => <div key={s.key}><h3 className="font-bold">{s.title}</h3>{s.paragraphs.map((p, i) => <p key={i}>{p}</p>)}</div>)}</DossierBlock>
    <DossierBlock title="Certificat de signature">{c.signatures.map(s => <div key={s.id}><p>{s.event === "employer_signed" ? "Signature employeur" : s.event === "companion_signed" ? "Signature compagnon" : s.event}</p><p>{date(s.occurred_at)} (heure de Paris) · {s.auth_method ?? "—"}</p>{s.document_hash && <p className="break-all">{s.document_hash}</p>}</div>)}</DossierBlock>
    <DossierBlock title="Contrat complet"><FinalContractDocument document={c.final_document} /></DossierBlock><PdfButton id={id} /><DossierBlock title="Planning et missions rattachées"><DossierMissions contractId={id} /></DossierBlock>
  </>}</>}</div>;
}
const actionLabels: Record<string, string> = { contract_view: "Consultation contrat", pdf_download: "Téléchargement PDF", document_open: "Ouverture document" };
export function AccessLog({ personId }: { personId?: string }) {
  const fetch = useServerFn(listMandataireAccessLog); const ctx = useContext(MandataireContext); const query = useQuery({ queryKey: ["mandataire-log"], queryFn: () => fetch(), staleTime: 0 }); const [action, setAction] = useState(""); const [person, setPerson] = useState("");
  const selected = personId ?? person; const ids = ctx.contracts.filter(c => c.client_id === selected || c.companion_user_id === selected).map(c => c.id);
  const rows = (query.data ?? []).filter(r => (!action || r.action === action) && (!selected || dossierLogMatches(r, selected, ids)));
  const people = [...ctx.clients.map(p => ({ id: p.id, name: `${p.first_name} ${p.last_name}` })), ...ctx.companions.map(p => ({ id: p.user_id, name: `${p.first_name} ${p.last_name}` }))];
  return <div className="space-y-3"><div className="flex flex-wrap gap-2"><select aria-label="Filtrer le journal par action" value={action} onChange={e => setAction(e.target.value)} className="bg-card border border-border rounded-lg p-2"><option value="">Toutes les actions</option>{Object.entries(actionLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>{!personId && <select aria-label="Filtrer le journal par personne" value={person} onChange={e => setPerson(e.target.value)} className="bg-card border border-border rounded-lg p-2 max-w-full"><option value="">Toutes les personnes</option>{people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}<Button variant="outline" onClick={() => query.refetch()}>Actualiser</Button></div>{query.isPending && <p>Chargement…</p>}{query.isError && <p className="text-destructive">{query.error.message}</p>}<div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr><th className="p-2">Date (Paris)</th><th className="p-2">Action</th><th className="p-2">Dossier / objet</th></tr></thead><tbody>{rows.map(r => { const c = ctx.contracts.find(c => c.id === r.object_id); const p = people.find(p => p.id === r.object_id.split("/")[0]); return <tr key={r.id} className="border-t border-border"><td className="p-2 align-top">{date(r.created_at)}</td><td className="p-2 align-top">{actionLabels[r.action] ?? r.action}</td><td className="p-2 break-all">{c ? `${c.client_name} / ${c.companion_name}` : p?.name ?? r.object_id}</td></tr>; })}</tbody></table></div>{!query.isPending && !rows.length && <p>Aucun accès enregistré</p>}</div>;
}
