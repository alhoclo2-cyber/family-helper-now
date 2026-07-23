import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { store, useStore, randomStudent, type NeedType, type Request } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SOS Étudiants — Aide d'urgence pour seniors" },
      { name: "description", content: "Mise en relation d'urgence entre familles seniors et étudiants à proximité." },
      { property: "og:title", content: "SOS Étudiants" },
      { property: "og:description", content: "Aide d'urgence à proximité pour les seniors." },
    ],
  }),
  component: App,
});

type Mode = "family" | "student" | "admin";

function App() {
  const [mode, setMode] = useState<Mode>("family");
  return (
    <div className="min-h-screen bg-background flex justify-center">
      <div className="w-full max-w-[440px] min-h-screen flex flex-col bg-background shadow-xl">
        <Header mode={mode} setMode={setMode} />
        <main className="flex-1 flex flex-col">
          {mode === "family" ? <FamilyFlow /> : mode === "student" ? <StudentFlow /> : <AdminFlow />}
        </main>
      </div>
    </div>
  );
}

function Header({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  const tabs: { v: Mode; label: string }[] = [
    { v: "family", label: "👵 Famille" },
    { v: "student", label: "🎓 Étudiant" },
    { v: "admin", label: "🛡️ Admin" },
  ];
  return (
    <header className="px-5 pt-6 pb-4 border-b border-border">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-10 w-10 rounded-2xl bg-primary grid place-items-center text-primary-foreground text-xl font-black">S</div>
        <div>
          <h1 className="text-xl font-black leading-none">SOS Étudiants</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Aide d'urgence à proximité</p>
        </div>
      </div>
      <div className="grid grid-cols-3 rounded-2xl bg-muted p-1 gap-1">
        {tabs.map((t) => (
          <button
            key={t.v}
            onClick={() => setMode(t.v)}
            className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${
              mode === t.v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </header>
  );
}

function NeedLabel({ need }: { need: NeedType }) {
  const [first, second] = need.split("/");
  if (second) {
    return (
      <div className="text-base font-semibold leading-tight">
        <div>{first}</div>
        <div>{second}</div>
      </div>
    );
  }
  return <div className="text-base font-semibold leading-tight">{need}</div>;
}

function formatSchedule(ts: number) {
  return new Date(ts).toLocaleString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const BASE_RATE = 21;
const SERVICE_FEE = 4.87;

function computePrice(hours: number) {
  const total = hours <= 1 ? BASE_RATE : BASE_RATE * hours;
  return { total, serviceFee: SERVICE_FEE, intervention: total - SERVICE_FEE };
}

function formatPrice(n: number) {
  return n.toFixed(2).replace(".", ",");
}

/* ---------------- FAMILY ---------------- */

function FamilyFlow() {
  const [step, setStep] = useState<"home" | "form" | "wait">("home");
  const [requestMode, setRequestMode] = useState<"asap" | "scheduled">("asap");
  const currentId = useStore((s) => s.currentRequestId);
  const current = useStore((s) => s.requests.find((r) => r.id === s.currentRequestId));

  useEffect(() => {
    if (step !== "wait" || !currentId || current?.status !== "searching") return;
    // ASAP => auto-match after a short delay. Scheduled => wait for a student.
    const isFuture = !!current?.scheduledAt && current.scheduledAt > Date.now() + 60_000;
    if (isFuture) return;
    const t = setTimeout(() => store.acceptRequest(currentId, Math.floor(Math.random() * 3)), 3500);
    return () => clearTimeout(t);
  }, [step, current?.status, current?.scheduledAt, currentId]);

  if (step === "home")
    return (
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-8 gap-6">
        <div className="text-center">
          <p className="text-lg text-muted-foreground">Besoin d'aide ?</p>
          <p className="text-base text-muted-foreground mt-1">Choisissez le moment qui vous convient.</p>
        </div>
        <button
          onClick={() => { setRequestMode("asap"); setStep("form"); }}
          className="btn-huge bg-primary text-primary-foreground hover:brightness-110 min-h-[180px] w-full flex flex-col items-center justify-center gap-2"
        >
          <span className="text-5xl">🆘</span>
          <span>Urgence — maintenant</span>
          <span className="text-sm font-normal opacity-90">Un étudiant vient au plus vite</span>
        </button>
        <button
          onClick={() => { setRequestMode("scheduled"); setStep("form"); }}
          className="btn-huge bg-accent text-foreground border-2 border-primary min-h-[140px] w-full flex flex-col items-center justify-center gap-2"
        >
          <span className="text-4xl">📅</span>
          <span>Prendre un rendez-vous</span>
          <span className="text-sm font-normal text-muted-foreground">Planifier pour plus tard</span>
        </button>
        <p className="text-xs text-muted-foreground text-center max-w-xs">
          En cas d'urgence vitale, composez le <span className="font-bold text-foreground">15</span> (SAMU).
        </p>
      </div>
    );

  if (step === "form")
    return <FamilyForm mode={requestMode} onSubmit={() => setStep("wait")} onBack={() => setStep("home")} />;

  return <FamilyWait request={current} onDone={() => { store.clearCurrent(); setStep("home"); }} />;
}

function FamilyForm({ mode, onSubmit, onBack }: { mode: "asap" | "scheduled"; onSubmit: () => void; onBack: () => void }) {
  const [need, setNeed] = useState<NeedType>("Compagnie/Présence");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [durationHours, setDurationHours] = useState<number>(1);
  const [parcelWeight, setParcelWeight] = useState<string>("moins de 2 kg");
  const [parcelSize, setParcelSize] = useState<string>("Petit (enveloppe / boîte à chaussures)");
  // default schedule: today + 2h, rounded to next hour
  const defaultSched = () => {
    const d = new Date(Date.now() + 2 * 60 * 60 * 1000);
    d.setMinutes(0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const [when, setWhen] = useState<string>(defaultSched());
  const minWhen = (() => {
    const d = new Date(Date.now() + 30 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  })();

  const needs: { v: NeedType; icon: string }[] = [
    { v: "Compagnie/Présence", icon: "🤝" },
    { v: "Courses urgentes", icon: "🛒" },
    { v: "Pharmacie", icon: "💊" },
    { v: "Aide au repas", icon: "🍽️" },
    { v: "Accompagnement sorties extérieures", icon: "🌳" },
    { v: "Sortir ou nourrir animal de compagnie", icon: "🐕" },
    { v: "Arroser les plantes", icon: "🪴" },
    { v: "Retrait ou dépôt d'un colis", icon: "📦" },
  ];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim() || !phone.trim()) return;
    const scheduledAt = mode === "scheduled" ? new Date(when).getTime() : null;
    const dh = (need === "Compagnie/Présence" || need === "Accompagnement sorties extérieures") ? durationHours : 1;
    const isParcel = need === "Retrait ou dépôt d'un colis";
    store.createRequest({
      need,
      address,
      phone,
      scheduledAt,
      durationHours: dh,
      parcelWeight: isParcel ? parcelWeight : undefined,
      parcelSize: isParcel ? parcelSize : undefined,
    });
    onSubmit();
  };

  return (
    <form onSubmit={submit} className="flex-1 flex flex-col px-5 py-6 gap-6">
      <button type="button" onClick={onBack} className="text-base text-muted-foreground text-left">← Retour</button>
      <div className={`rounded-2xl p-3 text-sm font-semibold text-center ${mode === "asap" ? "bg-primary/10 text-primary" : "bg-accent text-foreground"}`}>
        {mode === "asap" ? "🆘 Urgence — maintenant" : "📅 Prendre un rendez-vous"}
      </div>
      <div>
        <label className="block text-lg font-bold mb-3">De quoi avez-vous besoin ?</label>
        <div className="grid grid-cols-2 gap-3">
          {needs.map((n) => (
            <button
              key={n.v}
              type="button"
              onClick={() => setNeed(n.v)}
              className={`p-4 rounded-2xl border-2 text-left transition-all ${
                need === n.v ? "border-primary bg-accent" : "border-border bg-card"
              }`}
            >
              <div className="text-3xl mb-1">{n.icon}</div>
              <NeedLabel need={n.v} />
            </button>
          ))}
        </div>
      </div>
      {(need === "Compagnie/Présence" || need === "Accompagnement sorties extérieures") && (
        <div>
          <label className="block text-lg font-bold mb-2">Durée souhaitée</label>
          <p className="text-sm text-muted-foreground mb-3">
            Le tarif de base couvre 1 heure. Ajoutez du temps si besoin.
          </p>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setDurationHours(h)}
                className={`py-3 rounded-2xl border-2 text-base font-bold transition-all ${
                  durationHours === h ? "border-primary bg-accent" : "border-border bg-card"
                }`}
              >
                {h}h
              </button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Estimation : <b>{formatPrice(computePrice(durationHours).total)} €</b>
            {durationHours <= 1
              ? " (tarif forfaitaire 1h, frais de service 4,87 € inclus)"
              : ` (${durationHours}h × 21 €, frais de service 4,87 € inclus)`}
          </p>
        </div>
      )}
      {need === "Retrait ou dépôt d'un colis" && (
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-lg font-bold mb-2">Poids du colis</label>
            <div className="grid grid-cols-2 gap-2">
              {["moins de 2 kg", "2 à 5 kg", "5 à 10 kg", "plus de 10 kg"].map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setParcelWeight(w)}
                  className={`py-3 px-3 rounded-2xl border-2 text-sm font-bold transition-all ${
                    parcelWeight === w ? "border-primary bg-accent" : "border-border bg-card"
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-lg font-bold mb-2">Taille du colis</label>
            <div className="grid grid-cols-1 gap-2">
              {[
                "Petit (enveloppe / boîte à chaussures)",
                "Moyen (carton type micro-ondes)",
                "Grand (encombrant, à deux mains)",
              ].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setParcelSize(s)}
                  className={`py-3 px-3 rounded-2xl border-2 text-sm font-bold text-left transition-all ${
                    parcelSize === s ? "border-primary bg-accent" : "border-border bg-card"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {mode === "scheduled" && (
        <div>
          <label className="block text-lg font-bold mb-2">Date et heure</label>
          <input
            type="datetime-local"
            value={when}
            min={minWhen}
            onChange={(e) => setWhen(e.target.value)}
            className="w-full px-5 py-4 rounded-2xl border-2 border-border bg-card text-lg focus:border-primary outline-none"
          />
        </div>
      )}
      <div>
        <label className="block text-lg font-bold mb-2">Adresse</label>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="12 rue des Lilas, 75014 Paris"
          className="w-full px-5 py-4 rounded-2xl border-2 border-border bg-card text-lg focus:border-primary outline-none"
        />
      </div>
      <div>
        <label className="block text-lg font-bold mb-2">Téléphone</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="06 12 34 56 78"
          className="w-full px-5 py-4 rounded-2xl border-2 border-border bg-card text-lg focus:border-primary outline-none"
        />
      </div>
      <div className="flex-1" />
      <button type="submit" className="btn-huge bg-primary text-primary-foreground">
        {mode === "asap" ? "Lancer la recherche" : "Confirmer le rendez-vous"}
      </button>
    </form>
  );
}

function FamilyWait({ request, onDone }: { request: Request | undefined; onDone: () => void }) {
  const [paid, setPaid] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [editing, setEditing] = useState(false);
  const toLocalInput = (ts: number) => {
    const d = new Date(ts);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const [newWhen, setNewWhen] = useState<string>(() =>
    request?.scheduledAt ? toLocalInput(request.scheduledAt) : "",
  );
  if (!request) return null;
  const accepted = request.status === "accepted" && request.student;

  const hours = request?.durationHours ?? 1;
  const total = 12 * hours + 3;

  if (accepted && showPay && !paid) {
    return (
      <PaymentScreen
        student={request.student!.firstName}
        hours={hours}
        onDone={() => { setPaid(true); setShowPay(false); }}
        onBack={() => setShowPay(false)}
      />
    );
  }

  const isFutureSched = !!request.scheduledAt && request.scheduledAt > Date.now() + 60_000;

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 gap-6 text-center">
      {!accepted ? (
        isFutureSched ? (
          <>
            <div className="text-6xl">📅</div>
            <div>
              <p className="text-2xl font-bold">Rendez-vous enregistré</p>
              <p className="text-base text-muted-foreground mt-2">Nous cherchons un étudiant pour ce créneau.</p>
            </div>
            <div className="w-full bg-card rounded-2xl p-5 border-2 border-border text-left">
              <p className="text-sm text-muted-foreground">Date et heure</p>
              {!editing ? (
                <>
                  <p className="text-lg font-bold">{formatSchedule(request.scheduledAt!)}</p>
                  <button
                    type="button"
                    onClick={() => { setNewWhen(toLocalInput(request.scheduledAt!)); setEditing(true); }}
                    className="mt-2 text-sm font-bold text-primary underline"
                  >
                    ✏️ Modifier le rendez-vous
                  </button>
                </>
              ) : (
                <div className="flex flex-col gap-2 mt-1">
                  <input
                    type="datetime-local"
                    value={newWhen}
                    onChange={(e) => setNewWhen(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border-2 border-border bg-card text-base focus:border-primary outline-none"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditing(false)}
                      className="py-3 rounded-2xl border-2 border-border bg-card font-bold text-sm"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const ts = new Date(newWhen).getTime();
                        if (!Number.isNaN(ts)) {
                          store.updateRequest(request.id, { scheduledAt: ts });
                          setEditing(false);
                        }
                      }}
                      className="py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-sm"
                    >
                      Enregistrer
                    </button>
                  </div>
                </div>
              )}
              <p className="text-sm text-muted-foreground mt-3">Besoin</p>
              <p className="text-base font-semibold">{request.need.includes("/") ? request.need.replace("/", " / ") : request.need}</p>
            </div>
            <button onClick={onDone} className="text-base text-muted-foreground underline">Retour à l'accueil</button>
          </>
        ) : (
          <>
            <div className="relative h-32 w-32">
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
              <div className="absolute inset-4 rounded-full bg-primary/40 animate-pulse" />
              <div className="absolute inset-10 rounded-full bg-primary grid place-items-center text-3xl">📡</div>
            </div>
            <div>
              <p className="text-2xl font-bold">Recherche d'un étudiant à proximité…</p>
              <p className="text-base text-muted-foreground mt-2">Ne quittez pas cet écran.</p>
            </div>
            <p className="text-sm text-muted-foreground">Besoin : <b>{request.need.includes("/") ? request.need.replace("/", " / ") : request.need}</b></p>
          </>
        )
      ) : (
        <>
          <p className="text-lg font-bold text-success">✅ Un étudiant a accepté !</p>
          <div className="w-full bg-card rounded-3xl p-6 border-2 border-border shadow-sm">
            <img
              src={request.student!.photo}
              alt={request.student!.firstName}
              className="h-40 w-40 rounded-full mx-auto object-cover ring-4 ring-primary/30"
            />
            <p className="text-2xl font-bold mt-4">{request.student!.firstName}</p>
            <p className="text-lg text-warning-foreground mt-1">⭐ {request.student!.rating.toFixed(1)}/5</p>
            <p className="text-sm text-muted-foreground mt-1">Arrivée estimée : 10 min</p>
            <div className="mt-4 bg-warning/15 border-2 border-warning rounded-2xl p-3 text-left">
              <p className="text-sm font-bold">🔒 Vérifiez l'identité</p>
              <p className="text-sm text-muted-foreground mt-1">
                N'ouvrez la porte qu'à la personne montrée sur cette photo.
              </p>
            </div>
          </div>


          {!paid ? (
            <button onClick={() => setShowPay(true)} className="btn-huge bg-primary text-primary-foreground w-full">
              💳 Procéder au paiement — {total} €
            </button>
          ) : (
            <div className="w-full bg-success/10 border-2 border-success rounded-2xl p-4">
              <p className="text-lg font-bold text-success">✅ Paiement confirmé</p>
              <p className="text-sm text-muted-foreground mt-1">Reçu envoyé par SMS</p>
            </div>
          )}

          <a
            href={`tel:${request.student!.firstName}`}
            className="btn-huge bg-success text-success-foreground text-center w-full"
          >
            📞 Appeler l'étudiant
          </a>
          <button onClick={onDone} className="text-base text-muted-foreground underline">Terminer</button>
        </>
      )}
    </div>
  );
}

function PaymentScreen({ student, hours, onDone, onBack }: { student: string; hours: number; onDone: () => void; onBack: () => void }) {
  const [method, setMethod] = useState<"card" | "apple" | "paypal">("card");
  const [processing, setProcessing] = useState(false);
  const [card, setCard] = useState("");
  const [exp, setExp] = useState("");
  const [cvc, setCvc] = useState("");

  const pay = (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    setTimeout(() => onDone(), 1500);
  };

  return (
    <form onSubmit={pay} className="flex-1 flex flex-col px-5 py-6 gap-5">
      <button type="button" onClick={onBack} className="text-base text-muted-foreground text-left">← Retour</button>
      <div>
        <h2 className="text-2xl font-black">Paiement</h2>
        <p className="text-base text-muted-foreground mt-1">Mission acceptée par {student}</p>
      </div>

      <div className="bg-card rounded-2xl p-5 border-2 border-border">
        <div className="flex justify-between text-base">
          <span className="text-muted-foreground">Intervention ({hours}h × 12€)</span>
          <span className="font-semibold">{(12 * hours).toFixed(2).replace(".", ",")} €</span>
        </div>
        <div className="flex justify-between text-base mt-2">
          <span className="text-muted-foreground">Frais de service</span>
          <span className="font-semibold">3,00 €</span>
        </div>
        <div className="h-px bg-border my-3" />
        <div className="flex justify-between text-xl font-black">
          <span>Total</span>
          <span>{(12 * hours + 3).toFixed(2).replace(".", ",")} €</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {([
          { v: "card" as const, label: "💳 Carte" },
          { v: "apple" as const, label: " Pay" },
          { v: "paypal" as const, label: "PayPal" },
        ]).map((m) => (
          <button
            key={m.v}
            type="button"
            onClick={() => setMethod(m.v)}
            className={`py-3 rounded-2xl border-2 text-sm font-semibold ${
              method === m.v ? "border-primary bg-accent" : "border-border bg-card"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {method === "card" ? (
        <div className="flex flex-col gap-3">
          <input
            value={card}
            onChange={(e) => setCard(e.target.value)}
            placeholder="Numéro de carte"
            inputMode="numeric"
            required
            className="w-full px-5 py-4 rounded-2xl border-2 border-border bg-card text-lg focus:border-primary outline-none"
          />
          <div className="grid grid-cols-2 gap-3">
            <input value={exp} onChange={(e) => setExp(e.target.value)} placeholder="MM/AA" required className="px-5 py-4 rounded-2xl border-2 border-border bg-card text-lg focus:border-primary outline-none" />
            <input value={cvc} onChange={(e) => setCvc(e.target.value)} placeholder="CVC" required className="px-5 py-4 rounded-2xl border-2 border-border bg-card text-lg focus:border-primary outline-none" />
          </div>
        </div>
      ) : (
        <div className="bg-accent rounded-2xl p-4 text-sm text-center">
          Vous serez redirigé vers {method === "apple" ? "Apple Pay" : "PayPal"} pour valider.
        </div>
      )}

      <div className="flex-1" />
      <button type="submit" disabled={processing} className="btn-huge bg-success text-success-foreground disabled:opacity-60">
        {processing ? "Traitement…" : `Payer ${(12 * hours + 3).toFixed(2).replace(".", ",")} €`}
      </button>
      <p className="text-xs text-muted-foreground text-center">🔒 Paiement sécurisé — démo</p>
    </form>
  );
}

/* ---------------- STUDENT ---------------- */

type EnrollStatus = "none" | "pending" | "approved" | "rejected";
type EnrollProfile = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  school: string;
  city: string;
  motivation: string;
  selfie?: string;
  docs: { idCard?: string; studentCard?: string; criminalRecord?: string; iban?: string };
};

type Application = {
  id: string;
  submittedAt: number;
  status: "pending" | "approved" | "rejected";
  reviewedAt?: number;
  rejectReason?: string;
  profile: EnrollProfile;
};

const APPS_KEY = "sos-applications";
const ENROLL_KEY = "sos-enroll";

function loadApplications(): Application[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(APPS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}
function saveApplications(list: Application[]) {
  try {
    localStorage.setItem(APPS_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event("sos-apps-changed"));
  } catch {}
}
function useApplications(): Application[] {
  const [apps, setApps] = useState<Application[]>(() => loadApplications());
  useEffect(() => {
    const refresh = () => setApps(loadApplications());
    window.addEventListener("storage", refresh);
    window.addEventListener("sos-apps-changed", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("sos-apps-changed", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  return apps;
}

function loadEnroll(): { status: EnrollStatus; profile?: EnrollProfile; appId?: string } {
  if (typeof window === "undefined") return { status: "none" };
  try {
    const raw = localStorage.getItem(ENROLL_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { status: "none" };
}

function StudentFlow() {
  const [enroll, setEnroll] = useState<{ status: EnrollStatus; profile?: EnrollProfile; appId?: string }>(() => loadEnroll());
  const apps = useApplications();
  const [online, setOnline] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const requests = useStore((s) => s.requests.filter((r) => r.status === "searching"));
  const active = useStore((s) => (openId ? s.requests.find((r) => r.id === openId) : undefined));

  // Sync enroll state with admin's decision on this candidate
  useEffect(() => {
    if (!enroll.appId) return;
    const app = apps.find((a) => a.id === enroll.appId);
    if (!app) return;
    const nextStatus: EnrollStatus =
      app.status === "approved" ? "approved" : app.status === "rejected" ? "rejected" : "pending";
    if (nextStatus !== enroll.status) {
      const next = { ...enroll, status: nextStatus };
      setEnroll(next);
      try { localStorage.setItem(ENROLL_KEY, JSON.stringify(next)); } catch {}
    }
  }, [apps, enroll]);

  const saveEnroll = (next: { status: EnrollStatus; profile?: EnrollProfile; appId?: string }) => {
    setEnroll(next);
    try { localStorage.setItem(ENROLL_KEY, JSON.stringify(next)); } catch {}
  };

  if (enroll.status !== "approved") {
    return <StudentEnroll enroll={enroll} onChange={saveEnroll} />;
  }


  if (active) return <StudentDetail request={active} onBack={() => setOpenId(null)} />;

  return (
    <div className="flex-1 flex flex-col px-5 py-6 gap-5">
      <button
        onClick={() => setOnline((v) => !v)}
        className={`btn-huge ${online ? "bg-success text-success-foreground" : "bg-muted text-foreground"}`}
      >
        <span className="flex items-center justify-center gap-3">
          <span className={`h-3 w-3 rounded-full ${online ? "bg-white animate-pulse" : "bg-muted-foreground"}`} />
          {online ? "En ligne — disponible" : "Hors ligne"}
        </span>
      </button>

      {online ? (
        <>
          <h2 className="text-xl font-bold mt-2">Demandes actives ({requests.length})</h2>
          <div className="flex flex-col gap-3">
            {requests.length === 0 && (
              <p className="text-muted-foreground text-center py-10">Aucune demande pour le moment.</p>
            )}
            {requests.map((r) => {
              const scheduled = !!r.scheduledAt;
              return (
                <button
                  key={r.id}
                  onClick={() => setOpenId(r.id)}
                  className="text-left bg-card rounded-2xl p-5 border-2 border-border hover:border-primary transition-all"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <p className="text-lg font-bold">{r.need.includes("/") ? r.need.replace("/", " / ") : r.need}</p>
                      <p className="text-base text-muted-foreground mt-1">📍 {r.city}</p>
                      {(r.need === "Compagnie/Présence" || r.need === "Accompagnement sorties extérieures") && r.durationHours && r.durationHours > 1 && (
                        <p className="text-sm mt-1 font-semibold">⏱️ Durée : {r.durationHours}h</p>
                      )}
                      {r.need === "Retrait ou dépôt d'un colis" && (
                        <p className="text-sm mt-1 font-semibold">📦 {r.parcelWeight} · {r.parcelSize}</p>
                      )}
                      {scheduled && (
                        <p className="text-sm mt-2 font-semibold">🗓️ {formatSchedule(r.scheduledAt!)}</p>
                      )}
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full shrink-0 ${scheduled ? "bg-accent text-foreground" : "bg-primary/10 text-primary"}`}>
                      {scheduled ? "RDV" : "URGENT"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <p className="text-center text-muted-foreground py-10">
          Passez en ligne pour voir les demandes d'urgence près de vous.
        </p>
      )}
    </div>
  );
}

function StudentDetail({ request, onBack }: { request: Request; onBack: () => void }) {
  const accepted = request.status === "accepted";
  const accept = () => store.acceptRequest(request.id);

  return (
    <div className="flex-1 flex flex-col px-5 py-6 gap-5">
      <button onClick={onBack} className="text-base text-muted-foreground text-left">← Retour</button>
      <div className="bg-card rounded-3xl p-6 border-2 border-border">
        <p className="text-sm text-muted-foreground uppercase tracking-wide font-bold">Besoin</p>
        <p className="text-2xl font-bold mt-1">{request.need.includes("/") ? request.need.replace("/", " / ") : request.need}</p>
        {(request.need === "Compagnie/Présence" || request.need === "Accompagnement sorties extérieures") && request.durationHours && request.durationHours > 1 && (
          <p className="text-base font-semibold mt-2">⏱️ Durée demandée : {request.durationHours}h</p>
        )}
        {request.need === "Retrait ou dépôt d'un colis" && (
          <div className="mt-3 bg-accent rounded-xl p-3">
            <p className="text-xs text-muted-foreground font-bold uppercase">Colis</p>
            <p className="text-base font-semibold mt-1">⚖️ Poids : {request.parcelWeight}</p>
            <p className="text-base font-semibold mt-1">📦 Taille : {request.parcelSize}</p>
          </div>
        )}
        <p className="text-base text-muted-foreground mt-3">📍 {request.city}</p>
        {request.scheduledAt ? (
          <div className="mt-3 bg-accent rounded-xl p-3">
            <p className="text-xs text-muted-foreground font-bold uppercase">Rendez-vous</p>
            <p className="text-base font-semibold mt-1">🗓️ {formatSchedule(request.scheduledAt)}</p>
          </div>
        ) : (
          <div className="mt-3 inline-block bg-primary/10 text-primary text-xs font-bold px-2 py-1 rounded-full">
            🆘 URGENCE — au plus vite
          </div>
        )}
      </div>

      {!accepted ? (
        <>
          <div className="bg-accent rounded-2xl p-4 text-sm">
            L'adresse exacte et le téléphone seront révélés après acceptation.
          </div>
          <div className="flex-1" />
          <button onClick={accept} className="btn-huge bg-success text-success-foreground">
            ✅ Accepter la mission
          </button>
        </>
      ) : (
        <>
          <div className="bg-card rounded-3xl p-6 border-2 border-success">
            <p className="text-sm text-success font-bold uppercase tracking-wide">Mission acceptée</p>
            <div className="mt-4">
              <p className="text-sm text-muted-foreground">Adresse</p>
              <p className="text-lg font-semibold">{request.address}</p>
            </div>
            <div className="mt-4">
              <p className="text-sm text-muted-foreground">Téléphone</p>
              <p className="text-lg font-semibold">{request.phone}</p>
            </div>
          </div>
          <a href={`tel:${request.phone}`} className="btn-huge bg-success text-success-foreground text-center">
            📞 Appeler la famille
          </a>
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(request.address)}`}
            target="_blank"
            rel="noreferrer"
            className="btn-huge bg-primary text-primary-foreground text-center"
          >
            🗺️ Itinéraire
          </a>
        </>
      )}
    </div>
  );
}

/* ---------------- STUDENT ENROLLMENT ---------------- */

function StudentEnroll({
  enroll,
  onChange,
}: {
  enroll: { status: EnrollStatus; profile?: EnrollProfile; appId?: string };
  onChange: (n: { status: EnrollStatus; profile?: EnrollProfile; appId?: string }) => void;
}) {
  const [step, setStep] = useState<"intro" | "form">("intro");
  const [p, setP] = useState<EnrollProfile>(
    enroll.profile ?? {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      school: "",
      city: "",
      motivation: "",
      docs: {},
    },
  );

  const apps = useApplications();
  const myApp = enroll.appId ? apps.find((a) => a.id === enroll.appId) : undefined;

  if (enroll.status === "rejected") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 gap-5 text-center">
        <div className="text-6xl">❌</div>
        <h2 className="text-2xl font-black">Candidature refusée</h2>
        <p className="text-base text-muted-foreground">
          Malheureusement votre dossier n'a pas été retenu.
        </p>
        {myApp?.rejectReason && (
          <div className="w-full bg-destructive/10 border-2 border-destructive/40 rounded-2xl p-4 text-left">
            <p className="text-sm font-bold text-destructive">Motif</p>
            <p className="text-sm mt-1">{myApp.rejectReason}</p>
          </div>
        )}
        <button
          onClick={() => onChange({ status: "none" })}
          className="btn-huge bg-primary text-primary-foreground"
        >
          Refaire une candidature
        </button>
      </div>
    );
  }

  if (enroll.status === "pending") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 gap-5 text-center">
        <div className="text-6xl">📨</div>
        <h2 className="text-2xl font-black">Dossier envoyé !</h2>
        <p className="text-base text-muted-foreground">
          Un administrateur vérifie vos documents. Vous serez notifié dès la validation.
        </p>
        <div className="w-full bg-card border-2 border-border rounded-2xl p-5 text-left">
          <p className="text-sm text-muted-foreground">Candidat</p>
          <p className="text-lg font-bold">{enroll.profile?.firstName} {enroll.profile?.lastName}</p>
          <p className="text-sm text-muted-foreground mt-2">École</p>
          <p className="text-base">{enroll.profile?.school}</p>
          <p className="text-sm text-muted-foreground mt-2">Statut</p>
          <p className="text-base font-semibold text-warning-foreground">⏳ En attente de vérification</p>
        </div>
        <button
          onClick={() => onChange({ status: "none" })}
          className="text-sm text-muted-foreground underline"
        >
          Modifier ma candidature
        </button>
      </div>
    );
  }


  if (step === "intro") {
    return (
      <div className="flex-1 flex flex-col px-6 py-8 gap-5">
        <div className="text-center">
          <div className="text-5xl mb-2">🎓</div>
          <h2 className="text-2xl font-black">Devenir étudiant SOS</h2>
          <p className="text-base text-muted-foreground mt-2">
            Aidez des seniors près de chez vous et gagnez un revenu complémentaire.
          </p>
        </div>
        <div className="bg-card border-2 border-border rounded-2xl p-5">
          <p className="font-bold mb-3">Conditions</p>
          <ul className="space-y-2 text-sm">
            <li>✓ Être étudiant (18 ans et +)</li>
            <li>✓ Pièce d'identité valide</li>
            <li>✓ Carte étudiante en cours</li>
            <li>✓ Extrait de casier judiciaire (bulletin n°3)</li>
            <li>✓ RIB pour les paiements</li>
          </ul>
        </div>
        <div className="flex-1" />
        <button onClick={() => setStep("form")} className="btn-huge bg-primary text-primary-foreground">
          Commencer ma candidature
        </button>
      </div>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = `app-${Date.now()}`;
    const app: Application = {
      id,
      submittedAt: Date.now(),
      status: "pending",
      profile: p,
    };
    const list = loadApplications();
    saveApplications([app, ...list]);
    onChange({ status: "pending", profile: p, appId: id });
  };


  const setDoc = (key: keyof EnrollProfile["docs"]) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setP({ ...p, docs: { ...p.docs, [key]: f.name } });
  };

  const docs: { k: keyof EnrollProfile["docs"]; label: string; icon: string }[] = [
    { k: "idCard", label: "Pièce d'identité", icon: "🪪" },
    { k: "studentCard", label: "Carte étudiante", icon: "🎓" },
    { k: "criminalRecord", label: "Casier judiciaire (B3)", icon: "📄" },
    { k: "iban", label: "RIB", icon: "🏦" },
  ];

  const allDocs = docs.every((d) => p.docs[d.k]);
  const valid = p.firstName && p.lastName && p.email && p.phone && p.school && p.city && p.selfie && allDocs;

  const setSelfie = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setP({ ...p, selfie: typeof reader.result === "string" ? reader.result : undefined });
    reader.readAsDataURL(f);
  };


  return (
    <form onSubmit={submit} className="flex-1 flex flex-col px-5 py-6 gap-4">
      <button type="button" onClick={() => setStep("intro")} className="text-base text-muted-foreground text-left">
        ← Retour
      </button>
      <h2 className="text-xl font-black">Ma candidature</h2>

      <div className="grid grid-cols-2 gap-3">
        <input required placeholder="Prénom" value={p.firstName} onChange={(e) => setP({ ...p, firstName: e.target.value })} className="px-4 py-3 rounded-2xl border-2 border-border bg-card focus:border-primary outline-none" />
        <input required placeholder="Nom" value={p.lastName} onChange={(e) => setP({ ...p, lastName: e.target.value })} className="px-4 py-3 rounded-2xl border-2 border-border bg-card focus:border-primary outline-none" />
      </div>
      <input required type="email" placeholder="Email" value={p.email} onChange={(e) => setP({ ...p, email: e.target.value })} className="px-4 py-3 rounded-2xl border-2 border-border bg-card focus:border-primary outline-none" />
      <input required type="tel" placeholder="Téléphone" value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} className="px-4 py-3 rounded-2xl border-2 border-border bg-card focus:border-primary outline-none" />
      <input required placeholder="École / université" value={p.school} onChange={(e) => setP({ ...p, school: e.target.value })} className="px-4 py-3 rounded-2xl border-2 border-border bg-card focus:border-primary outline-none" />
      <input required placeholder="Ville" value={p.city} onChange={(e) => setP({ ...p, city: e.target.value })} className="px-4 py-3 rounded-2xl border-2 border-border bg-card focus:border-primary outline-none" />
      <textarea placeholder="Pourquoi voulez-vous rejoindre SOS Étudiants ?" value={p.motivation} onChange={(e) => setP({ ...p, motivation: e.target.value })} rows={3} className="px-4 py-3 rounded-2xl border-2 border-border bg-card focus:border-primary outline-none resize-none" />

      <div className="mt-2">
        <p className="font-bold mb-2">Photo / Selfie</p>
        <p className="text-xs text-muted-foreground mb-2">
          Cette photo sera montrée à la famille pour qu'elle vous reconnaisse à la porte. Visage bien visible, sans lunettes de soleil ni casquette.
        </p>
        <label className={`flex items-center gap-4 p-3 rounded-2xl border-2 cursor-pointer ${p.selfie ? "border-success bg-success/5" : "border-border bg-card"}`}>
          {p.selfie ? (
            <img src={p.selfie} alt="Selfie" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <span className="h-16 w-16 rounded-full bg-muted grid place-items-center text-2xl">📸</span>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{p.selfie ? "Photo enregistrée" : "Prendre un selfie"}</p>
            <p className="text-xs text-muted-foreground">{p.selfie ? "Appuyez pour changer" : "Utilise la caméra frontale"}</p>
          </div>
          <input type="file" accept="image/*" capture="user" className="hidden" onChange={setSelfie} />
        </label>
      </div>


      <div className="mt-2">
        <p className="font-bold mb-2">Documents à fournir</p>
        <div className="flex flex-col gap-2">
          {docs.map((d) => (
            <label key={d.k} className={`flex items-center gap-3 p-3 rounded-2xl border-2 cursor-pointer ${p.docs[d.k] ? "border-success bg-success/5" : "border-border bg-card"}`}>
              <span className="text-2xl">{d.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{d.label}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {p.docs[d.k] ? `✓ ${p.docs[d.k]}` : "Aucun fichier"}
                </p>
              </div>
              <span className="text-xs font-bold text-primary">{p.docs[d.k] ? "Modifier" : "Ajouter"}</span>
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={setDoc(d.k)} />
            </label>
          ))}
        </div>
      </div>

      <button type="submit" disabled={!valid} className="btn-huge bg-primary text-primary-foreground disabled:opacity-50 mt-2">
        Envoyer ma candidature
      </button>
      <p className="text-xs text-muted-foreground text-center">🔒 Vos documents sont traités confidentiellement.</p>
    </form>
  );
}

/* ---------------- ADMIN ---------------- */

const ADMIN_PASSWORD = "admin2026";
const ADMIN_SESSION_KEY = "sos-admin-auth";

function AdminFlow() {
  const [authed, setAuthed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(ADMIN_SESSION_KEY) === "1";
  });

  if (!authed) return <AdminLogin onOk={() => {
    try { sessionStorage.setItem(ADMIN_SESSION_KEY, "1"); } catch {}
    setAuthed(true);
  }} />;

  return <AdminDashboard onLogout={() => {
    try { sessionStorage.removeItem(ADMIN_SESSION_KEY); } catch {}
    setAuthed(false);
  }} />;
}

function AdminLogin({ onOk }: { onOk: () => void }) {
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState(false);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd === ADMIN_PASSWORD) onOk();
    else setErr(true);
  };
  return (
    <form onSubmit={submit} className="flex-1 flex flex-col items-center justify-center px-6 py-10 gap-5 text-center">
      <div className="text-6xl">🛡️</div>
      <h2 className="text-2xl font-black">Espace administrateur</h2>
      <p className="text-sm text-muted-foreground">Réservé à l'équipe SOS Étudiants — vérification des candidatures.</p>
      <input
        type="password"
        autoFocus
        value={pwd}
        onChange={(e) => { setPwd(e.target.value); setErr(false); }}
        placeholder="Mot de passe"
        className="w-full px-5 py-4 rounded-2xl border-2 border-border bg-card text-lg text-center focus:border-primary outline-none"
      />
      {err && <p className="text-sm text-destructive">Mot de passe incorrect</p>}
      <button type="submit" className="btn-huge bg-primary text-primary-foreground w-full">Se connecter</button>
      <p className="text-xs text-muted-foreground">Démo : le mot de passe est <b>admin2026</b></p>
    </form>
  );
}

function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const apps = useApplications();
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = apps.filter((a) => filter === "all" || a.status === filter);
  const opened = openId ? apps.find((a) => a.id === openId) : undefined;

  if (opened) return <AdminApplicationDetail app={opened} onBack={() => setOpenId(null)} />;

  const counts = {
    pending: apps.filter((a) => a.status === "pending").length,
    approved: apps.filter((a) => a.status === "approved").length,
    rejected: apps.filter((a) => a.status === "rejected").length,
  };

  return (
    <div className="flex-1 flex flex-col px-5 py-5 gap-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black">Candidatures</h2>
          <p className="text-xs text-muted-foreground">Vérification et validation des étudiants</p>
        </div>
        <button onClick={onLogout} className="text-xs text-muted-foreground underline">Déconnexion</button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-warning/10 border-2 border-warning/40 rounded-2xl p-3 text-center">
          <p className="text-2xl font-black">{counts.pending}</p>
          <p className="text-xs text-muted-foreground">En attente</p>
        </div>
        <div className="bg-success/10 border-2 border-success/40 rounded-2xl p-3 text-center">
          <p className="text-2xl font-black">{counts.approved}</p>
          <p className="text-xs text-muted-foreground">Validés</p>
        </div>
        <div className="bg-destructive/10 border-2 border-destructive/40 rounded-2xl p-3 text-center">
          <p className="text-2xl font-black">{counts.rejected}</p>
          <p className="text-xs text-muted-foreground">Refusés</p>
        </div>
      </div>

      <div className="flex gap-1 bg-muted p-1 rounded-2xl">
        {(["pending", "approved", "rejected", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold ${filter === f ? "bg-background shadow-sm" : "text-muted-foreground"}`}
          >
            {f === "pending" ? "En attente" : f === "approved" ? "Validés" : f === "rejected" ? "Refusés" : "Tous"}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-10 text-sm">Aucune candidature.</p>
        )}
        {filtered.map((a) => (
          <button
            key={a.id}
            onClick={() => setOpenId(a.id)}
            className="text-left bg-card rounded-2xl p-4 border-2 border-border hover:border-primary transition-all flex items-center gap-3"
          >
            {a.profile.selfie ? (
              <img src={a.profile.selfie} alt="" className="h-14 w-14 rounded-full object-cover" />
            ) : (
              <div className="h-14 w-14 rounded-full bg-muted grid place-items-center text-xl">👤</div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-bold truncate">{a.profile.firstName} {a.profile.lastName}</p>
              <p className="text-xs text-muted-foreground truncate">{a.profile.school} — {a.profile.city}</p>
            </div>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${
              a.status === "pending" ? "bg-warning/20 text-warning-foreground" :
              a.status === "approved" ? "bg-success/20 text-success" :
              "bg-destructive/20 text-destructive"
            }`}>
              {a.status === "pending" ? "EN ATTENTE" : a.status === "approved" ? "VALIDÉ" : "REFUSÉ"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function AdminApplicationDetail({ app, onBack }: { app: Application; onBack: () => void }) {
  const [reason, setReason] = useState("");
  const [showReject, setShowReject] = useState(false);

  const update = (patch: Partial<Application>) => {
    const list = loadApplications().map((a) => (a.id === app.id ? { ...a, ...patch, reviewedAt: Date.now() } : a));
    saveApplications(list);
    onBack();
  };

  const docs: { k: keyof EnrollProfile["docs"]; label: string; icon: string }[] = [
    { k: "idCard", label: "Pièce d'identité", icon: "🪪" },
    { k: "studentCard", label: "Carte étudiante", icon: "🎓" },
    { k: "criminalRecord", label: "Casier judiciaire (B3)", icon: "📄" },
    { k: "iban", label: "RIB", icon: "🏦" },
  ];

  return (
    <div className="flex-1 flex flex-col px-5 py-5 gap-4">
      <button onClick={onBack} className="text-sm text-muted-foreground text-left">← Retour</button>

      <div className="bg-card rounded-3xl p-5 border-2 border-border flex flex-col items-center text-center">
        {app.profile.selfie ? (
          <img src={app.profile.selfie} alt="" className="h-32 w-32 rounded-full object-cover ring-4 ring-primary/30" />
        ) : (
          <div className="h-32 w-32 rounded-full bg-muted grid place-items-center text-4xl">👤</div>
        )}
        <p className="text-xl font-black mt-3">{app.profile.firstName} {app.profile.lastName}</p>
        <p className="text-sm text-muted-foreground">Candidature du {new Date(app.submittedAt).toLocaleDateString("fr-FR")}</p>
        <span className={`mt-2 text-xs font-bold px-3 py-1 rounded-full ${
          app.status === "pending" ? "bg-warning/20 text-warning-foreground" :
          app.status === "approved" ? "bg-success/20 text-success" :
          "bg-destructive/20 text-destructive"
        }`}>
          {app.status === "pending" ? "EN ATTENTE" : app.status === "approved" ? "VALIDÉ" : "REFUSÉ"}
        </span>
      </div>

      <div className="bg-card rounded-2xl p-4 border-2 border-border space-y-2 text-sm">
        <Row label="Email" value={app.profile.email} />
        <Row label="Téléphone" value={app.profile.phone} />
        <Row label="École" value={app.profile.school} />
        <Row label="Ville" value={app.profile.city} />
        {app.profile.motivation && <Row label="Motivation" value={app.profile.motivation} />}
      </div>

      <div>
        <p className="font-bold text-sm mb-2">Documents fournis</p>
        <div className="flex flex-col gap-2">
          {docs.map((d) => (
            <div key={d.k} className={`flex items-center gap-3 p-3 rounded-2xl border-2 ${app.profile.docs[d.k] ? "border-success/40 bg-success/5" : "border-destructive/40 bg-destructive/5"}`}>
              <span className="text-xl">{d.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{d.label}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {app.profile.docs[d.k] ? `✓ ${app.profile.docs[d.k]}` : "❌ Manquant"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {app.status === "rejected" && app.rejectReason && (
        <div className="bg-destructive/10 border-2 border-destructive/40 rounded-2xl p-3 text-sm">
          <p className="font-bold text-destructive">Motif du refus</p>
          <p className="mt-1">{app.rejectReason}</p>
        </div>
      )}

      {app.status === "pending" && !showReject && (
        <div className="flex flex-col gap-2 mt-2">
          <button onClick={() => update({ status: "approved" })} className="btn-huge bg-success text-success-foreground">
            ✅ Valider la candidature
          </button>
          <button onClick={() => setShowReject(true)} className="btn-huge bg-destructive text-white">
            ❌ Refuser
          </button>
        </div>
      )}

      {app.status === "pending" && showReject && (
        <div className="flex flex-col gap-2 mt-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Motif du refus (visible par le candidat)"
            className="w-full px-4 py-3 rounded-2xl border-2 border-border bg-card text-sm focus:border-primary outline-none resize-none"
          />
          <button
            disabled={!reason.trim()}
            onClick={() => update({ status: "rejected", rejectReason: reason.trim() })}
            className="btn-huge bg-destructive text-white disabled:opacity-50"
          >
            Confirmer le refus
          </button>
          <button onClick={() => setShowReject(false)} className="text-sm text-muted-foreground underline">
            Annuler
          </button>
        </div>
      )}

      {app.status !== "pending" && (
        <button
          onClick={() => update({ status: "pending", rejectReason: undefined })}
          className="text-sm text-muted-foreground underline mt-2"
        >
          Remettre en attente
        </button>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold break-words">{value}</p>
    </div>
  );
}

