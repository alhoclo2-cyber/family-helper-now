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

type Mode = "family" | "student";

function App() {
  const [mode, setMode] = useState<Mode>("family");
  return (
    <div className="min-h-screen bg-background flex justify-center">
      <div className="w-full max-w-[440px] min-h-screen flex flex-col bg-background shadow-xl">
        <Header mode={mode} setMode={setMode} />
        <main className="flex-1 flex flex-col">
          {mode === "family" ? <FamilyFlow /> : <StudentFlow />}
        </main>
      </div>
    </div>
  );
}

function Header({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  return (
    <header className="px-5 pt-6 pb-4 border-b border-border">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-10 w-10 rounded-2xl bg-primary grid place-items-center text-primary-foreground text-xl font-black">S</div>
        <div>
          <h1 className="text-xl font-black leading-none">SOS Étudiants</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Aide d'urgence à proximité</p>
        </div>
      </div>
      <div className="grid grid-cols-2 rounded-2xl bg-muted p-1">
        {(["family", "student"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`py-3 rounded-xl text-base font-semibold transition-all ${
              mode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {m === "family" ? "👵 Famille" : "🎓 Étudiant"}
          </button>
        ))}
      </div>
    </header>
  );
}

/* ---------------- FAMILY ---------------- */

function FamilyFlow() {
  const [step, setStep] = useState<"home" | "form" | "wait">("home");
  const currentId = useStore((s) => s.currentRequestId);
  const current = useStore((s) => s.requests.find((r) => r.id === s.currentRequestId));

  useEffect(() => {
    if (step === "wait" && current?.status === "searching" && currentId) {
      const t = setTimeout(() => store.acceptRequest(currentId, Math.floor(Math.random() * 3)), 3500);
      return () => clearTimeout(t);
    }
  }, [step, current?.status, currentId]);

  if (step === "home")
    return (
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-10 gap-8">
        <div className="text-center">
          <p className="text-lg text-muted-foreground">Besoin d'aide maintenant ?</p>
          <p className="text-base text-muted-foreground mt-1">Un étudiant proche viendra vous aider.</p>
        </div>
        <button
          onClick={() => setStep("form")}
          className="btn-huge bg-primary text-primary-foreground hover:brightness-110 min-h-[220px] flex flex-col items-center justify-center gap-3"
        >
          <span className="text-6xl">🆘</span>
          <span>Déclarer une urgence</span>
        </button>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          En cas d'urgence vitale, composez le <span className="font-bold text-foreground">15</span> (SAMU).
        </p>
      </div>
    );

  if (step === "form")
    return <FamilyForm onSubmit={() => setStep("wait")} onBack={() => setStep("home")} />;

  return <FamilyWait request={current} onDone={() => { store.clearCurrent(); setStep("home"); }} />;
}

function FamilyForm({ onSubmit, onBack }: { onSubmit: () => void; onBack: () => void }) {
  const [need, setNeed] = useState<NeedType>("Compagnie/Présence");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const needs: { v: NeedType; icon: string }[] = [
    { v: "Compagnie/Présence", icon: "🤝" },
    { v: "Courses urgentes", icon: "🛒" },
    { v: "Pharmacie", icon: "💊" },
    { v: "Aide au repas", icon: "🍽️" },
  ];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim() || !phone.trim()) return;
    store.createRequest({ need, address, phone });
    onSubmit();
  };

  return (
    <form onSubmit={submit} className="flex-1 flex flex-col px-5 py-6 gap-6">
      <button type="button" onClick={onBack} className="text-base text-muted-foreground text-left">← Retour</button>
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
              <div className="text-base font-semibold leading-tight">{n.v}</div>
            </button>
          ))}
        </div>
      </div>
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
        Lancer la recherche
      </button>
    </form>
  );
}

function FamilyWait({ request, onDone }: { request: Request | undefined; onDone: () => void }) {
  if (!request) return null;
  const accepted = request.status === "accepted" && request.student;

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 gap-8 text-center">
      {!accepted ? (
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
          <p className="text-sm text-muted-foreground">Besoin : <b>{request.need}</b></p>
        </>
      ) : (
        <>
          <p className="text-lg font-bold text-success">✅ Un étudiant a accepté !</p>
          <div className="w-full bg-card rounded-3xl p-6 border-2 border-border shadow-sm">
            <img src={request.student!.photo} alt={request.student!.firstName} className="h-28 w-28 rounded-full mx-auto object-cover" />
            <p className="text-2xl font-bold mt-4">{request.student!.firstName}</p>
            <p className="text-lg text-warning-foreground mt-1">⭐ {request.student!.rating.toFixed(1)}/5</p>
            <p className="text-sm text-muted-foreground mt-1">Arrivée estimée : 10 min</p>
          </div>
          <a
            href={`tel:${request.student!.firstName}`}
            className="btn-huge bg-success text-success-foreground text-center"
          >
            📞 Appeler l'étudiant
          </a>
          <button onClick={onDone} className="text-base text-muted-foreground underline">Terminer</button>
        </>
      )}
    </div>
  );
}

/* ---------------- STUDENT ---------------- */

function StudentFlow() {
  const [online, setOnline] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const requests = useStore((s) => s.requests.filter((r) => r.status === "searching"));
  const active = useStore((s) => (openId ? s.requests.find((r) => r.id === openId) : undefined));

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
            {requests.map((r) => (
              <button
                key={r.id}
                onClick={() => setOpenId(r.id)}
                className="text-left bg-card rounded-2xl p-5 border-2 border-border hover:border-primary transition-all"
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-bold">{r.need}</p>
                    <p className="text-base text-muted-foreground mt-1">📍 {r.city}</p>
                  </div>
                  <span className="text-xs bg-primary/10 text-primary font-bold px-2 py-1 rounded-full shrink-0">
                    URGENT
                  </span>
                </div>
              </button>
            ))}
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
        <p className="text-2xl font-bold mt-1">{request.need}</p>
        <p className="text-base text-muted-foreground mt-3">📍 {request.city}</p>
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
