import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ContractQuestionnaire } from "@/components/ContractQuestionnaire";
import { ContractTermsQuestionnaire } from "@/components/ContractTermsQuestionnaire";
import { ContractReview, type ContractMission, type SignedContract } from "@/components/ContractReview";
import { meetsContractLeadTime, SIGNATURE_MESSAGES } from "@/lib/contractSignature";
import type { ContractAnswers, ContractKind } from "@/lib/contractDecision";
import type { EditTarget } from "@/lib/contractDocument";
import { COMPANIONS } from "@/lib/store";

/** Information non bloquante : mission à moins de 5 jours avec contrat applicable. */
export function ContractShortNoticeInfo({
  state,
  onContinue,
  onEditDate,
  onOtherCompanion,
}: {
  state: "threshold_reached" | "in_force";
  onContinue: () => void;
  onEditDate: () => void;
  onOtherCompanion: () => void;
}) {
  return (
    <div className="rounded-2xl border-2 border-border bg-card p-4 flex flex-col gap-3 text-base" role="status">
      <h2 className="text-lg font-black">Demande à moins de 5 jours</h2>
      <p>{state === "threshold_reached" ? "Avec ce compagnon, cette mission dépasse le seuil à partir duquel un contrat de travail écrit est nécessaire (plus de 3 h dans la semaine, ou à partir de la 5e semaine consécutive)." : "Vous avez déjà un contrat de travail en cours avec ce compagnon."}</p>
      <p>La convention collective prévoit que vous préveniez votre salarié au moins 5 jours avant le début d'une mission. Pour une demande imprévue, la plateforme vous permet de demander à ce compagnon s'il est disponible : il peut accepter ou refuser librement. S'il accepte, la mission est confirmée avec ce délai plus court.</p>
      <Button type="button" onClick={onContinue} className="h-auto whitespace-normal w-full py-4 text-base font-bold">Continuer ma demande</Button>
      <Button type="button" variant="outline" onClick={onEditDate} className="h-auto whitespace-normal w-full py-4 text-base font-bold">Modifier la date et l'heure</Button>
      <Button type="button" variant="outline" onClick={onOtherCompanion} className="h-auto whitespace-normal w-full py-4 text-base font-bold">Choisir un autre compagnon</Button>
      <p className="text-muted-foreground">Avec un compagnon qui n'a pas atteint le seuil, aucun contrat n'est nécessaire.</p>
    </div>
  );
}

type Q1 = { kind: ContractKind; draftId: string; answers: ContractAnswers };
type Phase = { name: "q1"; fromReview: boolean } | { name: "q2"; step?: 1 | 2 | 3 | 4 | 5; edit: boolean; n: number } | { name: "review" };

export function ContractFlow({
  companionId,
  companionName,
  missionTs,
  durationHours,
  mission,
  missionId,
  onBack,
  onSigned,
}: {
  companionId: string;
  companionName: string;
  missionTs: number;
  durationHours: number;
  mission: ContractMission;
  /** Identifiant de la mission liée au contrat (first_mission_id), connu avant la signature. */
  missionId: string;
  /** Retour au formulaire de réservation (aussi utilisé par « Modifier » des sections issues de la réservation). */
  onBack: () => void;
  onSigned: (result: SignedContract) => void;
}) {
  // Garde-fou non contractuel : le compagnon doit pouvoir répondre avant le début.
  const [leadTimeOk] = useState(() => meetsContractLeadTime(missionTs, Date.now()));
  const [q1, setQ1] = useState<Q1 | null>(null);
  const [phase, setPhase] = useState<Phase>({ name: "q1", fromReview: false });
  const cesuActive = COMPANIONS.find((c) => c.id === companionId)?.cesuActive ?? false;

  if (!leadTimeOk) {
    return (
      <div className="flex-1 flex flex-col px-5 py-6 gap-4 text-base">
        <p role="alert" className="font-semibold">{SIGNATURE_MESSAGES.too_close}</p>
        <Button type="button" onClick={onBack} className="h-auto whitespace-normal w-full py-4 text-base font-bold">Modifier la date et l'heure</Button>
      </div>
    );
  }

  const onEdit = (t: EditTarget) => {
    if (t.q === "booking") return onBack();
    if (t.q === 1) return setPhase({ name: "q1", fromReview: true });
    setPhase({ name: "q2", step: t.step, edit: true, n: Date.now() });
  };

  // Le questionnaire 1 reste monté (caché) pour conserver ses réponses au retour.
  return (
    <>
      <div className={phase.name === "q1" ? "contents" : "hidden"}>
        <ContractQuestionnaire
          companionId={companionId}
          companionName={companionName}
          missionTs={missionTs}
          durationHours={durationHours}
          onBack={phase.name === "q1" && phase.fromReview ? () => setPhase({ name: "review" }) : onBack}
          onDone={(r) => {
            const sameKind = q1 !== null && q1.kind === r.kind;
            setQ1(r);
            // Même type de contrat : retour direct à la relecture ; sinon le questionnaire 2 reprend du début.
            setPhase(phase.name === "q1" && phase.fromReview && sameKind ? { name: "review" } : { name: "q2", edit: false, n: Date.now() });
          }}
        />
      </div>
      {q1 && phase.name === "q2" && (
        <ContractTermsQuestionnaire
          key={`${q1.draftId}-${q1.kind}-${phase.n}`}
          draftId={q1.draftId}
          kind={q1.kind}
          answers={q1.answers}
          missionTs={missionTs}
          initialStep={phase.step}
          editMode={phase.edit}
          companionCesuActive={cesuActive}
          onBack={() => (phase.edit ? setPhase({ name: "review" }) : setPhase({ name: "q1", fromReview: false }))}
          onDone={() => setPhase({ name: "review" })}
        />
      )}
      {q1 && phase.name === "review" && (
        <ContractReview
          draftId={q1.draftId}
          kind={q1.kind}
          answers={q1.answers}
          missionTs={missionTs}
          durationHours={durationHours}
          mission={mission}
          missionId={missionId}
          onEdit={onEdit}
          onBack={() => setPhase({ name: "q2", step: 5, edit: false, n: Date.now() })}
          onSigned={onSigned}
        />
      )}
    </>
  );
}
