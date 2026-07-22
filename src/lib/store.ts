// Simple in-memory store shared across the app for the demo flow.
import { useRef, useSyncExternalStore } from "react";

export type NeedType = "Compagnie/Présence" | "Courses urgentes" | "Pharmacie" | "Aide au repas" | "Accompagnement sorties extérieures" | "Sortir ou nourrir animal de compagnie" | "Arroser les plantes";

export type Request = {
  id: string;
  need: NeedType;
  address: string;
  city: string;
  phone: string;
  seniorName: string;
  createdAt: number;
  scheduledAt?: number | null; // null/undefined => ASAP (urgence)
  durationHours?: number; // durée demandée (spécifique à Compagnie/Présence)
  status: "searching" | "accepted";
  student?: { firstName: string; photo: string; rating: number };
};

const seedStudents = [
  { firstName: "Léa", photo: "https://i.pravatar.cc/200?img=47", rating: 4.9 },
  { firstName: "Thomas", photo: "https://i.pravatar.cc/200?img=12", rating: 4.8 },
  { firstName: "Camille", photo: "https://i.pravatar.cc/200?img=32", rating: 5.0 },
];

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
  acceptRequest: (id: string, studentIdx = 0) => {
    state = {
      ...state,
      requests: state.requests.map((r) =>
        r.id === id ? { ...r, status: "accepted", student: seedStudents[studentIdx % seedStudents.length] } : r,
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
