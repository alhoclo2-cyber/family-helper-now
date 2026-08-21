// Simple in-memory store shared across the app for the demo flow.
import { useRef, useSyncExternalStore } from "react";

export type NeedType =
  | "Compagnie/Présence"
  | "Courses urgentes"
  | "Pharmacie"
  | "Aide au repas"
  | "Accompagnement sorties extérieures"
  | "Sortir ou nourrir animal de compagnie"
  | "Arroser les plantes"
  | "Retrait ou dépôt d'un colis"
  | "Aide aux devoirs (primaire au lycée)"
  | "Garde d'enfants (à partir de 3 ans)"
  | "Accompagner un enfant (à partir de 3 ans)"
  | "Autre (à préciser)";

export type Companion = {
  id: string;
  firstName: string;
  photo: string;
  rating: number;
  missions: number;
  thumbs: number;
  distanceKm: number;
  radiusKm: number;
  city: string;
};

export const COMPANIONS: Companion[] = [
  { id: "c1", firstName: "Léa", photo: "https://i.pravatar.cc/200?img=47", rating: 4.9, missions: 8, thumbs: 7, distanceKm: 1.2, radiusKm: 3, city: "Paris" },
  { id: "c2", firstName: "Thomas", photo: "https://i.pravatar.cc/200?img=12", rating: 4.8, missions: 34, thumbs: 29, distanceKm: 2.4, radiusKm: 5, city: "Paris" },
  { id: "c3", firstName: "Camille", photo: "https://i.pravatar.cc/200?img=32", rating: 5.0, missions: 96, thumbs: 88, distanceKm: 4.1, radiusKm: 8, city: "Paris" },
  { id: "c4", firstName: "Malik", photo: "https://i.pravatar.cc/200?img=15", rating: 4.9, missions: 212, thumbs: 197, distanceKm: 2.9, radiusKm: 6, city: "Paris" },
];

export type ExperienceBadge = {
  label: string;
  emoji: string;
  min: number;
  max: number | null;
};

export const EXPERIENCE_BADGES: ExperienceBadge[] = [
  { label: "Nouveau Compagnon", emoji: "🌱", min: 0, max: 10 },
  { label: "Compagnon Confirmé", emoji: "⭐", min: 11, max: 50 },
  { label: "Compagnon Chevronné", emoji: "🏅", min: 51, max: 150 },
  { label: "Compagnon Expert", emoji: "🏆", min: 151, max: null },
];

export function experienceBadge(missions: number): ExperienceBadge {
  return (
    EXPERIENCE_BADGES.find((b) => missions >= b.min && (b.max === null || missions <= b.max)) ??
    EXPERIENCE_BADGES[0]
  );
}

export type Request = {
  id: string;
  need: NeedType;
  address: string;
  city: string;
  phone: string;
  seniorName: string;
  createdAt: number;
  scheduledAt?: number | null; // null/undefined => ASAP (urgence)
  flow?: "sos" | "scheduled";
  preferredCompanionId?: string; // parcours RDV : compagnon choisi par son nom
  autoSearch?: boolean; // parcours RDV : recherche automatique à proximité
  acknowledged?: boolean; // le client a cliqué sur « C'est noté ! »
  thumbsGiven?: boolean; // pouce levé attribué en fin de prestation
  declinedBy?: string[]; // compagnons ayant refusé
  durationHours?: number; // durée demandée (spécifique à Compagnie/Présence)
  parcelWeight?: string; // pour "Retrait ou dépôt d'un colis"
  parcelSize?: string;
  childLevel?: string; // niveau scolaire pour l'aide aux devoirs
  childClass?: string; // classe précise (CP, 5e, Terminale…)
  childAge?: string; // âge de l'enfant (services enfants, 3 ans minimum)
  childrenCount?: string; // nombre d'enfants pour la garde
  escortDestination?: string; // destination pour l'accompagnement d'un enfant
  escortDetail?: string; // précision libre ("Autre")
  otherDetail?: string; // précision libre pour le besoin "Autre (à préciser)"
  extraInfo?: string; // informations complémentaires libres (tous services)
  continuityCertified?: boolean; // services extérieurs : continuité de l'aide à domicile
  status: "searching" | "accepted" | "cancelled";
  cancelledBy?: "family" | "companion";
  refunded?: boolean;
  student?: Companion;
};


const seedStudents = COMPANIONS;


let state: {
  requests: Request[];
  currentRequestId: string | null;
} = {
  requests: [
    {
      id: "seed-1",
      need: "Pharmacie",
      address: "12 rue des Lilas, 75014 Paris",
      city: "Paris 14e",
      phone: "06 12 34 56 78",
      seniorName: "Mme Dubois",
      createdAt: Date.now() - 60_000,
      status: "searching",
    },
    {
      id: "seed-2",
      need: "Compagnie/Présence",
      address: "3 avenue Foch, 69006 Lyon",
      city: "Lyon 6e",
      phone: "06 98 76 54 32",
      seniorName: "M. Martin",
      createdAt: Date.now() - 180_000,
      status: "searching",
    },
  ],
  currentRequestId: null,
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const store = {
  getState: () => state,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  createRequest: (data: Omit<Request, "id" | "createdAt" | "status" | "seniorName" | "city">) => {
    const id = `req-${Date.now()}`;
    const city = data.address.split(",").pop()?.trim() || "Ville inconnue";
    const req: Request = {
      ...data,
      id,
      createdAt: Date.now(),
      status: "searching",
      seniorName: "Vous",
      city,
    };
    state = { ...state, requests: [req, ...state.requests], currentRequestId: id };
    emit();
    return id;
  },
  updateRequest: (id: string, patch: Partial<Omit<Request, "id" | "createdAt" | "status" | "student">>) => {
    state = {
      ...state,
      requests: state.requests.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    };
    emit();
  },
  acceptRequest: (id: string, studentIdx = 0) => {
    state = {
      ...state,
      requests: state.requests.map((r) =>
        r.id === id ? { ...r, status: "accepted", student: seedStudents[studentIdx % seedStudents.length] } : r,
      ),
    };
    emit();
  },
  // La famille annule sa demande. Remboursement uniquement si > 48h avant le RDV.
  cancelRequest: (id: string, refunded: boolean) => {
    state = {
      ...state,
      requests: state.requests.map((r) =>
        r.id === id ? { ...r, status: "cancelled" as const, cancelledBy: "family" as const, refunded } : r,
      ),
    };
    emit();
  },
  // Le compagnon se désiste : la mission repart en recherche d'un autre compagnon.
  releaseRequest: (id: string) => {
    state = {
      ...state,
      requests: state.requests.map((r) =>
        r.id === id ? { ...r, status: "searching" as const, student: undefined } : r,
      ),
    };
    emit();
  },
  clearCurrent: () => {
    state = { ...state, currentRequestId: null };
    emit();
  },
};

export function useStore<T>(selector: (s: typeof state) => T): T {
  const cache = useRef<{ value: T; has: boolean }>({ value: undefined as unknown as T, has: false });
  const getSnapshot = () => {
    const next = selector(store.getState());
    const prev = cache.current;
    if (prev.has) {
      if (Object.is(prev.value, next)) return prev.value;
      if (
        Array.isArray(prev.value) &&
        Array.isArray(next) &&
        (prev.value as unknown[]).length === (next as unknown[]).length &&
        (prev.value as unknown[]).every((v, i) => v === (next as unknown[])[i])
      ) {
        return prev.value;
      }
    }
    cache.current = { value: next, has: true };
    return next;
  };
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

export const randomStudent = () => seedStudents[Math.floor(Math.random() * seedStudents.length)];
