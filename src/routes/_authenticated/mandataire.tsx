import { Button } from "@/components/ui/button";
import { MandataireContext, ContractCount, InForceBadge, PersonContracts, ContractsSection, ContractDetail, DossierBlock, DossierMissions, AccessLog, type PersonTarget } from "@/components/MandataireContracts";
import { listContractsForMandataire } from "@/lib/mandataire.functions";
import { useStore } from "@/lib/store";
import { CopyButton } from "@/components/CopyButton";
import { ContractSettingsPanel } from "@/components/ContractSettingsPanel";
import { MissionsTab } from "@/components/MandataireMissionsTab";
import { departmentLabel, formatBirthDate } from "@/components/BirthFields";
import { missingCompanionItems } from "@/lib/companionDossier";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ShieldCheck, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAccess, useSession } from "@/lib/auth";
import {
  getDocumentUrl,
  listApplications,
  listClientRegistrations,
  reviewApplication,
  reviewClientDocument,
} from "@/lib/account.functions";
import { inputCls } from "@/lib/auth";
import {
  listMissionPayments,
  runDuePaymentsNow,
  updatePaymentSimulation,
} from "@/lib/payments.functions";

export const Route = createFileRoute("/_authenticated/mandataire")({
  head: () => ({
    meta: [
      { title: "Tableau de bord Mandataire — Solélia" },
      { name: "description", content: "Validation des candidatures compagnon Solélia." },
      { property: "og:title", content: "Tableau de bord Mandataire — Solélia" },
      { property: "og:description", content: "Espace de gestion réservé au mandataire Solélia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MandatairePage,
});

type App = Awaited<ReturnType<typeof listApplications>>[number];
type Filter = "pending" | "changes_requested" | "approved" | "all";

const STATUS_LABEL: Record<string, string> = {
  pending: "⏳ En attente",
  changes_requested: "📝 À compléter",
  approved: "✅ Validé",
  rejected: "📝 À compléter",
};

const APP_URL = "https://id-preview--7fa03864-dcca-451b-8ec4-d161c6f9b537.lovable.app";

function mailtoLink(app: App, reason: string) {
  const isApproved = app.status === "approved";
  const subject = isApproved
    ? "Solélia — Bienvenue dans l'aventure !"
    : "Solélia — Action requise sur votre dossier";
  const body = isApproved
    ? `Félicitations ${app.first_name} ! Votre dossier est validé : vous faites désormais officiellement partie des Compagnons Solélia. Vous pouvez dès à présent vous connecter à votre espace pour découvrir les offres et réaliser vos premières missions : ${APP_URL}\n\nBienvenue dans l'équipe,\nL'équipe Solélia`
    : `Bonjour ${app.first_name},\n\nDe légers ajustements sont nécessaires pour valider votre profil.\n\nMotif : ${reason || app.reject_reason || ""}\n\nMerci de mettre à jour vos pièces sur votre espace : ${APP_URL}\n\nL'équipe Solélia`;
  return `mailto:${encodeURIComponent(app.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function MandatairePage() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const access = useAccess(session?.user.id);

  useEffect(() => {
    if (access.data && (!access.data.isMandataire || !access.data.strongAuth)) {
      supabase.auth.signOut().then(() => navigate({ to: "/pro", replace: true }));
    }
  }, [access.data, navigate]);

  if (loading || access.isLoading) {
    return (
      <Shell>
        <p className="text-center text-muted-foreground py-10">Chargement…</p>
      </Shell>
    );
  }
  if (access.isError || !access.data?.isMandataire || !access.data.strongAuth) {
    return (
      <Shell>
        <p className="text-center py-10">
          Accès réservé.{" "}
          <Link to="/pro" className="underline font-bold">
            Espace Pro
          </Link>
        </p>
      </Shell>
    );
  }
  return (
    <Shell email={access.data.email}>
      <Dashboard />
    </Shell>
  );
}

function Shell({ children, email }: { children: React.ReactNode; email?: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  return (
    <div className="min-h-screen bg-background flex justify-center">
      <div className="w-full max-w-[440px] md:max-w-5xl min-h-screen text-sm flex flex-col bg-background shadow-xl">
        <header className="px-5 pt-6 pb-4 border-b border-border flex items-center gap-3">
          <ShieldCheck className="h-7 w-7 text-primary" />
          <div className="flex-1">
            <h1 className="text-lg font-black leading-tight">Espace Mandataire</h1>
            {email && <p className="text-sm text-muted-foreground">{email}</p>}
          </div>
          {email && (
            <Button
              aria-label="Se déconnecter"
              onClick={async () => {
                await qc.cancelQueries();
                qc.clear();
                await supabase.auth.signOut();
                navigate({ to: "/pro", replace: true });
              }}
              className="p-2 rounded-xl border-2 border-border"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          )}
        </header>
        <main className="flex-1 flex flex-col px-5 py-5">{children}</main>
      </div>
    </div>
  );
}

const PAGE_SIZE = 20;

function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Rechercher un nom, prénom ou email…"
      className={inputCls}
    />
  );
}

function Pager({
  page,
  total,
  onPage,
}: {
  page: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-2 pt-2">
      <Button
        disabled={page === 0}
        onClick={() => onPage(page - 1)}
        className="px-4 py-2 rounded-2xl border-2 border-border font-bold disabled:opacity-40"
      >
        ←
      </Button>
      <span className="text-sm text-muted-foreground">
        Page {page + 1} / {pages}
      </span>
      <Button
        disabled={page >= pages - 1}
        onClick={() => onPage(page + 1)}
        className="px-4 py-2 rounded-2xl border-2 border-border font-bold disabled:opacity-40"
      >
        →
      </Button>
    </div>
  );
}

type Tab = "todo" | "companions" | "clients" | "payments" | "missions" | "contracts" | "log" | "settings";
function Dashboard() {
  const [tab, setTab] = useState<Tab>("todo");
  const [target, setTarget] = useState<PersonTarget | null>(null);
  const [filter, setFilter] = useState("all");
  const list = useServerFn(listApplications);
  const apps = useQuery({ queryKey: ["applications"], queryFn: () => list() });
  const listClients = useServerFn(listClientRegistrations);
  const clients = useQuery({ queryKey: ["client-registrations"], queryFn: () => listClients() });
  const listContracts = useServerFn(listContractsForMandataire);
  const contracts = useQuery({ queryKey: ["mandataire-contracts"], queryFn: () => listContracts() });
  const fetchPayments = useServerFn(listMissionPayments);
  const payments = useQuery({ queryKey: ["mission-payments"], queryFn: () => fetchPayments() });
  const requests = useStore(s => s.requests);
  const go = (next: Tab, nextFilter = "all") => { setTab(next); setFilter(nextFilter); setTarget(null); };
  const tasks: { label: string; count: number; tab: Tab; filter?: string }[] = [
    { label: "Candidatures à valider", count: (apps.data ?? []).filter(a => a.status === "pending").length, tab: "companions", filter: "pending" },
    { label: "Candidatures à compléter", count: (apps.data ?? []).filter(a => ["changes_requested", "rejected"].includes(a.status)).length, tab: "companions", filter: "changes_requested" },
    { label: "Dossiers Particulier incomplets", count: (clients.data ?? []).filter(c => clientStatus(c) === "incomplete").length, tab: "clients", filter: "incomplete" },
    { label: "Documents Particulier à vérifier", count: (clients.data ?? []).filter(c => clientStatus(c) === "to_check").length, tab: "clients", filter: "to_check" },
    { label: "Missions à déclarer", count: requests.filter(r => r.status === "accepted" && ["validated", "auto_validated"].includes(r.completion ?? "") && !r.declaredAt).length, tab: "missions", filter: "declare" },
    { label: "Missions signalées", count: requests.filter(r => r.status === "accepted" && r.completion === "problem").length, tab: "missions", filter: "reported" },
    { label: "Paiements en échec", count: (payments.data ?? []).filter(p => ["debit_echoue", "annulee_echec_paiement"].includes(p.status)).length, tab: "payments", filter: "failed" },
    { label: "Contrats en attente de réponse", count: (contracts.data ?? []).filter(c => c.status === "awaiting_companion").length, tab: "contracts", filter: "awaiting_companion" },
  ];
  return <MandataireContext.Provider value={{ contracts: contracts.data ?? [], clients: clients.data ?? [], companions: apps.data ?? [], navigate: setTarget }}>
    <div className="flex flex-col gap-5">
      <nav aria-label="Sections Mandataire" className="grid grid-cols-2 md:grid-cols-4 gap-2">{([
        ["todo", "À traiter"], ["clients", "Particuliers"], ["companions", "Compagnons"], ["contracts", "Contrats"], ["missions", "Missions"], ["payments", "Frais de service"], ["log", "Journal d'accès"], ["settings", "Réglages"],
      ] as const).map(([key, label]) => <Button key={key} variant={tab === key ? "secondary" : "outline"} className="h-auto whitespace-normal py-3" onClick={() => go(key)}>{label}</Button>)}</nav>
      {contracts.isError && <p className="text-destructive">Impossible de charger les contrats.</p>}
      {target?.type === "contract" ? <ContractDetail key={target.id} id={target.id} onBack={() => setTarget(null)} /> : target?.type === "client" ? (() => { const c = clients.data?.find(c => c.id === target.id); return c ? <ClientDetail client={c} onBack={() => setTarget(null)} /> : <p>Dossier indisponible</p>; })() : target?.type === "companion" ? (() => { const a = apps.data?.find(a => a.user_id === target.id); return a ? <Detail app={a} onBack={() => setTarget(null)} /> : <p>Dossier indisponible</p>; })() : <>
      <h2 className="text-xl font-bold">{({ todo: "À traiter", clients: "Particuliers", companions: "Compagnons", contracts: "Contrats", missions: "Missions", payments: "Frais de service", log: "Journal d'accès", settings: "Réglages" })[tab]}</h2>
      {tab === "todo" ? <>{(apps.isPending || clients.isPending || contracts.isPending || payments.isPending) && <p>Chargement des compteurs…</p>}{(apps.isError || clients.isError || payments.isError) && <p className="text-destructive">Certains compteurs sont indisponibles.</p>}<div className="grid gap-3 md:grid-cols-2">{tasks.map(t => <Button key={t.label} variant="outline" className="h-auto p-4 justify-between whitespace-normal text-left" onClick={() => go(t.tab, t.filter)}><span>{t.label}</span><span className="text-2xl font-bold">{t.count}</span></Button>)}</div></> : tab === "companions" ? <CompanionsTab key={filter} apps={apps} initialFilter={filter as Filter} onOpen={id => setTarget({ type: "companion", id })} /> : tab === "clients" ? <ClientsTab key={filter} clients={clients} initialFilter={filter as ClientStatus | "all"} onOpen={id => setTarget({ type: "client", id })} /> : tab === "missions" ? <MissionsTab filter={filter} /> : tab === "payments" ? <PaymentsTab filter={filter} /> : tab === "contracts" ? <ContractsSection key={filter} initialFilter={filter} /> : tab === "log" ? <AccessLog /> : <ContractSettingsPanel />}
      </>}
    </div>
  </MandataireContext.Provider>;
}

function CompanionsTab({ apps, initialFilter, onOpen }: { apps: UseQueryResult<App[]>; initialFilter: Filter; onOpen: (id: string) => void }) {
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  if (apps.isLoading)
    return <p className="text-center text-muted-foreground py-10">Chargement des candidatures…</p>;
  if (apps.isError)
    return (
      <p className="text-center text-destructive py-10">Impossible de charger les candidatures.</p>
    );

  const all = apps.data ?? [];

  const norm = (s: string) => (s === "rejected" ? "changes_requested" : s);
  const needle = q.trim().toLowerCase();
  const filtered = (filter === "all" ? all : all.filter((a) => norm(a.status) === filter))
    .filter((a) =>
      !needle
        ? true
        : `${a.first_name} ${a.last_name} ${a.email}`.toLowerCase().includes(needle),
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const count = (s: string) => all.filter((a) => norm(a.status) === s).length;
  const shown = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        {(["pending", "changes_requested", "approved"] as const).map((s) => (
          <Button
            key={s}
            onClick={() => {
              setFilter(s);
              setPage(0);
            }}
            className={`rounded-2xl border-2 p-3 ${filter === s ? "border-primary bg-secondary" : "border-border bg-card"}`}
          >
            <div className="text-2xl font-black">{count(s)}</div>
            <div className="text-sm">{STATUS_LABEL[s]}</div>
          </Button>
        ))}
      </div>
      <Button
        onClick={() => {
          setFilter("all");
          setPage(0);
        }}
        className={`text-sm underline ${filter === "all" ? "font-bold" : "text-muted-foreground"}`}
      >
        Voir toutes les candidatures ({all.length})
      </Button>
      <SearchBar
        value={q}
        onChange={(v) => {
          setQ(v);
          setPage(0);
        }}
      />
      {shown.length === 0 && (
        <p className="text-center text-muted-foreground py-8">
          Aucune candidature dans cette catégorie.
        </p>
      )}
      {shown.map((a) => (
        <div key={a.id} className="rounded-2xl border-2 border-border bg-card p-4 flex flex-col gap-3">
          <Button onClick={() => onOpen(a.user_id)} className="text-left flex gap-3 items-center">
            <DocThumb path={a.selfie_path} size={56} rounded />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-base truncate">
                {a.first_name} {a.last_name}
              <InForceBadge personId={a.user_id} role="companion" />
              </div>
              <div className="text-sm text-muted-foreground truncate">
                {a.situation ?? "—"} · {a.address || a.city}
              </div>
              <div className="text-sm text-muted-foreground">
                {new Date(a.created_at).toLocaleDateString("fr-FR")}
              </div>
            </div>
            <span className="text-sm font-bold whitespace-nowrap">{STATUS_LABEL[a.status]}</span>
          </Button>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm font-bold">
            {(
              [
                ...(a.id_type === "passport"
                  ? ([["Passeport", a.id_passport_path]] as const)
                  : ([
                      ["Identité recto", a.id_card_path],
                      ["Identité verso", a.id_card_back_path],
                    ] as const)),
                ["Situation", a.situation_proof_path],
                ["B3", a.criminal_record_path],
                ["RIB", a.iban_path],
                ["Selfie", a.selfie_path],
              ] as const
            ).map(([label, path]) => (
              <span key={label} className={path ? "text-success" : "text-destructive"}>
                {path ? "✓" : "✗"} {label}
              </span>
            ))}
          </div>
          <a
            href={mailtoLink(a, a.reject_reason ?? "")}
            className="text-sm font-bold text-primary underline"
          >
            ✉️ Envoyer l'email
          </a>
        </div>
      ))}
      <Pager page={page} total={filtered.length} onPage={setPage} />
    </div>
  );
}


function useSignedUrl(path: string | null, bucket: "companion-docs" | "client-docs" = "companion-docs") {
  const fetchUrl = useServerFn(getDocumentUrl);
  return useQuery({
    queryKey: ["doc-url", bucket, path],
    queryFn: () => { if (!path) throw new Error("Document manquant"); return fetchUrl({ data: { path, bucket } }); },
    enabled: !!path,
    staleTime: 5 * 60_000,
  });
}

function DocThumb({
  path,
  size = 56,
  rounded,
}: {
  path: string | null;
  size?: number;
  rounded?: boolean;
}) {
  const url = useSignedUrl(path);
  const cls = `${rounded ? "rounded-full" : "rounded-xl"} bg-muted object-cover shrink-0`;
  if (!path || !url.data) return <div style={{ width: size, height: size }} className={cls} />;
  return (
    <img
      src={url.data.url}
      alt="Selfie"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={cls}
    />
  );
}

function DocCard({ label, path }: { label: string; path: string | null }) {
  const url = useSignedUrl(path);
  const isPdf = path?.toLowerCase().endsWith(".pdf");
  return (
    <div className="rounded-2xl border-2 border-border bg-card p-3">
      <div className="text-sm font-bold mb-2">{label}</div>
      {!path ? (
        <p className="text-sm text-destructive">Non fourni</p>
      ) : url.isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : url.isError || !url.data ? (
        <p className="text-sm text-destructive">Document inaccessible</p>
      ) : (
        <>
          {!isPdf && (
            <img
              src={url.data.url}
              alt={label}
              className="w-full max-h-64 object-contain rounded-xl bg-muted mb-2"
            />
          )}
          <a
            href={url.data.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm font-bold text-primary underline"
          >
            {isPdf ? "📄 Ouvrir le PDF" : "🔍 Ouvrir en grand"}
          </a>
        </>
      )}
    </div>
  );
}

function Detail({ app, onBack }: { app: App; onBack: () => void }) {
  const qc = useQueryClient();
  const review = useServerFn(reviewApplication);
  const [reason, setReason] = useState(app.reject_reason ?? "");
  const [err, setErr] = useState<string | null>(null);
  const mut = useMutation({
    mutationFn: (v: { status: "pending" | "approved" | "changes_requested"; rejectReason?: string }) =>
      review({ data: { id: app.id, ...v } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["applications"] }),
    onError: (e: Error) => setErr(e.message),
  });

  const missing = missingCompanionItems(app);
  const NotSet = () => <span className="font-bold text-destructive">Non renseigné</span>;
  return (
    <div className="flex flex-col gap-4">
      <Button onClick={onBack} className="text-sm font-bold text-primary text-left">
        ← Retour à la liste
      </Button>
      <div className="flex items-center gap-4">
        <DocThumb path={app.selfie_path} size={80} rounded />
        <div>
          <h2 className="text-xl font-black">
            {app.first_name} {app.last_name}
          </h2>
          <p className="text-sm text-muted-foreground">
            {app.situation ?? "—"}
            {app.address ? ` · ${app.address}` : ""}
          </p>
          <p className="text-sm font-bold mt-1">{STATUS_LABEL[app.status]}</p>
          <p>{app.email}</p><ContractCount personId={app.user_id} role="companion" />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-x-6">
      <DossierBlock title="Identité et coordonnées" open>
      <div className="text-sm space-y-1">
        <p>📧 {app.email}</p>
        <p>📞 {app.phone}</p>
        <p>📍 {app.address || app.city}</p>
        <p className="flex items-center gap-2 flex-wrap">
          🆔 NIR : <span className="font-mono font-bold">{app.nir || "Non renseigné"}</span>
          <CopyButton value={app.nir ?? ""} />
        </p>
        <p className="flex items-center gap-2 flex-wrap">
          🎂 Date de naissance : {app.birth_date ? <b>{formatBirthDate(app.birth_date)}</b> : <NotSet />}
          <CopyButton value={formatBirthDate(app.birth_date)} />
        </p>
        <p className="flex items-center gap-2 flex-wrap">
          📍 Lieu de naissance : {app.birth_place?.trim() ? <b>{app.birth_place}</b> : <NotSet />}
          <CopyButton value={app.birth_place?.trim() ?? ""} />
        </p>
        <p className="flex items-center gap-2 flex-wrap">
          🗺️ Département de naissance :{" "}
          {app.birth_department ? <b>{departmentLabel(app.birth_department)}</b> : <NotSet />}
          <CopyButton value={app.birth_department ? departmentLabel(app.birth_department) : ""} />
        </p>
        <p>
          🏠 Logement :{" "}
          {app.housing_status === "hosted" ? "Hébergé(e) par un tiers" : "Titulaire du logement"}
        </p>
        <p>
          🪪 Pièce fournie :{" "}
          <b>{app.id_type === "passport" ? "Passeport" : app.id_type === "id_card" ? "Carte d'identité" : "Carte d'identité (non précisé)"}</b>
        </p>
        <p>
          💼 Numéro CESU :{" "}
          {app.has_cesu_number === true ? (
            <span className="font-mono font-bold">{app.cesu_number || "Non renseigné"}</span>
          ) : app.has_cesu_number === false ? (
            "Aucun"
          ) : (
            "Non renseigné"
          )}
        </p>
        <p>🗓️ Candidature du {new Date(app.created_at).toLocaleString("fr-FR")}</p>
        {app.motivation && (
          <p className="pt-2 text-muted-foreground italic">« {app.motivation} »</p>
        )}
      </div>

      </DossierBlock>
      <DossierBlock title="Documents">
      {app.id_type === "passport" ? (
        <DocCard label="🛂 Passeport (page photo)" path={app.id_passport_path} />
      ) : (
        <>
          <DocCard label="🪪 Pièce d'identité — recto" path={app.id_card_path} />
          <DocCard label="🪪 Pièce d'identité — verso" path={app.id_card_back_path} />
        </>
      )}
      <DocCard label="💳 Carte Vitale (recto)" path={app.vitale_card_path} />
      <DocCard label="🎓 Justificatif de situation" path={app.situation_proof_path} />
      <DocCard label="⚖️ Casier judiciaire (B3, moins de 3 mois)" path={app.criminal_record_path} />
      <DocCard label="🏦 RIB" path={app.iban_path} />
      {app.housing_status === "hosted" ? (
        <>
          <DocCard label="✍️ Attestation d'hébergement" path={app.host_attestation_path} />
          <DocCard label="🏠 Justificatif de domicile de l'hébergeur" path={app.host_address_proof_path} />
          <DocCard label="🪪 Pièce d'identité de l'hébergeur" path={app.host_id_path} />
        </>
      ) : (
        <DocCard label="🏠 Justificatif de domicile" path={app.address_proof_path} />
      )}
      <DocCard label="🤳 Selfie" path={app.selfie_path} />

      </DossierBlock>
      <DossierBlock title="Validation du dossier" open>
      {app.reject_reason && (
        <p className="text-sm rounded-2xl bg-secondary p-3">
          Note envoyée au compagnon : {app.reject_reason}
        </p>
      )}

      {err && <p className="text-sm text-destructive text-center">{err}</p>}

      {app.status !== "approved" && missing.length > 0 && (
        <p className="text-sm font-bold text-destructive">
          Candidature incomplète, validation impossible. Manquant : {missing.join(", ")}.
        </p>
      )}
      {app.status !== "approved" && (
        <Button
          disabled={mut.isPending || missing.length > 0}
          onClick={() => mut.mutate({ status: "approved" })}
          className="btn-huge bg-success text-success-foreground disabled:opacity-50"
        >
          ✅ Valider la candidature
        </Button>
      )}
      <div className="flex flex-col gap-2">
        <textarea
          placeholder="Motif des corrections demandées (10 caractères minimum)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className={inputCls + " min-h-20"}
        />
        <Button
          disabled={mut.isPending || reason.trim().length < 10}
          onClick={() => mut.mutate({ status: "changes_requested", rejectReason: reason })}
          className="btn-huge bg-warning text-warning-foreground disabled:opacity-50"
        >
          📝 Demander des corrections
        </Button>
      </div>
      <a
        href={mailtoLink(app, reason)}
        className="py-4 rounded-2xl border-2 border-primary text-primary font-bold text-center"
      >
        ✉️ Envoyer l'email
      </a>
      {app.status !== "pending" && (
        <Button
          disabled={mut.isPending}
          onClick={() => mut.mutate({ status: "pending" })}
          className="text-sm underline text-muted-foreground"
        >
          Remettre en attente
        </Button>
      )}
      </DossierBlock>
      <DossierBlock title="Contrats"><PersonContracts personId={app.user_id} role="companion" /></DossierBlock>
      <DossierBlock title="Autorisation ou mandat"><p>À venir</p></DossierBlock>
      <DossierBlock title="Missions"><DossierMissions personId={app.user_id} role="companion" /></DossierBlock>
      <DossierBlock title="Journal de ce dossier"><AccessLog personId={app.user_id} /></DossierBlock>
      </div>
    </div>
  );
}

/* ---------- Onglet « Inscriptions Particulier » ---------- */

type ClientRow = Awaited<ReturnType<typeof listClientRegistrations>>[number];
type ClientDoc = ClientRow["documents"][number];
type ClientStatus = "incomplete" | "to_check" | "complete";

const CLIENT_DOC_TYPES_ID_CARD = [
  { type: "rib", label: "RIB" },
  { type: "identity_front", label: "Pièce d'identité — recto" },
  { type: "identity_back", label: "Pièce d'identité — verso" },
  { type: "proof_of_address", label: "Justificatif de domicile" },
] as const;
const CLIENT_DOC_TYPES_PASSPORT = [
  { type: "rib", label: "RIB" },
  { type: "identity_passport", label: "Passeport (page photo)" },
  { type: "proof_of_address", label: "Justificatif de domicile" },
] as const;

/** Pièces attendues selon le type d'identité déposé (passeport si seul un passeport est présent). */
function clientDocTypes(c: ClientRow): readonly { type: ClientDoc["doc_type"]; label: string }[] {
  const has = (t: string) => c.documents.some((d) => d.doc_type === t && d.file_path);
  return has("identity_passport") && !has("identity_front") && !has("identity_back")
    ? CLIENT_DOC_TYPES_PASSPORT
    : CLIENT_DOC_TYPES_ID_CARD;
}

const CLIENT_STATUS_LABEL: Record<ClientStatus, string> = {
  incomplete: "🔴 Dossier incomplet",
  to_check: "🟡 Documents à vérifier",
  complete: "🟢 Dossier complet",
};

function clientStatus(c: ClientRow): ClientStatus {
  const byType = new Map(c.documents.map((d) => [d.doc_type, d]));
  const types = clientDocTypes(c);
  const present = types.filter((t) => byType.get(t.type)?.file_path);
  if (present.length < types.length) return "incomplete";
  return present.every((t) => byType.get(t.type)?.status === "validated") ? "complete" : "to_check";
}

function ClientsTab({ clients, initialFilter, onOpen }: { clients: UseQueryResult<ClientRow[]>; initialFilter: ClientStatus | "all"; onOpen: (id: string) => void }) {
  const [filter, setFilter] = useState<ClientStatus | "all">(initialFilter);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [priority, setPriority] = useState(false);

  if (clients.isLoading)
    return <p className="text-center text-muted-foreground py-10">Chargement des inscriptions…</p>;
  if (clients.isError)
    return (
      <p className="text-center text-destructive py-10">Impossible de charger les inscriptions.</p>
    );

  const all = clients.data ?? [];
  const needle = q.trim().toLowerCase();
  const filtered = all
    .filter((c) => (filter === "all" ? true : clientStatus(c) === filter))
    .filter((c) =>
      !needle ? true : `${c.first_name} ${c.last_name} ${c.email}`.toLowerCase().includes(needle),
    )
    .sort((a, b) => {
      if (priority) {
        const rank = (c: ClientRow) => (clientStatus(c) === "to_check" ? 0 : 1);
        const d = rank(a) - rank(b);
        if (d !== 0) return d;
      }
      return b.created_at.localeCompare(a.created_at);
    });
  const count = (s: ClientStatus) => all.filter((c) => clientStatus(c) === s).length;
  const shown = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Un compte Particulier n'est utilisable qu'une fois son dossier complet (champs et documents).
      </p>
      <div className="grid grid-cols-3 gap-2 text-center">
        {(["incomplete", "to_check", "complete"] as const).map((s) => (
          <Button
            key={s}
            onClick={() => {
              setFilter(s);
              setPage(0);
            }}
            className={`rounded-2xl border-2 p-3 ${filter === s ? "border-primary bg-secondary" : "border-border bg-card"}`}
          >
            <div className="text-2xl font-black">{count(s)}</div>
            <div className="text-sm">{CLIENT_STATUS_LABEL[s]}</div>
          </Button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2">
        <Button
          onClick={() => {
            setFilter("all");
            setPage(0);
          }}
          className={`text-sm underline ${filter === "all" ? "font-bold" : "text-muted-foreground"}`}
        >
          Toutes les inscriptions ({all.length})
        </Button>
        <label className="text-sm flex items-center gap-2">
          <input
            type="checkbox"
            checked={priority}
            onChange={(e) => setPriority(e.target.checked)}
            className="h-4 w-4"
          />
          À vérifier d'abord
        </label>
      </div>
      <SearchBar
        value={q}
        onChange={(v) => {
          setQ(v);
          setPage(0);
        }}
      />
      {shown.length === 0 && (
        <p className="text-center text-muted-foreground py-8">Aucune inscription dans cette catégorie.</p>
      )}
      {shown.map((c) => (
        <ClientCard key={c.id} client={c} onOpen={() => onOpen(c.id)} />
      ))}
      <Pager page={page} total={filtered.length} onPage={setPage} />
    </div>
  );
}

function ClientCard({ client, onOpen }: { client: ClientRow; onOpen: () => void }) {
  return <article className="rounded-lg border border-border bg-card p-4 space-y-2"><Button variant="ghost" onClick={onOpen} className="h-auto w-full justify-start text-left whitespace-normal"><span><b>{client.first_name} {client.last_name}</b><br />{client.email}<br />{CLIENT_STATUS_LABEL[clientStatus(client)]}</span></Button><InForceBadge personId={client.id} role="client" /><p>Inscrit le {new Date(client.created_at).toLocaleDateString("fr-FR")}</p><Button variant="link" onClick={onOpen}>Voir et vérifier le dossier</Button></article>;
}
function ClientDetail({ client, onBack }: { client: ClientRow; onBack: () => void }) {
  const byType = new Map(client.documents.map(d => [d.doc_type, d]));
  return <div className="space-y-4"><Button variant="ghost" onClick={onBack}>← Retour à la liste</Button><header><h2 className="text-xl font-bold">{client.first_name} {client.last_name}</h2><p>{client.email}</p><p>{CLIENT_STATUS_LABEL[clientStatus(client)]}</p><ContractCount personId={client.id} role="client" /></header><div className="grid md:grid-cols-2 gap-x-6">
    <DossierBlock title="Identité et coordonnées" open><p>Nom d'usage : {client.last_name}</p><p>Nom de naissance : {client.birth_name || "Non renseigné"}</p><p>{client.address_line} {client.postal_code} {client.city}</p><p>{client.phone}</p><a className="text-primary underline" href={`mailto:${encodeURIComponent(client.email)}`}>{client.email}</a></DossierBlock>
    <DossierBlock title="Informations URSSAF"><UrssafInfo client={client} /></DossierBlock>
    <DossierBlock title="Documents">{clientDocTypes(client).map(t => <ClientDocCard key={t.type} label={t.label} doc={byType.get(t.type) ?? null} />)}</DossierBlock>
    <DossierBlock title="Contrats"><PersonContracts personId={client.id} role="client" /></DossierBlock>
    <DossierBlock title="Mandat"><p>À venir</p></DossierBlock>
    <DossierBlock title="Missions et planning"><DossierMissions personId={client.id} role="client" /></DossierBlock>
    <DossierBlock title="Frais de service"><PaymentsTab personId={client.id} /></DossierBlock>
    <DossierBlock title="Journal de ce dossier"><AccessLog personId={client.id} /></DossierBlock>
  </div></div>;
}

function UrssafInfo({ client }: { client: ClientRow }) {
  const cesu =
    client.has_cesu_number === false
      ? { text: "Aucun", copy: "" }
      : client.has_cesu_number === true && client.cesu_number?.trim()
        ? { text: client.cesu_number, copy: client.cesu_number }
        : { text: "", copy: "" };
  const rows: { label: string; value: string; copy?: string }[] = [
    { label: "Numéro fiscal", value: client.tax_number ?? "" },
    { label: "Numéro CESU", value: cesu.text, copy: cesu.copy },
    { label: "Date de naissance", value: formatBirthDate(client.birth_date) },
    { label: "Lieu de naissance", value: client.birth_place ?? "" },
    { label: "Département de naissance", value: departmentLabel(client.birth_department) },
  ];
  return (
    <div className="rounded-2xl border-2 border-border p-3">
      <p className="text-sm font-bold mb-2">Informations URSSAF</p>
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground shrink-0">{r.label}</span>
            <span className="flex items-center gap-2 min-w-0">
              {r.value ? (
                <span className="font-bold truncate">{r.value}</span>
              ) : (
                <span className="font-bold text-destructive">Non renseigné</span>
              )}
              <CopyButton value={r.copy ?? r.value} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClientDocCard({ label, doc }: { label: string; doc: ClientDoc | null }) {
  const qc = useQueryClient();
  const review = useServerFn(reviewClientDocument);
  const [reason, setReason] = useState(doc?.reject_reason ?? "");
  const [err, setErr] = useState<string | null>(null);
  const url = useSignedUrl(doc?.file_path ?? null, "client-docs");
  const mut = useMutation({
    mutationFn: (v: { status: "validated" | "rejected"; rejectReason?: string }) =>
      doc ? review({ data: { id: doc.id, ...v } }) : Promise.reject(new Error("Document manquant")),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-registrations"] }),
    onError: (e: Error) => setErr(e.message),
  });
  const isPdf = doc?.file_path?.toLowerCase().endsWith(".pdf");

  return (
    <div className="rounded-2xl border-2 border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-bold">{label}</p>
        <span
          className={`text-sm font-bold shrink-0 ${doc?.status === "validated" ? "text-success" : doc?.status === "pending" ? "text-warning" : "text-destructive"}`}
        >
          {doc?.status === "validated"
            ? "🟢 Validé"
            : doc?.status === "pending"
              ? "🟡 À vérifier"
              : doc?.status === "rejected"
                ? "🔴 Refusé"
                : "🔴 Manquant"}
        </span>
      </div>
      {!doc?.file_path ? (
        <p className="text-sm text-destructive mt-2">Non fourni</p>
      ) : (
        <>
          {url.data && !isPdf && (
            <img
              src={url.data.url}
              alt={label}
              className="w-full max-h-64 object-contain rounded-xl bg-muted my-2"
            />
          )}
          {url.data && (
            <a
              href={url.data.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm font-bold text-primary underline"
            >
              {isPdf ? "📄 Ouvrir le PDF" : "🔍 Ouvrir en grand"}
            </a>
          )}
          {doc.reject_reason && (
            <p className="text-sm font-bold text-destructive mt-1">Motif : {doc.reject_reason}</p>
          )}
          {err && <p className="text-sm text-destructive mt-2">{err}</p>}
          <div className="flex flex-col gap-2 mt-3">
            {doc.status !== "validated" && (
              <Button
                disabled={mut.isPending}
                onClick={() => mut.mutate({ status: "validated" })}
                className="py-3 rounded-2xl bg-success text-success-foreground font-bold disabled:opacity-50"
              >
                ✅ Valider ce document
              </Button>
            )}
            <textarea
              placeholder="Motif du refus (10 caractères minimum)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={inputCls + " min-h-16"}
            />
            <Button
              disabled={mut.isPending || reason.trim().length < 10}
              onClick={() => mut.mutate({ status: "rejected", rejectReason: reason })}
              className="py-3 rounded-2xl bg-warning text-warning-foreground font-bold disabled:opacity-50"
            >
              📝 Refuser et demander une correction
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ============ Frais de service : suivi et simulation du débit à J-24 h ============

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  en_attente_debit: "⏳ En attente de débit",
  debit_reussi: "✅ Débit réussi",
  debit_echoue: "⚠️ Débit échoué",
  annulee_echec_paiement: "🚫 Mission annulée (paiement impossible)",
  annulee_avant_debit: "↩️ Mission annulée avant débit (rien n'a été prélevé)",
};

function PaymentsTab({ personId, filter = "all" }: { personId?: string; filter?: string } = {}) {
  const qc = useQueryClient();
  const list = useServerFn(listMissionPayments);
  const payments = useQuery({ queryKey: ["mission-payments"], queryFn: () => list() });
  const update = useServerFn(updatePaymentSimulation);
  const runNow = useServerFn(runDuePaymentsNow);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = () => void qc.invalidateQueries({ queryKey: ["mission-payments"] });

  const mutate = useMutation({
    mutationFn: (input: { id: string; dueNow?: boolean; simulateFailure?: boolean }) =>
      update({ data: input }),
    onSuccess: refresh,
  });

  const run = useMutation({
    mutationFn: () => runNow(),
    onSuccess: (r) => {
      setMessage(
        `Traitement exécuté : ${r.processed} ligne(s), ${r.succeeded} réussie(s), ${r.failed} en relance, ${r.cancelled} mission(s) annulée(s).`,
      );
      refresh();
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const rows = (payments.data ?? []).filter(p => (!personId || p.client_id === personId) && (filter !== "failed" || ["debit_echoue", "annulee_echec_paiement"].includes(p.status)));

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border-2 border-border bg-card p-3 text-sm">
        <p className="font-bold">Débit des frais de service (6,00 €) à 24 h de la mission</p>
        <p className="text-sm text-muted-foreground mt-1">
          Vérification automatique toutes les heures. Paiement simulé : aucun prélèvement réel.
        </p>
        <Button
          onClick={() => run.mutate()}
          disabled={run.isPending}
          className="mt-3 w-full rounded-2xl bg-primary text-primary-foreground font-bold py-3 disabled:opacity-50"
        >
          {run.isPending ? "Traitement…" : "▶️ Lancer le traitement maintenant"}
        </Button>
        {message && <p className="text-sm mt-2">{message}</p>}
      </div>

      {payments.isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
      {payments.isError && <p className="text-destructive">Impossible de charger les frais de service.</p>}
      {!payments.isLoading && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">Aucune réservation avec paiement différé.</p>
      )}

      {rows.map((p) => (
        <div key={p.id} className="rounded-2xl border-2 border-border bg-card p-3 text-sm">
          <p className="font-bold">{PAYMENT_STATUS_LABEL[p.status] ?? p.status}</p>
          <p className="text-sm text-muted-foreground mt-1 break-all">Mission {p.mission_id}</p>
          <p className="text-sm text-muted-foreground">
            Prélèvement prévu :{" "}
            {p.scheduled_charge_at ? new Date(p.scheduled_charge_at).toLocaleString("fr-FR") : "—"}
          </p>
          <p className="text-sm text-muted-foreground">
            Montant : {(p.amount_cents / 100).toFixed(2)} €
            {p.charged_at ? ` · débité le ${new Date(p.charged_at).toLocaleString("fr-FR")}` : ""}
          </p>
          <p className="text-sm text-muted-foreground">
            Tentatives : {p.retry_count ?? 0} / 3
            {p.next_retry_at
              ? ` · prochaine relance le ${new Date(p.next_retry_at).toLocaleString("fr-FR")}`
              : ""}
          </p>
          {p.failure_reason && <p className="text-sm text-destructive mt-1">{p.failure_reason}</p>}
          {p.refund_status && p.refund_status !== "aucun" && (
            <div className="mt-2 rounded-xl border-2 border-border bg-muted/40 p-2 text-sm">
              <p className="font-bold">
                {p.refund_status === "rembourse"
                  ? "💶 Remboursé"
                  : p.refund_status === "echec"
                    ? "❌ Remboursement échoué"
                    : "⏳ Remboursement demandé"}
                {p.refund_amount_cents != null ? ` : ${(p.refund_amount_cents / 100).toFixed(2)} €` : ""}
                {p.refunded_at ? ` · le ${new Date(p.refunded_at).toLocaleString("fr-FR")}` : ""}
              </p>
              {p.refund_reason && <p className="text-muted-foreground mt-1">Motif : {p.refund_reason}</p>}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 mt-3">
            <Button
              onClick={() => mutate.mutate({ id: p.id, dueNow: true })}
              className="rounded-2xl border-2 border-primary text-primary font-bold py-2 text-sm"
            >
              {p.status === "debit_echoue" ? "⏱️ Relancer maintenant" : "⏱️ Rendre exigible maintenant"}
            </Button>
            <Button
              onClick={() => mutate.mutate({ id: p.id, simulateFailure: !p.simulate_failure })}
              className={`rounded-2xl border-2 font-bold py-2 text-sm ${p.simulate_failure ? "border-destructive text-destructive" : "border-border"}`}
            >
              {p.simulate_failure ? "Échec simulé : activé" : "Simuler un échec"}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
