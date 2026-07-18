// Simple in-memory store shared across the app for the demo flow.
import { useSyncExternalStore } from "react";

export type NeedType = "Compagnie/Présence" | "Courses urgentes" | "Pharmacie" | "Aide au repas";

export type Request = {
  id: string;
  need: NeedType;
  address: string;
  city: string;
  phone: string;
  seniorName: string;
  createdAt: number;
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
  const getSnapshot = () => selector(store.getState());
  const cache = { current: undefined as { value: T } | undefined };
  const memoized = () => {
    const next = getSnapshot();
    if (
      cache.current &&
      (Object.is(cache.current.value, next) ||
        (Array.isArray(cache.current.value) &&
          Array.isArray(next) &&
          cache.current.value.length === (next as unknown[]).length &&
          (cache.current.value as unknown[]).every((v, i) => v === (next as unknown[])[i])))
    ) {
      return cache.current.value;
    }
    cache.current = { value: next };
    return next;
  };
  return useSyncExternalStore(store.subscribe, memoized, memoized);
}

export const randomStudent = () => seedStudents[Math.floor(Math.random() * seedStudents.length)];
