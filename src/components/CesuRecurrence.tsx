import { useState } from "react";

/* ------------------------------------------------------------------
   Simulation & alerte de récurrence CESU
   (Article L. 1271-5 du Code du travail)
------------------------------------------------------------------- */

export const ALT_COMPANIONS = [
  { firstName: "Thomas", photo: "https://i.pravatar.cc/200?img=12", rating: 4.8, city: "à 1,2 km" },
  { firstName: "Camille", photo: "https://i.pravatar.cc/200?img=32", rating: 5.0, city: "à 2,4 km" },
  { firstName: "Malik", photo: "https://i.pravatar.cc/200?img=15", rating: 4.9, city: "à 3,1 km" },
];

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/50 p-3">
      <div className="w-full max-w-[440px] max-h-[85vh] overflow-y-auto rounded-3xl bg-card border-2 border-border p-5 text-left">
        {children}
        <button
          type="button"
          onClick={onClose}
          className="w-full mt-3 py-3 rounded-2xl border-2 border-border font-bold text-sm"
        >
          Fermer
        </button>
      </div>
    </div>
  );
}

export function CesuRecurrenceModal({
  companionName,
  onClose,
  onSwitchCompanion,
}: {
  companionName: string;
  onClose: () => void;
  onSwitchCompanion: (name: string) => void;
}) {
  const [view, setView] = useState<"alert" | "companions" | "contract">("alert");

  if (view === "companions")
    return (
      <Modal onClose={onClose}>
        <p className="text-lg font-black">🤝 Autres compagnons disponibles</p>
        <p className="text-sm text-muted-foreground mt-1">
          Alterner de compagnon vous évite toute démarche administrative supplémentaire.
        </p>
        <div className="flex flex-col gap-2 mt-3">
          {ALT_COMPANIONS.map((c) => (
            <button
              key={c.firstName}
              type="button"
              onClick={() => onSwitchCompanion(c.firstName)}
              className="flex items-center gap-3 p-3 rounded-2xl border-2 border-border hover:border-primary text-left"
            >
              <img src={c.photo} alt={c.firstName} className="h-14 w-14 rounded-full object-cover" />
              <div className="flex-1 min-w-0">
                <p className="font-bold">{c.firstName}</p>
                <p className="text-xs text-muted-foreground">⭐ {c.rating.toFixed(1)} · {c.city}</p>
              </div>
              <span className="text-xs font-bold text-primary">Choisir</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setView("alert")}
          className="w-full mt-3 py-3 rounded-2xl border-2 border-border font-bold text-sm"
        >
          ← Revenir à l'alerte
        </button>
      </Modal>
    );

  if (view === "contract")
    return (
      <Modal onClose={onClose}>
        <p className="text-lg font-black">📝 Contrat de travail CESU (exemple)</p>
        <p className="text-xs text-muted-foreground mt-1">
          Modèle pré-rempli — à compléter et signer entre le particulier employeur et le compagnon.
        </p>
        <div className="mt-3 rounded-2xl border-2 border-border bg-background p-4 text-sm space-y-3">
          <p className="font-bold text-center">CONTRAT DE TRAVAIL À DURÉE INDÉTERMINÉE — EMPLOI À DOMICILE (CESU)</p>
          <p>
            <b>Entre :</b> le particulier employeur (la Famille), demeurant à l'adresse de la prestation,
            <br />
            <b>Et :</b> {companionName}, salarié(e) du particulier employeur.
          </p>
          <p>
            <b>Article 1 — Objet.</b> Le salarié est engagé pour des missions d'assistance et de présence à domicile
            (convention collective nationale des particuliers employeurs et de l'emploi à domicile).
          </p>
          <p>
            <b>Article 2 — Durée et horaires.</b> Emploi régulier récurrent : ____ heures par semaine, réparties selon
            le planning convenu entre les parties.
          </p>
          <p>
            <b>Article 3 — Rémunération.</b> Salaire horaire net de ____ €, congés payés 10 % inclus, réglé via le
            CESU déclaratif ou préfinancé.
          </p>
          <p>
            <b>Article 4 — Période d'essai.</b> Un mois, renouvelable une fois par accord écrit.
          </p>
          <p>
            <b>Article 5 — Déclaration.</b> L'employeur déclare le salarié auprès du CESU URSSAF pour chaque période
            travaillée.
          </p>
          <p className="text-xs text-muted-foreground">
            Fait en deux exemplaires. Document d'exemple non contractuel généré par SOS Compagnons.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setView("alert")}
          className="w-full mt-3 py-3 rounded-2xl border-2 border-border font-bold text-sm"
        >
          ← Revenir à l'alerte
        </button>
      </Modal>
    );

  return (
    <Modal onClose={onClose}>
      <p className="text-lg font-black">⚠️ Récurrence détectée</p>
      <p className="text-sm mt-2 leading-relaxed">
        Vous vous préparez à réserver <b>{companionName}</b> pour la 4ᵉ semaine consécutive. Conformément à la
        réglementation CESU, ce niveau de récurrence nécessite l'établissement d'un contrat de travail écrit.
      </p>
      <p className="text-xs text-muted-foreground mt-2">Article L. 1271-5 du Code du travail.</p>
      <button
        type="button"
        onClick={() => setView("companions")}
        className="w-full mt-4 py-4 rounded-2xl bg-primary text-primary-foreground font-bold"
      >
        ✅ Découvrir d'autres compagnons (recommandé)
      </button>
      <button
        type="button"
        onClick={() => setView("contract")}
        className="w-full mt-2 py-4 rounded-2xl border-2 border-border font-bold"
      >
        📝 Continuer et générer le contrat CESU
      </button>
    </Modal>
  );
}
