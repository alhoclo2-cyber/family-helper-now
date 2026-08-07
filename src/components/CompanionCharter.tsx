import { useEffect, useState } from "react";

/* ------------------------------------------------------------------
   Charte du Compagnon SOS — texte provisoire.
   La charte officielle sera fournie par l'exploitant et remplacera
   le contenu de CHARTER_SECTIONS ci-dessous.
------------------------------------------------------------------- */

export const CHARTER_VERSION = "v1 (provisoire)";

export const CHARTER_SECTIONS: { title: string; items: string[] }[] = [
  {
    title: "1. Engagement général",
    items: [
      "Être majeur, disposer d'un dossier complet et à jour (identité, situation, casier n°3, RIB).",
      "N'accepter que les missions que l'on peut réellement assurer, dans les délais annoncés.",
      "Se présenter sous sa véritable identité : la photo du profil doit permettre à la famille de reconnaître la personne qui sonne à sa porte.",
    ],
  },
  {
    title: "2. Ponctualité et présence",
    items: [
      "Arriver à l'heure convenue et prévenir immédiatement la famille en cas d'imprévu.",
      "Annulation d'un rendez-vous possible jusqu'à 48 h avant, si un autre compagnon est disponible.",
      "À moins de 48 h : uniquement sur justificatif valable (maladie, accident, force majeure).",
    ],
  },
  {
    title: "3. Comportement",
    items: [
      "Respect, politesse, bienveillance et patience en toutes circonstances.",
      "Discrétion absolue : ce qui est vu ou entendu au domicile reste confidentiel (RGPD).",
      "Aucune incivilité, aucun propos déplacé, discriminatoire ou agressif.",
      "Ni alcool, ni substance, ni tabac au domicile ; usage du téléphone limité au strict nécessaire.",
    ],
  },
  {
    title: "4. Limites du service",
    items: [
      "Aucun acte médical, paramédical, de soin corporel ou d'apprentissage réglementé.",
      "Aucun paiement direct, aucun cadeau, aucune opération bancaire, aucune clé conservée.",
      "Aucune mise en relation ou prestation en dehors de l'application.",
      "Enfants à partir de 3 ans uniquement : ne jamais laisser l'enfant seul, ne le confier qu'à l'adulte désigné.",
    ],
  },
  {
    title: "5. Sanctions",
    items: [
      "Plainte justifiée d'un client : 1 blâme. 3 blâmes entraînent la radiation définitive.",
      "3 rendez-vous non honorés sans justificatif valable : radiation définitive.",
      "Irrespect de la présente charte : radiation immédiate.",
      "Vol, violence, maltraitance, fausse identité, état d'ébriété : radiation immédiate et signalement aux autorités.",
    ],
  },
];

export function CharterText() {
  return (
    <div className="text-left space-y-4">
      {CHARTER_SECTIONS.map((s) => (
        <div key={s.title}>
          <p className="text-sm font-bold">{s.title}</p>
          <ul className="text-sm text-muted-foreground mt-1 space-y-1 list-disc pl-4">
            {s.items.map((it) => (
              <li key={it}>{it}</li>
            ))}
          </ul>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        Charte des compagnons SOS Compagnons — {CHARTER_VERSION}. Version définitive à venir.
      </p>
    </div>
  );
}

/* --- Bouton + panneau dépliable, réutilisable côté client et compagnon --- */
export function CharterPanel({ label = "📜 Lire la charte du compagnon" }: { label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="w-full text-left">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full py-4 rounded-2xl border-2 border-primary text-primary font-bold text-base"
      >
        {open ? "Fermer la charte" : label}
      </button>
      {open && (
        <div className="mt-3 rounded-2xl border-2 border-border bg-card p-4">
          <CharterText />
        </div>
      )}
    </div>
  );
}

/* --- Signature dématérialisée du compagnon --- */
const SIGN_KEY = "sos-charter-signature";
export type CharterSignatureData = { fullName: string; signedAt: number; version: string };

export function loadCharterSignature(): CharterSignatureData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SIGN_KEY);
    return raw ? (JSON.parse(raw) as CharterSignatureData) : null;
  } catch {
    return null;
  }
}

export function CharterSignatureBlock({ defaultName = "" }: { defaultName?: string }) {
  const [sig, setSig] = useState<CharterSignatureData | null>(null);
  const [name, setName] = useState(defaultName);
  const [read, setRead] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    setSig(loadCharterSignature());
  }, []);

  const sign = () => {
    if (!name.trim() || !read || !accepted) return;
    const data: CharterSignatureData = { fullName: name.trim(), signedAt: Date.now(), version: CHARTER_VERSION };
    try {
      localStorage.setItem(SIGN_KEY, JSON.stringify(data));
    } catch {}
    setSig(data);
  };

  if (sig) {
    return (
      <div className="w-full rounded-2xl border-2 border-success bg-success/10 p-4 text-left">
        <p className="text-sm font-bold text-success">✅ Charte signée électroniquement</p>
        <p className="text-sm mt-1">
          {sig.fullName} — le {new Date(sig.signedAt).toLocaleDateString("fr-FR")} à{" "}
          {new Date(sig.signedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
        </p>
        <p className="text-xs text-muted-foreground mt-1">Version {sig.version} · signature horodatée conservée.</p>
        <div className="mt-3">
          <CharterPanel label="📜 Relire la charte" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl border-2 border-warning bg-warning/10 p-4 text-left">
      <p className="text-sm font-bold">✍️ Signature de la charte du compagnon</p>
      <p className="text-sm text-muted-foreground mt-1">
        La signature électronique de la charte est obligatoire pour exercer comme compagnon.
      </p>
      <div className="mt-3">
        <CharterPanel />
      </div>
      <label className="flex items-start gap-3 mt-3 text-sm">
        <input type="checkbox" checked={read} onChange={(e) => setRead(e.target.checked)} className="mt-1 h-5 w-5" />
        <span>J'ai lu la charte du compagnon dans son intégralité.</span>
      </label>
      <label className="flex items-start gap-3 mt-2 text-sm">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-1 h-5 w-5"
        />
        <span>
          J'accepte ses règles et les sanctions associées (3 blâmes ou 3 rendez-vous non honorés = radiation ;
          irrespect de la charte = radiation immédiate).
        </span>
      </label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nom et prénom (valant signature)"
        className="w-full mt-3 px-4 py-3 rounded-2xl border-2 border-border bg-card text-base outline-none focus:border-primary"
      />
      <button
        type="button"
        onClick={sign}
        disabled={!name.trim() || !read || !accepted}
        className="w-full mt-3 py-4 rounded-2xl bg-primary text-primary-foreground font-bold disabled:opacity-50"
      >
        Signer électroniquement
      </button>
    </div>
  );
}
