import { useState } from "react";
import { COMPANIONS } from "@/lib/store";
import { companionFullLabel } from "@/lib/companionLabel";
import { useSession } from "@/lib/auth";
import { useCesuStatus } from "@/lib/contractIdentity";
import { CesuNumberField } from "@/components/CesuNumberField";
import type { ContractCheckResult } from "@/lib/contractCompliance";

/* ------------------------------------------------------------------
   Alerte de conformité : obligation de contrat de travail écrit
   (Article L. 1271-5 du Code du travail)
------------------------------------------------------------------- */

function Modal({ children, onClose, dismissible = true, closeLabel = "Fermer" }: { children: React.ReactNode; onClose: () => void; dismissible?: boolean; closeLabel?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/50 p-3">
      <div className="w-full max-w-[440px] max-h-[85vh] overflow-y-auto rounded-3xl bg-card border-2 border-border p-5 text-left">
        {children}
        {dismissible && (
          <button
            type="button"
            onClick={onClose}
            className="w-full mt-3 py-3 rounded-2xl border-2 border-border font-bold text-sm"
          >
            {closeLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export function CesuRecurrenceModal({
  companionId,
  companionName,
  check,
  onClose,
  onContinue,
  onSwitchCompanion,
  dismissible = true,
}: {
  companionId: string;
  companionName: string;
  check: ContractCheckResult;
  onClose: () => void;
  onContinue: () => void;
  onSwitchCompanion: (companionId: string) => void;
  dismissible?: boolean;
}) {
  const [view, setView] = useState<"alert" | "companions">("alert");
  const { session } = useSession();
  const userId = session?.user.id;
  const cesu = useCesuStatus(userId);
  const cesuMissing = !!userId && cesu.data?.hasCesu === false;
  // Chargement en cours = numéro non vérifié : « Continuer » reste désactivé.
  const cesuUnverified = !!userId && cesu.data?.hasCesu !== true;

  if (view === "companions")
    return (
      <Modal onClose={onClose} dismissible={dismissible}>
        <p className="text-lg font-black">🤝 Autres compagnons disponibles</p>
        <p className="text-sm text-muted-foreground mt-1">
          Alterner de compagnon vous évite toute démarche administrative supplémentaire.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Liste triée par distance uniquement. Les badges et pouces sont purement informatifs.
        </p>
        <div className="flex flex-col gap-2 mt-3">
          {[...COMPANIONS]
            .filter((c) => c.id !== companionId)
            .sort((a, b) => a.distanceKm - b.distanceKm)
            .map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onSwitchCompanion(c.id)}
                className="flex items-center gap-3 p-3 rounded-2xl border-2 border-border hover:border-primary text-left"
              >
                <img src={c.photo} alt={c.firstName} className="h-14 w-14 rounded-full object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold">{companionFullLabel(c)}</p>
                  <p className="text-xs text-muted-foreground">
                    👍 {c.thumbs} · à {c.distanceKm} km
                  </p>
                </div>
                <span className="text-xs font-bold text-primary">Choisir</span>
              </button>
            ))}
        </div>
        <button
          type="button"
          onClick={() => setView("alert")}
          className="w-full mt-3 py-3 rounded-2xl border-2 border-border font-bold text-sm"
        >
          ← Revenir à l'alerte
        </button>
      </Modal>
    );

  const both = check.weeklyHoursExceeded && check.consecutiveWeeksReached;

  return (
    <Modal onClose={onClose} dismissible={dismissible} closeLabel="✏️ Modifier ma demande">
      <p className="text-lg font-black">⚠️ Contrat de travail écrit requis</p>
      <p className="text-sm mt-2 leading-relaxed">
        {both ? (
          <>
            Avec <b>{companionName}</b>, cette réservation porte le total à{" "}
            <b>{check.weeklyHours} h sur la semaine</b> et atteint la{" "}
            <b>{check.consecutiveWeeks}ᵉ semaine consécutive</b>. Ces deux situations nécessitent l'établissement d'un
            contrat de travail écrit.
          </>
        ) : check.weeklyHoursExceeded ? (
          <>
            Avec <b>{companionName}</b>, cette réservation porte le total à{" "}
            <b>{check.weeklyHours} h sur une même semaine</b>. Au-delà de 3 h par semaine, un contrat de travail écrit
            est nécessaire.
          </>
        ) : (
          <>
            Vous vous préparez à réserver <b>{companionName}</b> pour la{" "}
            <b>{check.consecutiveWeeks}ᵉ semaine consécutive</b>. Ce niveau de récurrence nécessite l'établissement
            d'un contrat de travail écrit.
          </>
        )}
      </p>
      <p className="text-xs text-muted-foreground mt-2">Article L. 1271-5 du Code du travail.</p>
      <button
        type="button"
        onClick={() => setView("companions")}
        className="w-full mt-4 py-4 rounded-2xl bg-primary text-primary-foreground font-bold"
      >
        ✅ Découvrir d'autres compagnons (recommandé)
      </button>
      <button
        type="button"
        onClick={onContinue}
        disabled={cesuUnverified}
        aria-disabled={cesuUnverified}
        className="w-full mt-2 py-4 rounded-2xl border-2 border-border font-bold disabled:opacity-50"
      >
        Continuer avec {companionName}
      </button>
      {cesuMissing && (
        <>
          <p className="text-sm mt-3 leading-relaxed">
            Pour établir un contrat de travail avec ce compagnon, votre numéro CESU est nécessaire. Tant qu'il n'est
            pas renseigné dans votre compte, nous ne pouvons pas créer ce contrat. Vous pouvez demander votre numéro
            CESU sur cesu.urssaf.fr. Dès que vous l'avez obtenu, renseignez-le ci-dessous, choisissez un autre
            compagnon ou modifiez votre demande.
          </p>
          <CesuNumberField userId={userId!} />
        </>
      )}
    </Modal>
  );
}
