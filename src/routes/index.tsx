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
  const [paid, setPaid] = useState(false);
  const [showPay, setShowPay] = useState(false);
  if (!request) return null;
  const accepted = request.status === "accepted" && request.student;

  if (accepted && showPay && !paid) {
    return (
      <PaymentScreen
        student={request.student!.firstName}
        onDone={() => { setPaid(true); setShowPay(false); }}
        onBack={() => setShowPay(false)}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 gap-6 text-center">
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
              💳 Procéder au paiement — 15 €
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

function PaymentScreen({ student, onDone, onBack }: { student: string; onDone: () => void; onBack: () => void }) {
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
          <span className="text-muted-foreground">Intervention</span>
          <span className="font-semibold">12,00 €</span>
        </div>
        <div className="flex justify-between text-base mt-2">
          <span className="text-muted-foreground">Frais de service</span>
          <span className="font-semibold">3,00 €</span>
        </div>
        <div className="h-px bg-border my-3" />
        <div className="flex justify-between text-xl font-black">
          <span>Total</span>
          <span>15,00 €</span>
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
        {processing ? "Traitement…" : "Payer 15,00 €"}
      </button>
      <p className="text-xs text-muted-foreground text-center">🔒 Paiement sécurisé — démo</p>
    </form>
  );
}

/* ---------------- STUDENT ---------------- */

type EnrollStatus = "none" | "pending" | "approved";
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


function loadEnroll(): { status: EnrollStatus; profile?: EnrollProfile } {
  if (typeof window === "undefined") return { status: "none" };
  try {
    const raw = localStorage.getItem("sos-enroll");
    if (raw) return JSON.parse(raw);
  } catch {}
  return { status: "none" };
}

function StudentFlow() {
  const [enroll, setEnroll] = useState<{ status: EnrollStatus; profile?: EnrollProfile }>(() => loadEnroll());
  const [online, setOnline] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const requests = useStore((s) => s.requests.filter((r) => r.status === "searching"));
  const active = useStore((s) => (openId ? s.requests.find((r) => r.id === openId) : undefined));

  const saveEnroll = (next: { status: EnrollStatus; profile?: EnrollProfile }) => {
    setEnroll(next);
    try { localStorage.setItem("sos-enroll", JSON.stringify(next)); } catch {}
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

/* ---------------- STUDENT ENROLLMENT ---------------- */

function StudentEnroll({
  enroll,
  onChange,
}: {
  enroll: { status: EnrollStatus; profile?: EnrollProfile };
  onChange: (n: { status: EnrollStatus; profile?: EnrollProfile }) => void;
}) {
  const [step, setStep] = useState<"intro" | "form">(enroll.status === "pending" ? "intro" : "intro");
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

  if (enroll.status === "pending") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 gap-5 text-center">
        <div className="text-6xl">📨</div>
        <h2 className="text-2xl font-black">Dossier envoyé !</h2>
        <p className="text-base text-muted-foreground">
          Nous vérifions vos documents. Vous recevrez une réponse par email sous 48h.
        </p>
        <div className="w-full bg-card border-2 border-border rounded-2xl p-5 text-left">
          <p className="text-sm text-muted-foreground">Candidat</p>
          <p className="text-lg font-bold">{enroll.profile?.firstName} {enroll.profile?.lastName}</p>
          <p className="text-sm text-muted-foreground mt-2">École</p>
          <p className="text-base">{enroll.profile?.school}</p>
        </div>
        <button
          onClick={() => onChange({ status: "approved", profile: enroll.profile })}
          className="btn-huge bg-success text-success-foreground"
        >
          ✅ Simuler la validation (démo)
        </button>
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
    onChange({ status: "pending", profile: p });
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

