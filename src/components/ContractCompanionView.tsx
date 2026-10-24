import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  expireOverdueContracts,
  getContractForCompanion,
  refuseContractAsCompanion,
  requestCompanionSignatureCode,
  signContractAsCompanion,
} from "@/lib/contract.functions";
import { sendSimulatedEmail } from "@/lib/simulatedEmails";
import { SimulatedEmailsDialog } from "@/components/SimulatedEmailsDialog";
import { ContractNoticeSentence } from "@/components/ContractQuestionnaire";
import { contractIdentityKey } from "@/lib/contractIdentity";
import type { ContractField } from "@/lib/contractDocument";

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

/** Écran du compagnon : lecture du contrat, signature ou refus libre. */
export function ContractCompanionView({
  contractId,
  userId,
  onBack,
  onOpenAccount,
  onSigned,
  onRefused,
}: {
  contractId: string;
  userId: string;
  onBack: () => void;
  onOpenAccount: () => void;
  onSigned: () => void;
  onRefused: () => void;
}) {
  const qc = useQueryClient();
  const fetchContract = useServerFn(getContractForCompanion);
  const requestCode = useServerFn(requestCompanionSignatureCode);
  const sign = useServerFn(signContractAsCompanion);
  const refuse = useServerFn(refuseContractAsCompanion);
  const expire = useServerFn(expireOverdueContracts);
  const contract = useQuery({
    queryKey: ["contract-for-companion", contractId],
    queryFn: () => fetchContract({ data: { contractId } }),
    staleTime: 0,
    retry: false,
  });
  const [read, setRead] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRefuse, setConfirmRefuse] = useState(false);

  // Expire les contrats dont l'échéance est dépassée (en attendant une tâche planifiée).
  useEffect(() => {
    void expire().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (contract.isLoading) {
    return <div className="flex-1 flex items-center justify-center px-6 py-10"><p className="text-muted-foreground">Chargement du contrat…</p></div>;
  }
  if (contract.error || !contract.data) {
    return (
      <div className="flex-1 flex flex-col px-5 py-6 gap-4">
        <p role="alert" className="text-base font-semibold text-destructive">
          {contract.error instanceof Error ? contract.error.message : "Impossible d'afficher le contrat. Réessayez."}
        </p>
        <button type="button" onClick={onBack} className="w-full py-4 rounded-2xl border-2 border-border font-bold">← Retour</button>
      </div>
    );
  }

  const doc = contract.data.document;
  const info = contract.data.companion;
  const myFields: ContractField[] = [
    { label: "Nom de naissance", value: info.birthName },
    { label: "Nom d'usage", value: info.lastName },
    { label: "Prénom", value: info.firstName },
    {
      label: "Naissance",
      value: [info.birthDate ? format(new Date(`${info.birthDate}T00:00:00`), "dd/MM/yyyy") : "", info.birthPlace, info.birthDepartment ? `(${info.birthDepartment})` : ""]
        .filter(Boolean)
        .join(" "),
    },
    { label: "N° de sécurité sociale", value: info.nir },
    { label: "Adresse", value: info.address },
    { label: "Téléphone", value: info.phone },
  ];

  const sendCode = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await requestCode({ data: { contractId } });
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
      const r = await sign({ data: { contractId, code } });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      // E-mails simulés aux deux parties : contrat complet, sans masquage.
      for (const to of [r.employerEmail, r.companionEmail]) {
        sendSimulatedEmail("contract_signed_both", to, { contractId: r.contractId, hash: r.finalHash, contractText: r.emailText });
      }
      onSigned();
    } catch {
      setError("La signature n'a pas pu être enregistrée. Rien n'a été modifié, réessayez.");
    } finally {
      setBusy(false);
    }
  };

  const confirmRefusal = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await refuse({ data: { contractId } });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      onRefused();
    } catch {
      setError("Le refus n'a pas pu être enregistré. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col px-5 py-6 gap-4 text-base">
      <h2 className="text-xl font-black">Contrat de travail à lire</h2>
      <p className="font-bold">{doc.title}</p>
      <p className="text-sm font-bold text-destructive">
        Répondez avant le {format(new Date(contract.data.deadline), "EEEE d MMMM 'à' HH:mm", { locale: fr })}.
      </p>
      <Fields title="L'employeur" fields={doc.employer} />
      <p className="text-sm text-muted-foreground">
        Les coordonnées exactes de la famille (numéro de rue, téléphone, e-mail) vous seront révélées si vous acceptez la mission.
      </p>

      <div className="rounded-2xl border-2 border-primary bg-accent p-4">
        <p className="font-black mb-2">Vos informations</p>
        {myFields.map((f) => (
          <p key={f.label} className="text-base"><b>{f.label} :</b> {f.value || "—"}</p>
        ))}
        <p className="text-sm text-muted-foreground mt-2">
          Une information est erronée ? Corrigez-la dans Mon compte, puis revenez ici. Votre délai de réponse continue de courir.
        </p>
        <button
          type="button"
          onClick={() => {
            void qc.invalidateQueries({ queryKey: contractIdentityKey(userId) });
            void qc.invalidateQueries({ queryKey: ["contract-for-companion", contractId] });
            onOpenAccount();
          }}
          className="mt-2 text-sm font-bold text-primary underline"
        >
          Mon compte
        </button>
      </div>

      {doc.sections.map((s) => (
        <details key={s.key} className="rounded-2xl border-2 border-border bg-card p-4" open>
          <summary className="font-black cursor-pointer">{s.number}. {s.title}</summary>
          <div className="mt-2 flex flex-col gap-2">
            {s.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
          </div>
        </details>
      ))}

      <ContractNoticeSentence />
      <p className="text-sm font-semibold">Vous pouvez refuser ce contrat sans justification ni pénalité.</p>

      <label className="flex items-start gap-3 rounded-2xl border-2 border-border bg-card p-4 font-semibold">
        <input type="checkbox" checked={read} onChange={(e) => setRead(e.target.checked)} className="mt-1 h-5 w-5 accent-primary" disabled={codeSent} />
        <span>J'ai lu le contrat et je l'accepte.</span>
      </label>

      {error && <p role="alert" className="font-semibold text-destructive">{error}</p>}

      {!codeSent ? (
        <button type="button" onClick={sendCode} disabled={!read || busy}
          className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-bold disabled:opacity-50">
          Signer et accepter la mission
        </button>
      ) : (
        <div className="rounded-2xl border-2 border-primary bg-card p-4 flex flex-col gap-3">
          <label htmlFor="companion-sign-code" className="font-bold">Code reçu par e-mail (6 chiffres)</label>
          <input id="companion-sign-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
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

      {!confirmRefuse ? (
        <button type="button" onClick={() => setConfirmRefuse(true)} disabled={busy}
          className="w-full py-4 rounded-2xl border-2 border-border font-bold">
          Refuser le contrat
        </button>
      ) : (
        <div className="rounded-2xl border-2 border-destructive bg-card p-4 flex flex-col gap-3">
          <p className="font-bold">Confirmer le refus ?</p>
          <p className="text-sm text-muted-foreground">Aucun motif ne vous sera demandé, aucune pénalité ne s'applique.</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setConfirmRefuse(false)} disabled={busy} className="py-3 rounded-2xl border-2 border-border font-bold text-sm">Annuler</button>
            <button type="button" onClick={confirmRefusal} disabled={busy} className="py-3 rounded-2xl bg-destructive text-destructive-foreground font-bold text-sm disabled:opacity-50">Confirmer le refus</button>
          </div>
        </div>
      )}

      <button type="button" onClick={onBack} disabled={busy} className="w-full py-3 rounded-2xl border-2 border-border font-bold text-sm">← Retour</button>
    </div>
  );
}
