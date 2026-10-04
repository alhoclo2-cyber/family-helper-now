import { useEffect, useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import { store, useStore, type Request } from "@/lib/store";
import {
  AUTO_VALIDATION_DELAY_MS,
  formatMissionRange,
  getMissionEnd,
  getMissionStart,
  requestDurationMin,
} from "@/lib/missionClosure";

const isDone = (r: Request) => r.completion === "validated" || r.completion === "auto_validated";
const fmtNum = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
const fmtEur = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const fmtDate = (t: number) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(new Date(t));

function useAccepted() {
  return useStore((s) => s.requests.filter((r) => r.status === "accepted"));
}

export function useMissionsToDeclareCount() {
  const list = useAccepted();
  return list.filter((r) => isDone(r) && !r.declaredAt).length;
}

function remaining(r: Request, now: number) {
  const end = getMissionEnd(r);
  if (end == null) return "—";
  const ms = end + AUTO_VALIDATION_DELAY_MS - now;
  if (ms <= 0) return "imminente";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h} h ${String(m).padStart(2, "0")} min`;
}

function MissionCard({ r, now, children }: { r: Request; now: number; children?: React.ReactNode }) {
  const hours = requestDurationMin(r) / 60;
  const rate = r.salaryNetHourly;
  const range = formatMissionRange(r);
  const companion = r.student?.firstName ?? "—";
  const recap = `${range} · ${fmtNum(hours)} h · ${rate != null ? `${fmtEur(rate)} net/h` : "salaire non renseigné"} · Particulier : ${r.seniorName} · Compagnon : ${companion}`;
  let state: string;
  if (r.completion === "validated") state = "Validée par les deux parties";
  else if (r.completion === "auto_validated") state = "Validée automatiquement";
  else if (r.completion === "problem") state = "Signalée comme non effectuée";
  else if (r.familyValidatedAt || r.companionValidatedAt) state = "En attente de validation";
  else {
    const start = getMissionStart(r);
    const end = getMissionEnd(r);
    if (start == null || now < start) state = "Mission à venir";
    else if (end != null && now <= end) state = "Mission en cours";
    else state = "En attente de validation";
  }

  return (
    <div className="rounded-2xl border-2 border-border bg-card p-4 flex flex-col gap-1 text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="font-bold">{range}</p>
        <CopyButton value={recap} />
      </div>
      <p>Service : <b>{r.need}</b></p>
      <p>Particulier : <b>{r.seniorName}</b> · Compagnon : <b>{companion}</b></p>
      <p>Heures réservées : <b>{fmtNum(hours)} h</b></p>
      <p>
        Salaire net horaire :{" "}
        {rate != null ? <b>{fmtEur(rate)} net/h</b> : <b className="text-destructive">Non renseigné</b>}
      </p>
      <p>
        Montant net total :{" "}
        {rate != null ? <b>{fmtEur(rate * hours)}</b> : <b className="text-destructive">Non renseigné</b>}
      </p>
      <p>
        Déclaration :{" "}
        <b>{r.student?.cesuActive ? "Avance immédiate (CESU+)" : "Sans CESU+ : le particulier paie le net au compagnon"}</b>
      </p>
      <p className="mt-1 font-bold text-primary">{state}</p>
      {state === "En attente de validation" && (
        <p className="text-muted-foreground">
          Famille : {r.familyValidatedAt ? "a validé" : "n'a pas validé"} · Compagnon :{" "}
          {r.companionValidatedAt ? "a validé" : "n'a pas validé"}
          <br />
          Validation automatique dans : {remaining(r, now)}
        </p>
      )}
      {children}
    </div>
  );
}

function NoteField({ r }: { r: Request }) {
  const [note, setNote] = useState(r.soleliaNote ?? "");
  return (
    <div className="mt-2 flex flex-col gap-2">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note interne"
        className="rounded-xl border-2 border-border bg-background p-2 text-sm"
        rows={2}
      />
      <button
        type="button"
        onClick={() => store.setSoleliaNote(r.id, note)}
        className="rounded-xl border-2 border-primary px-3 py-2 text-sm font-bold text-primary"
      >
        Enregistrer la note
      </button>
    </div>
  );
}

function Section({ title, items, render }: { title: string; items: Request[]; render: (r: Request) => React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-black">
        {title} ({items.length})
      </h2>
      {items.length === 0 ? <p className="text-sm text-muted-foreground">Aucune mission</p> : items.map(render)}
    </section>
  );
}

export function MissionsTab() {
  const list = useAccepted();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  const toDeclare = list.filter((r) => isDone(r) && !r.declaredAt);
  const reported = list.filter((r) => r.completion === "problem");
  const pending = list.filter((r) => !r.completion || r.completion === "pending");
  const declared = list.filter((r) => isDone(r) && r.declaredAt);

  return (
    <div className="flex flex-col gap-5">
      <p className="rounded-2xl border-2 border-border bg-secondary p-3 text-sm font-semibold">
        Démo : ces données sont celles de cette session du navigateur et ne sont pas enregistrées.
      </p>
      {list.length === 0 ? (
        <p className="text-center text-muted-foreground">Aucune mission pour le moment</p>
      ) : (
        <>
          <Section
            title="À déclarer"
            items={toDeclare}
            render={(r) => (
              <MissionCard key={r.id} r={r} now={now}>
                <p>Heures à déclarer : <b>{fmtNum(r.hoursToDeclare ?? 0)} h</b></p>
                <button
                  type="button"
                  onClick={() => store.markDeclared(r.id)}
                  className="mt-2 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"
                >
                  Marquer comme déclarée
                </button>
              </MissionCard>
            )}
          />
          <Section
            title="Signalées"
            items={reported}
            render={(r) => (
              <MissionCard key={r.id} r={r} now={now}>
                {r.problemReport && (
                  <p>
                    Signalé par <b>{r.problemReport.by === "family" ? "Famille" : "Compagnon"}</b> le{" "}
                    {fmtDate(r.problemReport.createdAt)}
                    <br />
                    Raison : {r.problemReport.reason}
                  </p>
                )}
                <p className="font-bold text-destructive">Ces heures ne sont jamais déclarées.</p>
                <NoteField r={r} />
              </MissionCard>
            )}
          />
          <Section
            title="À venir et en attente"
            items={pending}
            render={(r) => <MissionCard key={r.id} r={r} now={now} />}
          />
          <Section
            title="Déclarées"
            items={declared}
            render={(r) => (
              <MissionCard key={r.id} r={r} now={now}>
                <p>Déclarée le <b>{fmtDate(r.declaredAt!)}</b></p>
              </MissionCard>
            )}
          />
        </>
      )}
    </div>
  );
}
