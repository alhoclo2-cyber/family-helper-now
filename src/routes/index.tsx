import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAccess, useSession } from "@/lib/auth";
import { AuthCard } from "@/components/AuthCard";
import { store, useStore, randomStudent, COMPANIONS, experienceBadge, type NeedType, type Request } from "@/lib/store";
import { CguAcceptBlock, CguPanel } from "@/components/Cgu";
import { CesuRecurrenceModal } from "@/components/CesuRecurrence";
import {
  CompanionProfileHeader,
  ExperienceBadgeChip,
  ExperienceBadgeScale,
  ThumbsCount,
  ThumbUpButton,
} from "@/components/CompanionBadges";
import { CompanionProfilePanel } from "@/components/CompanionProfilePanel";
import { useCompanionSettings } from "@/lib/companionSettings";
import soleliaLogoAsset from "@/assets/solelia-logo.png.asset.json";
import floralBorderAsset from "@/assets/floral-border.jpg.asset.json";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Solélia — Présence et accompagnement à domicile" },
      { name: "description", content: "Mise en relation entre familles et compagnons de confiance pour du présence et de l'accompagnement à domicile." },
      { property: "og:title", content: "Solélia" },
      { property: "og:description", content: "Présence et accompagnement à domicile. Un besoin = un compagnon à proximité." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: App,
});

type Mode = "family" | "student";

function App() {
  const [mode, setMode] = useState<Mode>("family");
  const navigate = useNavigate();
  const { session } = useSession();
  const access = useAccess(session?.user.id);

  // Le Mandataire est redirigé vers son tableau de bord dédié
  useEffect(() => {
    if (access.data?.isMandataire && access.data.strongAuth) navigate({ to: "/mandataire" });
  }, [access.data, navigate]);

  return (
    <div className="min-h-screen bg-background flex justify-center">
      <div className="w-full max-w-[440px] min-h-screen flex flex-col bg-background shadow-xl">
        <Header mode={mode} setMode={setMode} session={session} />
        <main className="flex-1 flex flex-col">
          {mode === "family" ? <FamilyFlow /> : <StudentFlow />}
        </main>
        <footer className="px-5 py-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <span>© Solélia</span>
          <Link to="/pro" className="underline hover:text-foreground">Espace Pro</Link>
        </footer>
      </div>
    </div>
  );
}

function Header({ mode, setMode, session }: { mode: Mode; setMode: (m: Mode) => void; session: Session | null }) {
  const qc = useQueryClient();
  const tabs: { v: Mode; label: string }[] = [
    { v: "family", label: "👴👵 👨👩 Famille" },
    { v: "student", label: "🤝 Compagnon" },
  ];
  return (
    <header className="px-5 pt-6 pb-4 border-b border-border">
      <div className="flex items-center gap-2 mb-4">
        <img
          src={soleliaLogoAsset.url}
          alt="Solélia"
          className="h-10 w-10 rounded-2xl object-cover"
        />
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-black leading-none">Solélia</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Présence et accompagnement à domicile</p>
        </div>
        {session ? (
          <button
            onClick={async () => {
              await qc.cancelQueries();
              qc.clear();
              await supabase.auth.signOut();
            }}
            className="text-xs font-bold text-primary underline shrink-0"
            title={session.user.email ?? undefined}
          >
            Déconnexion
          </button>
        ) : (
          <Link to="/auth" className="text-xs font-bold text-primary underline shrink-0">
            Se connecter
          </Link>
        )}
      </div>
      <div className="grid grid-cols-2 rounded-2xl bg-muted p-1 gap-1">
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
  const paren = need.match(/^(.*?)\s*\((.*)\)$/);
  if (paren) {
    return (
      <div className="text-base font-semibold leading-tight">
        <div>{paren[1]}</div>
        <div className="text-xs font-medium text-muted-foreground">{paren[2]}</div>
      </div>
    );
  }
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

function ServiceLimitsNotice({ className = "" }: { className?: string }) {
  return (
    <div className={`mt-3 rounded-2xl border-2 border-warning/40 bg-warning/10 p-3 text-xs leading-relaxed ${className}`}>
      <p className="font-bold mb-1">⚠️ Services non autorisés</p>
      <p>
        Les compagnons ne peuvent réaliser aucun service relevant d'une compétence médicale ou paramédicale
        (soins, injections, médicaments administrés, toilette, transferts), d'un apprentissage ou d'un enseignement
        certifiant (conduite, cours diplômants), d'une profession réglementée (juridique, comptable, financière,
        travaux du bâtiment, électricité, gaz), ni aucune activité illégale, dangereuse ou discriminatoire
        (transport de substances interdites, manipulation d'argent liquide, garde d'enfant de moins de 3 ans,
        port de charges lourdes, intervention sur animaux malades).
      </p>
    </div>
  );
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

const BASE_RATE = 26; // tarif horaire TTC — paiement en CESU préfinancé
const TAX_CREDIT_RATE = 0.5; // SAP : crédit d'impôt de 50 % (avance immédiate)

function computePrice(hours: number) {
  const total = hours <= 1 ? BASE_RATE : BASE_RATE * hours;
  return {
    total,
    intervention: total,
    afterCredit: total * (1 - TAX_CREDIT_RATE),
    credit: total * TAX_CREDIT_RATE,
    dueNow: total * (1 - TAX_CREDIT_RATE), // le client ne règle que 50 % à la commande
  };
}

function formatPrice(n: number) {
  return n.toFixed(2).replace(".", ",");
}

/* ---------------- FAMILY ACCOUNT (SAP) ---------------- */

type Order = {
  id: string;
  date: number;
  need: NeedType;
  address: string;
  hours: number;
  total: number;
  studentName?: string;
};

type FamilyAccount = {
  email: string;
  fullName: string;
  createdAt: number;
  orders: Order[];
};

const FAMILY_ACCOUNT_KEY = "sos-family-account";

function loadFamilyAccount(): FamilyAccount | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(FAMILY_ACCOUNT_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}
function saveFamilyAccount(a: FamilyAccount | null) {
  try {
    if (a) localStorage.setItem(FAMILY_ACCOUNT_KEY, JSON.stringify(a));
    else localStorage.removeItem(FAMILY_ACCOUNT_KEY);
    window.dispatchEvent(new Event("sos-family-account-changed"));
  } catch {}
}
function useFamilyAccount() {
  const [acc, setAcc] = useState<FamilyAccount | null>(null);
  useEffect(() => {
    setAcc(loadFamilyAccount());
    const refresh = () => setAcc(loadFamilyAccount());
    window.addEventListener("storage", refresh);
    window.addEventListener("sos-family-account-changed", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("sos-family-account-changed", refresh);
    };
  }, []);
  return acc;
}
function addOrderToAccount(order: Order) {
  const a = loadFamilyAccount();
  if (!a) return;
  saveFamilyAccount({ ...a, orders: [order, ...a.orders] });
}

function TaxCreditHint({ total, className = "" }: { total: number; className?: string }) {
  return (
    <div className={`text-xs text-muted-foreground ${className}`}>
      💚 Vous ne payez que <b className="text-success">{formatPrice(total * (1 - TAX_CREDIT_RATE))} €</b> à la commande (crédit d'impôt SAP –50 % déduit immédiatement)
    </div>
  );
}

/* ---------------- FAMILY ---------------- */

function FamilyFlow() {
  const [step, setStep] = useState<"home" | "form" | "wait" | "account">("home");
  const [requestMode, setRequestMode] = useState<"asap" | "scheduled">("asap");
  const [simulateNoAnswer, setSimulateNoAnswer] = useState(false);
  const currentId = useStore((s) => s.currentRequestId);
  const current = useStore((s) => s.requests.find((r) => r.id === s.currentRequestId));
  const account = useFamilyAccount();
  const { session, loading: sessionLoading } = useSession();

  // Simulation « premier répondant » : un compagnon disponible accepte la mission.
  useEffect(() => {
    if (step !== "wait" || !currentId || current?.status !== "searching") return;
    if (simulateNoAnswer) return;
    const preferredId = current?.preferredCompanionId;
    const delay = preferredId ? 6000 : current?.scheduledAt ? 5000 : 3500;
    const t = setTimeout(() => {
      if (preferredId) store.acceptRequestBy(currentId, preferredId);
      else store.acceptRequest(currentId, Math.floor(Math.random() * COMPANIONS.length));
    }, delay);
    return () => clearTimeout(t);
  }, [step, current?.status, current?.preferredCompanionId, current?.scheduledAt, currentId, simulateNoAnswer]);


  if (step === "account") return <FamilyAccountScreen onBack={() => setStep("home")} />;

  if (step === "home")
    return (
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-8 gap-5">
        <button
          onClick={() => setStep("account")}
          className="self-end text-sm font-semibold text-primary underline"
        >
          {account ? `👤 ${account.fullName.split(" ")[0]}` : "👤 Mon compte"}
        </button>
        <div
          className="text-center space-y-1"
          style={{ fontFamily: "'Parisienne', cursive", color: "#4A1525" }}
        >
          <p className="text-base">Pour rompre l'isolement,</p>
          <p className="text-base">Accompagner les enfants,</p>
          <p className="text-base">Soutenir une personne temporairement ou durablement fragilisée,</p>
          <p className="text-base">Et être présent dans les moments où l'on a simplement besoin de quelqu'un.</p>
        </div>
        <img
          src={floralBorderAsset.url}
          alt="Liseret floral"
          className="w-full max-w-[320px] h-auto object-contain opacity-90"
        />
        <div className="w-full flex flex-wrap justify-center gap-2">
          {[
            { emoji: "👵", label: "Nos aînés" },
            { emoji: "👶", label: "Nos enfants (dès 3 ans)" },
            { emoji: "🤰", label: "Grossesse & maternité" },
            { emoji: "🏥", label: "Retour d'hospitalisation & convalescence" },
            { emoji: "🤝", label: "Handicap & invalidité", sub: "(temporaire ou permanent)" },
            { emoji: "🩹", label: "Blessures & imprévus" },
          ].map((b) => (
            <span
              key={b.label}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent border border-primary/20 px-3 py-1.5 text-xs font-semibold"
            >
              <span>{b.emoji}</span>
              <span className="flex flex-col items-start leading-none">
                <span>{b.label}</span>
                {b.sub && <span className="text-[10px] text-muted-foreground font-medium mt-0.5">{b.sub}</span>}
              </span>
            </span>
          ))}
        </div>
        <div className="w-full bg-card border-2 border-primary/30 rounded-2xl p-4 text-center">
          <p className="text-base font-black">Un besoin = un compagnon à proximité.</p>
          <ul className="mt-2 text-sm text-muted-foreground space-y-0.5">
            <li>0 € de frais de dossier</li>
            <li>0 € d'abonnement</li>
            <li>Sans engagement.</li>
          </ul>
        </div>
        <button
          onClick={() => { setRequestMode("asap"); setSimulateNoAnswer(false); setStep("form"); }}
          className="btn-huge bg-primary text-primary-foreground hover:brightness-110 min-h-[180px] w-full flex flex-col items-center justify-center gap-2"
        >
          <span className="text-5xl">⚡</span>
          <span>Besoin rapidement</span>
          <span className="text-sm font-normal opacity-90">
            Nous recherchons activement un compagnon disponible à proximité
          </span>
        </button>
        <button
          onClick={() => { setRequestMode("scheduled"); setSimulateNoAnswer(false); setStep("form"); }}
          className="btn-huge bg-accent text-foreground border-2 border-primary min-h-[140px] w-full flex flex-col items-center justify-center gap-2"
        >
          <span className="text-4xl">📅</span>
          <span>Prendre un rendez-vous</span>
          <span className="text-sm font-normal text-muted-foreground">
            Date et heure précises — compagnon au choix ou recherche automatique
          </span>
        </button>
        <div className="w-full bg-success/10 border-2 border-success/40 rounded-2xl p-4 text-left">
          <p className="text-sm font-bold text-success text-center">💳 Paiement CESU+ & Crédit d'Impôt (SAP)</p>
          <ul className="text-xs text-muted-foreground mt-2 space-y-1 list-disc pl-4">
            <li>
              <b className="text-foreground">Service à la Personne (SAP)</b> : vous bénéficiez de 50 % de crédit d'impôt sur l'ensemble de vos prestations.
            </li>
            <li>
              <b className="text-foreground">Avance Immédiate (CESU+)</b> : dès que le compte du compagnon est validé par l'URSSAF, vous ne payez que la moitié du tarif à la commande.
            </li>
            <li>
              <b className="text-foreground">1ʳᵉ mission avec un nouveau compagnon</b> : règlement au tarif plein le temps que l'URSSAF crée son compte (délai de 2 à 4 semaines). Vos 50 % seront déduits lors de votre déclaration d'impôts.
            </li>
            <li>
              <b className="text-foreground">Zéro démarche</b> : nous gérons l'ensemble des déclarations URSSAF. Votre attestation fiscale annuelle est disponible chaque janvier sur votre compte.
            </li>
          </ul>
        </div>
        <CguPanel />
        <p className="text-xs text-muted-foreground text-center max-w-xs">
          En cas d'urgence vitale, composez le <span className="font-bold text-foreground">15</span> (SAMU).
        </p>
      </div>
    );

  if (step === "form") {
    if (sessionLoading) return <p className="flex-1 grid place-items-center text-muted-foreground">Chargement…</p>;
    if (!session)
      return (
        <div className="flex-1 flex flex-col px-5 py-6 gap-4">
          <button type="button" onClick={() => setStep("home")} className="text-base text-muted-foreground text-left">
            ← Retour
          </button>
          <AuthCard
            title="Connectez-vous pour continuer"
            subtitle="Un compte est nécessaire pour réserver un compagnon."
            onSuccess={() => {}}
          />
        </div>
      );
    return <FamilyForm mode={requestMode} onSubmit={() => setStep("wait")} onBack={() => setStep("home")} />;
  }

  return (
    <FamilyWait
      request={current}
      simulateNoAnswer={simulateNoAnswer}
      onSimulateNoAnswer={setSimulateNoAnswer}
      onDone={() => { store.clearCurrent(); setSimulateNoAnswer(false); setStep("home"); }}
    />
  );
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

  const [autoSearch, setAutoSearch] = useState(true);
  const [pickedCompanion, setPickedCompanion] = useState<string>("");

  const [childLevel, setChildLevel] = useState<string>("Primaire");
  const [childClass, setChildClass] = useState<string>("");
  const [childAge, setChildAge] = useState<string>("");
  const [childrenCount, setChildrenCount] = useState<string>("1 enfant");
  const [escortDestination, setEscortDestination] = useState<string>("À l'école");
  const [escortDetail, setEscortDetail] = useState<string>("");
  const [otherDetail, setOtherDetail] = useState<string>("");
  const [extraInfo, setExtraInfo] = useState<string>("");
  const [continuity, setContinuity] = useState(false);
  const [cguOk, setCguOk] = useState(false);
  const [testRecurrence, setTestRecurrence] = useState(false);
  const [showCesuAlert, setShowCesuAlert] = useState(false);
  const [companionName, setCompanionName] = useState("Léa");
  // Commissions extérieures rattachées à une présence à domicile (conformité SAP)
  const [commissions, setCommissions] = useState<string[]>([]);
  const [commissionCertified, setCommissionCertified] = useState(false);

  const needs: { v: NeedType; icon: string }[] = [
    { v: "Compagnie/Présence", icon: "🤝" },
    { v: "Aide au repas", icon: "🍽️" },
    { v: "Accompagnement sorties extérieures", icon: "🌳" },
    { v: "Aide aux devoirs (primaire au lycée)", icon: "📚" },
    { v: "Garde d'enfants (à partir de 3 ans)", icon: "🧸" },
    { v: "Accompagner un enfant (à partir de 3 ans)", icon: "🚸" },
    { v: "Autre (à préciser)", icon: "✏️" },
  ];

  const PRESENCE_SUBTITLE =
    "Présence bienveillante au domicile (inclut dans son prolongement les petites commissions : courses, pharmacie, colis, promenade d'animaux)";
  const COMMISSION_OPTIONS = [
    "💊 Médicaments / pharmacie",
    "🛒 Courses",
    "📦 Retrait ou dépôt d'un colis",
    "🐕 Animaux (sortir ou nourrir)",
  ];

  const isOther = need === "Autre (à préciser)";

  const isHomework = need === "Aide aux devoirs (primaire au lycée)";
  const isChildcare = need === "Garde d'enfants (à partir de 3 ans)";
  const isEscortChild = need === "Accompagner un enfant (à partir de 3 ans)";
  const isChildNeed = isHomework || isChildcare || isEscortChild;
  const hasDuration =
    need === "Compagnie/Présence" ||
    need === "Accompagnement sorties extérieures" ||
    isHomework ||
    isChildcare ||
    isEscortChild ||
    need === "Autre (à préciser)";

  const isOutdoor =
    need === "Retrait ou dépôt d'un colis" || need === "Pharmacie" || need === "Courses urgentes";

  const createAndGo = () => {
    const scheduledAt = mode === "scheduled" ? new Date(when).getTime() : null;
    const dh = hasDuration ? durationHours : 1;
    const isParcel = need === "Retrait ou dépôt d'un colis";
    store.createRequest({
      need,
      address,
      phone,
      scheduledAt,
      flow: mode === "scheduled" ? "scheduled" : "sos",
      autoSearch: mode === "scheduled" ? autoSearch : true,
      preferredCompanionId: mode === "scheduled" && !autoSearch && pickedCompanion ? pickedCompanion : undefined,
      durationHours: dh,

      parcelWeight: isParcel ? parcelWeight : undefined,
      parcelSize: isParcel ? parcelSize : undefined,
      childLevel: isHomework ? childLevel : undefined,
      childClass: isHomework && childClass.trim() ? childClass.trim() : undefined,
      childAge: isChildNeed && childAge.trim() ? childAge.trim() : undefined,
      childrenCount: isChildcare ? childrenCount : undefined,
      escortDestination: isEscortChild ? escortDestination : undefined,
      escortDetail: isEscortChild && escortDestination === "Autre" ? escortDetail : undefined,
      otherDetail: isOther ? otherDetail : undefined,
      extraInfo:
        [
          need === "Compagnie/Présence" && commissions.length > 0
            ? `Commissions demandées dans le prolongement de la présence : ${commissions.join(", ")}`
            : "",
          extraInfo.trim(),
        ]
          .filter(Boolean)
          .join("\n") || undefined,
      continuityCertified:
        isOutdoor ? continuity : need === "Compagnie/Présence" && commissions.length > 0 ? commissionCertified : undefined,
    });
    onSubmit();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim() || !phone.trim()) return;
    if (need === "Autre (à préciser)" && !otherDetail.trim()) return;
    if (isOutdoor && !continuity) return;
    if (need === "Compagnie/Présence" && commissions.length > 0 && !commissionCertified) return;
    if (isChildNeed && (!childAge.trim() || Number(childAge) < 3)) return;
    if (mode === "scheduled" && !autoSearch && !pickedCompanion) return;
    if (!cguOk) return;

    if (testRecurrence) {
      setShowCesuAlert(true);
      return;
    }
    createAndGo();
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
              {n.v === "Compagnie/Présence" && (
                <p className="text-xs font-medium text-muted-foreground mt-1 leading-snug">
                  {PRESENCE_SUBTITLE}
                </p>
              )}
            </button>
          ))}
        </div>
      </div>
      {need === "Compagnie/Présence" && (
        <div className="flex flex-col gap-3">
          <label className="block text-lg font-bold">Petites commissions en complément (optionnel)</label>
          <div className="grid grid-cols-2 gap-2">
            {COMMISSION_OPTIONS.map((opt) => {
              const checked = commissions.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() =>
                    setCommissions((prev) =>
                      checked ? prev.filter((c) => c !== opt) : [...prev, opt],
                    )
                  }
                  className={`p-3 rounded-2xl border-2 text-sm font-semibold text-left transition-all ${
                    checked ? "border-primary bg-accent" : "border-border bg-card"
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
          {commissions.length > 0 && (
            <label className="flex items-start gap-3 rounded-2xl border-2 border-warning/50 bg-warning/10 p-4 cursor-pointer">
              <input
                type="checkbox"
                checked={commissionCertified}
                onChange={(e) => setCommissionCertified(e.target.checked)}
                className="mt-1 h-5 w-5 shrink-0 accent-primary"
              />
              <span className="text-sm font-semibold leading-snug">
                Je certifie que cette demande de commission ou service extérieur est effectuée dans le
                prolongement direct d'une présence à domicile.
              </span>
            </label>
          )}
        </div>
      )}
      {isOther && (
        <div>
          <label className="block text-lg font-bold mb-2">Précisez votre besoin</label>
          <textarea
            value={otherDetail}
            onChange={(e) => setOtherDetail(e.target.value)}
            placeholder="Décrivez en quelques mots le service souhaité"
            rows={3}
            required
            className="w-full px-4 py-3 rounded-2xl border-2 border-border bg-card text-base focus:border-primary outline-none"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Le besoin doit tenir dans le cadre d'une mission d'entraide du quotidien, réalisable par une personne
            non professionnelle, en toute sécurité.
          </p>
          <ServiceLimitsNotice />
        </div>
      )}
      {isChildNeed && (
        <div className="flex flex-col gap-4">
          <div className="bg-accent rounded-2xl p-3 text-sm">
            👶 Services enfants accessibles <b>à partir de 3 ans</b>.
          </div>
          <div>
            <label className="block text-lg font-bold mb-2">Âge de l'enfant</label>
            <input
              type="number"
              min={3}
              max={17}
              required
              value={childAge}
              onChange={(e) => setChildAge(e.target.value)}
              placeholder="Ex. 6"
              className="w-full px-5 py-4 rounded-2xl border-2 border-border bg-card text-lg focus:border-primary outline-none"
            />
            {childAge && Number(childAge) < 3 && (
              <p className="text-sm text-destructive mt-2">
                Les missions avec enfant sont réservées aux enfants de 3 ans et plus.
              </p>
            )}
          </div>
          {isHomework && (
            <div>
              <label className="block text-lg font-bold mb-2">Niveau scolaire</label>
              <div className="grid grid-cols-2 gap-2">
                {["Primaire", "Collège", "Lycée"].map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setChildLevel(l)}
                    className={`py-3 px-3 rounded-2xl border-2 text-sm font-bold transition-all ${
                      childLevel === l ? "border-primary bg-accent" : "border-border bg-card"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <label className="block text-lg font-bold mt-4 mb-2">Classe de l'enfant</label>
              <div className="grid grid-cols-3 gap-2">
                {(childLevel === "Primaire"
                  ? ["CP", "CE1", "CE2", "CM1", "CM2"]
                  : childLevel === "Collège"
                    ? ["6e", "5e", "4e", "3e"]
                    : ["Seconde", "Première", "Terminale"]
                ).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setChildClass(c)}
                    className={`py-3 px-2 rounded-2xl border-2 text-sm font-bold transition-all ${
                      childClass === c ? "border-primary bg-accent" : "border-border bg-card"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isChildcare && (
            <div>
              <label className="block text-lg font-bold mb-2">Nombre d'enfants</label>
              <div className="grid grid-cols-3 gap-2">
                {["1 enfant", "2 enfants", "3 enfants et +"].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setChildrenCount(c)}
                    className={`py-3 px-2 rounded-2xl border-2 text-sm font-bold transition-all ${
                      childrenCount === c ? "border-primary bg-accent" : "border-border bg-card"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}
          {isEscortChild && (
            <div>
              <label className="block text-lg font-bold mb-2">Accompagner l'enfant…</label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  "À l'école",
                  "À une activité sportive",
                  "À une activité artistique",
                  "Chez un ami",
                  "Faire un achat",
                  "Autre",
                ].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setEscortDestination(d)}
                    className={`py-3 px-3 rounded-2xl border-2 text-sm font-bold text-left transition-all ${
                      escortDestination === d ? "border-primary bg-accent" : "border-border bg-card"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
              {escortDestination === "Autre" && (
                <div className="mt-3">
                  <input
                    value={escortDetail}
                    onChange={(e) => setEscortDetail(e.target.value)}
                    placeholder="Précisez la demande"
                    className="w-full px-4 py-3 rounded-2xl border-2 border-border bg-card text-base focus:border-primary outline-none"
                  />
                  <ServiceLimitsNotice />
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {hasDuration && (
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
            {durationHours <= 1 ? " (tarif forfaitaire 1h, tout compris)" : ` (${durationHours}h × 26 €, tout compris)`}
          </p>
          <TaxCreditHint total={computePrice(durationHours).total} className="mt-1" />
        </div>
      )}
      {!hasDuration && need !== "Retrait ou dépôt d'un colis" && (
        <div className="bg-accent rounded-2xl p-3 text-sm">
          Tarif : <b>{formatPrice(BASE_RATE)} €</b> (forfait 1h, tout compris)
          <TaxCreditHint total={BASE_RATE} className="mt-1" />
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
      {mode === "scheduled" && (
        <div>
          <label className="block text-lg font-bold mb-2">Qui doit venir ?</label>
          <label
            className={`flex items-start gap-3 rounded-2xl border-2 p-4 text-sm ${
              autoSearch ? "border-primary bg-accent" : "border-border bg-card"
            }`}
          >
            <input
              type="checkbox"
              checked={autoSearch}
              onChange={(e) => setAutoSearch(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0"
            />
            <span>
              <b>Recherche d'un compagnon à proximité disponible</b>
              <span className="block text-xs text-muted-foreground mt-1">
                Votre demande est envoyée à tous les compagnons libres sur ce créneau. Le premier à accepter valide le
                rendez-vous.
              </span>
            </span>
          </label>
          {!autoSearch && (
            <div className="mt-3 flex flex-col gap-2">
              <p className="text-sm font-bold">Choisir un compagnon par son nom</p>
              <p className="text-xs text-muted-foreground -mt-1">
                Liste triée par distance et disponibilité uniquement. Les badges et pouces sont purement informatifs.
              </p>
              {[...COMPANIONS].sort((a, b) => a.distanceKm - b.distanceKm).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setPickedCompanion(c.id)}
                  className={`flex items-center gap-3 rounded-2xl border-2 p-3 text-left ${
                    pickedCompanion === c.id ? "border-primary bg-accent" : "border-border bg-card"
                  }`}
                >
                  <img src={c.photo} alt={c.firstName} className="h-12 w-12 rounded-full object-cover" />
                  <span className="min-w-0">
                    <span className="block text-base font-bold">{c.firstName}</span>
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      {experienceBadge(c.missions).emoji} {experienceBadge(c.missions).label} · 👍 {c.thumbs} ·{" "}
                      {c.distanceKm} km
                    </span>
                  </span>
                </button>
              ))}
              <p className="text-xs text-muted-foreground">
                Sans réponse du compagnon choisi sous 2 heures, nous vous proposerons un autre compagnon ou une
                recherche automatique.
              </p>
            </div>
          )}
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
      <div>
        <label className="block text-lg font-bold mb-2">Informations complémentaires</label>
        <textarea
          value={extraInfo}
          onChange={(e) => setExtraInfo(e.target.value)}
          rows={3}
          placeholder="Précisions utiles au compagnon : code d'entrée, étage, préférences, matériel à prévoir…"
          className="w-full px-4 py-3 rounded-2xl border-2 border-border bg-card text-base focus:border-primary outline-none"
        />
      </div>
      {isOutdoor && (
        <label className="flex items-start gap-3 rounded-2xl border-2 border-warning bg-warning/10 p-4 text-sm">
          <input
            type="checkbox"
            checked={continuity}
            onChange={(e) => setContinuity(e.target.checked)}
            className="mt-1 h-5 w-5 shrink-0"
          />
          <span>
            Je certifie que cette course, ce retrait de colis ou ce passage en pharmacie s'inscrit dans la
            <b> continuité de l'aide à domicile</b> qui m'est apportée, et ne constitue pas une prestation de
            livraison autonome (à défaut, risque de requalification en service de livraison).
          </span>
        </label>
      )}
      <CguAcceptBlock checked={cguOk} onChange={setCguOk} role="client" />
      <button
        type="button"
        onClick={() => setTestRecurrence((v) => !v)}
        className={`text-xs underline text-left ${testRecurrence ? "text-primary font-bold" : "text-muted-foreground"}`}
      >
        {testRecurrence
          ? "🧪 Mode test actif — 4e semaine consécutive avec Léa (désactiver)"
          : "🧪 Simuler 4e semaine consécutive avec ce compagnon"}
      </button>
      <div className="flex-1" />
      <button
        type="submit"
        disabled={!cguOk || (mode === "scheduled" && !autoSearch && !pickedCompanion)}
        className="btn-huge bg-primary text-primary-foreground disabled:opacity-50"
      >
        {mode === "asap" ? "Lancer la recherche" : "Valider la réservation"}
      </button>
      {showCesuAlert && (
        <CesuRecurrenceModal
          companionName={companionName}
          onClose={() => setShowCesuAlert(false)}
          onSwitchCompanion={(n) => {
            setCompanionName(n);
            setTestRecurrence(false);
            setShowCesuAlert(false);
            createAndGo();
          }}
        />
      )}
    </form>
  );
}


const CANCEL_WINDOW_MS = 48 * 60 * 60 * 1000;
const canFreeCancel = (scheduledAt?: number | null) =>
  !!scheduledAt && scheduledAt - Date.now() > CANCEL_WINDOW_MS;

// Simulation de disponibilité des compagnons sur un nouveau créneau.
// Aucun compagnon entre 21 h et 7 h, ni à moins de 48 h ; sinon 1 créneau sur 4 est complet.
function companionAvailableAt(ts: number) {
  if (Number.isNaN(ts)) return false;
  if (ts - Date.now() <= CANCEL_WINDOW_MS) return false;
  const h = new Date(ts).getHours();
  if (h < 7 || h >= 21) return false;
  return Math.floor(ts / 60_000) % 4 !== 0;
}

// Masque le numéro de rue : "12 rue des Lilas, 75014 Paris" -> "rue des Lilas, 75014 Paris"
function maskAddress(address: string) {
  const [street, ...rest] = address.split(",");
  const masked = street.replace(/^\s*\d+\s*(bis|ter|quater)?\s*/i, "").trim();
  return [masked, ...rest.map((r) => r.trim())].filter(Boolean).join(", ");
}

function toLocalInput(ts: number) {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Bloc unique : modifier OU annuler un rendez-vous (fenêtre de 48 h).
function ScheduleManageBlock({ request, paid }: { request: Request; paid: boolean }) {
  const [confirm, setConfirm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [reschedule, setReschedule] = useState<"idle" | "checking" | "refused" | "confirmed">("idle");
  const [newWhen, setNewWhen] = useState<string>(() =>
    request.scheduledAt ? toLocalInput(request.scheduledAt) : "",
  );
  const free = canFreeCancel(request.scheduledAt);
  return (
    <div className="w-full text-left">
      <p className="text-sm font-bold">Gérer mon rendez-vous</p>
      {editing ? (
        <div className="flex flex-col gap-2 mt-2 rounded-2xl border-2 border-border bg-card p-4">
          <p className="text-sm font-bold">✏️ Nouveau créneau</p>
          <input
            type="datetime-local"
            value={newWhen}
            onChange={(e) => { setNewWhen(e.target.value); setReschedule("idle"); }}
            disabled={reschedule === "checking"}
            className="w-full px-4 py-3 rounded-2xl border-2 border-border bg-card text-base focus:border-primary outline-none"
          />
          {reschedule === "checking" && (
            <p className="text-sm font-semibold text-primary">🔎 Recherche d'un compagnon disponible sur ce créneau…</p>
          )}
          {reschedule === "refused" && (
            <div className="rounded-2xl border-2 border-destructive/50 bg-destructive/10 p-3">
              <p className="text-sm font-bold text-destructive">Modification refusée</p>
              <p className="text-sm text-muted-foreground mt-1">
                Aucun compagnon n'est disponible sur ce nouveau créneau. Votre rendez-vous initial est maintenu.
                Essayez un autre horaire (entre 7 h et 21 h, à plus de 48 h).
              </p>
            </div>
          )}
          {reschedule === "confirmed" && (
            <p className="text-sm font-bold text-success">
              ✅ Modification acceptée : un compagnon est disponible sur ce créneau.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { setEditing(false); setReschedule("idle"); }}
              className="py-3 rounded-2xl border-2 border-border bg-card font-bold text-sm"
            >
              Revenir
            </button>
            <button
              type="button"
              disabled={reschedule === "checking"}
              onClick={() => {
                const ts = new Date(newWhen).getTime();
                if (Number.isNaN(ts)) return;
                setReschedule("checking");
                setTimeout(() => {
                  if (companionAvailableAt(ts)) {
                    store.updateRequest(request.id, { scheduledAt: ts });
                    setReschedule("confirmed");
                    setTimeout(() => { setEditing(false); setReschedule("idle"); }, 1400);
                  } else {
                    setReschedule("refused");
                  }
                }, 1500);
              }}
              className="py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-60"
            >
              {reschedule === "checking" ? "Vérification…" : "Vérifier & enregistrer"}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            La modification n'est validée que si un compagnon est disponible sur le nouveau créneau.
          </p>
        </div>
      ) : confirm ? (
        <div
          className={`rounded-2xl border-2 p-4 mt-2 ${free ? "border-border bg-card" : "border-destructive/50 bg-destructive/10"}`}
        >
          <p className="text-sm font-bold">{free ? "Annulation gratuite" : "Annulation tardive"}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {free
              ? "Vous annulez plus de 48 h avant le rendez-vous : remboursement intégral sous 3 jours ouvrés."
              : `Il reste moins de 48 h avant le rendez-vous : ${paid ? "le paiement ne sera pas remboursé." : "le montant réglé ne sera pas remboursé."}`}
          </p>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button
              type="button"
              onClick={() => setConfirm(false)}
              className="py-3 rounded-2xl border-2 border-border bg-card font-bold text-sm"
            >
              Revenir
            </button>
            <button
              type="button"
              onClick={() => store.cancelRequest(request.id, free)}
              className="py-3 rounded-2xl bg-destructive text-destructive-foreground font-bold text-sm"
            >
              Confirmer l'annulation
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 mt-2">
          <button
            type="button"
            disabled={!free}
            onClick={() => { setNewWhen(request.scheduledAt ? toLocalInput(request.scheduledAt) : ""); setEditing(true); }}
            className="py-4 rounded-2xl border-2 border-primary text-primary font-bold text-sm disabled:opacity-40"
          >
            ✏️ Modifier le RDV
          </button>
          <button
            type="button"
            onClick={() => setConfirm(true)}
            className="py-4 rounded-2xl border-2 border-destructive text-destructive font-bold text-sm"
          >
            🗑️ Annuler le RDV
          </button>
        </div>
      )}
      {!free && !editing && (
        <p className="text-xs text-muted-foreground mt-2">
          ⏳ Moins de 48 h avant le rendez-vous : la modification n'est plus possible.
        </p>
      )}
      <p className="text-xs text-muted-foreground mt-2">
        Modification et annulation gratuites jusqu'à 48 h avant le rendez-vous, sous réserve qu'un compagnon soit
        disponible sur le nouveau créneau. Passé 48 h, la mission reste due.
      </p>
    </div>
  );
}


const SOS_TIMEOUT_MS = 30 * 60 * 1000; // 30 min sans réponse sur une urgence
const PREFERRED_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 h sans réponse du compagnon choisi

function FamilyWait({
  request,
  simulateNoAnswer,
  onSimulateNoAnswer,
  onDone,
}: {
  request: Request | undefined;
  simulateNoAnswer: boolean;
  onSimulateNoAnswer: (v: boolean) => void;
  onDone: () => void;
}) {
  const [paid, setPaid] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [restartedAt, setRestartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  if (!request) return null;
  if (request.status === "cancelled") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 gap-5 text-center">
        <div className="text-6xl">🗑️</div>
        <p className="text-2xl font-black">Rendez-vous annulé</p>
        <p className="text-base text-muted-foreground">
          {request.refunded
            ? "Annulation à plus de 48 h : vous serez intégralement remboursé sous 3 jours ouvrés."
            : "Annulation à moins de 48 h : conformément aux conditions, le paiement n'est pas remboursé."}
        </p>
        <button onClick={onDone} className="btn-huge bg-primary text-primary-foreground w-full">
          Retour à l'accueil
        </button>
      </div>
    );
  }
  const accepted = request.status === "accepted" && request.student;

  const hours = request?.durationHours ?? 1;
  const { total } = computePrice(hours);

  if (accepted && showPay && !paid) {
    return (
      <PaymentScreen
        student={request.student!.firstName}
        hours={hours}
        onDone={() => {
          addOrderToAccount({
            id: request.id,
            date: Date.now(),
            need: request.need,
            address: request.address,
            hours,
            total,
            studentName: request.student!.firstName,
          });
          setPaid(true);
          setShowPay(false);
        }}
        onBack={() => setShowPay(false)}
      />
    );
  }

  const isSos = !request.scheduledAt;
  const preferred = request.preferredCompanionId
    ? COMPANIONS.find((c) => c.id === request.preferredCompanionId)
    : undefined;
  const startedAt = restartedAt ?? request.createdAt;
  const waited = now - startedAt;
  const limit = preferred ? PREFERRED_TIMEOUT_MS : SOS_TIMEOUT_MS;
  const timedOut = !accepted && (simulateNoAnswer || waited > limit);
  const nearbyCount = COMPANIONS.filter((c) => c.distanceKm <= c.radiusKm).length;

  const relaunch = () => {
    onSimulateNoAnswer(false);
    setRestartedAt(Date.now());
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 gap-6 text-center">
      {!accepted ? (
        <>
          {isSos ? (
            <>
              <div className="relative h-32 w-32">
                <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                <div className="absolute inset-4 rounded-full bg-primary/40 animate-pulse" />
                <div className="absolute inset-10 rounded-full bg-primary grid place-items-center text-3xl">📡</div>
              </div>
              <div>
                <p className="text-2xl font-bold">Alerte urgente envoyée</p>
                <p className="text-base text-muted-foreground mt-2">
                  {nearbyCount} compagnon(s) disponible(s) dans leur rayon d'intervention ont reçu une notification.
                  Le premier qui accepte verrouille la mission.
                </p>
              </div>
            </>
          ) : preferred ? (
            <>
              <img
                src={preferred.photo}
                alt={preferred.firstName}
                className="h-28 w-28 rounded-full object-cover ring-4 ring-primary/30"
              />
              <div>
                <p className="text-2xl font-bold">Demande envoyée à {preferred.firstName}</p>
                <p className="text-base text-muted-foreground mt-2">
                  Réponse attendue sous 2 heures. Sans réponse, nous vous proposerons une alternative.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="text-6xl">📅</div>
              <div>
                <p className="text-2xl font-bold">Recherche automatique en cours</p>
                <p className="text-base text-muted-foreground mt-2">
                  Votre demande a été envoyée aux compagnons disponibles sur ce créneau. Le premier à accepter valide
                  le rendez-vous.
                </p>
              </div>
            </>
          )}

          <div className="w-full bg-card rounded-2xl p-5 border-2 border-border text-left">
            <p className="text-sm text-muted-foreground">Besoin</p>
            <p className="text-base font-semibold">
              {request.need.includes("/") ? request.need.replace("/", " / ") : request.need}
            </p>
            {!!request.scheduledAt && (
              <>
                <p className="text-sm text-muted-foreground mt-3">Date et heure</p>
                <p className="text-lg font-bold">{formatSchedule(request.scheduledAt)}</p>
              </>
            )}
            <p className="text-sm text-muted-foreground mt-3">
              ⏱️ En attente depuis {Math.max(0, Math.floor(waited / 60000))} min
              {isSos ? " (délai maximum 30 min)" : preferred ? " (délai maximum 2 h)" : ""}
            </p>
          </div>

          {timedOut && (
            <div className="w-full rounded-2xl border-2 border-warning bg-warning/10 p-4 text-left">
              <p className="text-sm font-black">
                {isSos ? "⏰ Aucune réponse après 30 minutes" : `⏰ ${preferred?.firstName ?? "Le compagnon"} n'a pas répondu sous 2 h`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {isSos
                  ? "Aucun compagnon disponible n'a accepté votre urgence. Vous pouvez relancer l'alerte ou modifier vos critères (besoin, durée, adresse)."
                  : "Choisissez un autre compagnon ou basculez en recherche automatique à proximité."}
              </p>
              <div className="grid grid-cols-1 gap-2 mt-3">
                <button
                  type="button"
                  onClick={relaunch}
                  className="py-4 rounded-2xl bg-primary text-primary-foreground font-bold text-sm"
                >
                  🔁 Relancer la demande
                </button>
                {isSos ? (
                  <button
                    type="button"
                    onClick={() => { store.cancelRequest(request.id, true); }}
                    className="py-4 rounded-2xl border-2 border-border bg-card font-bold text-sm"
                  >
                    ✏️ Modifier mes critères
                  </button>
                ) : (
                  <>
                    <div className="rounded-2xl border-2 border-border bg-card p-3">
                      <p className="text-xs font-bold mb-2">Autres compagnons disponibles</p>
                      <div className="flex flex-col gap-2">
                        {[...COMPANIONS]
                          .filter((c) => c.id !== preferred?.id)
                          .sort((a, b) => a.distanceKm - b.distanceKm)
                          .map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              store.updateRequest(request.id, { preferredCompanionId: c.id });
                              relaunch();
                            }}
                            className="flex items-center gap-3 rounded-xl border-2 border-border p-2 text-left"
                          >
                            <img src={c.photo} alt={c.firstName} className="h-10 w-10 rounded-full object-cover" />
                            <span className="min-w-0">
                              <span className="block text-sm font-bold">{c.firstName}</span>
                              <span className="block text-[11px] text-muted-foreground">
                                {experienceBadge(c.missions).emoji} {experienceBadge(c.missions).label} · 👍 {c.thumbs}
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        store.updateRequest(request.id, { preferredCompanionId: undefined, autoSearch: true });
                        relaunch();
                      }}
                      className="py-4 rounded-2xl border-2 border-primary text-primary font-bold text-sm"
                    >
                      🔎 Basculer en recherche automatique
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {isSos ? (
            <div className="w-full rounded-2xl border-2 border-border bg-card p-3 text-left">
              <p className="text-sm font-bold">🆘 Demande d'urgence</p>
              <p className="text-xs text-muted-foreground mt-1">
                Une demande SOS ne peut être ni modifiée ni annulée pendant la recherche. Pour un besoin planifiable,
                utilisez « Prendre un rendez-vous ».
              </p>
            </div>
          ) : (
            <ScheduleManageBlock request={request} paid={false} />
          )}

          {!timedOut && (
            <button
              type="button"
              onClick={() => onSimulateNoAnswer(true)}
              className="text-xs underline text-muted-foreground"
            >
              🧪 Simuler l'absence de réponse ({isSos ? "30 min" : "2 h"})
            </button>
          )}
          <button onClick={onDone} className="text-base text-muted-foreground underline">
            Retour à l'accueil
          </button>
        </>
      ) : (
        <>
          <p className="text-lg font-bold text-success">
            {isSos ? "✅ Mission verrouillée par un compagnon !" : "✅ Rendez-vous confirmé !"}
          </p>
          <div className="w-full bg-card rounded-3xl p-6 border-2 border-border shadow-sm">
            <img
              src={request.student!.photo}
              alt={request.student!.firstName}
              className="h-40 w-40 rounded-full mx-auto object-cover ring-4 ring-primary/30"
            />
            <p className="text-2xl font-bold mt-4">{request.student!.firstName}</p>
            <div className="mt-2 flex items-center justify-center gap-2 flex-wrap">
              <ExperienceBadgeChip missions={request.student!.missions} />
              <ThumbsCount thumbs={request.student!.thumbs} />
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {request.student!.missions} missions réalisées ·{" "}
              {isSos ? "Arrivée estimée : 10 min" : "Rendez-vous confirmé"}
            </p>
            <div className="mt-4 bg-warning/15 border-2 border-warning rounded-2xl p-3 text-left">
              <p className="text-sm font-bold">🔒 Vérifiez l'identité</p>
              <p className="text-sm text-muted-foreground mt-1">
                N'ouvrez la porte qu'à la personne montrée sur cette photo.
              </p>
            </div>
          </div>

          <CompanionProfileHeader
            firstName={request.student!.firstName}
            missions={request.student!.missions}
            thumbs={request.student!.thumbs}
          />

          {!request.acknowledged ? (
            <div className="w-full rounded-2xl border-2 border-primary bg-accent p-4 text-left">
              <p className="text-sm font-black">📩 Accusé de réception</p>
              <p className="text-xs text-muted-foreground mt-1">
                Confirmez que vous avez bien pris connaissance de l'intervention de {request.student!.firstName}.
              </p>
              <button
                onClick={() => store.acknowledgeRequest(request.id)}
                className="btn-huge bg-primary text-primary-foreground w-full mt-3"
              >
                👍 C'est noté !
              </button>
            </div>
          ) : !paid ? (
            <>
              <div className="w-full bg-success/10 border-2 border-success/40 rounded-2xl p-3 text-left">
                <p className="text-sm font-bold text-success">
                  💚 Mission {formatPrice(total)} € — vous ne réglez que {formatPrice(computePrice(hours).dueNow)} € (crédit d'impôt SAP –50 % déduit)
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Récapitulatif annuel disponible en janvier depuis votre compte.
                </p>
              </div>
              <button onClick={() => setShowPay(true)} className="btn-huge bg-primary text-primary-foreground w-full">
                💳 Finaliser & payer — {formatPrice(computePrice(hours).dueNow)} €
              </button>
              <p className="text-xs text-muted-foreground">
                Les coordonnées du compagnon seront révélées après paiement.
              </p>
            </>
          ) : (
            <>
              <div className="w-full bg-success/10 border-2 border-success rounded-2xl p-4">
                <p className="text-lg font-bold text-success">✅ Paiement confirmé</p>
                <p className="text-sm text-muted-foreground mt-1">Reçu envoyé par SMS · ajouté à votre compte</p>
              </div>
              <a
                href={`tel:${request.phone}`}
                className="btn-huge bg-success text-success-foreground text-center w-full"
              >
                📞 Appeler le compagnon
              </a>
              <ThumbUpButton
                given={!!request.thumbsGiven}
                onGive={() => store.giveThumb(request.id)}
              />
            </>
          )}
          {!!request.scheduledAt && <ScheduleManageBlock request={request} paid={paid} />}
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
  const { total, intervention } = computePrice(hours);

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
          <span className="text-muted-foreground">
            Intervention {hours <= 1 ? "(forfait 1h)" : `(${hours}h × 26 €)`}
          </span>
          <span className="font-semibold">{formatPrice(intervention)} €</span>
        </div>
        <div className="h-px bg-border my-3" />
        <div className="flex justify-between text-base font-bold">
          <span>Coût total de la mission</span>
          <span>{formatPrice(total)} €</span>
        </div>
        <div className="flex justify-between text-sm mt-2">
          <span className="text-muted-foreground">Crédit d'impôt SAP (50 %) déduit immédiatement</span>
          <span className="font-semibold text-success">– {formatPrice(computePrice(hours).credit)} €</span>
        </div>
        <div className="h-px bg-border my-3" />
        <div className="mt-1 bg-success/10 border-2 border-success/40 rounded-xl p-3">
          <div className="flex justify-between text-xl font-black">
            <span className="text-success">À payer aujourd'hui</span>
            <span className="text-success">{formatPrice(computePrice(hours).dueNow)} €</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Paiement en CESU préfinancé — vous ne réglez que 50 % du montant à la commande. Attestation fiscale
            envoyée chaque janvier.
          </p>
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
        {processing ? "Traitement…" : `Payer ${formatPrice(total)} €`}
      </button>
      <p className="text-xs text-muted-foreground text-center">🔒 Paiement sécurisé — démo</p>
    </form>
  );
}

/* ---------------- STUDENT ---------------- */

type EnrollStatus = "none" | "pending" | "approved" | "rejected";
type CompanionApplicationRow = Database["public"]["Tables"]["companion_applications"]["Row"];

const DEMO_KEY = "solelia-companion-demo";

function useMyApplication(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-application", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companion_applications")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!userId,
  });
}

function StudentFlow() {
  const { session, loading: sessionLoading } = useSession();
  const qc = useQueryClient();
  const myApp = useMyApplication(session?.user.id);
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    setDemo(window.localStorage?.getItem(DEMO_KEY) === "1");
  }, []);
  const saveDemo = (v: boolean) => {
    setDemo(v);
    if (v) window.localStorage?.setItem(DEMO_KEY, "1");
    else window.localStorage?.removeItem(DEMO_KEY);
  };
  const [online, setOnline] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const allSearching = useStore((s) => s.requests.filter((r) => r.status === "searching"));
  const active = useStore((s) => (openId ? s.requests.find((r) => r.id === openId) : undefined));
  const strikes = useStrikes();
  const settings = useCompanionSettings();

  // Distance simulée stable par demande (démo)
  const distanceOf = (id: string) =>
    Math.round((([...id].reduce((a, c) => a + c.charCodeAt(0), 0) % 90) / 10 + 0.5) * 10) / 10;

  const requests = allSearching.filter((r) => {
    if (distanceOf(r.id) > settings.radiusKm) return false;
    if ((r.durationHours ?? 1) < settings.minDurationH) return false;
    if (!settings.tasks.includes(r.need)) return false;
    if (!settings.acceptPets && r.need === "Sortir ou nourrir animal de compagnie") return false;
    return true;
  });
  const hiddenCount = allSearching.length - requests.length;

  const status: EnrollStatus = demo ? "approved" : (myApp.data?.status ?? "none");

  if (status !== "approved") {
    return (
      <StudentEnroll
        session={session}
        app={myApp.data ?? null}
        loading={sessionLoading || (!!session && myApp.isLoading)}
        onDemo={() => saveDemo(true)}
        onSubmitted={() => qc.invalidateQueries({ queryKey: ["my-application"] })}
      />
    );
  }


  if (active) return <StudentDetail request={active} onBack={() => setOpenId(null)} />;

  return (
    <div className="flex-1 flex flex-col px-5 py-6 gap-5">
      {demo && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-primary/40 bg-accent p-3">
          <p className="text-sm font-bold">👁️ Mode démo — espace Compagnon validé</p>
          <button
            onClick={() => saveDemo(false)}
            className="text-sm font-bold text-primary underline shrink-0"
          >
            Quitter
          </button>
        </div>
      )}
      <button
        onClick={() => setOnline((v) => !v)}
        className={`btn-huge ${online ? "bg-success text-success-foreground" : "bg-muted text-foreground"}`}
      >
        <span className="flex items-center justify-center gap-3">
          <span className={`h-3 w-3 rounded-full ${online ? "bg-white animate-pulse" : "bg-muted-foreground"}`} />
          {online ? "En ligne — disponible" : "Hors ligne"}
        </span>
      </button>

      <CompanionProfilePanel />

      {online ? (
        <>
          <h2 className="text-xl font-bold mt-2">Demandes actives ({requests.length})</h2>
          {hiddenCount > 0 && (
            <p className="text-xs text-muted-foreground -mt-3">
              {hiddenCount} demande(s) masquée(s) : hors de votre rayon de {settings.radiusKm} km ou hors de vos
              critères d'acceptation.
            </p>
          )}
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
                      <p className="text-base text-muted-foreground mt-1">📍 {maskAddress(r.address)}</p>
                      <p className="text-sm text-muted-foreground">🧭 ≈ {distanceOf(r.id)} km de chez vous</p>

                      {r.durationHours && r.durationHours > 1 && (
                        <p className="text-sm mt-1 font-semibold">⏱️ Durée : {r.durationHours}h</p>
                      )}
                      {r.childAge && <p className="text-sm mt-1 font-semibold">🎂 Enfant : {r.childAge} ans</p>}
                      {r.childLevel && (
                        <p className="text-sm mt-1 font-semibold">
                          🎒 Niveau : {r.childLevel}{r.childClass ? ` — ${r.childClass}` : ""}
                        </p>
                      )}
                      {r.extraInfo && <p className="text-sm mt-1 text-muted-foreground">📝 {r.extraInfo}</p>}

                      {r.childrenCount && <p className="text-sm mt-1 font-semibold">🧸 {r.childrenCount}</p>}
                      {r.otherDetail && (
                        <p className="text-sm mt-1 font-semibold">✏️ {r.otherDetail}</p>
                      )}
                      {r.escortDestination && (
                        <p className="text-sm mt-1 font-semibold">🚸 {r.escortDestination}{r.escortDetail ? ` — ${r.escortDetail}` : ""}</p>
                      )}
                      {r.need === "Retrait ou dépôt d'un colis" && (
                        <p className="text-sm mt-1 font-semibold">📦 {r.parcelWeight} · {r.parcelSize}</p>
                      )}
                      {scheduled && (
                        <p className="text-sm mt-2 font-semibold">🗓️ {formatSchedule(r.scheduledAt!)}</p>
                      )}
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full shrink-0 ${scheduled ? "bg-accent text-foreground" : "bg-primary/10 text-primary"}`}>
                      {scheduled ? "RDV" : "URGENT · 1er répondant"}
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

      <CguPanel />
    </div>
  );
}

/* --- Compagnon : annulation d'un RDV & règles de radiation --- */

const STRIKES_KEY = "sos-companion-strikes";
function loadStrikes(): number {
  if (typeof window === "undefined") return 0;
  return Number(localStorage.getItem(STRIKES_KEY) || 0);
}
function saveStrikes(n: number) {
  try {
    localStorage.setItem(STRIKES_KEY, String(n));
    window.dispatchEvent(new Event("sos-strikes-changed"));
  } catch {}
}
function useStrikes(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const refresh = () => setN(loadStrikes());
    refresh();
    window.addEventListener("sos-strikes-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("sos-strikes-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return n;
}


function CompanionCancelBlock({ request }: { request: Request }) {
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState<"released" | "strike" | null>(null);
  const strikes = useStrikes();
  const inTime = canFreeCancel(request.scheduledAt);
  // Simulation : un autre compagnon est disponible sur ce créneau.
  const replacementAvailable = true;

  if (done === "released")
    return (
      <div className="rounded-2xl border-2 border-primary bg-accent p-4 text-left">
        <p className="text-sm font-bold">🔄 Mission libérée</p>
        <p className="text-sm text-muted-foreground mt-1">
          La recherche d'un autre compagnon a été relancée. La famille est prévenue par SMS.
        </p>
      </div>
    );

  if (done === "strike")
    return (
      <div className="rounded-2xl border-2 border-destructive bg-destructive/10 p-4 text-left">
        <p className="text-sm font-bold text-destructive">Rendez-vous non honoré enregistré</p>
        <p className="text-sm text-muted-foreground mt-1">
          Sans justificatif valable, ce désistement compte comme un manquement ({strikes}/3). À 3 manquements,
          votre compte est radié.
        </p>
      </div>
    );

  return (
    <div className="text-left">
      {!confirm ? (
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="text-sm font-bold text-destructive underline"
        >
          🚫 Je ne peux pas assurer cette mission
        </button>
      ) : (
        <div className="rounded-2xl border-2 border-border bg-card p-4">
          {inTime && replacementAvailable ? (
            <>
              <p className="text-sm font-bold">Annulation possible</p>
              <p className="text-sm text-muted-foreground mt-1">
                Plus de 48 h avant le rendez-vous et un autre compagnon est disponible : la mission repart en
                recherche, sans pénalité.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-bold text-destructive">Annulation tardive</p>
              <p className="text-sm text-muted-foreground mt-1">
                {inTime
                  ? "Aucun autre compagnon n'est disponible sur ce créneau."
                  : "Il reste moins de 48 h avant le rendez-vous."}{" "}
                Sans justificatif valable, ce désistement sera compté comme un rendez-vous non honoré (3 = radiation).
              </p>
            </>
          )}
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button
              type="button"
              onClick={() => setConfirm(false)}
              className="py-3 rounded-2xl border-2 border-border bg-card font-bold text-sm"
            >
              Je maintiens
            </button>
            <button
              type="button"
              onClick={() => {
                store.releaseRequest(request.id);
                if (inTime && replacementAvailable) {
                  setDone("released");
                } else {
                  saveStrikes(loadStrikes() + 1);
                  setDone("strike");
                }
              }}
              className="py-3 rounded-2xl bg-destructive text-destructive-foreground font-bold text-sm"
            >
              Confirmer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


function StudentDetail({ request, onBack }: { request: Request; onBack: () => void }) {
  const accepted = request.status === "accepted";
  const strikes = useStrikes();
  const banned = strikes >= 3;
  const [taken, setTaken] = useState(false);
  const accept = () => {
    if (banned) return;
    const ok = store.acceptRequest(request.id);
    if (!ok) setTaken(true);
  };



  return (
    <div className="flex-1 flex flex-col px-5 py-6 gap-5">
      <button onClick={onBack} className="text-base text-muted-foreground text-left">← Retour</button>
      <div className="bg-card rounded-3xl p-6 border-2 border-border">
        <p className="text-sm text-muted-foreground uppercase tracking-wide font-bold">Besoin</p>
        <p className="text-2xl font-bold mt-1">{request.need.includes("/") ? request.need.replace("/", " / ") : request.need}</p>
        {request.durationHours && request.durationHours > 1 && (
          <p className="text-base font-semibold mt-2">⏱️ Durée demandée : {request.durationHours}h</p>
        )}
        {(request.childLevel || request.childrenCount || request.escortDestination || request.otherDetail || request.childAge) && (
          <div className="mt-3 bg-accent rounded-xl p-3">
            <p className="text-xs text-muted-foreground font-bold uppercase">Enfant (3 ans et +)</p>
            {request.childAge && <p className="text-base font-semibold mt-1">🎂 {request.childAge} ans</p>}
            {request.childLevel && (
              <p className="text-base font-semibold mt-1">
                🎒 Niveau : {request.childLevel}{request.childClass ? ` — ${request.childClass}` : ""}
              </p>
            )}

            {request.childrenCount && <p className="text-base font-semibold mt-1">🧸 {request.childrenCount}</p>}
            {request.otherDetail && (
              <p className="text-base font-semibold mt-1">✏️ {request.otherDetail}</p>
            )}
            {request.escortDestination && (
              <p className="text-base font-semibold mt-1">🚸 {request.escortDestination}{request.escortDetail ? ` — ${request.escortDetail}` : ""}</p>
            )}
          </div>
        )}
        {request.extraInfo && (
          <div className="mt-3 bg-accent rounded-xl p-3">
            <p className="text-xs text-muted-foreground font-bold uppercase">Informations complémentaires</p>
            <p className="text-base mt-1">{request.extraInfo}</p>
          </div>
        )}

        {request.need === "Retrait ou dépôt d'un colis" && (
          <div className="mt-3 bg-accent rounded-xl p-3">
            <p className="text-xs text-muted-foreground font-bold uppercase">Colis</p>
            <p className="text-base font-semibold mt-1">⚖️ Poids : {request.parcelWeight}</p>
            <p className="text-base font-semibold mt-1">📦 Taille : {request.parcelSize}</p>
          </div>
        )}
        <p className="text-base text-muted-foreground mt-3">📍 {request.city}</p>
        {!accepted && (
          <>
            <p className="text-base font-semibold mt-1">🛣️ {maskAddress(request.address)}</p>
            <p className="text-xs text-muted-foreground mt-1">Numéro de rue masqué jusqu'à l'acceptation.</p>
          </>
        )}
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

      {taken ? (
        <div className="rounded-2xl border-2 border-warning bg-warning/10 p-5 text-center">
          <p className="text-lg font-black">⚡ Mission déjà attribuée</p>
          <p className="text-sm text-muted-foreground mt-1">
            Un autre compagnon a répondu en premier. La demande disparaît de votre liste.
          </p>
          <button onClick={onBack} className="btn-huge bg-primary text-primary-foreground w-full mt-4">
            Retour aux demandes
          </button>
        </div>
      ) : !accepted ? (
        <>
          <div className="bg-accent rounded-2xl p-4 text-sm">
            Vous voyez la rue et la ville. Le <b>numéro exact</b> et le <b>téléphone de la famille</b> seront
            révélés dès que vous aurez accepté la mission.
          </div>
          {!request.scheduledAt && (
            <div className="rounded-2xl border-2 border-primary/40 bg-primary/5 p-4 text-sm">
              🆘 <b>Urgence — premier répondant.</b> Le premier compagnon qui accepte verrouille la mission ; elle
              disparaît alors chez les autres.
            </div>
          )}
          <div className="flex-1" />
          <button
            onClick={accept}
            disabled={banned}
            className="btn-huge bg-success text-success-foreground disabled:opacity-50"
          >
            {banned ? "🚫 Compte radié" : "✅ Accepter la mission"}
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
            href={`sms:${request.phone}`}
            className="btn-huge bg-accent text-foreground border-2 border-primary text-center"
          >
            💬 Envoyer un message au client
          </a>
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(request.address)}`}
            target="_blank"
            rel="noreferrer"
            className="btn-huge bg-primary text-primary-foreground text-center"
          >
            🗺️ Itinéraire
          </a>
          {!!request.scheduledAt && <CompanionCancelBlock request={request} />}
        </>
      )}
    </div>
  );
}

/* ---------------- STUDENT ENROLLMENT ---------------- */

type DocKey =
  | "idCard"
  | "studentCard"
  | "criminalRecord"
  | "iban"
  | "addressProof"
  | "hostAttestation"
  | "hostAddressProof"
  | "hostId";
type HousingStatus = "owner" | "hosted";
type EnrollForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  situation: string;
  school: string;
  city: string;
  motivation: string;
  nir: string;
  housing: HousingStatus;
  selfie?: File;
  selfiePreview?: string;
  docs: Partial<Record<DocKey, File>>;
};

type DocColumn =
  | "id_card_path"
  | "situation_proof_path"
  | "criminal_record_path"
  | "iban_path"
  | "address_proof_path"
  | "host_attestation_path"
  | "host_address_proof_path"
  | "host_id_path";

const DOC_COLUMN: Record<DocKey, DocColumn> = {
  idCard: "id_card_path",
  studentCard: "situation_proof_path",
  criminalRecord: "criminal_record_path",
  iban: "iban_path",
  addressProof: "address_proof_path",
  hostAttestation: "host_attestation_path",
  hostAddressProof: "host_address_proof_path",
  hostId: "host_id_path",
};

/** Masque le NIR côté Compagnon : 1 ** ** ** *** *** ** */
function maskNir(v: string) {
  const d = v.replace(/\D/g, "");
  if (!d) return "";
  const groups = [1, 2, 2, 2, 3, 3, 2];
  let i = 0;
  const out: string[] = [];
  for (const g of groups) {
    const chunk = d.slice(i, i + g);
    if (!chunk) break;
    out.push(out.length === 0 ? chunk : "*".repeat(chunk.length));
    i += g;
  }
  return out.join(" ");
}

/** Contrôle de la clé du NIR (métropole) : clé = 97 - (13 premiers chiffres mod 97) */
function isNirValid(v: string) {
  const d = v.replace(/\D/g, "");
  if (d.length !== 15) return false;
  const body = d.slice(0, 13);
  const key = Number(d.slice(13));
  if (!/^\d{13}$/.test(body) || Number.isNaN(key)) return false;
  const expected = 97 - Number(BigInt(body) % 97n);
  return key === expected;
}

function StudentEnroll({
  session,
  app,
  loading,
  onDemo,
  onSubmitted,
}: {
  session: Session | null;
  app: CompanionApplicationRow | null;
  loading: boolean;
  onDemo: () => void;
  onSubmitted: () => void;
}) {
  const [step, setStep] = useState<"intro" | "auth" | "form">("intro");
  const [cguOk, setCguOk] = useState(false);
  const [nirFocus, setNirFocus] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [p, setP] = useState<EnrollForm>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    situation: "Étudiant(e)",
    school: "",
    city: "",
    motivation: "",
    nir: "",
    housing: "owner",
    docs: {},
  });

  // Pré-remplissage depuis le profil du compte ou la candidature existante
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
      if (cancelled) return;
      setP((prev) => ({
        ...prev,
        firstName: prev.firstName || app?.first_name || prof?.first_name || "",
        lastName: prev.lastName || app?.last_name || prof?.last_name || "",
        email: prev.email || app?.email || prof?.email || session.user.email || "",
        phone: prev.phone || app?.phone || prof?.phone || "",
        city: prev.city || app?.city || prof?.city || "",
        situation: app?.situation || prev.situation,
        school: prev.school || app?.school || "",
        motivation: prev.motivation || app?.motivation || "",
        nir: prev.nir || app?.nir || "",
        housing: (app?.housing_status as HousingStatus) || prev.housing,
      }));
    })();
    return () => {
      cancelled = true;
    };
  }, [session, app]);

  if (loading) {
    return <p className="flex-1 grid place-items-center text-muted-foreground">Chargement…</p>;
  }

  if (app?.status === "rejected" && step === "intro") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 gap-5 text-center">
        <div className="text-6xl">❌</div>
        <h2 className="text-2xl font-black">Candidature refusée</h2>
        <p className="text-base text-muted-foreground">Malheureusement votre dossier n'a pas été retenu.</p>
        {app.reject_reason && (
          <div className="w-full bg-destructive/10 border-2 border-destructive/40 rounded-2xl p-4 text-left">
            <p className="text-sm font-bold text-destructive">Motif</p>
            <p className="text-sm mt-1">{app.reject_reason}</p>
          </div>
        )}
        <button onClick={() => setStep("form")} className="btn-huge bg-primary text-primary-foreground">
          Refaire une candidature
        </button>
      </div>
    );
  }

  if (app?.status === "pending" && step === "intro") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 gap-5 text-center">
        <div className="text-6xl">📨</div>
        <h2 className="text-2xl font-black">Dossier envoyé !</h2>
        <p className="text-base text-muted-foreground">
          Solélia vérifie vos documents. Vous serez notifié dès la validation.
        </p>
        <div className="w-full bg-card border-2 border-border rounded-2xl p-5 text-left">
          <p className="text-sm text-muted-foreground">Candidat</p>
          <p className="text-lg font-bold">{app.first_name} {app.last_name}</p>
          <p className="text-sm text-muted-foreground mt-2">Situation</p>
          <p className="text-base">{app.situation} — {app.school}</p>
          <p className="text-sm text-muted-foreground mt-2">Statut</p>
          <p className="text-base font-semibold text-warning-foreground">⏳ En attente de vérification</p>
        </div>
        <button onClick={() => setStep("form")} className="text-sm text-muted-foreground underline">
          Modifier ma candidature
        </button>
      </div>
    );
  }

  if (step === "auth") {
    return (
      <div className="flex-1 flex flex-col px-5 py-6 gap-4">
        <button type="button" onClick={() => setStep("intro")} className="text-base text-muted-foreground text-left">
          ← Retour
        </button>
        <AuthCard
          title="Créer mon compte Compagnon"
          subtitle="Un compte est nécessaire pour déposer votre candidature."
          initialMode="signup"
          onSuccess={() => setStep("form")}
        />
      </div>
    );
  }

  if (step === "intro") {
    return (
      <div className="flex-1 flex flex-col px-6 py-8 gap-5">
      <div className="text-center">
          <div className="text-5xl mb-2">🤝</div>
          <h2 className="text-2xl font-black">Devenir Compagnon</h2>
          <p className="text-base text-muted-foreground mt-2">
            Étudiant, salarié, indépendant, retraité ou en recherche d'emploi : aidez des familles près de chez vous
            et gagnez un revenu complémentaire.
          </p>
        </div>
        <img
          src={floralBorderAsset.url}
          alt="Liseret floral"
          className="w-full max-w-[320px] h-auto object-contain opacity-90 self-center"
        />
        <div className="bg-card border-2 border-border rounded-2xl p-5">
          <p className="font-bold mb-3">Conditions</p>
          <ul className="space-y-2 text-sm">
            <li>✓ Être majeur (18 ans et +)</li>
            <li>✓ Pièce d'identité valide</li>
            <li>✓ Justificatif de domicile (ou dossier d'hébergement)</li>
            <li>✓ Justificatif de situation (carte étudiante, contrat de travail, attestation France Travail, notification de retraite…)</li>
            <li>✓ Extrait de casier judiciaire (bulletin n°3 de moins de 3 mois)</li>
            <li>✓ Numéro de Sécurité sociale (NIR)</li>
            <li>✓ RIB pour les paiements</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-left">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
            <div className="space-y-2 text-sm text-blue-900">
              <p>
                Le bulletin n°3 du casier judiciaire (datant de moins de 3 mois) est obligatoire pour valider votre inscription. La démarche est 100 % gratuite sur le site officiel du Ministère de la Justice.
              </p>
              <p className="font-medium">
                Astuce : connectez-vous avec FranceConnect pour recevoir votre extrait immédiatement.
              </p>
            </div>
          </div>
          <a
            href="https://casier-judiciaire.justice.gouv.fr/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-blue-600 px-4 py-4 text-base font-bold text-white shadow-sm transition-all active:scale-[0.98]"
          >
            Obtenir mon casier judiciaire (Gratuit - Ministère de la Justice)
          </a>
        </div>
        <ServiceLimitsNotice />
        <div className="flex-1" />
        <button onClick={() => setStep(session ? "form" : "auth")} className="btn-huge bg-primary text-primary-foreground">
          Commencer ma candidature
        </button>
        {!session && (
          <p className="text-xs text-muted-foreground text-center -mt-2">
            Déjà un compte ?{" "}
            <button type="button" onClick={() => setStep("auth")} className="underline font-bold text-primary">
              Se connecter
            </button>
          </p>
        )}
        <button
          type="button"
          onClick={onDemo}
          className="py-4 rounded-2xl border-2 border-primary text-primary font-bold text-base"
        >
          👁️ Aperçu de l'espace Compagnon (démo)
        </button>
      </div>
    );
  }

  if (!session) {
    setStep("auth");
    return null;
  }

  const ext = (f: File) => (f.name.split(".").pop() || "bin").toLowerCase();
  const upload = async (key: string, f: File) => {
    const path = `${session.user.id}/${key}-${Date.now()}.${ext(f)}`;
    const { error } = await supabase.storage.from("companion-docs").upload(path, f, { upsert: true, contentType: f.type });
    if (error) throw new Error(`Envoi du document « ${key} » impossible : ${error.message}`);
    return path;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) {
      setShowErrors(true);
      setErr("Votre inscription ne peut pas être validée. Veuillez compléter les pièces manquantes indiquées en rouge.");
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setShowErrors(false);
    setBusy(true);
    setErr(null);
    try {
      const paths: Partial<Record<(typeof DOC_COLUMN)[DocKey] | "selfie_path", string | null>> = {};
      for (const k of Object.keys(DOC_COLUMN) as DocKey[]) {
        const f = p.docs[k];
        if (f) paths[DOC_COLUMN[k]] = await upload(k, f);
      }
      if (p.selfie) paths.selfie_path = await upload("selfie", p.selfie);

      const row = {
        user_id: session.user.id,
        first_name: p.firstName.trim(),
        last_name: p.lastName.trim(),
        email: p.email.trim(),
        phone: p.phone.trim(),
        situation: p.situation,
        school: p.school.trim(),
        city: p.city.trim(),
        motivation: p.motivation.trim(),
        nir: p.nir.replace(/\D/g, ""),
        housing_status: p.housing,
        status: "pending" as const,
        reject_reason: null,
        reviewed_at: null,
        reviewed_by: null,
        ...paths,
      };
      const res = app
        ? await supabase.from("companion_applications").update(row).eq("id", app.id)
        : await supabase.from("companion_applications").insert(row);
      if (res.error) throw new Error(res.error.message);
      onSubmitted();
      setStep("intro");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Envoi impossible. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  const setDoc = (key: DocKey) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setP({ ...p, docs: { ...p.docs, [key]: f } });
  };

  const docs: { k: DocKey; label: string; icon: string }[] = [
    { k: "idCard", label: "Pièce d'identité", icon: "🪪" },
    { k: "studentCard", label: "Justificatif de situation (carte étudiante, contrat, attestation…)", icon: "📑" },
    { k: "criminalRecord", label: "Casier judiciaire (B3, moins de 3 mois)", icon: "📄" },
    { k: "iban", label: "RIB", icon: "🏦" },
  ];

  const housingDocs: { k: DocKey; label: string; icon: string }[] =
    p.housing === "owner"
      ? [{ k: "addressProof", label: "Justificatif de domicile (moins de 3 mois)", icon: "🏠" }]
      : [
          { k: "hostAttestation", label: "Attestation d'hébergement sur l'honneur (datée et signée)", icon: "✍️" },
          { k: "hostAddressProof", label: "Justificatif de domicile de l'hébergeur (moins de 3 mois)", icon: "🏠" },
          { k: "hostId", label: "Pièce d'identité de l'hébergeur", icon: "🪪" },
        ];

  // Un document déjà transmis lors d'une candidature précédente reste valable
  const hasDoc = (k: DocKey) => !!p.docs[k] || !!app?.[DOC_COLUMN[k]];
  const hasSelfie = !!p.selfie || !!app?.selfie_path;
  const allDocs = [...docs, ...housingDocs].every((d) => hasDoc(d.k));
  const nirDigits = p.nir.replace(/\D/g, "");
  const nirLenOk = nirDigits.length === 15;
  const nirKeyOk = isNirValid(nirDigits);
  const nirOk = nirLenOk && nirKeyOk;
  const valid = Boolean(
    p.firstName.trim() &&
      p.lastName.trim() &&
      p.email.trim() &&
      p.phone.trim() &&
      p.situation &&
      p.school.trim() &&
      p.city.trim() &&
      nirOk &&
      hasSelfie &&
      allDocs &&
      cguOk,
  );

  // Bordure rouge + message sous les éléments manquants après un clic sur « Envoyer »
  const bad = (ok: boolean) => showErrors && !ok;
  const errCls = (ok: boolean) => (bad(ok) ? " border-destructive bg-destructive/5" : "");
  const Missing = ({ ok, text }: { ok: boolean; text: string }) =>
    bad(ok) ? <p className="text-xs text-destructive font-semibold mt-1">{text}</p> : null;

  const setSelfie = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () =>
      setP({ ...p, selfie: f, selfiePreview: typeof reader.result === "string" ? reader.result : undefined });
    reader.readAsDataURL(f);
  };

  const field = "px-4 py-3 rounded-2xl border-2 border-border bg-card focus:border-primary outline-none";

  return (
    <form onSubmit={submit} className="flex-1 flex flex-col px-5 py-6 gap-4">
      <button type="button" onClick={() => setStep("intro")} className="text-base text-muted-foreground text-left">
        ← Retour
      </button>
      <h2 className="text-xl font-black">Ma candidature</h2>
      <p className="text-xs text-muted-foreground -mt-2">Connecté en tant que {session.user.email}</p>

      {showErrors && !valid && (
        <div className="rounded-2xl border-2 border-destructive bg-destructive/10 p-3">
          <p className="text-sm font-bold text-destructive">
            Votre inscription ne peut pas être validée. Veuillez compléter les pièces manquantes indiquées en rouge.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col">
          <input placeholder="Prénom" value={p.firstName} onChange={(e) => setP({ ...p, firstName: e.target.value })} className={field + errCls(!!p.firstName.trim())} />
          <Missing ok={!!p.firstName.trim()} text="Champ obligatoire" />
        </div>
        <div className="flex flex-col">
          <input placeholder="Nom" value={p.lastName} onChange={(e) => setP({ ...p, lastName: e.target.value })} className={field + errCls(!!p.lastName.trim())} />
          <Missing ok={!!p.lastName.trim()} text="Champ obligatoire" />
        </div>
      </div>
      <div className="flex flex-col">
        <input type="email" placeholder="Email" value={p.email} onChange={(e) => setP({ ...p, email: e.target.value })} className={field + errCls(!!p.email.trim())} />
        <Missing ok={!!p.email.trim()} text="Champ obligatoire" />
      </div>
      <div className="flex flex-col">
        <input type="tel" placeholder="Téléphone" value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} className={field + errCls(!!p.phone.trim())} />
        <Missing ok={!!p.phone.trim()} text="Champ obligatoire" />
      </div>
      <div>
        <p className="font-bold mb-2 text-sm">Votre situation</p>
        <div className="grid grid-cols-2 gap-2">
          {["Étudiant(e)", "Salarié(e)", "Indépendant(e)", "Retraité(e)", "En recherche d'emploi", "Autre"].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setP({ ...p, situation: s })}
              className={`py-3 px-2 rounded-2xl border-2 text-sm font-bold transition-all ${
                p.situation === s ? "border-primary bg-accent" : bad(!!p.situation) ? "border-destructive bg-destructive/5" : "border-border bg-card"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <Missing ok={!!p.situation} text="Sélection obligatoire" />
      </div>
      <div className="flex flex-col">
        <input placeholder="Établissement / employeur / activité" value={p.school} onChange={(e) => setP({ ...p, school: e.target.value })} className={field + errCls(!!p.school.trim())} />
        <Missing ok={!!p.school.trim()} text="Champ obligatoire" />
      </div>
      <div className="flex flex-col">
        <input placeholder="Ville" value={p.city} onChange={(e) => setP({ ...p, city: e.target.value })} className={field + errCls(!!p.city.trim())} />
        <Missing ok={!!p.city.trim()} text="Champ obligatoire" />
      </div>
      <textarea placeholder="Pourquoi voulez-vous rejoindre Solélia ?" value={p.motivation} onChange={(e) => setP({ ...p, motivation: e.target.value })} rows={3} className={field + " resize-none"} />

      <div>
        <p className="font-bold mb-2 text-sm">Numéro de Sécurité sociale (NIR — 15 chiffres)</p>
        <input
          inputMode="numeric"
          autoComplete="off"
          placeholder="1 23 45 67 890 123 45"
          value={nirFocus ? p.nir : maskNir(p.nir)}
          onFocus={() => setNirFocus(true)}
          onBlur={() => setNirFocus(false)}
          onChange={(e) => setP({ ...p, nir: e.target.value.replace(/[^\d ]/g, "").slice(0, 21) })}
          className={field + " w-full tracking-wider" + errCls(nirOk)}
        />
        <p className="text-xs text-muted-foreground mt-2">
          🔒 Ce numéro est strictement conservé pour établir vos déclarations administratives et contrats auprès de
          l'URSSAF.
        </p>
        {!nirLenOk && nirDigits.length > 0 && (
          <p className="text-xs text-destructive mt-1">Le NIR doit comporter 15 chiffres.</p>
        )}
        {nirLenOk && !nirKeyOk && (
          <p className="text-xs text-destructive font-semibold mt-1">Numéro de Sécurité sociale invalide (erreur de saisie).</p>
        )}
        <Missing ok={nirOk || nirDigits.length > 0} text="Champ obligatoire" />
      </div>

      <div>
        <p className="font-bold mb-2 text-sm">Quel est votre statut d'occupation ?</p>
        <div className="flex flex-col gap-2">
          {(
            [
              { v: "owner", label: "Je suis titulaire du logement" },
              { v: "hosted", label: "Je suis hébergé(e) par un tiers / mes parents" },
            ] as const
          ).map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => setP({ ...p, housing: o.v })}
              className={`py-3 px-4 rounded-2xl border-2 text-sm font-bold text-left transition-all ${
                p.housing === o.v ? "border-primary bg-accent" : "border-border bg-card"
              }`}
            >
              {p.housing === o.v ? "● " : "○ "}
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2">
        <p className="font-bold mb-2">Photo / Selfie</p>
        <p className="text-xs text-muted-foreground mb-2">
          Cette photo sera montrée à la famille pour qu'elle vous reconnaisse à la porte. Visage bien visible, sans lunettes de soleil ni casquette.
        </p>
        <label className={`flex items-center gap-4 p-3 rounded-2xl border-2 cursor-pointer ${hasSelfie ? "border-success bg-success/5" : bad(hasSelfie) ? "border-destructive bg-destructive/5" : "border-border bg-card"}`}>
          {p.selfiePreview ? (
            <img src={p.selfiePreview} alt="Selfie" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <span className="h-16 w-16 rounded-full bg-muted grid place-items-center text-2xl">{hasSelfie ? "✅" : "📸"}</span>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{hasSelfie ? "Photo enregistrée" : "Prendre un selfie"}</p>
            <p className="text-xs text-muted-foreground">{hasSelfie ? "Appuyez pour changer" : "Utilise la caméra frontale"}</p>
          </div>
          <input type="file" accept="image/*" capture="user" className="hidden" onChange={setSelfie} />
        </label>
        <Missing ok={hasSelfie} text="Photo obligatoire" />
      </div>

      <div className="mt-2">
        <p className="font-bold mb-2">Documents à fournir</p>
        <div className="flex flex-col gap-2">
          {[...docs, ...housingDocs].map((d) => (
            <div key={d.k}>
              <label className={`flex items-center gap-3 p-3 rounded-2xl border-2 cursor-pointer ${hasDoc(d.k) ? "border-success bg-success/5" : bad(hasDoc(d.k)) ? "border-destructive bg-destructive/5" : "border-border bg-card"}`}>
                <span className="text-2xl">{d.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{d.label}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {p.docs[d.k] ? `✓ ${p.docs[d.k]!.name}` : hasDoc(d.k) ? "✓ Document déjà transmis" : "Aucun fichier"}
                  </p>
                </div>
                <span className="text-xs font-bold text-primary">{hasDoc(d.k) ? "Modifier" : "Ajouter"}</span>
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={setDoc(d.k)} />
              </label>
              <Missing ok={hasDoc(d.k)} text="Pièce justificative obligatoire" />
            </div>
          ))}
        </div>
      </div>

      <div className={bad(cguOk) ? "rounded-2xl border-2 border-destructive bg-destructive/5 p-1" : ""}>
        <CguAcceptBlock checked={cguOk} onChange={setCguOk} role="companion" />
        <Missing ok={cguOk} text="Acceptation des CGU obligatoire" />
      </div>

      {err && <p className="text-sm text-destructive text-center font-semibold">{err}</p>}
      <button type="submit" disabled={busy} className="btn-huge bg-primary text-primary-foreground disabled:opacity-50 mt-2">
        {busy ? "Envoi en cours…" : "Envoyer ma candidature"}
      </button>
      <ServiceLimitsNotice />
      <p className="text-xs text-muted-foreground text-center">🔒 Vos documents sont stockés de façon privée et consultés uniquement par Solélia.</p>
    </form>
  );
}

function FamilyAccountScreen({ onBack }: { onBack: () => void }) {
  const account = useFamilyAccount();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [showYear, setShowYear] = useState<number | null>(null);

  if (!account) {
    const submit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!fullName.trim() || !email.trim()) return;
      saveFamilyAccount({
        email: email.trim(),
        fullName: fullName.trim(),
        createdAt: Date.now(),
        orders: [],
      });
    };
    return (
      <form onSubmit={submit} className="flex-1 flex flex-col px-5 py-6 gap-4">
        <button type="button" onClick={onBack} className="text-base text-muted-foreground text-left">← Retour</button>
        <div className="text-center">
          <div className="text-5xl">👤</div>
          <h2 className="text-2xl font-black mt-2">Créer mon compte</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Retrouvez l'historique de vos missions et votre récapitulatif fiscal annuel.
          </p>
        </div>
        <div className="bg-success/10 border-2 border-success/40 rounded-2xl p-3 text-sm">
          💳 <b>CESU préfinancé</b> — crédit d'impôt SAP de 50 % déduit immédiatement : vous ne réglez que la moitié
          du tarif, et retrouvez votre attestation fiscale annuelle ici.
        </div>
        <input
          required
          placeholder="Nom et prénom"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="px-5 py-4 rounded-2xl border-2 border-border bg-card text-lg focus:border-primary outline-none"
        />
        <input
          required
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="px-5 py-4 rounded-2xl border-2 border-border bg-card text-lg focus:border-primary outline-none"
        />
        <div className="flex-1" />
        <button type="submit" className="btn-huge bg-primary text-primary-foreground">
          Créer mon compte
        </button>
      </form>
    );
  }

  // Aggregate orders by year
  const byYear = new Map<number, Order[]>();
  for (const o of account.orders) {
    const y = new Date(o.date).getFullYear();
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y)!.push(o);
  }
  const years = Array.from(byYear.keys()).sort((a, b) => b - a);

  if (showYear !== null) {
    const orders = byYear.get(showYear) ?? [];
    const totalYear = orders.reduce((s, o) => s + o.total, 0);
    const creditYear = totalYear * TAX_CREDIT_RATE;
    return (
      <div className="flex-1 flex flex-col px-5 py-6 gap-4">
        <button onClick={() => setShowYear(null)} className="text-base text-muted-foreground text-left">← Retour au compte</button>
        <div>
          <h2 className="text-2xl font-black">Récapitulatif fiscal {showYear}</h2>
          <p className="text-sm text-muted-foreground mt-1">Attestation Services à la Personne</p>
        </div>
        <div className="bg-card rounded-2xl p-5 border-2 border-border">
          <p className="text-sm text-muted-foreground">Titulaire</p>
          <p className="text-lg font-bold">{account.fullName}</p>
          <p className="text-xs text-muted-foreground mt-1">{account.email}</p>
        </div>
        <div className="bg-success/10 border-2 border-success/40 rounded-2xl p-5">
          <div className="flex justify-between text-base">
            <span className="text-muted-foreground">Total dépensé en {showYear}</span>
            <span className="font-black">{formatPrice(totalYear)} €</span>
          </div>
          <div className="flex justify-between text-base mt-2">
            <span className="text-muted-foreground">Nombre de missions</span>
            <span className="font-semibold">{orders.length}</span>
          </div>
          <div className="h-px bg-success/30 my-3" />
          <div className="flex justify-between text-lg font-black text-success">
            <span>💰 Crédit d'impôt (50 %)</span>
            <span>{formatPrice(creditYear)} €</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Montant à reporter sur votre déclaration de revenus (case 7DB) pour bénéficier du crédit d'impôt SAP.
          </p>
        </div>
        <div>
          <p className="font-bold mb-2">Détail des missions</p>
          <div className="flex flex-col gap-2">
            {orders.map((o) => (
              <div key={o.id} className="bg-card rounded-xl p-3 border-2 border-border text-sm">
                <div className="flex justify-between font-semibold">
                  <span>{o.need}</span>
                  <span>{formatPrice(o.total)} €</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(o.date).toLocaleDateString("fr-FR")} · {o.address}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const totalAll = account.orders.reduce((s, o) => s + o.total, 0);
  const currentYear = new Date().getFullYear();

  return (
    <div className="flex-1 flex flex-col px-5 py-6 gap-4">
      <button onClick={onBack} className="text-base text-muted-foreground text-left">← Retour</button>
      <div className="bg-card rounded-3xl p-5 border-2 border-border flex items-center gap-4">
        <div className="h-14 w-14 rounded-full bg-primary text-primary-foreground grid place-items-center text-2xl font-black">
          {account.fullName.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold truncate">{account.fullName}</p>
          <p className="text-xs text-muted-foreground truncate">{account.email}</p>
        </div>
      </div>

      <div className="bg-success/10 border-2 border-success/40 rounded-2xl p-4">
        <p className="text-sm font-bold text-success">🇫🇷 Services à la personne</p>
        <p className="text-xs text-muted-foreground mt-1">
          Total dépensé : <b className="text-foreground">{formatPrice(totalAll)} €</b> ·
          Crédit d'impôt estimé : <b className="text-success">{formatPrice(totalAll * TAX_CREDIT_RATE)} €</b>
        </p>
      </div>

      <div>
        <p className="font-bold mb-2">📊 Récapitulatif fiscal annuel</p>
        {years.length === 0 ? (
          <div className="bg-card rounded-2xl p-4 border-2 border-border text-sm text-muted-foreground text-center">
            Vous n'avez pas encore de commande. Votre récapitulatif {currentYear} sera généré automatiquement en janvier {currentYear + 1}.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {years.map((y) => {
              const orders = byYear.get(y)!;
              const total = orders.reduce((s, o) => s + o.total, 0);
              return (
                <button
                  key={y}
                  onClick={() => setShowYear(y)}
                  className="text-left bg-card rounded-2xl p-4 border-2 border-border hover:border-primary"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-bold">Année {y}</p>
                      <p className="text-xs text-muted-foreground">{orders.length} mission(s) · {formatPrice(total)} €</p>
                    </div>
                    <span className="text-sm font-bold text-primary">Voir →</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <p className="font-bold mb-2">🗂️ Historique des commandes</p>
        {account.orders.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Aucune commande pour le moment.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {account.orders.map((o) => (
              <div key={o.id} className="bg-card rounded-2xl p-4 border-2 border-border">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <p className="font-bold">{o.need}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(o.date).toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 truncate">📍 {o.address}</p>
                    {o.studentName && <p className="text-xs mt-1">🎓 {o.studentName}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-black">{formatPrice(o.total)} €</p>
                    <p className="text-[11px] text-success">–50 % SAP</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => { if (confirm("Se déconnecter de votre compte ?")) saveFamilyAccount(null); }}
        className="text-sm text-muted-foreground underline mt-2"
      >
        Se déconnecter
      </button>
    </div>
  );
}

