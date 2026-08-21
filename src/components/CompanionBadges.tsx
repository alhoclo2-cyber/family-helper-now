import { experienceBadge, EXPERIENCE_BADGES } from "@/lib/store";

export function ExperienceBadgeChip({
  missions,
  className = "",
}: {
  missions: number;
  className?: string;
}) {
  const b = experienceBadge(missions);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-accent border-2 border-primary/30 px-3 py-1 text-xs font-black ${className}`}
    >
      {b.emoji} {b.label}
    </span>
  );
}

export function ThumbsCount({ thumbs, className = "" }: { thumbs: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-bold ${className}`}>
      👍 {thumbs}
    </span>
  );
}

export function ThumbUpButton({ given, onGive }: { given: boolean; onGive: () => void }) {
  return (
    <div className="w-full rounded-2xl border-2 border-border bg-card p-4 text-left">
      <p className="text-sm font-bold">Prestation terminée ?</p>
      <p className="text-xs text-muted-foreground mt-1">
        Laissez un pouce levé à votre compagnon : c'est un simple compteur de satisfaction, sans note ni commentaire.
      </p>
      <button
        type="button"
        disabled={given}
        onClick={onGive}
        className={`mt-3 w-full py-4 rounded-2xl font-black text-base ${
          given ? "bg-success/20 text-success" : "bg-success text-success-foreground"
        }`}
      >
        {given ? "👍 Pouce levé envoyé — merci !" : "👍 Donner un pouce levé"}
      </button>
    </div>
  );
}

export function ExperienceBadgeScale() {
  return (
    <section className="rounded-2xl border-2 border-border bg-card p-4">
      <p className="text-sm font-black">Badges d'expérience</p>
      <p className="text-xs text-muted-foreground mt-1">
        Attribués automatiquement selon le nombre de missions réalisées.
      </p>
      <ul className="mt-3 space-y-2">
        {EXPERIENCE_BADGES.map((b) => (
          <li key={b.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="font-bold">
              {b.emoji} {b.label}
            </span>
            <span className="text-muted-foreground text-xs shrink-0">
              {b.max === null ? `${b.min}+ missions` : `${b.min} à ${b.max} missions`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
