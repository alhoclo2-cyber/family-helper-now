import { useMemo, useState } from "react";
import { COMPANIONS, store, useStore, type UnavailabilitySlot } from "@/lib/store";

// Lundi -> Dimanche, avec l'index JS correspondant (0 = dimanche)
const DAYS: { idx: number; label: string; short: string }[] = [
  { idx: 1, label: "Lundi", short: "lun." },
  { idx: 2, label: "Mardi", short: "mar." },
  { idx: 3, label: "Mercredi", short: "mer." },
  { idx: 4, label: "Jeudi", short: "jeu." },
  { idx: 5, label: "Vendredi", short: "ven." },
  { idx: 6, label: "Samedi", short: "sam." },
  { idx: 0, label: "Dimanche", short: "dim." },
];

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const fmtHour = (t: string) => {
  const [h, m] = t.split(":");
  return m === "00" ? `${Number(h)}h` : `${Number(h)}h${m}`;
};

// Fusionne les plages qui se chevauchent (ou se touchent) pour un même jour.
function mergeSlots(slots: UnavailabilitySlot[]): UnavailabilitySlot[] {
  const out: UnavailabilitySlot[] = [];
  for (const day of [0, 1, 2, 3, 4, 5, 6]) {
    const dayslots = slots
      .filter((s) => s.day === day)
      .sort((a, b) => toMin(a.start) - toMin(b.start));
    let cur: UnavailabilitySlot | undefined;
    for (const s of dayslots) {
      if (cur !== undefined && toMin(s.start) <= toMin(cur.end)) {
        if (toMin(s.end) > toMin(cur.end)) cur = { day, start: cur.start, end: s.end };
      } else {
        if (cur !== undefined) out.push(cur);
        cur = { day, start: s.start, end: s.end };
      }
    }
    if (cur !== undefined) out.push(cur);
  }
  return out;
}

export function CompanionAvailabilityPanel({ companionId }: { companionId: string }) {
  const slots = useStore(
    () => COMPANIONS.find((c) => c.id === companionId)?.unavailabilitySlots ?? [],
  );
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<number, { start: string; end: string } | null>>({});
  const [error, setError] = useState<string | null>(null);

  const summary = useMemo(() => {
    if (slots.length === 0) return "Disponible sans restriction";
    const parts = DAYS.flatMap((d) =>
      slots
        .filter((s) => s.day === d.idx)
        .sort((a, b) => toMin(a.start) - toMin(b.start))
        .map((s) =>
          toMin(s.start) === 0 && toMin(s.end) >= 23 * 60 + 59
            ? `${d.short} toute la journée`
            : `${d.short} ${fmtHour(s.start)}-${fmtHour(s.end)}`,
        ),
    );
    return `Indisponible : ${parts.join(", ")}`;
  }, [slots]);

  const save = (next: UnavailabilitySlot[]) =>
    store.updateCompanionUnavailability(companionId, mergeSlots(next));

  const addSlot = (day: number) => {
    const d = drafts[day];
    if (!d) return;
    if (toMin(d.end) <= toMin(d.start)) {
      setError("L'heure de fin doit être après l'heure de début.");
      return;
    }
    setError(null);
    save([...slots, { day, start: d.start, end: d.end }]);
    setDrafts((p) => ({ ...p, [day]: null }));
  };

  const removeSlot = (slot: UnavailabilitySlot) =>
    save(slots.filter((s) => !(s.day === slot.day && s.start === slot.start && s.end === slot.end)));

  return (
    <section className="rounded-2xl border-2 border-border bg-card p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <span>
          <span className="text-sm font-black">🗓️ Mes indisponibilités récurrentes</span>
          <span className="block text-xs text-muted-foreground mt-0.5">{summary}</span>
        </span>
        <span className="text-sm font-bold text-primary shrink-0">{open ? "Fermer" : "Modifier"}</span>
      </button>

      {open && (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            Déclarez uniquement les moments où vous n'êtes <b>jamais</b> disponible (cours, autre emploi…). Sans
            créneau déclaré, vous êtes considéré disponible toute la semaine.
          </p>
          {error && <p className="text-sm font-bold text-destructive">{error}</p>}

          {DAYS.map((d) => {
            const daySlots = slots
              .filter((s) => s.day === d.idx)
              .sort((a, b) => toMin(a.start) - toMin(b.start));
            const draft = drafts[d.idx];
            return (
              <div key={d.idx} className="rounded-2xl border-2 border-border bg-background p-3">
                <p className="text-sm font-bold">{d.label}</p>
                {daySlots.length === 0 ? (
                  <p className="text-xs text-muted-foreground mt-1">Disponible toute la journée</p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-2">
                    {daySlots.map((s) => (
                      <li
                        key={`${s.start}-${s.end}`}
                        className="flex items-center justify-between gap-3 rounded-xl border-2 border-border px-3 py-2"
                      >
                        <span className="text-sm font-semibold">
                          Indisponible {fmtHour(s.start)} – {fmtHour(s.end)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeSlot(s)}
                          className="text-sm font-bold text-destructive shrink-0"
                        >
                          Supprimer
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {draft ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      type="time"
                      value={draft.start}
                      onChange={(e) =>
                        setDrafts((p) => ({ ...p, [d.idx]: { ...draft, start: e.target.value } }))
                      }
                      className="px-3 py-2 rounded-xl border-2 border-border bg-card text-base"
                    />
                    <span className="text-sm font-bold">→</span>
                    <input
                      type="time"
                      value={draft.end}
                      onChange={(e) =>
                        setDrafts((p) => ({ ...p, [d.idx]: { ...draft, end: e.target.value } }))
                      }
                      className="px-3 py-2 rounded-xl border-2 border-border bg-card text-base"
                    />
                    <button
                      type="button"
                      onClick={() => addSlot(d.idx)}
                      className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold"
                    >
                      Enregistrer
                    </button>
                    <button
                      type="button"
                      onClick={() => setDrafts((p) => ({ ...p, [d.idx]: null }))}
                      className="px-3 py-2 rounded-xl border-2 border-border text-sm font-bold"
                    >
                      Annuler
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setDrafts((p) => ({ ...p, [d.idx]: { start: "08:00", end: "11:00" } }));
                    }}
                    className="mt-2 text-sm font-bold text-primary"
                  >
                    + Ajouter un créneau indisponible
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default CompanionAvailabilityPanel;
