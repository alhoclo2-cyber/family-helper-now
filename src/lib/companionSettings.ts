import { useEffect, useState } from "react";
import type { NeedType } from "./store";

export type CompanionSettings = {
  radiusKm: number; // distance maximale d'intervention, saisie libre
  minDurationH: number; // durée minimale de mission acceptée
  tasks: NeedType[]; // types de tâches acceptées
  acceptPets: boolean; // accepte les logements avec animaux
  nonSmokingOnly: boolean; // n'intervient que dans un logement non-fumeur
};

export const ALL_NEEDS: NeedType[] = [
  "Compagnie/Présence",
  "Courses urgentes",
  "Pharmacie",
  "Aide au repas",
  "Accompagnement sorties extérieures",
  "Sortir ou nourrir animal de compagnie",
  "Arroser les plantes",
  "Retrait ou dépôt d'un colis",
  "Aide aux devoirs (primaire au lycée)",
  "Garde d'enfants (à partir de 3 ans)",
  "Accompagner un enfant (à partir de 3 ans)",
  "Autre (à préciser)",
];

export const DEFAULT_SETTINGS: CompanionSettings = {
  radiusKm: 3,
  minDurationH: 1,
  tasks: ALL_NEEDS,
  acceptPets: true,
  nonSmokingOnly: false,
};

const KEY = "sos-companion-settings";

export function loadSettings(): CompanionSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_SETTINGS;
}

export function saveSettings(s: CompanionSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    window.dispatchEvent(new Event("sos-settings-changed"));
  } catch {}
}

export function useCompanionSettings(): CompanionSettings {
  const [s, setS] = useState<CompanionSettings>(DEFAULT_SETTINGS);
  useEffect(() => {
    const refresh = () => setS(loadSettings());
    refresh();
    window.addEventListener("sos-settings-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("sos-settings-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return s;
}
