import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ContractWithdrawalActions } from "@/components/ContractWithdrawalActions";
import { setPendingWithdrawalEdit } from "@/lib/contractWithdrawal";
import { AccountPageShell } from "@/components/AccountPageShell";
import { Button } from "@/components/ui/button";
import { FinalContractDocument } from "@/components/FinalContractDocument";
import { SimulatedEmailsDialog } from "@/components/SimulatedEmailsDialog";
import { myContractsOptions } from "@/lib/myContracts";
import { getContractPdf } from "@/lib/contractFiles.functions";
import { formatContractAsText } from "@/lib/contractCompanion";
import { sendSimulatedEmail } from "@/lib/simulatedEmails";
import { sendContractPlanning } from "@/lib/contractPlanning";
import { COMPANIONS, store } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/compte/contrats")({
  loader: ({ context }) => context.queryClient.ensureQueryData(myContractsOptions(context.user.id)),
  head: () => ({ meta: [
    { title: "Mes contrats — Solélia Accompagnement" },
    { name: "description", content: "Retrouvez vos contrats de travail Solélia, leurs signatures et votre planning." },
    { property: "og:title", content: "Mes contrats — Solélia" },
    { property: "og:description", content: "Consultation des contrats et plannings Solélia Accompagnement." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: ContractsPage,
});

const states: Record<string, string> = { awaiting_companion: "En attente de la réponse du compagnon", in_force: "En vigueur", refused: "Refusé", expired: "Expiré", withdrawn: "Retiré par le particulier", ended: "Terminé", terminated: "Terminé", closed: "Terminé" };
const date = (iso: string | null) => iso ? new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" }).format(new Date(iso)) : "Non signée";
function ContractsPage() {
  const { user } = Route.useRouteContext();
  const { data: contracts } = useSuspenseQuery(myContractsOptions(user.id));
  const download = useServerFn(getContractPdf);
  const [opened, setOpened] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const navigate = useNavigate();
  const active = contracts.filter(c => ["in_force", "awaiting_companion"].includes(c.status));
  const closed = contracts.filter(c => !["in_force", "awaiting_companion"].includes(c.status));
  const cards = (list: typeof contracts) => list.map(c => {
    const doc = c.final_document;
    const isEmployer = c.client_id === user.id;
    const otherFields = isEmployer ? doc?.companion : doc?.employer;
    const other = doc && otherFields
      ? ["Prénom", "Nom d'usage"].map(label => otherFields.find(f => f.label === label)?.value).filter(Boolean).join(" ")
      : COMPANIONS.find(p => p.id === c.companion_ref)?.firstName ?? "Compagnon";
    return <article key={c.id} className="border-2 border-border bg-card rounded-lg p-4 space-y-3 text-base">
      <h2 className="font-black text-lg">{other} · {c.contract_kind === "cdd" ? "CDD" : "CDI"}</h2>
      <p className="font-bold">{states[c.status] ?? "Terminé"}</p>
      <p>Signature de l'employeur : {date(c.employer_signed_at)}</p>
      <p>Signature du compagnon : {date(c.companion_signed_at)}</p>
      <p>Début : {c.effective_from ? new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", dateStyle: "long" }).format(new Date(`${c.effective_from}T12:00:00Z`)) : "—"}</p>
      {isEmployer && c.status === "awaiting_companion" && <ContractWithdrawalActions contractId={c.id} onWithdrawn={() => setNotice("Votre demande a été retirée, sans frais.")} onModify={(r) => { setPendingWithdrawalEdit(r); void navigate({ to: "/" }); }} />}
      {doc && <>
        <Button variant="outline" className="w-full text-base" onClick={() => setOpened(opened === c.id ? null : c.id)}>{opened === c.id ? "Fermer le contrat" : "Lire le contrat"}</Button>
        {opened === c.id && <FinalContractDocument document={doc} />}
        <Button className="w-full text-base" disabled={busy === c.id} onClick={async () => {
          setBusy(c.id); setNotice(null);
          try {
            const file = await download({ data: { contractId: c.id } });
            const url = URL.createObjectURL(new Blob([new Uint8Array(file.bytes)], { type: "application/pdf" }));
            const a = document.createElement("a"); a.href = url; a.download = file.filename; a.click();
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
          } catch (e) { setNotice(e instanceof Error ? e.message : "Impossible de télécharger le PDF."); }
          finally { setBusy(null); }
        }}>{busy === c.id ? "Préparation du PDF…" : "Télécharger le PDF"}</Button>
        {c.status === "in_force" && <><Button variant="outline" className="w-full h-auto py-3 whitespace-normal text-base" onClick={() => {
          const fields = isEmployer ? doc.employer : doc.companion;
          sendSimulatedEmail("contract_signed_both", fields.find(f => f.label === "E-mail")?.value, { contractId: c.id, contractText: formatContractAsText(doc) });
          setNotice("Le contrat figure dans vos e-mails simulés.");
        }}>Recevoir le contrat par e-mail</Button>
        <Button variant="outline" className="w-full h-auto py-3 whitespace-normal text-base" onClick={() => setNotice(sendContractPlanning(c, store.getState().requests, "requested", isEmployer ? "employer" : "companion") ? "Le planning figure dans vos e-mails simulés." : "Aucun planning n'est établi pour ce contrat.")}>Renvoyer le planning par e-mail</Button></>}
      </>}
    </article>;
  });
  return <AccountPageShell title="Mes contrats">{() => <div className="space-y-4 text-base">
    {!contracts.length && <p>Aucun contrat pour le moment.</p>}
    {cards(active)}
    {!!closed.length && <details><summary className="font-bold cursor-pointer py-3">Contrats terminés ou sans suite ({closed.length})</summary><div className="space-y-4">{cards(closed)}</div></details>}
    {notice && <p role="status" className="font-semibold text-base">{notice}</p>}
    <SimulatedEmailsDialog />
  </div>}</AccountPageShell>;
}