import { useState } from "react";

/* ------------------------------------------------------------------
   Conditions Générales d'Utilisation — SOS Compagnons
------------------------------------------------------------------- */

export const CGU_VERSION = "v1";

export const CGU_SECTIONS: { title: string; items: string[] }[] = [
  {
    title: "Préambule et définitions",
    items: [
      "SOS Compagnons intervient exclusivement en qualité d'intermédiaire technologique et de mandataire dans le cadre du Service à la Personne (SAP), en mode mandataire.",
      "« La Famille » ou « Le Particulier Employeur » : toute personne physique réservant une prestation d'assistance ou de présence à domicile via l'application.",
      "« Le Compagnon » : toute personne physique majeure proposant ses services d'assistance et de présence à domicile.",
      "« La Prestation » : toute mission ponctuelle d'assistance (compagnie/présence, courses, pharmacie, aide au repas, sorties extérieures, animal de compagnie, plantes, colis, aide aux devoirs, garde et accompagnement d'enfants à partir de 3 ans, autre mission convenue via l'application).",
    ],
  },
  {
    title: "Article 1 — Nature juridique de la relation (mode mandataire)",
    items: [
      "1.1. SOS Compagnons n'est en aucun cas l'employeur des Compagnons : la Plateforme met en relation des Particuliers Employeurs et des Compagnons.",
      "1.2. L'acceptation d'une mission forme un contrat de travail de gré à gré direct entre la Famille (employeur) et le Compagnon (salarié du particulier).",
      "1.3. Le Compagnon est rémunéré dans le cadre du Chèque Emploi Service Universel (CESU).",
    ],
  },
  {
    title: "Article 2 — Mandat de déclaration et avance immédiate (URSSAF)",
    items: [
      "2.1. En acceptant les présentes CGU, la Famille donne mandat à SOS Compagnons pour réaliser en son nom les déclarations auprès de l'URSSAF / CESU.",
      "2.2. Sous réserve d'éligibilité, les prestations ouvrent droit à l'avance immédiate du crédit d'impôt de 50 %.",
    ],
  },
  {
    title: "Article 3 — Tarification, commissions et fidélité",
    items: [
      "3.1. Le tarif affiché (26 €/h à titre d'exemple) est un tarif indicatif incluant le salaire net du Compagnon, les cotisations CESU estimées et les frais de service de la Plateforme.",
      "3.2. SOS Compagnons perçoit une commission au titre de la plateforme numérique, du support et de la gestion administrative du mandat.",
      "3.3. Le programme de fidélité (Bronze à Royal) repose exclusivement sur la réduction progressive des frais de service : il ne s'agit pas d'une grille salariale imposée par un employeur.",
    ],
  },
  {
    title: "Article 4 — Périmètre et limites de la prestation",
    items: [
      "4.1. Aucun acte médical, paramédical, de soin corporel ou relevant d'une compétence réglementée (soins infirmiers, kinésithérapie, toilette intime, gestion de médicaments, apprentissage réglementé).",
      "4.2. En cas de besoin de santé, le Compagnon prévient immédiatement la Famille et, le cas échéant, les services d'urgence ; il ne se substitue jamais à un professionnel de santé.",
      "4.3. Les missions impliquant un enfant sont réservées aux enfants de 3 ans et plus. L'enfant n'est jamais laissé seul et n'est confié qu'à l'adulte désigné.",
    ],
  },
  {
    title: "Article 5 — Sécurité et prévention du contournement",
    items: [
      "5.1. Tout paiement, cadeau, opération bancaire ou remise d'espèces hors circuit CESU / Plateforme est strictement interdit.",
      "5.2. La Famille et le Compagnon s'engagent à ne pas poursuivre la relation en dehors de l'application.",
      "5.3. Aucune clé, aucun code d'accès ni moyen de paiement de la Famille n'est confié au Compagnon au-delà de la mission validée.",
    ],
  },
  {
    title: "Article 6 — Règles de bonne conduite",
    items: [
      "6.1. Le Compagnon s'engage à la ponctualité, au respect, à la courtoisie et à la confidentialité.",
      "6.2. L'acceptation d'une mission est un engagement ferme ; tout empêchement doit être signalé au moins 48 heures à l'avance via l'application.",
      "6.3. SOS Compagnons n'exerce aucun pouvoir disciplinaire patronal : ni avertissement ni blâme salarial.",
      "6.4. En cas de non-respect répétitif des règles (rendez-vous non honorés sans justificatif, incivilités, paiement hors plateforme), l'accès au compte peut être suspendu ou désactivé pour rupture des CGU.",
    ],
  },
  {
    title: "Article 7 — Responsabilité et assurances",
    items: [
      "7.1. SOS Compagnons est un intermédiaire technique et n'est pas responsable des dommages survenant lors de l'exécution de la prestation.",
      "7.2. Le Particulier Employeur reste responsable des dommages causés à son domicile, conformément au droit commun du travail et du CESU.",
    ],
  },
  {
    title: "Article 8 — Données personnelles (RGPD)",
    items: [
      "Les données collectées (nom, prénom, adresse, numéro de sécurité sociale, RIB) sont strictement nécessaires à la mise en relation et aux déclarations légales auprès de l'URSSAF. Elles ne sont jamais revendues à des tiers.",
    ],
  },
];

export function CguText() {
  return (
    <div className="text-left space-y-4">
      {CGU_SECTIONS.map((s) => (
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
        Conditions Générales d'Utilisation SOS Compagnons — {CGU_VERSION}.
      </p>
    </div>
  );
}

export function CguPanel({ label = "📄 Lire les Conditions Générales d'Utilisation" }: { label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="w-full text-left">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full py-4 rounded-2xl border-2 border-primary text-primary font-bold text-base"
      >
        {open ? "Fermer les CGU" : label}
      </button>
      {open && (
        <div className="mt-3 rounded-2xl border-2 border-border bg-card p-4 max-h-96 overflow-y-auto">
          <CguText />
        </div>
      )}
    </div>
  );
}

/* Case à cocher obligatoire d'acceptation des CGU */
export function CguAcceptBlock({
  checked,
  onChange,
  role = "client",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  role?: "client" | "companion";
}) {
  return (
    <div className="w-full rounded-2xl border-2 border-border bg-card p-4 text-left">
      <p className="text-sm font-bold">📄 Conditions Générales d'Utilisation</p>
      <div className="mt-3">
        <CguPanel />
      </div>
      <label className="flex items-start gap-3 mt-3 text-sm">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-1 h-5 w-5 shrink-0"
        />
        <span>
          Je déclare avoir pris connaissance des Conditions Générales d'Utilisation de SOS Compagnons ({CGU_VERSION})
          et je m'engage à les respecter
          {role === "client"
            ? ", notamment le mandat de déclaration URSSAF/CESU et l'interdiction de tout paiement hors plateforme."
            : ", notamment le périmètre des prestations autorisées et l'interdiction de tout paiement hors plateforme."}
        </span>
      </label>
    </div>
  );
}
