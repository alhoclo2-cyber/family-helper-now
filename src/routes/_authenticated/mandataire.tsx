import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ShieldCheck, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAccess, useSession } from "@/lib/auth";
import { getDocumentUrl, listApplications, reviewApplication } from "@/lib/account.functions";
import { inputCls } from "@/lib/auth";

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

function Dashboard() {
  const list = useServerFn(listApplications);
  const apps = useQuery({ queryKey: ["applications"], queryFn: () => list() });
  const [filter, setFilter] = useState<Filter>("pending");
  const [selected, setSelected] = useState<string | null>(null);

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
  const shown = filter === "all" ? all : all.filter((a) => norm(a.status) === filter);
  const count = (s: string) => all.filter((a) => norm(a.status) === s).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        {(["pending", "changes_requested", "approved"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-2xl border-2 p-3 ${filter === s ? "border-primary bg-secondary" : "border-border bg-card"}`}
          >
            <div className="text-2xl font-black">{count(s)}</div>
            <div className="text-xs">{STATUS_LABEL[s]}</div>
          </button>
        ))}
      </div>
      <button
        onClick={() => setFilter("all")}
        className={`text-sm underline ${filter === "all" ? "font-bold" : "text-muted-foreground"}`}
      >
        Voir toutes les candidatures ({all.length})
      </button>
      {shown.length === 0 && (
        <p className="text-center text-muted-foreground py-8">
          Aucune candidature dans cette catégorie.
        </p>
      )}
      {shown.map((a) => (
        <button
          key={a.id}
          onClick={() => setSelected(a.id)}
          className="rounded-2xl border-2 border-border bg-card p-4 text-left flex gap-3 items-center"
        >
          <DocThumb path={a.selfie_path} size={56} rounded />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-base truncate">
              {a.first_name} {a.last_name}
            </div>
            <div className="text-sm text-muted-foreground truncate">
              {a.situation ?? "—"} · {a.city}
            </div>
            <div className="text-xs text-muted-foreground">
              {new Date(a.created_at).toLocaleDateString("fr-FR")}
            </div>
          </div>
          <span className="text-xs font-bold whitespace-nowrap">{STATUS_LABEL[a.status]}</span>
        </button>
      ))}
    </div>
  );
}

function useSignedUrl(path: string | null) {
  const fetchUrl = useServerFn(getDocumentUrl);
  return useQuery({
    queryKey: ["doc-url", path],
    queryFn: () => fetchUrl({ data: { path: path! } }),
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
            {app.school ? ` · ${app.school}` : ""}
          </p>
          <p className="text-sm font-bold mt-1">{STATUS_LABEL[app.status]}</p>
        </div>
      </div>

      <div className="rounded-2xl border-2 border-border bg-card p-4 text-sm space-y-1">
        <p>📧 {app.email}</p>
        <p>📞 {app.phone}</p>
        <p>📍 {app.city}</p>
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
      <DocCard label="🪪 Pièce d'identité" path={app.id_card_path} />
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
