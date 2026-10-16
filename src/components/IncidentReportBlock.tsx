import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { store, type Request } from "@/lib/store";
import { sendSimulatedEmail } from "@/lib/simulatedEmails";
import {
  AUTO_VALIDATION_DELAY_MS,
  SOLELIA_EMAIL,
  formatMissionDate,
  getMissionEnd,
  isCompletionClosed,
  isMissionStarted,
  missionHours,
  partyAddress,
} from "@/lib/missionClosure";

const REASONS: Record<"family" | "companion", string[]> = {
  family: [
    "Le compagnon est très en retard",
    "Le compagnon est parti plus tôt que prévu",
    "Problème de sécurité ou de comportement",
    "Demande hors du cadre autorisé (acte médical, etc.)",
    "Imprévu de mon côté (urgence, hospitalisation…)",
    "Erreur d'adresse ou de service",
    "Autre raison",
  ],
  companion: [
    "Le particulier est absent ou ne répond pas",
    "Le particulier est très en retard ou m'a fait attendre",
    "Problème de sécurité ou de comportement",
    "Demande hors du cadre autorisé (acte médical, etc.)",
    "Imprévu de mon côté (santé, urgence…)",
    "Adresse erronée ou accès impossible",
    "Autre raison",
  ],
};

const EXPLAIN = {
  family:
    "Vous êtes l'employeur du compagnon : c'est à vous de décider de la suite avec lui (poursuivre, écourter la mission…). Solélia enregistre votre signalement pour garder une trace, mais ne tranche pas les litiges.",
  companion:
    "Vous travaillez pour le particulier, qui est votre employeur : échangez directement avec lui pour décider de la suite. Solélia enregistre votre signalement pour garder une trace, mais ne tranche pas les litiges.",
};

export function IncidentReportBlock({ request, role }: { request: Request; role: "family" | "companion" }) {
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [error, setError] = useState(false);
  const [sent, setSent] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => setNow(Date.now()), [request.scheduledAt, request.acceptedAt]);

  const end = getMissionEnd(request);
  const visible =
    now > 0 && isMissionStarted(request) && !isCompletionClosed(request) && end != null && Date.now() <= end + AUTO_VALIDATION_DELAY_MS;
  if (!visible) return null;

  const submit = () => {
    if (!reason) {
      setError(true);
      return;
    }
    const d = detail.trim() || undefined;
    store.addIncident(request.id, { by: role, reason, detail: d, createdAt: Date.now() });
    const base = {
      hours: missionHours(request),
      missionDate: formatMissionDate(request),
      role,
      reason,
      detail: d,
      companionName: request.student?.firstName,
    };
    sendSimulatedEmail("mission_incident_solelia", SOLELIA_EMAIL, base);
    sendSimulatedEmail("mission_incident_confirmation", partyAddress(request, role), base);
    setOpen(false);
    setReason("");
    setDetail("");
    setSent(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => { setSent(false); setError(false); setOpen(true); }}
        className="py-3 rounded-2xl border-2 border-destructive text-destructive font-bold text-sm w-full"
      >
        ⚠️ Signaler un incident
      </button>
      {sent && <p className="text-sm font-semibold text-success text-center">Signalement envoyé. Solélia en garde une trace.</p>}
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Signaler un incident</AlertDialogTitle>
            <AlertDialogDescription>{EXPLAIN[role]}</AlertDialogDescription>
          </AlertDialogHeader>
          <label className="text-sm font-semibold">
            Que se passe-t-il ?
            <select
              value={reason}
              onChange={(e) => { setReason(e.target.value); setError(false); }}
              className={`mt-1 w-full rounded-xl border-2 p-3 text-base font-normal bg-background ${error ? "border-destructive" : "border-border"}`}
            >
              <option value="">Choisir un motif</option>
              {REASONS[role].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
          {error && <p className="text-sm text-destructive">Merci de choisir un motif.</p>}
          <label className="text-sm font-semibold">
            Précision (facultatif) — Restez factuel.
            <textarea
              value={detail}
              maxLength={150}
              onChange={(e) => setDetail(e.target.value.slice(0, 150))}
              rows={3}
              className="mt-1 w-full rounded-xl border-2 border-border p-3 text-base font-normal bg-background"
            />
            <span className="block text-xs font-normal text-muted-foreground text-right">{detail.length}/150</span>
          </label>
          <p className="text-sm font-semibold text-destructive">En cas de danger immédiat, appelez le 15 (SAMU) ou le 17.</p>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <button
              type="button"
              onClick={submit}
              className="h-10 rounded-md bg-destructive px-4 text-sm font-semibold text-destructive-foreground"
            >
              Envoyer mon signalement
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
