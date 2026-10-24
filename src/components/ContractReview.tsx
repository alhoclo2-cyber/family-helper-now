import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { fetchContractTerms } from "@/lib/contractDraft";
import { defaultTerms, type ContractTerms } from "@/lib/contractTerms";
import type { ContractAnswers, ContractKind } from "@/lib/contractDecision";
import { buildContractDocument, type ContractField, type EditTarget } from "@/lib/contractDocument";
import { getContractParties, requestEmployerSignatureCode, signContractAsEmployer } from "@/lib/contract.functions";
import { sendSimulatedEmail } from "@/lib/simulatedEmails";
import { SimulatedEmailsDialog } from "@/components/SimulatedEmailsDialog";
import { ContractNoticeSentence } from "@/components/ContractQuestionnaire";

export type ContractMission = { address: string; need: string; salaryNet: number };
export type SignedContract = { contractId: string; deadline: number };

function Fields({ title, fields }: { title: string; fields: ContractField[] }) {
  return (
    <div className="rounded-2xl border-2 border-border bg-card p-4">
      <p className="font-black mb-2">{title}</p>
      {fields.map((f) => (
        <p key={f.label} className="text-base"><b>{f.label} :</b> {f.value || "—"}</p>
      ))}
    </div>
  );
}

export function ContractReview({
  draftId, kind, answers, missionTs, durationHours, mission, missionId, onEdit, onBack, onSigned,
}: {
  draftId: string;
  kind: ContractKind;
  answers: ContractAnswers;
  missionTs: number;
  durationHours: number;
  mission: ContractMission;
  missionId: string;
  onEdit: (target: EditTarget) => void;
  onBack: () => void;
  onSigned: (result: SignedContract) => void;
}) {
  const fetchParties = useServerFn(getContractParties);
  const requestCode = useServerFn(requestEmployerSignatureCode);
  const sign = useServerFn(signContractAsEmployer);
  const terms = useQuery({ queryKey: ["contract-terms", draftId, "review"], queryFn: () => fetchContractTerms(draftId), staleTime: 0, gcTime: 0 });
  const parties = useQuery({ queryKey: ["contract-parties", draftId], queryFn: () => fetchParties({ data: { draftId } }), staleTime: 0 });
  const [read, setRead] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (terms.isLoading || parties.isLoading) {
    return <div className="flex-1 flex items-center justify-center px-6 py-10"><p className="text-muted-foreground">Chargement du contrat…</p></div>;
  }
  if (parties.error || terms.error || !parties.data) {
    return (
      <div className="flex-1 flex flex-col px-5 py-6 gap-4">
        <p role="alert" className="text-base font-semibold text-destructive">Impossible d'afficher le contrat. Réessayez.</p>
        <button type="button" onClick={onBack} className="w-full py-4 rounded-2xl border-2 border-border font-bold">← Retour</button>
      </div>
    );
  }

  const ctx = { kind, missionTs, answers };
  const fullTerms = { ...defaultTerms(ctx), ...(terms.data ?? {}), startDate: defaultTerms(ctx).startDate } as ContractTerms;
  const doc = buildContractDocument({
    kind, answers, terms: fullTerms,
    employer: parties.data.employer, companion: parties.data.companion,
    mission: { address: mission.address, needs: [mission.need] },
    salary: { netHourly: mission.salaryNet },
  });

  const sendCode = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await requestCode({ data: { draftId } });
      // SIMULATION : le code apparaît dans les e-mails simulés, en attendant l'envoi réel.
      sendSimulatedEmail("contract_signature_code", r.email, { code: r.code });
      setCodeSent(true);
      setCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d'envoyer le code, réessayez.");
    } finally {
      setBusy(false);
    }
  };

  const confirmCode = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await sign({ data: { draftId, code, missionId, missionTs, durationHours, address: mission.address, need: mission.need, salaryNet: mission.salaryNet } });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      onSigned({ contractId: r.contractId, deadline: r.deadline });
    } catch {
      setError("La signature n'a pas pu être enregistrée. Rien n'a été modifié, réessayez.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col px-5 py-6 gap-4 text-base">
      <h2 className="text-xl font-black">Relecture du contrat</h2>
      <p className="font-bold">{doc.title}</p>
      <p className="text-sm text-muted-foreground">Mission du {format(new Date(missionTs), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })} · {durationHours} h</p>
      <button type="button" onClick={() => onEdit({ q: 1 })} className="self-start text-sm font-bold text-primary underline">Modifier le type de contrat</button>
      {doc.emploiPending && (
        <p className="text-sm text-muted-foreground">Note : l'emploi-repère de la convention collective est encore à confirmer par Solélia Accompagnement.</p>
      )}
      <Fields title="L'employeur" fields={doc.employer} />
      <Fields title="Le salarié" fields={doc.companion} />
      <p className="text-sm text-muted-foreground">Code de la convention collective (IDCC) : {doc.idcc}. Les coordonnées du compagnon restent masquées jusqu'à la signature des deux parties.</p>

      {doc.sections.map((s) => (
        <details key={s.key} className="rounded-2xl border-2 border-border bg-card p-4" open>
          <summary className="font-black cursor-pointer">{s.number}. {s.title}</summary>
          <div className="mt-2 flex flex-col gap-2">
            {s.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
            {s.edit && (
              <button type="button" onClick={() => onEdit(s.edit!)} className="self-start text-sm font-bold text-primary underline">Modifier</button>
            )}
          </div>
        </details>
      ))}

      <ContractNoticeSentence />
      <label className="flex items-start gap-3 rounded-2xl border-2 border-border bg-card p-4 font-semibold">
        <input type="checkbox" checked={read} onChange={(e) => setRead(e.target.checked)} className="mt-1 h-5 w-5 accent-primary" disabled={codeSent} />
        <span>Je confirme avoir lu le contrat et je le signe en tant qu'employeur.</span>
      </label>

      {error && <p role="alert" className="font-semibold text-destructive">{error}</p>}

      {!codeSent ? (
        <button type="button" onClick={sendCode} disabled={!read || busy}
          className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-bold disabled:opacity-50">
          Signer et envoyer la demande
        </button>
      ) : (
        <div className="rounded-2xl border-2 border-primary bg-card p-4 flex flex-col gap-3">
          <label htmlFor="sign-code" className="font-bold">Code reçu par e-mail (6 chiffres)</label>
          <input id="sign-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
            className="w-full p-3 rounded-2xl border-2 border-border bg-card text-xl tracking-widest text-center"
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
          <p className="text-sm text-muted-foreground">Le code est valable 10 minutes, 3 essais au maximum.</p>
          <button type="button" onClick={confirmCode} disabled={code.length !== 6 || busy}
            className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-bold disabled:opacity-50">
            Valider ma signature
          </button>
          <button type="button" onClick={sendCode} disabled={busy} className="text-sm font-bold text-primary underline">Recevoir un nouveau code</button>
          <SimulatedEmailsDialog />
        </div>
      )}
      <button type="button" onClick={onBack} disabled={busy} className="w-full py-3 rounded-2xl border-2 border-border font-bold text-sm">← Retour</button>
    </div>
  );
}
