import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { store, useStore, randomStudent, COMPANIONS, experienceBadge, type NeedType, type Request } from "@/lib/store";
import { CompanionLoyaltyGrid } from "@/components/CompanionLoyaltyGrid";
import { CguAcceptBlock, CguPanel } from "@/components/Cgu";
import { CesuRecurrenceModal } from "@/components/CesuRecurrence";
import { ExperienceBadgeChip, ExperienceBadgeScale, ThumbsCount, ThumbUpButton } from "@/components/CompanionBadges";
import { CompanionProfilePanel } from "@/components/CompanionProfilePanel";
import { useCompanionSettings } from "@/lib/companionSettings";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SOS Compagnons — Aide d'urgence pour seniors" },
      { name: "description", content: "Mise en relation d'urgence entre familles seniors et compagnons vérifiés à proximité." },
      { property: "og:title", content: "SOS Compagnons" },
      { property: "og:description", content: "Un besoin = Un compagnon = Un tarif unique. Aide d'urgence à proximité pour les seniors." },
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
    { v: "family", label: "👴👵 👨👩 Famille" },
    { v: "student", label: "🤝 Compagnon" },
    { v: "admin", label: "🛡️ Admin" },
  ];
  return (
    <header className="px-5 pt-6 pb-4 border-b border-border">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-10 w-10 rounded-2xl bg-primary grid place-items-center text-primary-foreground text-xl font-black">S</div>
        <div>
          <h1 className="text-xl font-black leading-none">SOS Compagnons</h1>
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
  const currentId = useStore((s) => s.currentRequestId);
  const current = useStore((s) => s.requests.find((r) => r.id === s.currentRequestId));
  const account = useFamilyAccount();

  useEffect(() => {
    if (step !== "wait" || !currentId || current?.status !== "searching") return;
    const isFuture = !!current?.scheduledAt && current.scheduledAt > Date.now() + 60_000;
    if (isFuture) return;
    const t = setTimeout(() => store.acceptRequest(currentId, Math.floor(Math.random() * 3)), 3500);
    return () => clearTimeout(t);
  }, [step, current?.status, current?.scheduledAt, currentId]);

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
        <div className="text-center">
          <p className="text-lg text-muted-foreground">Besoin d'aide ?</p>
          <p className="text-base text-muted-foreground mt-1">Choisissez le moment qui vous convient.</p>
        </div>
        <div className="w-full bg-card border-2 border-primary/30 rounded-2xl p-4 text-center">
          <p className="text-base font-black">Un besoin = Un compagnon = Un tarif unique.</p>
          <ul className="mt-2 text-sm text-muted-foreground space-y-0.5">
            <li>0 € de frais de dossier</li>
            <li>0 € d'abonnement</li>
            <li>Sans engagement.</li>
          </ul>
        </div>
        <button
          onClick={() => { setRequestMode("asap"); setStep("form"); }}
          className="btn-huge bg-primary text-primary-foreground hover:brightness-110 min-h-[180px] w-full flex flex-col items-center justify-center gap-2"
        >
          <span className="text-5xl">🆘</span>
          <span>Urgence — maintenant</span>
          <span className="text-sm font-normal opacity-90">Un compagnon vient au plus vite</span>
        </button>
        <button
          onClick={() => { setRequestMode("scheduled"); setStep("form"); }}
          className="btn-huge bg-accent text-foreground border-2 border-primary min-h-[140px] w-full flex flex-col items-center justify-center gap-2"
        >
          <span className="text-4xl">📅</span>
          <span>Prendre un rendez-vous</span>
          <span className="text-sm font-normal text-muted-foreground">Planifier pour plus tard</span>
        </button>
        <div className="w-full bg-success/10 border-2 border-success/40 rounded-2xl p-4 text-left">
          <p className="text-sm font-bold text-success text-center">💳 Paiement en CESU préfinancé</p>
          <ul className="text-xs text-muted-foreground mt-2 space-y-1 list-disc pl-4">
            <li>
              Service à la personne (SAP) : le <b className="text-foreground">crédit d'impôt de 50 %</b> est déduit
              immédiatement.
            </li>
            <li>
              Vous ne réglez que <b className="text-foreground">la moitié du tarif</b> à la commande, rien à avancer
              ni à réclamer ensuite.
            </li>
            <li>Le compagnon est déclaré en CESU : zéro démarche administrative pour vous.</li>
            <li>Attestation fiscale annuelle disponible chaque janvier depuis votre compte.</li>
          </ul>
        </div>
        <CguPanel />
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

  const needs: { v: NeedType; icon: string }[] = [
    { v: "Compagnie/Présence", icon: "🤝" },
    { v: "Courses urgentes", icon: "🛒" },
    { v: "Pharmacie", icon: "💊" },
    { v: "Aide au repas", icon: "🍽️" },
    { v: "Accompagnement sorties extérieures", icon: "🌳" },
    { v: "Sortir ou nourrir animal de compagnie", icon: "🐕" },
    { v: "Arroser les plantes", icon: "🪴" },
    { v: "Retrait ou dépôt d'un colis", icon: "📦" },
    { v: "Aide aux devoirs (primaire au lycée)", icon: "📚" },
    { v: "Garde d'enfants (à partir de 3 ans)", icon: "🧸" },
    { v: "Accompagner un enfant (à partir de 3 ans)", icon: "🚸" },
    { v: "Autre (à préciser)", icon: "✏️" },
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
      extraInfo: extraInfo.trim() || undefined,
      continuityCertified: isOutdoor ? continuity : undefined,
    });
    onSubmit();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim() || !phone.trim()) return;
    if (need === "Autre (à préciser)" && !otherDetail.trim()) return;
    if (isOutdoor && !continuity) return;
    if (isChildNeed && (!childAge.trim() || Number(childAge) < 3)) return;
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
            </button>
          ))}
        </div>
      </div>
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
      <button type="submit" disabled={!cguOk} className="btn-huge bg-primary text-primary-foreground disabled:opacity-50">
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


function FamilyWait({ request, onDone }: { request: Request | undefined; onDone: () => void }) {
  const [paid, setPaid] = useState(false);
  const [showPay, setShowPay] = useState(false);
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

  const isFutureSched = !!request.scheduledAt && request.scheduledAt > Date.now() + 60_000;

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 gap-6 text-center">
      {!accepted ? (
        isFutureSched ? (
          <>
            <div className="text-6xl">📅</div>
            <div>
              <p className="text-2xl font-bold">Rendez-vous enregistré</p>
              <p className="text-base text-muted-foreground mt-2">Nous cherchons un compagnon pour ce créneau.</p>
            </div>
            <div className="w-full bg-card rounded-2xl p-5 border-2 border-border text-left">
              <p className="text-sm text-muted-foreground">Date et heure</p>
              <p className="text-lg font-bold">{formatSchedule(request.scheduledAt!)}</p>
              <p className="text-sm text-muted-foreground mt-3">Besoin</p>
              <p className="text-base font-semibold">{request.need.includes("/") ? request.need.replace("/", " / ") : request.need}</p>
            </div>
            <ScheduleManageBlock request={request} paid={false} />
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
              <p className="text-2xl font-bold">Recherche d'un compagnon à proximité…</p>
              <p className="text-base text-muted-foreground mt-2">Ne quittez pas cet écran.</p>
            </div>
            <p className="text-sm text-muted-foreground">Besoin : <b>{request.need.includes("/") ? request.need.replace("/", " / ") : request.need}</b></p>
            <div className="w-full rounded-2xl border-2 border-border bg-card p-3 text-left">
              <p className="text-sm font-bold">🆘 Demande d'urgence</p>
              <p className="text-xs text-muted-foreground mt-1">
                Une demande SOS ne peut être ni modifiée ni annulée : un compagnon est déjà en route de recherche.
                Pour un besoin planifiable, utilisez « Prendre un rendez-vous ».
              </p>
            </div>
          </>
        )
      ) : (
        <>
          <p className="text-lg font-bold text-success">✅ Un compagnon a accepté !</p>
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
type EnrollProfile = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  situation?: string;
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

function loadEnroll(): { status: EnrollStatus; profile?: EnrollProfile; appId?: string; demo?: boolean } {
  if (typeof window === "undefined") return { status: "none" };
  try {
    const raw = localStorage.getItem(ENROLL_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { status: "none" };
}

function StudentFlow() {
  const [enroll, setEnroll] = useState<{ status: EnrollStatus; profile?: EnrollProfile; appId?: string; demo?: boolean }>(() => loadEnroll());
  const apps = useApplications();
  const [online, setOnline] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const requests = useStore((s) => s.requests.filter((r) => r.status === "searching"));
  const active = useStore((s) => (openId ? s.requests.find((r) => r.id === openId) : undefined));
  const strikes = useStrikes();

  // Sync enroll state with admin's decision on this candidate
  useEffect(() => {
    if (!enroll.appId || enroll.demo) return;
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

  const saveEnroll = (next: { status: EnrollStatus; profile?: EnrollProfile; appId?: string; demo?: boolean }) => {
    setEnroll(next);
    try { localStorage.setItem(ENROLL_KEY, JSON.stringify(next)); } catch {}
  };

  if (enroll.status !== "approved") {
    return <StudentEnroll enroll={enroll} onChange={saveEnroll} />;
  }


  if (active) return <StudentDetail request={active} onBack={() => setOpenId(null)} />;

  return (
    <div className="flex-1 flex flex-col px-5 py-6 gap-5">
      {enroll.demo && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-primary/40 bg-accent p-3">
          <p className="text-sm font-bold">👁️ Mode démo — espace Compagnon validé</p>
          <button
            onClick={() => saveEnroll({ status: "none" })}
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
                      <p className="text-base text-muted-foreground mt-1">📍 {maskAddress(r.address)}</p>
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

      <CguPanel />

      <CompanionRulesNotice strikes={strikes} />
      <CompanionLoyaltyGrid />
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

const BLAMES_KEY = "sos-companion-blames";
function useBlames(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(Number(localStorage.getItem(BLAMES_KEY) || 0));
  }, []);
  return n;
}

function CompanionRulesNotice({ strikes }: { strikes: number }) {
  const blames = useBlames();
  const banned = strikes >= 3 || blames >= 3;
  return (
    <div
      className={`rounded-2xl border-2 p-4 text-left ${banned ? "border-destructive bg-destructive/10" : "border-warning bg-warning/10"}`}
    >
      <p className="text-sm font-bold">{banned ? "🚫 Compte radié" : "⚠️ Règles d'engagement du compagnon (CGU)"}</p>
      <p className="text-xs font-semibold mt-2">Avant la mission</p>
      <ul className="text-xs text-muted-foreground mt-1 space-y-1 list-disc pl-4">
        <li>N'acceptez que les missions que vous pouvez réellement assurer.</li>
        <li>Annulation possible jusqu'à 48 h avant le rendez-vous, si un autre compagnon est disponible.</li>
        <li>Moins de 48 h : uniquement sur justificatif valable (maladie, accident, cas de force majeure).</li>
        <li>Prévenez la famille par appel ou SMS dès qu'un imprévu survient.</li>
      </ul>
      <p className="text-xs font-semibold mt-2">Pendant la mission</p>
      <ul className="text-xs text-muted-foreground mt-1 space-y-1 list-disc pl-4">
        <li>Ponctualité : arrivez à l'heure, présentez-vous et montrez votre photo de profil.</li>
        <li>Respect, politesse et discrétion : ce qui se passe chez la famille reste confidentiel (RGPD).</li>
        <li>Restez dans le cadre du service demandé : aucun acte médical, paramédical ou d'apprentissage.</li>
        <li>Aucun paiement en direct, aucun cadeau, aucune clé conservée, aucune opération bancaire.</li>
        <li>Aucun alcool, aucune substance, aucun tabac au domicile ; téléphone en usage limité.</li>
        <li>Enfants (3 ans et +) : ne jamais laisser l'enfant seul, ne le confier qu'à l'adulte désigné.</li>
      </ul>
      <p className="text-xs font-semibold mt-2">Sanctions et pénalités</p>
      <ul className="text-xs text-muted-foreground mt-1 space-y-1 list-disc pl-4">
        <li>
          <b className="text-foreground">Plainte justifiée d'un client</b> (impolitesse, retard répété, incivilité,
          négligence, non-respect du service demandé) : <b className="text-foreground">1 blâme</b>.
        </li>
        <li>
          <b className="text-foreground">3 blâmes = radiation définitive</b> de l'application. Chaque blâme est
          notifié avec le motif ; vous disposez de 7 jours pour le contester.
        </li>
        <li>
          <b className="text-foreground">3 rendez-vous non honorés</b> sans justificatif valable ={" "}
          <b className="text-foreground">radiation définitive</b>.
        </li>
        <li>
          <b className="text-foreground">Non-respect des CGU : radiation immédiate</b>, sans préavis.
        </li>
        <li>
          Radiation immédiate et signalement aux autorités : vol, violence, maltraitance, propos discriminatoires,
          état d'ébriété, fausse identité, paiement en direct ou mise en relation hors application.
        </li>
        <li>Toute mission non réglée en cas de radiation reste due au compagnon pour le travail déjà effectué.</li>
      </ul>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <div className="rounded-xl bg-card border-2 border-border p-2 text-center">
          <p className="text-xs text-muted-foreground">RDV non honorés</p>
          <p className="text-lg font-black">{strikes}/3</p>
        </div>
        <div className="rounded-xl bg-card border-2 border-border p-2 text-center">
          <p className="text-xs text-muted-foreground">Blâmes clients</p>
          <p className="text-lg font-black">{blames}/3</p>
        </div>
      </div>
      <p className={`text-sm font-bold mt-2 ${banned ? "text-destructive" : ""}`}>
        {banned
          ? "Votre compte est radié : vous ne pouvez plus accepter de mission."
          : "Compte en règle — merci de votre sérieux."}
      </p>
      <div className="mt-3">
        <CguPanel />
      </div>

    </div>
  );
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
  const accept = () => { if (!banned) store.acceptRequest(request.id); };


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

      {!accepted ? (
        <>
          <div className="bg-accent rounded-2xl p-4 text-sm">
            Vous voyez la rue et la ville. Le <b>numéro exact</b> et le <b>téléphone de la famille</b> seront
            révélés dès que vous aurez accepté la mission.
          </div>
          <CompanionRulesNotice strikes={strikes} />
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
          <CompanionRulesNotice strikes={strikes} />
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
  enroll: { status: EnrollStatus; profile?: EnrollProfile; appId?: string; demo?: boolean };
  onChange: (n: { status: EnrollStatus; profile?: EnrollProfile; appId?: string; demo?: boolean }) => void;
}) {
  const [step, setStep] = useState<"intro" | "form">("intro");
  const [cguOk, setCguOk] = useState(false);
  const [p, setP] = useState<EnrollProfile>(
    enroll.profile ?? {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      situation: "Étudiant(e)",
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
          <p className="text-sm text-muted-foreground mt-2">Situation</p>
          <p className="text-base">{enroll.profile?.situation} — {enroll.profile?.school}</p>
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
          <div className="text-5xl mb-2">🤝</div>
          <h2 className="text-2xl font-black">Devenir Compagnon SOS</h2>
          <p className="text-base text-muted-foreground mt-2">
            Étudiant, salarié, indépendant, retraité ou en recherche d'emploi : aidez des familles près de chez vous
            et gagnez un revenu complémentaire.
          </p>
        </div>
        <div className="bg-card border-2 border-border rounded-2xl p-5">
          <p className="font-bold mb-3">Conditions</p>
          <ul className="space-y-2 text-sm">
            <li>✓ Être majeur (18 ans et +)</li>
            <li>✓ Pièce d'identité valide</li>
            <li>✓ Justificatif de situation (carte étudiante, contrat de travail, attestation Pôle emploi/France Travail, notification de retraite…)</li>
            <li>✓ Extrait de casier judiciaire (bulletin n°3)</li>
            <li>✓ RIB pour les paiements</li>
          </ul>
        </div>
        <ServiceLimitsNotice />
        <div className="flex-1" />
        <button onClick={() => setStep("form")} className="btn-huge bg-primary text-primary-foreground">
          Commencer ma candidature
        </button>
        <button
          type="button"
          onClick={() =>
            onChange({
              status: "approved",
              demo: true,
              profile: {
                firstName: "Démo",
                lastName: "Compagnon",
                email: "demo@sos-compagnons.fr",
                phone: "06 00 00 00 00",
                situation: "Étudiant(e)",
                school: "Démonstration",
                city: "Paris",
                motivation: "Aperçu de l'espace Compagnon",
                docs: {},
              },
            })
          }
          className="py-4 rounded-2xl border-2 border-primary text-primary font-bold text-base"
        >
          👁️ Aperçu de l'espace Compagnon (démo)
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
    { k: "studentCard", label: "Justificatif de situation (carte étudiante, contrat, attestation…)", icon: "📑" },
    { k: "criminalRecord", label: "Casier judiciaire (B3)", icon: "📄" },
    { k: "iban", label: "RIB", icon: "🏦" },
  ];

  const allDocs = docs.every((d) => p.docs[d.k]);
  const valid =
    p.firstName && p.lastName && p.email && p.phone && p.situation && p.school && p.city && p.selfie && allDocs && cguOk;

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
      <div>
        <p className="font-bold mb-2 text-sm">Votre situation</p>
        <div className="grid grid-cols-2 gap-2">
          {["Étudiant(e)", "Salarié(e)", "Indépendant(e)", "Retraité(e)", "En recherche d'emploi", "Autre"].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setP({ ...p, situation: s })}
              className={`py-3 px-2 rounded-2xl border-2 text-sm font-bold transition-all ${
                p.situation === s ? "border-primary bg-accent" : "border-border bg-card"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <input required placeholder="Établissement / employeur / activité" value={p.school} onChange={(e) => setP({ ...p, school: e.target.value })} className="px-4 py-3 rounded-2xl border-2 border-border bg-card focus:border-primary outline-none" />
      <input required placeholder="Ville" value={p.city} onChange={(e) => setP({ ...p, city: e.target.value })} className="px-4 py-3 rounded-2xl border-2 border-border bg-card focus:border-primary outline-none" />
      <textarea placeholder="Pourquoi voulez-vous rejoindre SOS Compagnons ?" value={p.motivation} onChange={(e) => setP({ ...p, motivation: e.target.value })} rows={3} className="px-4 py-3 rounded-2xl border-2 border-border bg-card focus:border-primary outline-none resize-none" />

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

      <CguAcceptBlock checked={cguOk} onChange={setCguOk} role="companion" />

      <button type="submit" disabled={!valid} className="btn-huge bg-primary text-primary-foreground disabled:opacity-50 mt-2">

        Envoyer ma candidature
      </button>
      <ServiceLimitsNotice />
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
      <p className="text-sm text-muted-foreground">Réservé à l'équipe SOS Compagnons — vérification des candidatures.</p>
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
          <p className="text-xs text-muted-foreground">Vérification et validation des compagnons</p>
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
    { k: "studentCard", label: "Justificatif de situation (carte étudiante, contrat, attestation…)", icon: "📑" },
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
        <Row label="Situation" value={app.profile.situation ?? "—"} />
        <Row label="Établissement / employeur" value={app.profile.school} />
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

/* ---------------- FAMILY ACCOUNT SCREEN ---------------- */

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

