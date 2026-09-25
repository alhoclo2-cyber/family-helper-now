// Simple in-memory store shared across the app for the demo flow.
import { useRef, useSyncExternalStore } from "react";

export type NeedType =
  | "Présence et Compagnie"
  | "Courses urgentes"
  | "Pharmacie"
  | "Aide à la préparation des repas"
  | "Ménage / rangement intérieur"
  | "Jardinage extérieur"
  | "Rangement extérieur"
  | "Petit bricolage"
  | "Aide administrative"
  | "Aide informatique & smartphone"
  | "Invalidité temporaire"
  | "Enfants de plus de 3 ans"
  | "Sortir ou nourrir animal de compagnie"
  | "Arroser les plantes"
  | "Retrait ou dépôt d'un colis"
  | "Garde d'enfants"
  | "Aide aux devoirs";

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
  cesuActive: boolean; // compte CESU+ Avance Immédiate actif
  hourlyRate: number; // salaire net horaire conseillé (congés payés inclus)
  missedCount: number; // nombre de RDV non honorés, visible par les familles
  unavailabilitySlots: UnavailabilitySlot[]; // plages hebdomadaires d'INDISPONIBILITÉ (vide = disponible)
};

export type UnavailabilitySlot = {
  day: number; // 0 = dimanche ... 6 = samedi
  start: string; // "HH:MM"
  end: string; // "HH:MM"
};

export const COMPANIONS: Companion[] = [
  { id: "c1", firstName: "Léa", photo: "https://i.pravatar.cc/200?img=47", rating: 4.9, missions: 8, thumbs: 7, distanceKm: 1.2, radiusKm: 3, city: "Paris", cesuActive: true, hourlyRate: 11.5, missedCount: 0, unavailabilitySlots: [] },
  { id: "c2", firstName: "Thomas", photo: "https://i.pravatar.cc/200?img=12", rating: 4.8, missions: 34, thumbs: 29, distanceKm: 2.4, radiusKm: 5, city: "Paris", cesuActive: false, hourlyRate: 11.5, missedCount: 0, unavailabilitySlots: [{ day: 3, start: "08:00", end: "11:00" }] },
  { id: "c3", firstName: "Camille", photo: "https://i.pravatar.cc/200?img=32", rating: 5.0, missions: 96, thumbs: 88, distanceKm: 4.1, radiusKm: 8, city: "Paris", cesuActive: true, hourlyRate: 11.5, missedCount: 0, unavailabilitySlots: [{ day: 0, start: "00:00", end: "23:59" }] },
  { id: "c4", firstName: "Malik", photo: "https://i.pravatar.cc/200?img=15", rating: 4.9, missions: 212, thumbs: 197, distanceKm: 2.9, radiusKm: 6, city: "Paris", cesuActive: true, hourlyRate: 12, missedCount: 0, unavailabilitySlots: [] },
];

export type ExperienceBadge = {
  label: string;
  emoji: string;
  min: number;
  max: number | null;
};

export const EXPERIENCE_BADGES: ExperienceBadge[] = [
  { label: "Nouveau compagnon", emoji: "🌱", min: 1, max: 9 },
  { label: "Compagnon régulier", emoji: "🤝", min: 10, max: 49 },
  { label: "Compagnon confirmé", emoji: "⭐", min: 50, max: 99 },
  { label: "Compagnon expert", emoji: "🏅", min: 100, max: 149 },
  { label: "Compagnon d'élite", emoji: "👑", min: 150, max: null },
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
  durationHours?: number; // durée demandée
  parcelWeight?: string; // pour "Retrait ou dépôt d'un colis"
  parcelSize?: string;
  childLevel?: string; // niveau scolaire pour l'aide aux devoirs
  childClass?: string; // classe précise (CP, 5e, Terminale…)
  childAge?: string; // âge de l'enfant (services enfants, 3 ans minimum)
  childAges?: string[]; // âges des enfants (garde / accompagnement multi-enfants)
  childrenCount?: string; // nombre d'enfants pour la garde
  escortDestination?: string; // destination pour l'accompagnement d'un enfant
  escortDetail?: string; // précision libre ("Autre")
  otherDetail?: string; // conservé pour la compatibilité avec les anciennes demandes
  extraInfo?: string; // informations complémentaires libres (tous services) : code d'entrée, étage…
  missionInfo?: string; // précisions libres concernant la mission (tous services)
  continuityCertified?: boolean; // services extérieurs : continuité de l'aide à domicile
  status: "searching" | "accepted" | "cancelled";
  cancelledBy?: "family" | "companion";
  refunded?: boolean;
  refundAmount?: number; // remboursement partiel simulé (annulation RDV à moins de 24 h)
  refundReason?: string;
  paid?: boolean; // paiement du forfait effectué OU carte enregistrée (le RDV est alors confirmé)
  deferredCharge?: boolean; // RDV à plus de 24 h : carte enregistrée, débit des 6 € différé
  scheduledChargeAt?: number; // date/heure prévue du débit des frais de service (J-24 h)
  cancelReason?: string; // motif final retenu pour l'annulation par la famille
  companionCancelNotice?: { companionName: string; reason: string } | null; // dernier motif d'un compagnon qui s'est désisté
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
      need: "Présence et Compagnie",
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
  // Premier répondant : verrouille la mission. Renvoie false si déjà attribuée.
  acceptRequest: (id: string, studentIdx = 0) => {
    const req = state.requests.find((r) => r.id === id);
    if (!req || req.status !== "searching") return false;
    const companion = seedStudents[studentIdx % seedStudents.length];
    state = {
      ...state,
      requests: state.requests.map((r) =>
        r.id === id ? { ...r, status: "accepted" as const, student: companion } : r,
      ),
    };
    emit();
    return true;
  },
  acceptRequestBy: (id: string, companionId: string) => {
    const req = state.requests.find((r) => r.id === id);
    if (!req || req.status !== "searching") return false;
    const companion = COMPANIONS.find((c) => c.id === companionId) ?? COMPANIONS[0];
    state = {
      ...state,
      requests: state.requests.map((r) =>
        r.id === id ? { ...r, status: "accepted" as const, student: companion } : r,
      ),
    };
    emit();
    return true;
  },
  declineRequest: (id: string, companionId: string) => {
    state = {
      ...state,
      requests: state.requests.map((r) =>
        r.id === id ? { ...r, declinedBy: [...(r.declinedBy ?? []), companionId] } : r,
      ),
    };
    emit();
  },
  // Supprime silencieusement une demande (remplacée par une version modifiée).
  discardRequest: (id: string) => {
    state = { ...state, requests: state.requests.filter((r) => r.id !== id) };
    emit();
  },
  // Panneau de test : remplace les demandes fictives (id préfixé "sim-").
  setSimulatedRequests: (reqs: Request[]) => {
    state = {
      ...state,
      requests: [...reqs, ...state.requests.filter((r) => !r.id.startsWith("sim-"))],
    };
    emit();
  },
  acknowledgeRequest: (id: string) => {
    state = {
      ...state,
      requests: state.requests.map((r) => (r.id === id ? { ...r, acknowledged: true } : r)),
    };
    emit();
  },
  giveThumb: (id: string) => {
    state = {
      ...state,
      requests: state.requests.map((r) => {
        if (r.id !== id || r.thumbsGiven) return r;
        if (r.student) {
          const c = COMPANIONS.find((x) => x.id === r.student!.id);
          if (c) c.thumbs += 1;
        }
        return { ...r, thumbsGiven: true };
      }),
    };
    emit();
  },

  // La famille annule sa demande. Remboursement uniquement si > 24h avant le RDV.
  cancelRequest: (id: string, refunded: boolean, reason: string) => {
    state = {
      ...state,
      requests: state.requests.map((r) =>
        r.id === id
          ? { ...r, status: "cancelled" as const, cancelledBy: "family" as const, refunded, cancelReason: reason }
          : r,
      ),
    };
    emit();
  },
  // Le compagnon se désiste avec un motif transmis à la famille.
  releaseRequestWithReason: (id: string, companionName: string, reason: string) => {
    state = {
      ...state,
      requests: state.requests.map((r) =>
        r.id === id
          ? { ...r, status: "searching" as const, student: undefined, companionCancelNotice: { companionName, reason } }
          : r,
      ),
    };
    emit();
  },
  updateCompanionUnavailability: (companionId: string, slots: UnavailabilitySlot[]) => {
    const c = COMPANIONS.find((x) => x.id === companionId);
    if (c) c.unavailabilitySlots = slots;
    emit();
  },
  recordMissedAppointment: (companionId: string) => {
    const c = COMPANIONS.find((x) => x.id === companionId);
    if (c) c.missedCount += 1;
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
