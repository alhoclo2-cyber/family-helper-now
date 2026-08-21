import { useEffect, useState } from "react";
import {
  ALL_NEEDS,
  loadSettings,
  saveSettings,
  type CompanionSettings,
} from "@/lib/companionSettings";
import type { NeedType } from "@/lib/store";

export function CompanionProfilePanel() {
  const [open, setOpen] = useState(false);
  const [s, setS] = useState<CompanionSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setS(loadSettings());
  }, []);

  if (!s) return null;

  const update = (patch: Partial<CompanionSettings>) => {
    const next = { ...s, ...patch };
    setS(next);
    saveSettings(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  };

  const toggleTask = (t: NeedType) => {
    const has = s.tasks.includes(t);
    update({ tasks: has ? s.tasks.filter((x) => x !== t) : [...s.tasks, t] });
  };

  return (
    <section className="rounded-2xl border-2 border-border bg-card p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <span>
          <span className="text-sm font-black">⚙️ Mon profil & critères d'intervention</span>
          <span className="block text-xs text-muted-foreground mt-0.5">
            Rayon {s.radiusKm} km · min. {s.minDurationH} h · {s.tasks.length} type(s) de mission
          </span>
        </span>
        <span className="text-sm font-bold text-primary shrink-0">{open ? "Fermer" : "Modifier"}</span>
      </button>

      {open && (
        <div className="mt-4 flex flex-col gap-5">
          <div>
            <label className="block text-sm font-bold mb-2">
              Distance maximale d'intervention (km)
            </label>
            <input
              type="number"
              min={1}
              max={100}
              step={1}
              value={s.radiusKm}
              onChange={(e) => update({ radiusKm: Math.max(1, Number(e.target.value) || 1) })}
              className="w-full px-5 py-4 rounded-2xl border-2 border-border bg-background text-lg focus:border-primary outline-none"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Vous ne recevrez que les demandes situées dans ce rayon autour de votre adresse (par défaut 3 km).
            </p>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">Durée minimale de mission</label>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => update({ minDurationH: h })}
                  className={`py-3 rounded-2xl border-2 text-base font-bold ${
                    s.minDurationH === h ? "border-primary bg-accent" : "border-border bg-background"
                  }`}
                >
                  {h}h
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">Types de tâches acceptées</label>
            <div className="flex flex-col gap-2">
              {ALL_NEEDS.map((t) => (
                <label
                  key={t}
                  className={`flex items-start gap-3 rounded-2xl border-2 p-3 text-sm ${
                    s.tasks.includes(t) ? "border-primary bg-accent" : "border-border bg-background"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={s.tasks.includes(t)}
                    onChange={() => toggleTask(t)}
                    className="mt-0.5 h-5 w-5 shrink-0"
                  />
                  <span className="font-semibold">{t}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">Environnement</label>
            <label className="flex items-start gap-3 rounded-2xl border-2 border-border bg-background p-3 text-sm">
              <input
                type="checkbox"
                checked={s.acceptPets}
                onChange={(e) => update({ acceptPets: e.target.checked })}
                className="mt-0.5 h-5 w-5 shrink-0"
              />
              <span className="font-semibold">🐕 J'accepte les logements avec animaux</span>
            </label>
            <label className="flex items-start gap-3 rounded-2xl border-2 border-border bg-background p-3 text-sm mt-2">
              <input
                type="checkbox"
                checked={s.nonSmokingOnly}
                onChange={(e) => update({ nonSmokingOnly: e.target.checked })}
                className="mt-0.5 h-5 w-5 shrink-0"
              />
              <span className="font-semibold">🚭 J'interviens uniquement en logement non-fumeur</span>
            </label>
          </div>

          {saved && <p className="text-sm font-bold text-success">✅ Critères enregistrés</p>}
        </div>
      )}
    </section>
  );
}

export default CompanionProfilePanel;
