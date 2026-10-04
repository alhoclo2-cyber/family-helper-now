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
  getMissionEnd,
  requestDurationMin,
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

  return (
    <div className="w-full flex flex-col gap-3">
      <p className="text-sm text-muted-foreground text-center">Durée réservée : {hours} (non modifiable)</p>
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
                if ((ms as number) > 48 * 3600_000) setTimeout(() => store.autoValidate(request.id), 0);
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
