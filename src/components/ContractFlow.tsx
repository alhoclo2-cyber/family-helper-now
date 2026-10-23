import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ContractQuestionnaire } from "@/components/ContractQuestionnaire";
import { ContractTermsQuestionnaire } from "@/components/ContractTermsQuestionnaire";
import { earliestContractMissionTs, meetsContractNotice } from "@/lib/contractTerms";
import type { ContractAnswers, ContractKind } from "@/lib/contractDecision";

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

export function ContractFlow({
  companionId,
  companionName,
  missionTs,
  durationHours,
  onBack,
  onDone,
}: {
  companionId: string;
  companionName: string;
  missionTs: number;
  durationHours: number;
  onBack: () => void;
  onDone: () => void;
}) {
  const [noticeOk] = useState(() => meetsContractNotice(missionTs, Date.now()));
  const [q1, setQ1] = useState<{ kind: ContractKind; draftId: string; answers: ContractAnswers } | null>(null);

  if (!noticeOk) {
    return (
      <div className="flex-1 flex flex-col px-5 py-6 gap-4">
        <ContractNoticeBlock onBack={onBack} />
      </div>
    );
  }

  // Le questionnaire 1 reste monté (caché) pour conserver ses réponses au retour.
  return (
    <>
      <div className={q1 ? "hidden" : "contents"}>
        <ContractQuestionnaire
          companionId={companionId}
          companionName={companionName}
          missionTs={missionTs}
          durationHours={durationHours}
          onBack={onBack}
          onDone={setQ1}
        />
      </div>
      {q1 && (
        <ContractTermsQuestionnaire
          key={`${q1.draftId}-${q1.kind}`}
          draftId={q1.draftId}
          kind={q1.kind}
          answers={q1.answers}
          missionTs={missionTs}
          onBack={() => setQ1(null)}
          onDone={onDone}
        />
      )}
    </>
  );
}
