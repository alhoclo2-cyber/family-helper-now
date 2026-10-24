import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ContractQuestionnaire } from "@/components/ContractQuestionnaire";
import { ContractTermsQuestionnaire } from "@/components/ContractTermsQuestionnaire";
import { ContractReview, type ContractMission, type SignedContract } from "@/components/ContractReview";
import { earliestContractMissionTs, meetsContractNotice } from "@/lib/contractTerms";
import type { ContractAnswers, ContractKind } from "@/lib/contractDecision";
import type { EditTarget } from "@/lib/contractDocument";
import { COMPANIONS } from "@/lib/store";

/** Carte de blocage : contrat applicable mais mission à moins de 5 jours (+ marge de réponse). */
export function ContractNoticeBlock({
  onEditDate,
  onOtherCompanion,
  onBack,
}: {
  onEditDate?: () => void;
  onOtherCompanion?: () => void;
  onBack?: () => void;
}) {
  const earliest = new Date(earliestContractMissionTs(Date.now()));
  return (
    <div className="rounded-2xl border-2 border-destructive bg-card p-4 flex flex-col gap-3" role="alert">
      <h2 className="text-lg font-black">Délai de 5 jours minimum</h2>
      <p className="text-sm font-bold text-destructive">
        Avec ce compagnon, un contrat de travail s'applique : la mission doit être réservée et validée au moins 5 jours avant son début.
      </p>
      <p className="text-sm">
        Date et heure au plus tôt : {format(earliest, "EEEE d MMMM yyyy", { locale: fr })} à {format(earliest, "HH:mm")}
      </p>
      {onEditDate && (
        <button type="button" onClick={onEditDate} className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-bold">
          Modifier la date et l'heure
        </button>
      )}
      {onOtherCompanion && (
        <button type="button" onClick={onOtherCompanion} className="w-full py-4 rounded-2xl border-2 border-border font-bold">
          Choisir un autre compagnon
        </button>
      )}
      {onBack && (
        <button type="button" onClick={onBack} className="w-full py-4 rounded-2xl border-2 border-border font-bold">
          Retour
        </button>
      )}
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
  /** Identifiant de la mission liée au contrat (first_mission_id). */
  missionId: string;
  /** Retour au formulaire de réservation (aussi utilisé par « Modifier » des sections issues de la réservation). */
  onBack: () => void;
  onSigned: (result: SignedContract) => void;
}) {
  const [noticeOk] = useState(() => meetsContractNotice(missionTs, Date.now()));
  const [q1, setQ1] = useState<Q1 | null>(null);
  const [phase, setPhase] = useState<Phase>({ name: "q1", fromReview: false });
  const cesuActive = COMPANIONS.find((c) => c.id === companionId)?.cesuActive ?? false;

  if (!noticeOk) {
    return (
      <div className="flex-1 flex flex-col px-5 py-6 gap-4">
        <ContractNoticeBlock onBack={onBack} />
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
