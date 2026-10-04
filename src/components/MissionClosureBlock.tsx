import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ThumbUpButton } from "@/components/CompanionBadges";
import { store, type Request } from "@/lib/store";
import {
  CLOSURE_OPEN_BEFORE_END_MS,
  AUTO_VALIDATION_DELAY_MS,
  SOLELIA_EMAIL,
  getMissionEnd,
  getMissionStart,
  latestReminder,
  missionMessage,
  reminderKind,
  reportMissionProblem,
  requestDurationMin,
  runClosureCheck,
  shiftMissionEnd,
  useMissionClosure,
} from "@/lib/missionClosure";

const fmtH = (r: Request) => {
  const h = requestDurationMin(r) / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1).replace(".", ",")} h`;
};

export function MissionClosureBlock({ request, role }: { request: Request; role: "family" | "companion" }) {
  useMissionClosure(request);
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  const [problemOpen, setProblemOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => setNow(Date.now()), [request.scheduledAt, request.acceptedAt]);

  const end = getMissionEnd(request);
  const hours = fmtH(request);
  const canClose = end != null && now >= end - CLOSURE_OPEN_BEFORE_END_MS;
  const mine = role === "family" ? request.familyValidatedAt : request.companionValidatedAt;
  const other = role === "family" ? request.companionValidatedAt : request.familyValidatedAt;
  const c = request.completion;
  const closed = c === "validated" || c === "auto_validated";
  const label = role === "family" ? "✅ Mission terminée" : "✅ Mission effectuée";
  const start = getMissionStart(request);
  const canReport =
    !mine &&
    (!c || c === "pending") &&
    start != null &&
    end != null &&
    now >= start &&
    now <= end + AUTO_VALIDATION_DELAY_MS;
  const last = latestReminder(request);
  const soleliaMessage =
    c === "problem"
      ? request.problemReport && request.problemReport.by !== role
        ? `Raison indiquée : « ${request.problemReport.reason} »`
        : null
      : c === "auto_validated"
        ? missionMessage(request, "auto", role)
        : mine || closed
          ? null
          : last
            ? missionMessage(request, reminderKind(last), role)
            : null;
  const submitProblem = () => {
    if (reason.trim().length < 10) {
      setReasonError(true);
      return;
    }
    reportMissionProblem(request, role, reason.trim());
    setProblemOpen(false);
  };

  return (
    <div className="w-full flex flex-col gap-3">
      <p className="text-sm text-muted-foreground text-center">Durée réservée : {hours} (non modifiable)</p>
      {soleliaMessage && (
        <div className="rounded-2xl border-2 border-primary bg-accent p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-primary">Message de Solélia Accompagnement</p>
          <p className="text-sm mt-1">{soleliaMessage}</p>
        </div>
      )}
      {c === "problem" ? (
        <div className="rounded-2xl border-2 border-destructive p-4 text-sm font-semibold text-destructive">
          Mission signalée comme non effectuée : elle ne sera pas déclarée par Solélia Accompagnement.
        </div>
      ) : mine || closed ? (
        <div className="rounded-2xl border-2 border-success bg-success/10 p-4 text-center">
          <p className="font-bold text-success">
            {c === "auto_validated" ? "Mission validée automatiquement" : role === "companion" ? "Merci, mission validée" : "Mission validée"}
          </p>
          {!closed && !other && (
            <p className="text-sm text-muted-foreground mt-1">
              {role === "family" ? "En attente de la validation du compagnon" : "En attente de la validation du particulier"}
            </p>
          )}
        </div>
      ) : canClose ? (
        <button type="button" onClick={() => setOpen(true)} className="btn-huge bg-success text-success-foreground w-full">
          {label}
        </button>
      ) : null}
      {canReport && (
        <button
          type="button"
          onClick={() => setProblemOpen(true)}
          className="py-3 rounded-2xl border-2 border-destructive text-destructive font-bold text-sm w-full"
        >
          Mission non effectuée
        </button>
      )}
      {role === "family" && (mine || closed) && c !== "problem" && (
        <ThumbUpButton given={!!request.thumbsGiven} onGive={() => store.giveThumb(request.id)} />
      )}

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{label}</AlertDialogTitle>
            <AlertDialogDescription>
              Vous confirmez que la mission de {hours} a bien eu lieu. Les {hours} réservées sont dues.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                role === "family" ? store.validateByFamily(request.id) : store.validateByCompanion(request.id)
              }
            >
              Valider
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={problemOpen} onOpenChange={setProblemOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Signaler un problème</AlertDialogTitle>
            <AlertDialogDescription>
              Ce message sera visible par Solélia Accompagnement et par l'autre partie.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="text-sm font-semibold">
            Raison (obligatoire, 10 caractères minimum)
            <textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (e.target.value.trim().length >= 10) setReasonError(false);
              }}
              rows={4}
              className={`mt-1 w-full rounded-xl border-2 p-3 text-base font-normal bg-background ${reasonError ? "border-destructive" : "border-border"}`}
            />
          </label>
          {reasonError && <p className="text-sm text-destructive">Merci d'indiquer une raison d'au moins 10 caractères.</p>}
          <p className="text-sm text-muted-foreground">
            Une question ?{" "}
            <a href={`mailto:${SOLELIA_EMAIL}`} className="font-semibold text-primary underline">{SOLELIA_EMAIL}</a>
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <button
              type="button"
              onClick={submitProblem}
              className="h-10 rounded-md bg-destructive px-4 text-sm font-semibold text-destructive-foreground"
            >
              Envoyer le signalement
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="rounded-2xl border-2 border-dashed border-border p-3">
        <p className="text-xs font-bold mb-2">🧪 Avancer le temps de la mission (test)</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            ["-30 min avant la fin", -30 * 60_000],
            ["Fin des heures", 0],
            ["+24 h", 24 * 3600_000],
            ["+48 h", 48 * 3600_000 + 60_000],
          ].map(([l, ms]) => (
            <button
              key={l as string}
              type="button"
              onClick={() => {
                shiftMissionEnd(request, ms as number);
                runClosureCheck(request.id);
                setNow(Date.now());
              }}
              className="rounded-xl border-2 border-border py-2 text-xs font-semibold"
            >
              {l as string}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
