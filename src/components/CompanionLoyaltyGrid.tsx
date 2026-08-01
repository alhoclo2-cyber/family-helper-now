import { Award, Crown, Gem, Medal, Trophy } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Tier = {
  emoji: string;
  name: string;
  Icon: LucideIcon;
  missions: string;
  net: string;
  gross: string;
  ring: string;
  badge: string;
  text: string;
};

const TIERS: Tier[] = [
  {
    emoji: "🥉",
    name: "Bronze",
    Icon: Medal,
    missions: "0 à 20 missions",
    net: "10,50 € net / h",
    gross: "13,46 € brut",
    ring: "border-warning/40 hover:border-warning",
    badge: "bg-warning/15",
    text: "text-warning",
  },
  {
    emoji: "🥈",
    name: "Argent",
    Icon: Award,
    missions: "21 à 50 missions",
    net: "10,75 € net / h",
    gross: "13,78 € brut",
    ring: "border-border hover:border-muted-foreground",
    badge: "bg-muted",
    text: "text-muted-foreground",
  },
  {
    emoji: "🥇",
    name: "Or",
    Icon: Trophy,
    missions: "51 à 90 missions",
    net: "11,00 € net / h",
    gross: "14,10 € brut",
    ring: "border-accent hover:border-warning",
    badge: "bg-accent",
    text: "text-accent-foreground",
  },
  {
    emoji: "💍",
    name: "Platine",
    Icon: Gem,
    missions: "91 à 150 missions",
    net: "11,25 € net / h",
    gross: "14,42 € brut",
    ring: "border-success/40 hover:border-success",
    badge: "bg-success/15",
    text: "text-success",
  },
  {
    emoji: "👑",
    name: "Royal",
    Icon: Crown,
    missions: "+150 missions",
    net: "11,50 € net / h",
    gross: "14,74 € brut",
    ring: "border-primary/50 hover:border-primary",
    badge: "bg-primary/10",
    text: "text-primary",
  },
];

export function CompanionLoyaltyGrid() {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-black">Programme fidélité Compagnon</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Plus vous réalisez de missions, plus votre rémunération augmente.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {TIERS.map((t) => (
          <article
            key={t.name}
            className={`bg-card rounded-3xl p-5 border-2 transition-all hover:shadow-lg hover:-translate-y-0.5 ${t.ring}`}
          >
            <div className="flex items-center gap-2">
              <span className={`h-10 w-10 rounded-2xl grid place-items-center ${t.badge}`}>
                <t.Icon className={`h-5 w-5 ${t.text}`} aria-hidden />
              </span>
              <div>
                <p className="text-base font-black leading-none">
                  {t.emoji} {t.name}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{t.missions}</p>
              </div>
            </div>

            <p className="mt-4 text-2xl font-black tracking-tight">{t.net}</p>
            <p className="text-sm text-muted-foreground">{t.gross}</p>
          </article>
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Rémunération en contrat CESU • Congés payés 10 % inclus • Zéro démarche administrative
      </p>
    </section>
  );
}

export default CompanionLoyaltyGrid;
