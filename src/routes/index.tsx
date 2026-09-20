import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAccess, useSession } from "@/lib/auth";
import { AuthCard } from "@/components/AuthCard";
import { store, useStore, randomStudent, COMPANIONS, experienceBadge, type NeedType, type Request, type Companion } from "@/lib/store";
import { CguAcceptBlock, CguPanel } from "@/components/Cgu";
import { CesuRecurrenceModal } from "@/components/CesuRecurrence";
import { startOfWeek, subWeeks } from "date-fns";
import { checkContractRequirement, type ContractCheckResult } from "@/lib/contractCompliance";
import {
  CompanionProfileHeader,
  ExperienceBadgeChip,
  ExperienceBadgeScale,
  ThumbsCount,
  ThumbUpButton,
} from "@/components/CompanionBadges";
import { CompanionProfilePanel } from "@/components/CompanionProfilePanel";
import { AccountInfoPanel } from "@/components/AccountInfoPanel";
import { ClientDocumentsPanel } from "@/components/ClientDocumentsPanel";
import { CompanionAvailabilityPanel } from "@/components/CompanionAvailabilityPanel";
import { useCompanionSettings } from "@/lib/companionSettings";
import soleliaLogoAsset from "@/assets/solelia-logo.png.asset.json";
import floralBorderAsset from "@/assets/floral-border.jpg.asset.json";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Solélia Accompagnement — Présence à domicile" },
      { name: "description", content: "Mise en relation entre familles et compagnons de confiance pour du présence et de l'accompagnement à domicile." },
      { property: "og:title", content: "Solélia Accompagnement" },
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
        <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full" aria-hidden="true">
          <img
            src={soleliaLogoAsset.url}
            alt=""
            className="h-full w-full scale-125 object-cover"
          />
        </span>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-black leading-none">Solélia Accompagnement</h1>
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
  if (need === "Accompagnement sorties extérieures") {
    return <div className="text-sm font-semibold leading-tight">{need}</div>;
  }
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

function ServiceLimitsNotice({ className = "", extra, hideBase = false }: { className?: string; extra?: string; hideBase?: boolean }) {
  return (
    <div className={`mt-3 rounded-2xl border-2 border-warning/40 bg-warning/10 p-3 text-xs leading-relaxed ${className}`}>
      <p className="font-bold mb-1">⚠️ Services non autorisés</p>
      {!hideBase && (
        <p>
          Les compagnons ne peuvent réaliser aucun service relevant d'une compétence médicale ou paramédicale
          (soins, injections, médicaments administrés, toilette, transferts), d'un apprentissage ou d'un enseignement
          certifiant (conduite, cours diplômants), d'une profession réglementée (juridique, comptable, financière,
          travaux du bâtiment, électricité, gaz), ni aucune activité illégale, dangereuse ou discriminatoire
          (transport de substances interdites, manipulation d'argent liquide, garde d'enfant de moins de 3 ans,
          port de charges lourdes, intervention sur animaux malades).
        </p>
      )}
      {extra && <p className={hideBase ? "" : "mt-2 font-semibold"}>{extra}</p>}
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

/** Modèle mandataire : seul montant réglé sur la plateforme */
const SERVICE_FEE = 6; // frais de service mandataire Solélia (forfait fixe)
const DEFAULT_HOURLY_RATE = 11.5; // salaire net horaire conseillé, congés payés inclus

/**
 * Anticipation du statut SAP : à passer à `true` manuellement une fois le
 * numéro de déclaration SAP obtenu. Tant que false, aucun crédit d'impôt
 * n'est calculé ni affiché sur les frais de service.
 */
const sapDeclarationActive = false;
const SAP_DECLARATION_NUMBER = "SAP-EN-COURS"; // numéro de déclaration SAP (à renseigner)

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
  serviceFee: number; // frais de service réglés sur la plateforme
  salaireNetHoraire: number; // salaire net horaire retenu par le client
  cesuActive: boolean; // statut CESU+ du compagnon au moment de la réservation
  studentName?: string;
};

type FamilyAccount = {
  email: string;
  fullName: string;
  createdAt: number;
  orders: Order[];
};

// Ancien compte local (avant authentification réelle) — conservé uniquement
// pour la migration douce vers le profil Supabase.
const FAMILY_ACCOUNT_KEY = "sos-family-account";
// Historique local des missions (prototype) — conservé par navigateur.
const FAMILY_ORDERS_KEY = "sos-family-orders";

function loadLegacyFamilyAccount(): FamilyAccount | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(FAMILY_ACCOUNT_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function loadFamilyOrders(): Order[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FAMILY_ORDERS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}
function saveFamilyOrders(orders: Order[]) {
  try {
    localStorage.setItem(FAMILY_ORDERS_KEY, JSON.stringify(orders));
    window.dispatchEvent(new Event("sos-family-account-changed"));
  } catch {}
}
function useFamilyOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  useEffect(() => {
    setOrders(loadFamilyOrders());
    const refresh = () => setOrders(loadFamilyOrders());
    window.addEventListener("storage", refresh);
    window.addEventListener("sos-family-account-changed", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("sos-family-account-changed", refresh);
    };
  }, []);
  return orders;
}
function addOrderToAccount(order: Order) {
  saveFamilyOrders([order, ...loadFamilyOrders()]);
}

/**
 * Migration douce : pré-remplit le profil Supabase à partir de l'ancien compte
 * local si ses champs sont encore vides, conserve l'historique des missions,
 * puis supprime l'ancienne clé pour n'avoir qu'une seule source de vérité.
 */
async function migrateLegacyFamilyAccount(userId: string) {
  const legacy = loadLegacyFamilyAccount();
  if (!legacy) return;
  try {
    // Conserve l'historique des missions sous la nouvelle clé.
    const existing = loadFamilyOrders();
    const known = new Set(existing.map((o) => o.id));
    saveFamilyOrders([...legacy.orders.filter((o) => !known.has(o.id)), ...existing]);

    const parts = legacy.fullName.trim().split(/\s+/);
    const firstName = parts[0] ?? "";
    const lastName = parts.slice(1).join(" ");
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name,last_name,email")
      .eq("id", userId)
      .maybeSingle();
    const update: Database["public"]["Tables"]["profiles"]["Update"] = {};
    if (profile && !profile.first_name && firstName) update.first_name = firstName;
    if (profile && !profile.last_name && lastName) update.last_name = lastName;
    if (profile && !profile.email && legacy.email) update.email = legacy.email;
    if (Object.keys(update).length > 0) {
      await supabase.from("profiles").update(update).eq("id", userId);
    }
  } finally {
    try {
      localStorage.removeItem(FAMILY_ACCOUNT_KEY);
    } catch {}
  }
}

function ServiceFeeHint({ className = "" }: { className?: string }) {
  return (
    <div className={`text-xs text-muted-foreground ${className}`}>
      💚 Vous réglez uniquement <b className="text-success">{formatPrice(SERVICE_FEE)} €</b> de frais de service sur
      Solélia. Le salaire du compagnon est fixé et réglé séparément.
    </div>
  );
}

/* ---------------- FAMILY ---------------- */

function FamilyFlow() {
  const [step, setStep] = useState<"home" | "form" | "wait" | "account">("home");
  const [requestMode, setRequestMode] = useState<"asap" | "scheduled">("asap");
  const [simulateNoAnswer, setSimulateNoAnswer] = useState(false);
  const [editRequest, setEditRequest] = useState<Request | null>(null);
  const currentId = useStore((s) => s.currentRequestId);
  const current = useStore((s) => s.requests.find((r) => r.id === s.currentRequestId));
  const { session, loading: sessionLoading } = useSession();
  const sessionFirstName =
    (session?.user.user_metadata?.first_name as string | undefined)?.trim() || "";

  // Simulation « premier répondant » : un compagnon disponible accepte la mission.
  useEffect(() => {
    if (step !== "wait" || !currentId || current?.status !== "searching") return;
    if (simulateNoAnswer) return;
    const preferredId = current?.preferredCompanionId;
    const delay = preferredId ? 6000 : current?.scheduledAt ? 5000 : 3500;
    const t = setTimeout(() => {
      if (preferredId) store.acceptRequestBy(currentId, preferredId);
      else {
        // Exclut les compagnons déjà écartés pour éviter de rouvrir la même alerte.
        const target = current?.scheduledAt ?? Date.now();
        const durationMin = current?.durationHours ? current.durationHours * 60 : DEFAULT_DURATION_MIN;
        const pool = COMPANIONS.filter(
          (c) =>
            !(current?.declinedBy ?? []).includes(c.id) &&
            isCompanionAvailableFor(c, target, durationMin),
        );
        // Aucun compagnon libre sur ce créneau : on laisse la demande en recherche.
        if (pool.length === 0) return;
        const chosen = pool[Math.floor(Math.random() * pool.length)];
        store.acceptRequestBy(currentId, chosen.id);
      }
    }, delay);
    return () => clearTimeout(t);
  }, [step, current?.status, current?.preferredCompanionId, current?.scheduledAt, current?.durationHours, currentId, simulateNoAnswer]);


  if (step === "account") return <FamilyAccountScreen onBack={() => setStep("home")} />;

  if (step === "home")
    return (
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-8 gap-5">
        <button
          onClick={() => setStep("account")}
          className="self-end text-sm font-semibold text-primary underline"
        >
          {session ? `👤 ${sessionFirstName || "Mon compte"}` : "👤 Mon compte"}
        </button>
        <div className="flex flex-col items-center gap-1">
          <div
            className="text-center space-y-1 text-lg leading-snug"
            style={{ fontFamily: "'Parisienne', cursive", color: "#4A1525" }}
          >
            <p>Pour rompre l'isolement,</p>
            <p>Accompagner les enfants,</p>
            <p>Soutenir une personne temporairement ou durablement fragilisée,</p>
            <p>Et être présent dans les moments où l'on a simplement besoin de quelqu'un.</p>
          </div>
          <div className="h-24 w-full max-w-[320px] overflow-hidden" aria-hidden="true">
            <img
              src={floralBorderAsset.url}
              alt=""
              className="h-full w-full object-cover opacity-90"
            />
          </div>
        </div>
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
          <p className="text-sm font-bold text-success text-center">💳 Solélia, votre mandataire</p>
          <ul className="text-xs text-muted-foreground mt-2 space-y-1 list-disc pl-4">
            <li>
              <b className="text-foreground">Frais de service uniques</b> : {formatPrice(SERVICE_FEE)} € par mission,
              quels que soient la durée et le compagnon choisi.
            </li>
            <li>
              <b className="text-foreground">Vous êtes particulier employeur</b> : le salaire net conseillé est de{" "}
              {formatPrice(DEFAULT_HOURLY_RATE)} €/h (congés payés inclus) et reste modifiable.
            </li>
            <li>
              <b className="text-foreground">Zéro démarche</b> : Solélia transmet les déclarations à l'URSSAF.
              Votre attestation fiscale officielle est délivrée par l'URSSAF.
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
          <button
            type="button"
            onClick={() => (editRequest ? (setEditRequest(null), setStep("wait")) : setStep("home"))}
            className="text-base text-muted-foreground text-left"
          >
            ← Retour
          </button>
          <AuthCard
            title="Connectez-vous pour continuer"
            subtitle="Un compte est nécessaire pour réserver un compagnon."
            onSuccess={() => {}}
          />
        </div>
      );
    return (
      <FamilyForm
        mode={editRequest ? (editRequest.scheduledAt ? "scheduled" : "asap") : requestMode}
        initial={editRequest}
        editId={editRequest?.id}
        onSubmit={() => { setEditRequest(null); setStep("wait"); }}
        onBack={() => (editRequest ? (setEditRequest(null), setStep("wait")) : setStep("home"))}
      />
    );
  }

  return (
    <FamilyWait
      request={current}
      simulateNoAnswer={simulateNoAnswer}
      onSimulateNoAnswer={setSimulateNoAnswer}
      onEditRequest={(req) => { const r = req ?? current; if (r) { setEditRequest(r); setStep("form"); } }}
      onDone={() => { store.clearCurrent(); setSimulateNoAnswer(false); setEditRequest(null); setStep("home"); }}
    />
  );
}


function FamilyForm({
  mode,
  onSubmit,
  onBack,
  initial,
  editId,
}: {
  mode: "asap" | "scheduled";
  onSubmit: () => void;
  onBack: () => void;
  initial?: Request | null; // demande existante à modifier (données pré-remplies)
  editId?: string; // id de la demande remplacée à la validation
}) {
  // Extraction des commissions stockées dans extraInfo lors d'une édition
  const parsed = (() => {
    const text = initial?.extraInfo ?? "";
    const m = text.match(/^Commissions demandées dans le prolongement de la présence : (.*)(?:\n([\s\S]*))?$/);
    if (!m) return { commissions: [] as string[], rest: text };
    return { commissions: m[1].split(", ").filter(Boolean), rest: (m[2] ?? "").trim() };
  })();
  const [need, setNeed] = useState<NeedType>(initial?.need ?? "Compagnie/Présence");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [durationHours, setDurationHours] = useState<number>(initial?.durationHours ?? 1);
  const [parcelWeight, setParcelWeight] = useState<string>(initial?.parcelWeight ?? "moins de 2 kg");
  const [parcelSize, setParcelSize] = useState<string>(initial?.parcelSize ?? "Petit (enveloppe / boîte à chaussures)");
  // default schedule: today + 2h, rounded to next hour
  const defaultSched = () => {
    const d = new Date(initial?.scheduledAt ?? Date.now() + 2 * 60 * 60 * 1000);
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

  const [autoSearch, setAutoSearch] = useState<boolean | null>(
    initial?.autoSearch !== undefined ? initial.autoSearch : null,
  );
  const [pickedCompanion, setPickedCompanion] = useState<string>(initial?.preferredCompanionId ?? "");

  const [childLevel, setChildLevel] = useState<string>(initial?.childLevel ?? "Primaire");
  const [childClass, setChildClass] = useState<string>(initial?.childClass ?? "");
  const [childAge, setChildAge] = useState<string>(initial?.childAge ?? "");
  const [childAges, setChildAges] = useState<string[]>(initial?.childAges ?? [""]);
  const [childrenCount, setChildrenCount] = useState<string>(
    initial?.childrenCount === "2 enfants"
      ? "2 enfants"
      : initial?.childrenCount && initial.childrenCount !== "1 enfant"
        ? "3 enfants"
        : "1 enfant",
  );
  const [escortDestination, setEscortDestination] = useState<string>(initial?.escortDestination ?? "À l'école");
  const [escortDetail, setEscortDetail] = useState<string>(initial?.escortDetail ?? "");
  const [otherDetail, setOtherDetail] = useState<string>(initial?.otherDetail ?? "");
  const [extraInfo, setExtraInfo] = useState<string>(parsed.rest);
  const [missionInfo, setMissionInfo] = useState<string>(initial?.missionInfo ?? "");
  
  const [cguOk, setCguOk] = useState(false);
  const [complianceCheck, setComplianceCheck] = useState<ContractCheckResult | null>(null);
  const [whenError, setWhenError] = useState(false);
  // Panneau de simulation (tests)
  const [simCompanion, setSimCompanion] = useState<string>("");
  const [simWeeks, setSimWeeks] = useState(0);
  const [simHours, setSimHours] = useState(0);
  // Commissions extérieures rattachées à une présence à domicile (conformité SAP)
  const [commissions, setCommissions] = useState<string[]>(parsed.commissions);
  const [commissionCertified, setCommissionCertified] = useState(parsed.commissions.length > 0);

  const needs: { v: NeedType; icon: string }[] = [
    { v: "Compagnie/Présence", icon: "🤝" },
    { v: "Ménage/Rangement intérieur", icon: "🧹" },
    { v: "Jardinage/Rangement extérieur", icon: "🌿" },
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
  const isMultiChild = isChildcare || isEscortChild;
  const childCountNum =
    childrenCount === "1 enfant"
      ? 1
      : childrenCount === "2 enfants"
        ? 2
        : 3;
  // Synchronise le tableau des âges avec le nombre d'enfants (tronque ou complète).
  const syncAges = (n: number) =>
    setChildAges((prev) => {
      const next = prev.slice(0, n);
      while (next.length < n) next.push("");
      return next;
    });
  const isCleaning = need === "Ménage/Rangement intérieur";
  const isGardening = need === "Jardinage/Rangement extérieur";

  const [continuity, setContinuity] = useState(initial?.continuityCertified ?? false);
  const isOutdoor =
    need === "Retrait ou dépôt d'un colis" || need === "Pharmacie" || need === "Courses urgentes";

  const createAndGo = (companionOverride?: string) => {
    const companion = companionOverride ?? pickedCompanion;
    const scheduledAt = mode === "scheduled" ? new Date(when).getTime() : null;
    const dh = durationHours;
    const isParcel = need === "Retrait ou dépôt d'un colis";
    store.createRequest({
      need,
      address,
      phone,
      scheduledAt,
      flow: mode === "scheduled" ? "scheduled" : "sos",
      autoSearch: mode === "scheduled" ? Boolean(autoSearch) : true,
      preferredCompanionId:
        mode === "scheduled" && autoSearch === false && companion ? companion : undefined,
      durationHours: dh,

      parcelWeight: isParcel ? parcelWeight : undefined,
      parcelSize: isParcel ? parcelSize : undefined,
      childLevel: isHomework ? childLevel : undefined,
      childClass: isHomework && childClass.trim() ? childClass.trim() : undefined,
      childAge: isHomework && childAge.trim() ? childAge.trim() : undefined,
      childAges: isMultiChild ? childAges.slice(0, childCountNum).map((a) => a.trim()) : undefined,
      childrenCount: isMultiChild ? childrenCount : undefined,
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
      missionInfo: missionInfo.trim() || undefined,
      continuityCertified:
        isOutdoor
          ? continuity
          : need === "Compagnie/Présence" && commissions.length > 0
            ? commissionCertified
            : undefined,
    });
    // En cas de modification, l'ancienne demande est remplacée par la nouvelle.
    if (editId) store.discardRequest(editId);
    onSubmit();
  };

  // Injecte les missions fictives du panneau de simulation puis lance le contrôle réel.
  const runComplianceCheck = (companionId: string): ContractCheckResult | null => {
    const bookingTs = new Date(when).getTime();
    const target = simCompanion || companionId;
    const sims: Request[] = [];
    const weekStart = startOfWeek(new Date(bookingTs), { weekStartsOn: 1 });
    const companionObj = COMPANIONS.find((c) => c.id === target);
    if (companionObj) {
      for (let i = 1; i <= simWeeks; i++) {
        const d = subWeeks(weekStart, i).getTime() + 24 * 60 * 60 * 1000;
        sims.push({
          id: `sim-w${i}`,
          need: "Compagnie/Présence",
          address: "Simulation",
          city: "Simulation",
          phone: "",
          seniorName: "Vous",
          createdAt: d,
          scheduledAt: d,
          durationHours: 1,
          status: "accepted",
          student: companionObj,
        });
      }
      if (simHours > 0) {
        const d = weekStart.getTime() + 60 * 60 * 1000;
        sims.push({
          id: "sim-h",
          need: "Compagnie/Présence",
          address: "Simulation",
          city: "Simulation",
          phone: "",
          seniorName: "Vous",
          createdAt: d,
          scheduledAt: d,
          durationHours: simHours,
          status: "accepted",
          student: companionObj,
        });
      }
    }
    store.setSimulatedRequests(sims);
    return checkContractRequirement(
      companionId,
      bookingTs,
      durationHours,
      store.getState().requests,
    );
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim() || !phone.trim()) return;
    if (need === "Autre (à préciser)" && !otherDetail.trim()) return;
    
    if (need === "Compagnie/Présence" && commissions.length > 0 && !commissionCertified) return;
    if (isOutdoor && !continuity) return;
    if (isHomework && (!childAge.trim() || Number(childAge) < 3)) return;
    if (
      isMultiChild &&
      childAges.slice(0, childCountNum).some((a) => !a.trim() || Number(a) < 3)
    )
      return;
    if (mode === "scheduled" && (autoSearch === null || (!autoSearch && !pickedCompanion))) return;
    if (!cguOk) return;

    // Un rendez-vous doit être pris au moins 24 h à l'avance.
    if (mode === "scheduled" && new Date(when).getTime() - Date.now() < 24 * 60 * 60 * 1000) {
      setWhenError(true);
      return;
    }
    setWhenError(false);

    if (mode === "scheduled" && autoSearch === false && pickedCompanion) {
      const check = runComplianceCheck(pickedCompanion);
      if (check?.requiresContract) {
        setComplianceCheck(check);
        return;
      }
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
          {isHomework && (
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
          )}
          {isMultiChild && (
            <div className="flex flex-col gap-4">
              {Array.from({ length: childCountNum }, (_, i) => (
                <div key={i}>
                  <label className="block text-lg font-bold mb-2">Âge de l'enfant {i + 1}</label>
                  <input
                    type="number"
                    min={3}
                    max={17}
                    required
                    value={childAges[i] ?? ""}
                    onChange={(e) =>
                      setChildAges((prev) => {
                        const next = [...prev];
                        next[i] = e.target.value;
                        return next;
                      })
                    }
                    placeholder="Ex. 6"
                    className="w-full px-5 py-4 rounded-2xl border-2 border-border bg-card text-lg focus:border-primary outline-none"
                  />
                  {childAges[i] && Number(childAges[i]) < 3 && (
                    <p className="text-sm text-destructive mt-2">
                      Les missions avec enfant sont réservées aux enfants de 3 ans et plus.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
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

          {isMultiChild && (
            <div>
              <label className="block text-lg font-bold mb-2">Nombre d'enfants</label>
              <div className="grid grid-cols-3 gap-2">
                {["1 enfant", "2 enfants", "3 enfants"].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setChildrenCount(c);
                      syncAges(
                        c === "1 enfant"
                          ? 1
                          : c === "2 enfants"
                            ? 2
                            : 3,
                      );
                    }}
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
                  "À la bibliothèque",
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
      {isGardening && (
        <div className="rounded-2xl border-2 border-border bg-accent p-3 text-xs leading-relaxed">
          🌿 Petits travaux de jardinage : plafond fiscal spécifique de 5 000 € par an et par foyer fiscal
          pour le crédit d'impôt (distinct du plafond global des autres services à la personne).
        </div>
      )}
      {(isCleaning || isGardening) && (
        <ServiceLimitsNotice
          hideBase
          extra={
            isGardening
              ? "Le compagnon ne peut utiliser aucun outil motorisé dangereux (tronçonneuse, taille-haie thermique, débroussailleuse), ne peut intervenir en hauteur (élagage, taille d'arbres) ni utiliser de produits phytosanitaires professionnels. Seuls les petits travaux d'entretien courant sont autorisés (tonte, désherbage manuel, arrosage, petit rangement)."
              : "Le compagnon ne peut effectuer aucun nettoyage en hauteur sans équipement adapté (vitres extérieures, lustres), ni utiliser de produits d'entretien professionnels ou dangereux. Seul l'entretien courant du logement est autorisé (rangement, dépoussiérage, sols, vaisselle, linge)."
          }
        />
      )}
      <div>
        <label className="block text-lg font-bold mb-2">Durée souhaitée</label>
        <p className="text-sm text-muted-foreground mb-3">
          Indiquez le temps d'intervention souhaité.
        </p>
        <div className="grid grid-cols-3 gap-2">
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
          <button
            type="button"
            onClick={() => setDurationHours((d) => (d >= 5 ? d : 5))}
            className={`py-3 rounded-2xl border-2 text-base font-bold transition-all ${
              durationHours >= 5 ? "border-primary bg-accent" : "border-border bg-card"
            }`}
          >
            5h et plus
          </button>
        </div>
        {durationHours >= 5 && (
          <div className="mt-3">
            <p className="text-sm font-semibold mb-1">Durée précise : {durationHours}h</p>
            <input
              type="range"
              min={5}
              max={12}
              step={1}
              value={durationHours}
              onChange={(e) => setDurationHours(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>
        )}
        <ServiceFeeHint className="mt-2" />
      </div>
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
            onChange={(e) => {
              setWhen(e.target.value);
              setWhenError(false);
            }}
            className={`w-full px-5 py-4 rounded-2xl border-2 bg-card text-lg outline-none ${
              whenError ? "border-destructive" : "border-border focus:border-primary"
            }`}
          />
          {whenError && (
            <p className="text-xs font-semibold text-destructive mt-1">
              Un rendez-vous doit être réservé au moins 24 h à l'avance. Pour un besoin plus proche, utilisez
              « Besoin rapidement », sans délai minimum.
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            🌙 Les horaires de nuit légaux (21h à 7h, Art. L3122-2 du Code du travail) peuvent faire l'objet d'un accord
            salarial différent entre vous et votre compagnon, qui reste libre d'accepter ou non une mission de nuit.
          </p>
        </div>
      )}
      <div>
        <label className="block text-lg font-bold mb-2">Précisions sur la mission</label>
        <textarea
          value={missionInfo}
          onChange={(e) => setMissionInfo(e.target.value)}
          rows={3}
          placeholder="Ex. faire réviser les tables de multiplication à mon fils, commencer par une promenade en arrivant, j'ai mis une machine à laver en route, pensez à l'étendre…"
          className="w-full px-4 py-3 rounded-2xl border-2 border-border bg-card text-base focus:border-primary outline-none"
        />
      </div>
      {mode === "scheduled" && (
        <div>
          <label className="block text-lg font-bold mb-2">Qui doit venir ?</label>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => {
                setAutoSearch(true);
                setPickedCompanion("");
              }}
              className={`flex-1 rounded-2xl border-2 p-4 text-left text-sm ${
                autoSearch === true ? "border-primary bg-accent" : "border-border bg-card"
              }`}
            >
              <b>🔍 Recherche automatique</b>
              <span className="block text-xs text-muted-foreground mt-1">
                Votre demande est envoyée à tous les compagnons libres sur ce créneau. Le premier à accepter valide le
                rendez-vous.
              </span>
            </button>
            <button
              type="button"
              onClick={() => setAutoSearch(false)}
              className={`flex-1 rounded-2xl border-2 p-4 text-left text-sm ${
                autoSearch === false ? "border-primary bg-accent" : "border-border bg-card"
              }`}
            >
              <b>🙋 Choisir moi-même un compagnon</b>
              <span className="block text-xs text-muted-foreground mt-1">
                Sélectionnez un compagnon disponible dans la liste, triée par distance.
              </span>
            </button>
          </div>
          {autoSearch === false && (
            <div className="mt-3 flex flex-col gap-2">
              <p className="text-sm font-bold">Choisir un compagnon par son nom</p>
              <p className="text-xs text-muted-foreground -mt-1">
                Liste triée par distance et disponibilité uniquement. Les badges et pouces sont purement informatifs.
              </p>
              {[...COMPANIONS].sort((a, b) => a.distanceKm - b.distanceKm).map((c) => {
                const whenTs = new Date(when).getTime();
                const free =
                  Number.isNaN(whenTs) ||
                  isCompanionAvailableFor(c, whenTs, durationHours * 60);
                return (
                <button
                  key={c.id}
                  type="button"
                  disabled={!free}
                  onClick={() => free && setPickedCompanion(c.id)}
                  className={`flex items-center gap-3 rounded-2xl border-2 p-3 text-left ${
                    !free
                      ? "border-border bg-card opacity-50 cursor-not-allowed"
                      : pickedCompanion === c.id
                        ? "border-primary bg-accent"
                        : "border-border bg-card"
                  }`}
                >
                  <img src={c.photo} alt={c.firstName} className="h-12 w-12 rounded-full object-cover" />
                  <span className="min-w-0">
                    <span className="block text-base font-bold">{c.firstName}</span>
                    {free ? (
                      <span className="block text-xs text-muted-foreground mt-0.5">
                        {experienceBadge(c.missions).emoji} {experienceBadge(c.missions).label} · 👍 {c.thumbs} ·{" "}
                        {c.distanceKm} km
                      </span>
                    ) : (
                      <span className="block text-xs font-bold text-destructive mt-0.5">
                        Indisponible à cette date/heure
                      </span>
                    )}
                  </span>
                </button>
                );
              })}
              <p className="text-xs text-muted-foreground">
                Sans réponse du compagnon choisi sous 4 h (ou 8 h si le rendez-vous est à plus de 48 h), nous vous
                proposerons un autre compagnon ou une recherche automatique.
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
          placeholder="Ex. code d'entrée 1234A, 2e étage, sonner à gauche…"
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
      {mode === "scheduled" && !!pickedCompanion && (
        <div className="rounded-2xl border-2 border-dashed border-border p-3 text-left">
          <p className="text-xs font-bold">🧪 Simulation d'historique (test)</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Injecte des missions fictives déjà réalisées avec ce compagnon pour tester le contrôle de conformité.
          </p>
          <label className="block text-xs font-semibold mt-3">Compagnon simulé</label>
          <select
            value={simCompanion || pickedCompanion}
            onChange={(e) => setSimCompanion(e.target.value)}
            className="w-full mt-1 px-3 py-2 rounded-xl border-2 border-border bg-card text-sm"
          >
            {COMPANIONS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName}
              </option>
            ))}
          </select>
          <label className="block text-xs font-semibold mt-3">
            Semaines consécutives déjà réalisées : {simWeeks}
          </label>
          <input
            type="range"
            min={0}
            max={6}
            value={simWeeks}
            onChange={(e) => setSimWeeks(Number(e.target.value))}
            className="w-full"
          />
          <label className="block text-xs font-semibold mt-2">
            Heures déjà réalisées cette semaine : {simHours} h
          </label>
          <input
            type="range"
            min={0}
            max={12}
            value={simHours}
            onChange={(e) => setSimHours(Number(e.target.value))}
            className="w-full"
          />
        </div>
      )}
      <div className="flex-1" />
      <button
        type="submit"
        disabled={!cguOk || (mode === "scheduled" && (autoSearch === null || (!autoSearch && !pickedCompanion)))}
        className="btn-huge bg-primary text-primary-foreground disabled:opacity-50"
      >
        {mode === "asap" ? "Lancer la recherche" : "Valider la réservation"}
      </button>
      {complianceCheck && (
        <CesuRecurrenceModal
          companionId={pickedCompanion}
          companionName={COMPANIONS.find((c) => c.id === pickedCompanion)?.firstName ?? "ce compagnon"}
          check={complianceCheck}
          onClose={() => setComplianceCheck(null)}
          onContinue={() => {
            setComplianceCheck(null);
            createAndGo();
          }}
          onSwitchCompanion={(id) => {
            setPickedCompanion(id);
            const next = runComplianceCheck(id);
            if (next?.requiresContract) {
              setComplianceCheck(next);
            } else {
              setComplianceCheck(null);
              createAndGo(id);
            }
          }}
        />
      )}
    </form>
  );
}


const CANCEL_WINDOW_MS = 24 * 60 * 60 * 1000;
const canFreeCancel = (scheduledAt?: number | null) =>
  !!scheduledAt && scheduledAt - Date.now() > CANCEL_WINDOW_MS;

const DEFAULT_DURATION_MIN = 60;

// Disponibilité réelle d'un compagnon selon ses indisponibilités récurrentes.
function isCompanionAvailableFor(
  companion: Companion,
  startTs: number,
  durationMinutes: number = DEFAULT_DURATION_MIN,
): boolean {
  const d = new Date(startTs);
  const day = d.getDay();
  const startMin = d.getHours() * 60 + d.getMinutes();
  const endMin = startMin + durationMinutes;

  return !(companion.unavailabilitySlots ?? []).some((sl) => {
    if (sl.day !== day) return false;
    const [sh, sm] = sl.start.split(":").map(Number);
    const [eh, em] = sl.end.split(":").map(Number);
    const unavailStart = sh * 60 + sm;
    const unavailEnd = eh * 60 + em;
    return Math.max(startMin, unavailStart) < Math.min(endMin, unavailEnd);
  });
}

const requestDurationMin = (r: { durationHours?: number }) =>
  r.durationHours ? r.durationHours * 60 : DEFAULT_DURATION_MIN;

const FAMILY_CANCEL_REASONS = [
  "Je n'ai plus besoin de cette prestation",
  "Mon emploi du temps a changé",
  "J'ai trouvé une autre solution",
  "Contretemps / imprévu personnel",
  "Autre raison",
];

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

// Bloc unique : modifier OU annuler un rendez-vous (fenêtre de 24 h).
function ScheduleManageBlock({ request, paid }: { request: Request; paid: boolean }) {
  const [confirm, setConfirm] = useState(false);
  const [reason, setReason] = useState("");
  const [otherDetail, setOtherDetail] = useState("");
  const [editing, setEditing] = useState(false);
  const [reschedule, setReschedule] = useState<"idle" | "checking" | "refused" | "confirmed">("idle");
  const [newWhen, setNewWhen] = useState<string>(() =>
    request.scheduledAt ? toLocalInput(request.scheduledAt) : "",
  );
  const free = canFreeCancel(request.scheduledAt);
  // Disponibilité réelle sur le nouveau créneau (pas de créneau à moins de 24 h).
  const slotAvailable = (ts: number) => {
    if (Number.isNaN(ts)) return false;
    if (ts - Date.now() <= CANCEL_WINDOW_MS) return false;
    const durationMin = requestDurationMin(request);
    if (request.student) return isCompanionAvailableFor(request.student, ts, durationMin);
    return COMPANIONS.some((c) => isCompanionAvailableFor(c, ts, durationMin));
  };
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
                Essayez un autre horaire (à plus de 24 h).
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
                  if (slotAvailable(ts)) {
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
              ? "Vous annulez plus de 24 h avant le rendez-vous : remboursement intégral sous 3 jours ouvrés."
              : `Il reste moins de 24 h avant le rendez-vous : ${paid ? "le paiement ne sera pas remboursé." : "le montant réglé ne sera pas remboursé."}`}
          </p>
          <label className="block text-xs font-semibold mt-3">Motif de l'annulation</label>
          <select
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (e.target.value !== "Autre raison") setOtherDetail("");
            }}
            className="w-full mt-1 px-3 py-2 rounded-xl border-2 border-border bg-card text-sm"
          >
            <option value="">Sélectionnez un motif</option>
            {FAMILY_CANCEL_REASONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          {reason === "Autre raison" && (
            <div className="mt-2">
              <p className="text-xs text-muted-foreground">
                ⚠️ Ce texte sera visible par le compagnon. Restez factuel.
              </p>
              <textarea
                value={otherDetail}
                onChange={(e) => setOtherDetail(e.target.value.slice(0, 150))}
                maxLength={150}
                rows={2}
                placeholder="Précisez en quelques mots (150 caractères max)"
                className="w-full mt-1 px-3 py-2 rounded-xl border-2 border-border bg-card text-sm"
              />
              <p className="text-[11px] text-muted-foreground text-right mt-0.5">{otherDetail.length}/150</p>
            </div>
          )}
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
              disabled={!reason || (reason === "Autre raison" && !otherDetail.trim())}
              onClick={() => {
                const finalReason = reason === "Autre raison" && otherDetail.trim() ? otherDetail.trim() : reason;
                store.cancelRequest(request.id, free, finalReason);
              }}
              className="py-3 rounded-2xl bg-destructive text-destructive-foreground font-bold text-sm disabled:opacity-50"
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
          ⏳ Moins de 24 h avant le rendez-vous : la modification n'est plus possible.
        </p>
      )}
      <p className="text-xs text-muted-foreground mt-2">
        Modification et annulation gratuites jusqu'à 24 h avant le rendez-vous, sous réserve qu'un compagnon soit
        disponible sur le nouveau créneau. Passé 24 h, la mission reste due.
      </p>
    </div>
  );
}


const SOS_TIMEOUT_MS = 20 * 60 * 1000; // 20 min sans réponse sur un besoin rapide
const SCHEDULED_SOON_TIMEOUT_MS = 4 * 60 * 60 * 1000; // rendez-vous à moins de 48 h
const SCHEDULED_LATER_TIMEOUT_MS = 8 * 60 * 60 * 1000; // rendez-vous à plus de 48 h

// Délai de réponse attendu : 20 min en besoin rapide, 4 h ou 8 h en rendez-vous
// selon que l'échéance est à moins ou plus de 48 h.
function responseTimeoutMs(request: Request) {
  if (!request.scheduledAt) return SOS_TIMEOUT_MS;
  return request.scheduledAt - Date.now() < 48 * 60 * 60 * 1000
    ? SCHEDULED_SOON_TIMEOUT_MS
    : SCHEDULED_LATER_TIMEOUT_MS;
}

function FamilyWait({
  request,
  simulateNoAnswer,
  onSimulateNoAnswer,
  onEditRequest,
  onDone,
}: {
  request: Request | undefined;
  simulateNoAnswer: boolean;
  onSimulateNoAnswer: (v: boolean) => void;
  onEditRequest: (req?: Request) => void;
  onDone: () => void;
}) {
  const [paid, setPaid] = useState(false);
  const [contractOk, setContractOk] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [salaireDraft, setSalaireDraft] = useState<string | null>(null);
  const [restartedAt, setRestartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  // Après paiement confirmé : le retour arrière du navigateur ramène à l'accueil,
  // jamais sur le formulaire ou l'écran de paiement.
  useEffect(() => {
    if (!paid) return;
    window.history.pushState({ soleliaPaid: true }, "");
    const onPop = () => onDone();
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [paid]);

  // Besoin rapide : cascade automatique. À l'expiration du délai, le compagnon
  // sollicité est écarté et la mission part vers le suivant, sans action du client.
  const [autoSkipped, setAutoSkipped] = useState<string | null>(null);
  useEffect(() => {
    if (!request || request.scheduledAt || request.status !== "searching") return;
    const started = restartedAt ?? request.createdAt;
    if (!simulateNoAnswer && now - started <= SOS_TIMEOUT_MS) return;
    const durationMin = request.durationHours ? request.durationHours * 60 : DEFAULT_DURATION_MIN;
    const declined = request.declinedBy ?? [];
    const pool = COMPANIONS.filter(
      (c) => !declined.includes(c.id) && isCompanionAvailableFor(c, Date.now(), durationMin),
    ).sort((a, b) => a.distanceKm - b.distanceKm);
    if (pool.length <= 1) return; // plus personne à solliciter : bouton manuel en secours
    store.declineRequest(request.id, pool[0].id);
    setAutoSkipped(pool[0].firstName);
    setRestartedAt(Date.now());
    onSimulateNoAnswer(false);
  }, [request?.id, request?.status, request?.scheduledAt, request?.declinedBy, now, simulateNoAnswer, restartedAt]);

  if (!request) return null;
  if (request.status === "cancelled") {
    const paidAlready = paid || request.paid;
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 gap-5 text-center">
        <div className="text-6xl">🗑️</div>
        <p className="text-2xl font-black">{paidAlready ? "Rendez-vous annulé" : "Demande annulée"}</p>
        <p className="text-base text-muted-foreground">
          {paidAlready
            ? request.refunded
              ? "Annulation à plus de 24 h : vous serez intégralement remboursé sous 3 jours ouvrés."
              : "Annulation à moins de 24 h : conformément aux conditions, le paiement n'est pas remboursé."
            : "Demande en cours annulée. Vous pouvez maintenant modifier vos critères et relancer la recherche."}
        </p>
        {!paidAlready && (
          <button
            onClick={() => { store.discardRequest(request.id); onEditRequest(request); }}
            className="btn-huge bg-primary text-primary-foreground w-full"
          >
            ✏️ Modifier mes critères
          </button>
        )}
        <button
          onClick={onDone}
          className={
            paidAlready
              ? "btn-huge bg-primary text-primary-foreground w-full"
              : "py-4 rounded-2xl border-2 border-border bg-card font-bold w-full"
          }
        >
          Retour à l'accueil
        </button>
      </div>
    );
  }
  const accepted = request.status === "accepted" && request.student;

  const hours = request?.durationHours ?? 1;

  // Contrôle de conformité (contrat de travail écrit) au moment de l'acceptation.
  const rawCheck =
    accepted && request.student && !request.acknowledged && !contractOk
      ? checkContractRequirement(
          request.student.id,
          request.scheduledAt ?? request.createdAt,
          hours,
          store.getState().requests.filter((r) => r.id !== request.id),
        )
      : null;
  const complianceCheck = rawCheck?.requiresContract ? rawCheck : null;

  if (accepted && showPay && !paid) {
    return (
      <PaymentScreen
        companion={request.student!}
        hours={hours}
        need={request.need}
        childAges={request.childAges}
        salaire={salaireDraft ?? formatPrice(request.student!.hourlyRate ?? DEFAULT_HOURLY_RATE)}
        onSalaire={setSalaireDraft}
        onDone={(salaireNetHoraire) => {
          addOrderToAccount({
            id: request.id,
            date: Date.now(),
            need: request.need,
            address: request.address,
            hours,
            serviceFee: SERVICE_FEE,
            salaireNetHoraire,
            cesuActive: request.student!.cesuActive,
            studentName: request.student!.firstName,
          });
          store.updateRequest(request.id, { paid: true });
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
  const limit = responseTimeoutMs(request);
  const limitLabel = !request.scheduledAt ? "20 min" : limit === SCHEDULED_SOON_TIMEOUT_MS ? "4 h" : "8 h";
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
          {request.companionCancelNotice && (
            <div className="w-full rounded-2xl border-2 border-warning bg-warning/10 p-4 text-left">
              <p className="text-sm font-black">
                🔔 {request.companionCancelNotice.companionName} a annulé
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Motif indiqué : « {request.companionCancelNotice.reason} ». Nous recherchons un autre compagnon.
              </p>
              <button
                type="button"
                onClick={() => store.updateRequest(request.id, { companionCancelNotice: null })}
                className="mt-3 py-3 rounded-2xl border-2 border-border bg-card font-bold text-sm w-full"
              >
                J'ai compris
              </button>
            </div>
          )}
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
                {autoSkipped && (
                  <p className="text-sm font-semibold mt-2">
                    🔄 {autoSkipped} n'a pas répondu : la demande a été transmise automatiquement au compagnon
                    disponible suivant.
                  </p>
                )}
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
                  Réponse attendue sous {limitLabel}. Sans réponse, nous vous proposerons une alternative.
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
              {` (délai maximum ${limitLabel})`}
            </p>
          </div>

          {timedOut && (
            <div className="w-full rounded-2xl border-2 border-warning bg-warning/10 p-4 text-left">
              <p className="text-sm font-black">
                {isSos
                  ? "⏰ Aucune réponse après 20 minutes"
                  : `⏰ ${preferred?.firstName ?? "Aucun compagnon"} n'a pas répondu sous ${limitLabel}`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {isSos
                  ? "Tous les compagnons disponibles à proximité ont été sollicités automatiquement, sans réponse. Vous pouvez relancer l'alerte ou modifier vos critères (besoin, durée, adresse)."
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
                    onClick={() => { store.cancelRequest(request.id, false, "Modification des critères de la demande"); }}
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
                          .filter(
                            (c) =>
                              c.id !== preferred?.id &&
                              isCompanionAvailableFor(
                                c,
                                request.scheduledAt ?? Date.now(),
                                requestDurationMin(request),
                              ),
                          )
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
              🧪 Simuler l'absence de réponse ({limitLabel})
            </button>
          )}
          <button
            type="button"
            onClick={() => onEditRequest()}
            className="py-4 rounded-2xl border-2 border-primary text-primary font-bold text-sm w-full"
          >
            ← Modifier ma demande
          </button>
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
            missedCount={request.student!.missedCount}
          />

          {complianceCheck ? (
            <CesuRecurrenceModal
              companionId={request.student!.id}
              companionName={request.student!.firstName}
              check={complianceCheck}
              dismissible={false}
              onClose={() => {}}
              onContinue={() => setContractOk(true)}
              onSwitchCompanion={(companionId) => {
                store.declineRequest(request.id, request.student!.id);
                store.updateRequest(request.id, { preferredCompanionId: companionId });
                store.releaseRequest(request.id);
                setContractOk(false);
              }}
            />
          ) : !request.acknowledged ? (
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
                  💚 Frais de service Solélia : {formatPrice(SERVICE_FEE)} € — seul montant réglé sur la plateforme
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Le salaire de votre compagnon est fixé à l'étape suivante.
                </p>
              </div>
              <button onClick={() => setShowPay(true)} className="btn-huge bg-primary text-primary-foreground w-full">
                💳 Finaliser — {formatPrice(SERVICE_FEE)} €
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
          {!paid && (
            <button
              type="button"
              onClick={() => onEditRequest()}
              className="py-4 rounded-2xl border-2 border-primary text-primary font-bold text-sm w-full"
            >
              ← Modifier ma demande
            </button>
          )}
          <button onClick={onDone} className="text-base text-muted-foreground underline">Terminer</button>
        </>
      )}
    </div>

  );
}

function PaymentScreen({
  companion,
  hours,
  salaire,
  need,
  childAges,
  onSalaire,
  onDone,
  onBack,
}: {
  companion: Companion;
  hours: number;
  salaire: string; // contrôlé par l'écran parent : conservé en cas de navigation arrière
  need: NeedType;
  childAges?: string[];
  onSalaire: (v: string) => void;
  onDone: (salaireNetHoraire: number) => void;
  onBack: () => void;
}) {
  const [method, setMethod] = useState<"card" | "apple" | "paypal">("card");
  const [processing, setProcessing] = useState(false);
  const [card, setCard] = useState("");
  const [exp, setExp] = useState("");
  const [cvc, setCvc] = useState("");
  const salaireNum = Number(salaire.replace(",", ".")) || 0;

  const pay = (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    setTimeout(() => onDone(salaireNum), 1500);
  };

  return (
    <form onSubmit={pay} className="flex-1 flex flex-col px-5 py-6 gap-5">
      <button type="button" onClick={onBack} className="text-base text-muted-foreground text-left">← Retour</button>
      <div>
        <h2 className="text-2xl font-black">Récapitulatif</h2>
        <p className="text-base text-muted-foreground mt-1">Mission acceptée par {companion.firstName}</p>
      </div>

      <div className="bg-card rounded-2xl p-5 border-2 border-border">
        <label className="block text-base font-bold">Salaire net horaire</label>
        <p className="text-xs text-muted-foreground mt-1">
          Salaire net conseillé (congés payés inclus). En tant que particulier employeur, vous pouvez modifier ce
          montant.
        </p>
        <div className="flex items-center gap-2 mt-3">
          <input
            value={salaire}
            onChange={(e) => onSalaire(e.target.value)}
            inputMode="decimal"
            className="flex-1 px-5 py-4 rounded-2xl border-2 border-border bg-background text-lg focus:border-primary outline-none"
          />
          <span className="text-lg font-bold">€/h</span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Durée prévue : {hours}h — salaire estimé {formatPrice(salaireNum * hours)} €
        </p>
        {(need === "Garde d'enfants (à partir de 3 ans)" ||
          need === "Accompagner un enfant (à partir de 3 ans)") &&
          (childAges?.length ?? 0) > 1 && (
            <p className="text-xs text-muted-foreground mt-2">
              👶 Pour {childAges!.length} enfants, il est habituel de majorer le salaire d'environ 1 €/h par
              enfant supplémentaire (soit environ {formatPrice(salaireNum + (childAges!.length - 1))} €/h avec
              votre montant actuel). Ce montant reste indicatif et modifiable.
            </p>
          )}
        <p className="text-xs text-muted-foreground mt-2">
          ⚖️ En tant que particulier employeur, vous ne pouvez pas rémunérer en dessous du SMIC horaire net (congés
          payés inclus).{" "}
          <a
            href="https://www.urssaf.fr/accueil/outils-documentation/taux-baremes/montant-smic.html"
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-semibold text-primary"
          >
            Consultez le taux en vigueur sur le site de l'URSSAF
          </a>
          .
        </p>
        <div className="h-px bg-border my-4" />
        <div className="flex justify-between text-xl font-black">
          <span>À régler aujourd'hui</span>
          <span>{formatPrice(SERVICE_FEE)} €</span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          Frais de service mandataire Solélia — forfait fixe, quelle que soit la durée.
        </p>
      </div>

      {companion.cesuActive ? (
        <div className="bg-success/10 border-2 border-success/40 rounded-2xl p-4 text-left">
          <p className="text-sm font-black text-success">
            ✅ Votre compagnon est agréé CESU+ Avance Immédiate !
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Vous réglez aujourd'hui {formatPrice(SERVICE_FEE)} € de frais de service. Grâce à l'Avance Immédiate de
            l'URSSAF, vous bénéficiez automatiquement de vos 50 % de crédit d'impôt. L'URSSAF prélèvera directement sur
            votre compte, sous 48 à 72h après la mission, le reste à charge estimé de la prestation (montant calculé
            lors du prélèvement URSSAF), et versera la rémunération à votre compagnon. Vous n'avez aucun salaire à lui
            verser la main à la main.
          </p>
        </div>
      ) : (
        <div className="bg-accent border-2 border-primary rounded-2xl p-4 text-left">
          <p className="text-sm font-black">⏳ Votre compagnon est en cours d'activation CESU+</p>
          <p className="text-xs text-muted-foreground mt-2">
            Vous réglez aujourd'hui {formatPrice(SERVICE_FEE)} € de frais de service. Ce compagnon finalise son compte
            CESU+ : pour cette mission, vous réglerez directement son salaire conseillé de{" "}
            <b className="text-foreground">{formatPrice(salaireNum * hours)} €</b> sur place le jour de l'intervention
            (espèces, chèque ou virement immédiat). Solélia transmet la déclaration à l'URSSAF ; vous bénéficierez de
            vos 50 % de déduction fiscale lors de votre déclaration d'impôts annuelle.
          </p>
        </div>
      )}


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
        {processing ? "Traitement…" : `Payer ${formatPrice(SERVICE_FEE)} € et confirmer la mission`}
      </button>
      <p className="text-xs text-muted-foreground text-center">🔒 Paiement sécurisé — démo</p>
    </form>
  );
}

/* ---------------- STUDENT ---------------- */

type EnrollStatus = "none" | "pending" | "approved" | "rejected" | "changes_requested";

const WELCOME_KEY = "solelia-companion-welcome-dismissed";

function CompanionWelcomeBanner({ firstName }: { firstName: string }) {
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    setHidden(window.localStorage?.getItem(WELCOME_KEY) === "1");
  }, []);
  if (hidden) return null;
  return (
    <div className="rounded-2xl border-2 border-success/50 bg-success/10 p-4">
      <p className="text-base font-bold">
        🎉 Félicitations {firstName} ! Votre dossier est validé, bienvenue parmi les Compagnons Solélia. Vous pouvez
        désormais consulter les offres et démarrer vos missions.
      </p>
      <button
        onClick={() => {
          window.localStorage?.setItem(WELCOME_KEY, "1");
          setHidden(true);
        }}
        className="mt-2 text-sm font-bold underline"
      >
        Fermer
      </button>
    </div>
  );
}
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
      {!demo && myApp.data?.status === "approved" && (
        <CompanionWelcomeBanner firstName={myApp.data.first_name} />
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

      <AccountInfoPanel />

      <CompanionAvailabilityPanel companionId={COMPANIONS[0].id} />

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

                      {r.durationHours != null && (
                        <p className="text-sm mt-1 font-semibold">⏱️ Durée : {r.durationHours}h</p>
                      )}
                      {r.childAge && <p className="text-sm mt-1 font-semibold">🎂 Enfant : {r.childAge} ans</p>}
                      {r.childAges && r.childAges.length > 0 && (
                        <p className="text-sm mt-1 font-semibold">
                          🎂 Enfants : {new Intl.ListFormat("fr", { style: "long", type: "conjunction" }).format(r.childAges)} ans
                        </p>
                      )}
                      {r.childLevel && (
                        <p className="text-sm mt-1 font-semibold">
                          🎒 Niveau : {r.childLevel}{r.childClass ? ` — ${r.childClass}` : ""}
                        </p>
                      )}
                      {r.extraInfo && <p className="text-sm mt-1 text-muted-foreground">📝 {r.extraInfo}</p>}
                      {r.missionInfo && <p className="text-sm mt-1 text-muted-foreground">🗒️ {r.missionInfo}</p>}

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

/* --- Compagnon : annulation d'un RDV --- */

const COMPANION_CANCEL_REASONS = [
  "Empêchement personnel",
  "Raison de santé",
  "Contretemps de dernière minute",
  "Le créneau ne correspond finalement pas à ma disponibilité",
  "Autre raison",
];


function CompanionCancelBlock({ request }: { request: Request }) {
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState<"released" | "strike" | null>(null);
  const [reason, setReason] = useState("");
  const [otherDetail, setOtherDetail] = useState("");
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
          Ce manquement est désormais visible par les familles sur votre profil.
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
                Plus de 24 h avant le rendez-vous et un autre compagnon est disponible : la mission repart en
                recherche, sans pénalité.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-bold text-destructive">Annulation tardive</p>
              <p className="text-sm text-muted-foreground mt-1">
                {inTime
                  ? "Aucun autre compagnon n'est disponible sur ce créneau."
                  : "Il reste moins de 24 h avant le rendez-vous."}{" "}
                Ce désistement sera enregistré comme un rendez-vous non honoré, visible par les familles.
              </p>
            </>
          )}
          <label className="block text-xs font-semibold mt-3">Motif de l'annulation</label>
          <select
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (e.target.value !== "Autre raison") setOtherDetail("");
            }}
            className="w-full mt-1 px-3 py-2 rounded-xl border-2 border-border bg-card text-sm"
          >
            <option value="">Sélectionnez un motif</option>
            {COMPANION_CANCEL_REASONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          {reason === "Autre raison" && (
            <div className="mt-2">
              <p className="text-xs text-muted-foreground">
                ⚠️ Ce texte sera visible par la famille. Restez factuel.
              </p>
              <textarea
                value={otherDetail}
                onChange={(e) => setOtherDetail(e.target.value.slice(0, 150))}
                maxLength={150}
                rows={2}
                placeholder="Précisez en quelques mots (150 caractères max)"
                className="w-full mt-1 px-3 py-2 rounded-xl border-2 border-border bg-card text-sm"
              />
              <p className="text-[11px] text-muted-foreground text-right mt-0.5">{otherDetail.length}/150</p>
            </div>
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
              disabled={!reason || (reason === "Autre raison" && !otherDetail.trim())}
              onClick={() => {
                if (!reason || (reason === "Autre raison" && !otherDetail.trim())) return;
                const finalReason = reason === "Autre raison" && otherDetail.trim() ? otherDetail.trim() : reason;
                const companion = request.student!;
                store.releaseRequestWithReason(request.id, companion.firstName, finalReason);
                if (inTime && replacementAvailable) {
                  setDone("released");
                } else {
                  store.recordMissedAppointment(companion.id);
                  setDone("strike");
                }
              }}
              className="py-3 rounded-2xl bg-destructive text-destructive-foreground font-bold text-sm disabled:opacity-50"
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
  const [taken, setTaken] = useState(false);
  const accept = () => {
    const ok = store.acceptRequest(request.id);
    if (!ok) setTaken(true);
  };

  if (request.status === "cancelled") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 gap-5 text-center">
        <div className="text-6xl">🔔</div>
        <h2 className="text-2xl font-black">Rendez-vous annulé par la famille</h2>
        <p className="text-base text-muted-foreground">Ne vous déplacez pas pour cette mission.</p>
        {request.cancelReason && (
          <div className="w-full bg-card rounded-2xl p-4 border-2 border-border text-left">
            <p className="text-sm text-muted-foreground">Motif indiqué par la famille</p>
            <p className="text-base font-semibold mt-1">{request.cancelReason}</p>
          </div>
        )}
        <button onClick={onBack} className="btn-huge bg-primary text-primary-foreground w-full">
          Retour aux demandes
        </button>
      </div>
    );
  }



  return (
    <div className="flex-1 flex flex-col px-5 py-6 gap-5">
      <button onClick={onBack} className="text-base text-muted-foreground text-left">← Retour</button>
      <div className="bg-card rounded-3xl p-6 border-2 border-border">
        <p className="text-sm text-muted-foreground uppercase tracking-wide font-bold">Besoin</p>
        <p className="text-2xl font-bold mt-1">{request.need.includes("/") ? request.need.replace("/", " / ") : request.need}</p>
        {request.durationHours != null && (
          <p className="text-base font-semibold mt-2">⏱️ Durée demandée : {request.durationHours}h</p>
        )}
        {(request.childLevel || request.childrenCount || request.escortDestination || request.otherDetail || request.childAge || (request.childAges?.length ?? 0) > 0) && (
          <div className="mt-3 bg-accent rounded-xl p-3">
            <p className="text-xs text-muted-foreground font-bold uppercase">Enfant (3 ans et +)</p>
            {request.childAge && <p className="text-base font-semibold mt-1">🎂 {request.childAge} ans</p>}
            {request.childAges && request.childAges.length > 0 && (
              <p className="text-base font-semibold mt-1">
                🎂 Enfants : {new Intl.ListFormat("fr", { style: "long", type: "conjunction" }).format(request.childAges)} ans
              </p>
            )}
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
        {request.missionInfo && (
          <div className="mt-3 bg-accent rounded-xl p-3">
            <p className="text-xs text-muted-foreground font-bold uppercase">Précisions sur la mission</p>
            <p className="text-base mt-1">{request.missionInfo}</p>
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
  | "vitaleCard"
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
  address: string;
  email: string;
  phone: string;
  situation: string;
  motivation: string;
  nir: string;
  housing: HousingStatus;
  selfie?: File;
  selfiePreview?: string;
  docs: Partial<Record<DocKey, File>>;
};

type DocColumn =
  | "id_card_path"
  | "vitale_card_path"
  | "situation_proof_path"
  | "criminal_record_path"
  | "iban_path"
  | "address_proof_path"
  | "host_attestation_path"
  | "host_address_proof_path"
  | "host_id_path";

const DOC_COLUMN: Record<DocKey, DocColumn> = {
  idCard: "id_card_path",
  vitaleCard: "vitale_card_path",
  studentCard: "situation_proof_path",
  criminalRecord: "criminal_record_path",
  iban: "iban_path",
  addressProof: "address_proof_path",
  hostAttestation: "host_attestation_path",
  hostAddressProof: "host_address_proof_path",
  hostId: "host_id_path",
};

/** Mots-clés permettant de mettre en rouge les pièces citées dans le motif du Mandataire */
const DOC_KEYWORDS: Record<DocKey, string[]> = {
  idCard: ["identité", "identite", "cni", "passeport"],
  vitaleCard: ["vitale"],
  studentCard: ["situation", "étudiante", "etudiante", "contrat", "retraite", "france travail"],
  criminalRecord: ["casier", "judiciaire", "b3", "bulletin"],
  iban: ["rib", "iban", "banc"],
  addressProof: ["domicile", "adresse"],
  hostAttestation: ["attestation", "hébergement", "hebergement"],
  hostAddressProof: ["domicile de l'hébergeur", "domicile de l'hebergeur", "hébergeur", "hebergeur"],
  hostId: ["identité de l'hébergeur", "identite de l'hebergeur"],
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
    address: "",
    email: "",
    phone: "",
    situation: "Étudiant(e)",
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
        address: prev.address || app?.address || prof?.address_line || "",
        situation: app?.situation || prev.situation,
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

  if ((app?.status === "changes_requested" || app?.status === "rejected") && step === "intro") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 gap-5 text-center">
        <div className="text-6xl">📝</div>
        <h2 className="text-2xl font-black">Dossier à compléter</h2>
        <p className="text-base text-muted-foreground text-left">
          Bonjour ! Votre inscription auprès de Solélia est presque finalisée. Afin de pouvoir valider votre profil et
          vous permettre de démarrer vos interventions, notre équipe a besoin de quelques ajustements sur votre dossier.
        </p>
        {app.reject_reason && (
          <div className="w-full bg-destructive/10 border-2 border-destructive/40 rounded-2xl p-4 text-left">
            <p className="text-sm font-bold text-destructive">Note de notre équipe</p>
            <p className="text-sm mt-1">{app.reject_reason}</p>
          </div>
        )}
        <p className="text-base text-muted-foreground text-left">
          Nous vous invitons à mettre à jour la ou les pièces concernées ci-après pour que nous puissions valider votre
          candidature. À très bientôt !
        </p>
        <button onClick={() => setStep("form")} className="btn-huge bg-primary text-primary-foreground">
          Mettre à jour mon dossier
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
          <p className="text-base">{app.situation}{app.address ? ` — ${app.address}` : ""}</p>
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
        address: p.address.trim(),
        email: p.email.trim(),
        phone: p.phone.trim(),
        situation: p.situation,
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
    { k: "vitaleCard", label: "Copie ou photo du recto de la carte Vitale", icon: "💳" },
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
  const motif =
    app?.status === "changes_requested" || app?.status === "rejected" ? (app.reject_reason ?? "").toLowerCase() : "";
  const flagged = (k: DocKey) => !!motif && !p.docs[k] && DOC_KEYWORDS[k].some((w) => motif.includes(w));
  const hasSelfie = !!p.selfie || !!app?.selfie_path;
  const allDocs = [...docs, ...housingDocs].every((d) => hasDoc(d.k));
  const nirDigits = p.nir.replace(/\D/g, "");
  const nirLenOk = nirDigits.length === 15;
  const nirKeyOk = isNirValid(nirDigits);
  const nirOk = nirLenOk && nirKeyOk;
  const valid = Boolean(
    p.firstName.trim() &&
      p.lastName.trim() &&
      p.address.trim() &&
      p.email.trim() &&
      p.phone.trim() &&
      p.situation &&
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
              <label className={`flex items-center gap-3 p-3 rounded-2xl border-2 cursor-pointer ${flagged(d.k) || bad(hasDoc(d.k)) ? "border-destructive bg-destructive/5" : hasDoc(d.k) ? "border-success bg-success/5" : "border-border bg-card"}`}>
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
              {flagged(d.k) && (
                <p className="text-xs font-bold text-destructive mt-1">Pièce à mettre à jour selon la note de l'équipe</p>
              )}
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

function AttestationFiscaleBlock({
  holderName,
  holderEmail,
  orders,
  currentYear,
}: {
  holderName: string;
  holderEmail: string;
  orders: Order[];
  currentYear: number;
}) {
  const [generating, setGenerating] = useState(false);
  const yearOrders = orders.filter((o) => new Date(o.date).getFullYear() === currentYear);
  const feesYear = yearOrders.reduce((s, o) => s + o.serviceFee, 0);

  const downloadPdf = async () => {
    setGenerating(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text("Solélia Accompagnement", 20, 20);
      doc.setFontSize(14);
      doc.text(`Attestation fiscale — frais de service ${currentYear}`, 20, 34);
      doc.setFontSize(11);
      doc.text(`Titulaire : ${holderName}`, 20, 50);
      doc.text(`Email : ${holderEmail}`, 20, 58);
      doc.text(`Nombre de missions : ${yearOrders.length}`, 20, 72);
      doc.text(`Total des frais de service réglés : ${formatPrice(feesYear)} EUR`, 20, 80);
      doc.text(`Numéro de déclaration SAP : ${SAP_DECLARATION_NUMBER}`, 20, 88);
      doc.setFontSize(9);
      doc.text(
        "Ces frais de service ouvrent droit à un crédit d'impôt de 50 % au titre des services à la personne.",
        20,
        100,
      );
      doc.save(`solelia-attestation-fiscale-${currentYear}.pdf`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="bg-card border-2 border-border rounded-2xl p-4">
      <p className="text-sm font-bold">🧾 Attestation fiscale — frais de service Solélia</p>
      <p className="text-xs text-muted-foreground mt-2">
        Année {currentYear} : <b className="text-foreground">{yearOrders.length} mission(s)</b> ·{" "}
        <b className="text-foreground">{formatPrice(feesYear)} €</b> de frais de service réglés.
      </p>
      {sapDeclarationActive && (
        <>
          <p className="text-xs text-muted-foreground mt-2">
            Ces frais de service ouvrent droit à un crédit d'impôt de 50 %. Une attestation fiscale annuelle vous sera
            transmise avant fin février.
          </p>
          <button
            type="button"
            onClick={downloadPdf}
            disabled={generating}
            className="mt-3 w-full py-3 rounded-2xl border-2 border-primary text-primary font-bold text-sm disabled:opacity-50"
          >
            {generating ? "Génération…" : "📄 Télécharger l'attestation (PDF)"}
          </button>
        </>
      )}
    </div>
  );
}

function FamilyAccountScreen({ onBack }: { onBack: () => void }) {
  const { session, loading: sessionLoading } = useSession();
  const orders = useFamilyOrders();
  const [showYear, setShowYear] = useState<number | null>(null);
  const [profile, setProfile] = useState<{
    first_name: string;
    last_name: string;
    email: string;
  } | null>(null);

  // Charge le profil Supabase et migre l'ancien compte local si présent.
  useEffect(() => {
    if (!session) return;
    const userId = session.user.id;
    let cancelled = false;
    (async () => {
      await migrateLegacyFamilyAccount(userId);
      const { data } = await supabase
        .from("profiles")
        .select("first_name,last_name,email")
        .eq("id", userId)
        .maybeSingle();
      if (!cancelled && data) setProfile(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user.id]);

  if (sessionLoading) {
    return (
      <div className="flex-1 flex flex-col px-5 py-6 gap-4">
        <button onClick={onBack} className="text-base text-muted-foreground text-left">← Retour</button>
        <p className="text-center text-muted-foreground py-10">Chargement…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex-1 flex flex-col px-5 py-6 gap-4">
        <button onClick={onBack} className="text-base text-muted-foreground text-left">← Retour</button>
        <div className="bg-success/10 border-2 border-success/40 rounded-2xl p-3 text-sm">
          💳 <b>Modèle mandataire</b> — {formatPrice(SERVICE_FEE)} € de frais de service par mission. Votre
          attestation fiscale officielle est délivrée par l'URSSAF.
        </div>
        <AuthCard
          title="Mon espace Solélia"
          subtitle="Particuliers"
          onSuccess={() => {
            /* la session met à jour la vue automatiquement */
          }}
        />
      </div>
    );
  }

  const displayName = profile
    ? `${profile.first_name} ${profile.last_name}`.trim()
    : "";
  const displayEmail = profile?.email || session.user.email || "";

  // Aggregate orders by year
  const byYear = new Map<number, Order[]>();
  for (const o of orders) {
    const y = new Date(o.date).getFullYear();
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y)!.push(o);
  }
  const years = Array.from(byYear.keys()).sort((a, b) => b - a);

  if (showYear !== null) {
    const yearOrders = byYear.get(showYear) ?? [];
    const feesYear = yearOrders.reduce((s, o) => s + o.serviceFee, 0);
    return (
      <div className="flex-1 flex flex-col px-5 py-6 gap-4">
        <button onClick={() => setShowYear(null)} className="text-base text-muted-foreground text-left">← Retour au compte</button>
        <div>
          <h2 className="text-2xl font-black">Missions {showYear}</h2>
          <p className="text-sm text-muted-foreground mt-1">Frais de service réglés sur Solélia</p>
        </div>
        <div className="bg-card rounded-2xl p-5 border-2 border-border">
          <p className="text-sm text-muted-foreground">Titulaire</p>
          <p className="text-lg font-bold">{displayName || displayEmail}</p>
          <p className="text-xs text-muted-foreground mt-1">{displayEmail}</p>
        </div>
        <div className="bg-success/10 border-2 border-success/40 rounded-2xl p-5">
          <div className="flex justify-between text-base">
            <span className="text-muted-foreground">Frais de service en {showYear}</span>
            <span className="font-black">{formatPrice(feesYear)} €</span>
          </div>
          <div className="flex justify-between text-base mt-2">
            <span className="text-muted-foreground">Nombre de missions</span>
            <span className="font-semibold">{yearOrders.length}</span>
          </div>
          <div className="h-px bg-success/30 my-3" />
          <p className="text-sm font-bold">Votre attestation fiscale officielle est délivrée par l'URSSAF.</p>
        </div>
        <div>
          <p className="font-bold mb-2">Détail des missions</p>
          <div className="flex flex-col gap-2">
            {yearOrders.map((o) => (
              <div key={o.id} className="bg-card rounded-xl p-3 border-2 border-border text-sm">
                <div className="flex justify-between font-semibold">
                  <span>{o.need}</span>
                  <span>{formatPrice(o.serviceFee)} €</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(o.date).toLocaleDateString("fr-FR")} · {o.address}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Salaire net retenu : {formatPrice(o.salaireNetHoraire)} €/h · {o.hours}h ·{" "}
                  {o.cesuActive ? "CESU+ Avance Immédiate" : "Salaire réglé sur place"}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const totalAll = orders.reduce((s, o) => s + o.serviceFee, 0);
  const currentYear = new Date().getFullYear();

  return (
    <div className="flex-1 flex flex-col px-5 py-6 gap-4">
      <button onClick={onBack} className="text-base text-muted-foreground text-left">← Retour</button>
      <div className="bg-card rounded-3xl p-5 border-2 border-border flex items-center gap-4">
        <div className="h-14 w-14 rounded-full bg-primary text-primary-foreground grid place-items-center text-2xl font-black">
          {(displayName || displayEmail).slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold truncate">{displayName || "Mon compte"}</p>
          <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
        </div>
      </div>

      <AccountInfoPanel />

      <ClientDocumentsPanel />

      <div className="bg-success/10 border-2 border-success/40 rounded-2xl p-4">
        <p className="text-sm font-bold text-success">🇫🇷 Services à la personne</p>
        <p className="text-xs text-muted-foreground mt-1">
          Frais de service réglés : <b className="text-foreground">{formatPrice(totalAll)} €</b>
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Votre attestation fiscale officielle est délivrée par l'URSSAF.
        </p>
      </div>

      <AttestationFiscaleBlock
        holderName={displayName || displayEmail}
        holderEmail={displayEmail}
        orders={orders}
        currentYear={currentYear}
      />

      <div>
        <p className="font-bold mb-2">📊 Historique par année</p>
        {years.length === 0 ? (
          <div className="bg-card rounded-2xl p-4 border-2 border-border text-sm text-muted-foreground text-center">
            Vous n'avez pas encore de commande.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {years.map((y) => {
              const yOrders = byYear.get(y)!;
              const total = yOrders.reduce((s, o) => s + o.serviceFee, 0);
              return (
                <button
                  key={y}
                  onClick={() => setShowYear(y)}
                  className="text-left bg-card rounded-2xl p-4 border-2 border-border hover:border-primary"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-bold">Année {y}</p>
                      <p className="text-xs text-muted-foreground">{yOrders.length} mission(s) · {formatPrice(total)} €</p>
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
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Aucune commande pour le moment.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {orders.map((o) => (
              <div key={o.id} className="bg-card rounded-2xl p-4 border-2 border-border">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <p className="font-bold">{o.need}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(o.date).toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 truncate">📍 {o.address}</p>
                    {o.studentName && <p className="text-xs mt-1">🤝 {o.studentName}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-black">{formatPrice(o.serviceFee)} €</p>
                    <p className="text-[11px] text-muted-foreground">frais de service</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => { if (confirm("Se déconnecter de votre compte ?")) supabase.auth.signOut(); }}
        className="text-sm text-muted-foreground underline mt-2"
      >
        Se déconnecter
      </button>
    </div>
  );
}

