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
      <div className="w-full max-w-[440px] min-h-screen flex flex-col bg-background shadow-xl">
        <header className="px-5 pt-6 pb-4 border-b border-border flex items-center gap-3">
          <ShieldCheck className="h-7 w-7 text-primary" />
          <div className="flex-1">
            <h1 className="text-lg font-black leading-tight">Espace Mandataire</h1>
            {email && <p className="text-xs text-muted-foreground">{email}</p>}
          </div>
          {email && (
            <button
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
            </button>
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
      <button
        disabled={page === 0}
        onClick={() => onPage(page - 1)}
        className="px-4 py-2 rounded-2xl border-2 border-border font-bold disabled:opacity-40"
      >
        ←
      </button>
      <span className="text-sm text-muted-foreground">
        Page {page + 1} / {pages}
      </span>
      <button
        disabled={page >= pages - 1}
        onClick={() => onPage(page + 1)}
        className="px-4 py-2 rounded-2xl border-2 border-border font-bold disabled:opacity-40"
      >
        →
      </button>
    </div>
  );
}

function Dashboard() {
  const [tab, setTab] = useState<"companions" | "clients" | "payments">("companions");
  const list = useServerFn(listApplications);
  const apps = useQuery({ queryKey: ["applications"], queryFn: () => list() });
  const listClients = useServerFn(listClientRegistrations);
  const clients = useQuery({ queryKey: ["client-registrations"], queryFn: () => listClients() });

  const norm = (s: string) => (s === "rejected" ? "changes_requested" : s);
  const companionTodo = (apps.data ?? []).filter((a) =>
    ["pending", "changes_requested"].includes(norm(a.status)),
  ).length;
  const clientTodo = (clients.data ?? []).filter((c) => clientStatus(c) !== "complete").length;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["companions", "Candidatures Compagnon", companionTodo],
            ["clients", "Inscriptions Particulier", clientTodo],
            ["payments", "Frais de service", 0],
          ] as const
        ).map(([key, label, badge]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`relative rounded-2xl border-2 p-3 text-sm font-bold ${tab === key ? "border-primary bg-secondary" : "border-border bg-card"}`}
          >
            {label}
            {badge > 0 && (
              <span className="absolute -top-2 -right-2 min-w-6 h-6 px-1 rounded-full bg-destructive text-destructive-foreground text-xs font-black flex items-center justify-center">
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>
      {tab === "companions" ? (
        <CompanionsTab apps={apps} />
      ) : tab === "clients" ? (
        <ClientsTab clients={clients} />
      ) : (
        <PaymentsTab />
      )}
    </div>
  );
}

function CompanionsTab({ apps }: { apps: UseQueryResult<App[]> }) {
  const [filter, setFilter] = useState<Filter>("pending");
  const [selected, setSelected] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  if (apps.isLoading)
    return <p className="text-center text-muted-foreground py-10">Chargement des candidatures…</p>;
  if (apps.isError)
    return (
      <p className="text-center text-destructive py-10">Impossible de charger les candidatures.</p>
    );

  const all = apps.data ?? [];
  const current = all.find((a) => a.id === selected);
  if (current) return <Detail app={current} onBack={() => setSelected(null)} />;

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
          <button
            key={s}
            onClick={() => {
              setFilter(s);
              setPage(0);
            }}
            className={`rounded-2xl border-2 p-3 ${filter === s ? "border-primary bg-secondary" : "border-border bg-card"}`}
          >
            <div className="text-2xl font-black">{count(s)}</div>
            <div className="text-xs">{STATUS_LABEL[s]}</div>
          </button>
        ))}
      </div>
      <button
        onClick={() => {
          setFilter("all");
          setPage(0);
        }}
        className={`text-sm underline ${filter === "all" ? "font-bold" : "text-muted-foreground"}`}
      >
        Voir toutes les candidatures ({all.length})
      </button>
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
          <button onClick={() => setSelected(a.id)} className="text-left flex gap-3 items-center">
            <DocThumb path={a.selfie_path} size={56} rounded />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-base truncate">
                {a.first_name} {a.last_name}
              </div>
              <div className="text-sm text-muted-foreground truncate">
                {a.situation ?? "—"} · {a.address || a.city}
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(a.created_at).toLocaleDateString("fr-FR")}
              </div>
            </div>
            <span className="text-xs font-bold whitespace-nowrap">{STATUS_LABEL[a.status]}</span>
          </button>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold">
            {(
              [
                ["Identité recto", a.id_card_path],
                ["Identité verso", a.id_card_back_path],
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
    queryFn: () => fetchUrl({ data: { path: path!, bucket } }),
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

  return (
    <div className="flex flex-col gap-4">
      <button onClick={onBack} className="text-sm font-bold text-primary text-left">
        ← Retour à la liste
      </button>
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
        </div>
      </div>

      <div className="rounded-2xl border-2 border-border bg-card p-4 text-sm space-y-1">
        <p>📧 {app.email}</p>
        <p>📞 {app.phone}</p>
        <p>📍 {app.address || app.city}</p>
        <p>
          🆔 NIR : <span className="font-mono font-bold">{app.nir || "Non renseigné"}</span>
        </p>
        <p>
          🏠 Logement :{" "}
          {app.housing_status === "hosted" ? "Hébergé(e) par un tiers" : "Titulaire du logement"}
        </p>
        <p>🗓️ Candidature du {new Date(app.created_at).toLocaleString("fr-FR")}</p>
        {app.motivation && (
          <p className="pt-2 text-muted-foreground italic">« {app.motivation} »</p>
        )}
      </div>

      <h3 className="font-black">Pièces justificatives</h3>
      <DocCard label="🪪 Pièce d'identité — recto" path={app.id_card_path} />
      <DocCard label="🪪 Pièce d'identité — verso" path={app.id_card_back_path} />
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

      {app.reject_reason && (
        <p className="text-sm rounded-2xl bg-secondary p-3">
          Note envoyée au compagnon : {app.reject_reason}
        </p>
      )}

      {err && <p className="text-sm text-destructive text-center">{err}</p>}

      {app.status !== "approved" && (
        <button
          disabled={mut.isPending}
          onClick={() => mut.mutate({ status: "approved" })}
          className="btn-huge bg-success text-success-foreground disabled:opacity-50"
        >
          ✅ Valider la candidature
        </button>
      )}
      <div className="flex flex-col gap-2">
        <textarea
          placeholder="Motif des corrections demandées (10 caractères minimum)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className={inputCls + " min-h-20"}
        />
        <button
          disabled={mut.isPending || reason.trim().length < 10}
          onClick={() => mut.mutate({ status: "changes_requested", rejectReason: reason })}
          className="btn-huge bg-warning text-warning-foreground disabled:opacity-50"
        >
          📝 Demander des corrections
        </button>
      </div>
      <a
        href={mailtoLink(app, reason)}
        className="py-4 rounded-2xl border-2 border-primary text-primary font-bold text-center"
      >
        ✉️ Envoyer l'email
      </a>
      {app.status !== "pending" && (
        <button
          disabled={mut.isPending}
          onClick={() => mut.mutate({ status: "pending" })}
          className="text-sm underline text-muted-foreground"
        >
          Remettre en attente
        </button>
      )}
    </div>
  );
}

/* ---------- Onglet « Inscriptions Particulier » ---------- */

type ClientRow = Awaited<ReturnType<typeof listClientRegistrations>>[number];
type ClientDoc = ClientRow["documents"][number];
type ClientStatus = "incomplete" | "to_check" | "complete";

const CLIENT_DOC_TYPES = [
  { type: "rib", label: "RIB" },
  { type: "identity_front", label: "Pièce d'identité — recto" },
  { type: "identity_back", label: "Pièce d'identité — verso" },
  { type: "proof_of_address", label: "Justificatif de domicile" },
] as const;

const CLIENT_STATUS_LABEL: Record<ClientStatus, string> = {
  incomplete: "🔴 Dossier incomplet",
  to_check: "🟡 Documents à vérifier",
  complete: "🟢 Dossier complet",
};

function clientStatus(c: ClientRow): ClientStatus {
  const byType = new Map(c.documents.map((d) => [d.doc_type, d]));
  const present = CLIENT_DOC_TYPES.filter((t) => byType.get(t.type)?.file_path);
  if (present.length < CLIENT_DOC_TYPES.length) return "incomplete";
  return present.every((t) => byType.get(t.type)?.status === "validated") ? "complete" : "to_check";
}

function ClientsTab({ clients }: { clients: UseQueryResult<ClientRow[]> }) {
  const [filter, setFilter] = useState<ClientStatus | "all">("all");
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
      <p className="text-xs text-muted-foreground">
        Suivi administratif uniquement : un compte Particulier est actif dès son inscription, quel
        que soit l'état de ses documents.
      </p>
      <div className="grid grid-cols-3 gap-2 text-center">
        {(["incomplete", "to_check", "complete"] as const).map((s) => (
          <button
            key={s}
            onClick={() => {
              setFilter(s);
              setPage(0);
            }}
            className={`rounded-2xl border-2 p-3 ${filter === s ? "border-primary bg-secondary" : "border-border bg-card"}`}
          >
            <div className="text-2xl font-black">{count(s)}</div>
            <div className="text-xs">{CLIENT_STATUS_LABEL[s]}</div>
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => {
            setFilter("all");
            setPage(0);
          }}
          className={`text-sm underline ${filter === "all" ? "font-bold" : "text-muted-foreground"}`}
        >
          Toutes les inscriptions ({all.length})
        </button>
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
        <ClientCard key={c.id} client={c} />
      ))}
      <Pager page={page} total={filtered.length} onPage={setPage} />
    </div>
  );
}

function ClientCard({ client }: { client: ClientRow }) {
  const [open, setOpen] = useState(false);
  const byType = new Map(client.documents.map((d) => [d.doc_type, d]));
  const status = clientStatus(client);
  return (
    <div className="rounded-2xl border-2 border-border bg-card p-4 flex flex-col gap-3">
      <button onClick={() => setOpen((o) => !o)} className="text-left flex gap-3 items-center">
        <div className="flex-1 min-w-0">
          <div className="font-bold text-base truncate">
            {client.first_name} {client.last_name}
          </div>
          <div className="text-sm text-muted-foreground truncate">{client.email}</div>
          <div className="text-xs text-muted-foreground">
            Inscrit le {new Date(client.created_at).toLocaleDateString("fr-FR")}
          </div>
        </div>
        <span className="text-xs font-bold whitespace-nowrap">{CLIENT_STATUS_LABEL[status]}</span>
      </button>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold">
        {CLIENT_DOC_TYPES.map((t) => {
          const d = byType.get(t.type);
          const ok = d?.status === "validated";
          return (
            <span key={t.type} className={ok ? "text-success" : "text-destructive"}>
              {ok ? "✓" : "✗"} {t.label}
            </span>
          );
        })}
      </div>
      <button onClick={() => setOpen((o) => !o)} className="text-sm font-bold text-primary text-left">
        {open ? "Masquer les documents" : "Voir et vérifier les documents"}
      </button>
      {open && (
        <div className="flex flex-col gap-3">
          {CLIENT_DOC_TYPES.map((t) => (
            <ClientDocCard key={t.type} label={t.label} doc={byType.get(t.type) ?? null} />
          ))}
        </div>
      )}
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
      review({ data: { id: doc!.id, ...v } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-registrations"] }),
    onError: (e: Error) => setErr(e.message),
  });
  const isPdf = doc?.file_path?.toLowerCase().endsWith(".pdf");

  return (
    <div className="rounded-2xl border-2 border-border p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-bold">{label}</p>
        <span
          className={`text-xs font-bold shrink-0 ${doc?.status === "validated" ? "text-success" : doc?.status === "pending" ? "text-warning" : "text-destructive"}`}
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
            <p className="text-xs font-bold text-destructive mt-1">Motif : {doc.reject_reason}</p>
          )}
          {err && <p className="text-sm text-destructive mt-2">{err}</p>}
          <div className="flex flex-col gap-2 mt-3">
            {doc.status !== "validated" && (
              <button
                disabled={mut.isPending}
                onClick={() => mut.mutate({ status: "validated" })}
                className="py-3 rounded-2xl bg-success text-success-foreground font-bold disabled:opacity-50"
              >
                ✅ Valider ce document
              </button>
            )}
            <textarea
              placeholder="Motif du refus (10 caractères minimum)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={inputCls + " min-h-16"}
            />
            <button
              disabled={mut.isPending || reason.trim().length < 10}
              onClick={() => mut.mutate({ status: "rejected", rejectReason: reason })}
              className="py-3 rounded-2xl bg-warning text-warning-foreground font-bold disabled:opacity-50"
            >
              📝 Refuser et demander une correction
            </button>
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

function PaymentsTab() {
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

  const rows = payments.data ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border-2 border-border bg-card p-3 text-sm">
        <p className="font-bold">Débit des frais de service (6,00 €) à 24 h de la mission</p>
        <p className="text-xs text-muted-foreground mt-1">
          Vérification automatique toutes les heures. Paiement simulé : aucun prélèvement réel.
        </p>
        <button
          onClick={() => run.mutate()}
          disabled={run.isPending}
          className="mt-3 w-full rounded-2xl bg-primary text-primary-foreground font-bold py-3 disabled:opacity-50"
        >
          {run.isPending ? "Traitement…" : "▶️ Lancer le traitement maintenant"}
        </button>
        {message && <p className="text-xs mt-2">{message}</p>}
      </div>

      {payments.isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
      {!payments.isLoading && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">Aucune réservation avec paiement différé.</p>
      )}

      {rows.map((p) => (
        <div key={p.id} className="rounded-2xl border-2 border-border bg-card p-3 text-sm">
          <p className="font-bold">{PAYMENT_STATUS_LABEL[p.status] ?? p.status}</p>
          <p className="text-xs text-muted-foreground mt-1 break-all">Mission {p.mission_id}</p>
          <p className="text-xs text-muted-foreground">
            Prélèvement prévu :{" "}
            {p.scheduled_charge_at ? new Date(p.scheduled_charge_at).toLocaleString("fr-FR") : "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            Montant : {(p.amount_cents / 100).toFixed(2)} €
            {p.charged_at ? ` · débité le ${new Date(p.charged_at).toLocaleString("fr-FR")}` : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            Tentatives : {p.retry_count ?? 0} / 3
            {p.next_retry_at
              ? ` · prochaine relance le ${new Date(p.next_retry_at).toLocaleString("fr-FR")}`
              : ""}
          </p>
          {p.failure_reason && <p className="text-xs text-destructive mt-1">{p.failure_reason}</p>}
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button
              onClick={() => mutate.mutate({ id: p.id, dueNow: true })}
              className="rounded-2xl border-2 border-primary text-primary font-bold py-2 text-xs"
            >
              {p.status === "debit_echoue" ? "⏱️ Relancer maintenant" : "⏱️ Rendre exigible maintenant"}
            </button>
            <button
              onClick={() => mutate.mutate({ id: p.id, simulateFailure: !p.simulate_failure })}
              className={`rounded-2xl border-2 font-bold py-2 text-xs ${p.simulate_failure ? "border-destructive text-destructive" : "border-border"}`}
            >
              {p.simulate_failure ? "Échec simulé : activé" : "Simuler un échec"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
