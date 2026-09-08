import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { inputCls } from "@/lib/auth";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Nouveau mot de passe — Solélia" },
      {
        name: "description",
        content: "Choisissez un nouveau mot de passe pour votre compte Solélia.",
      },
      { property: "og:title", content: "Nouveau mot de passe — Solélia" },
      { property: "og:description", content: "Réinitialisation du mot de passe Solélia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const isRecovery = window.location.hash.includes("type=recovery");
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (isRecovery && session)) setReady(true);
    });
    supabase.auth.getSession().then(({ data: s }) => {
      if (s.session) setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return setErr("8 caractères minimum.");
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return setErr("Impossible de modifier le mot de passe. Redemandez un lien.");
    setDone(true);
    setTimeout(() => navigate({ to: "/", replace: true }), 1500);
  };

  return (
    <div className="min-h-screen bg-background flex justify-center">
      <div className="w-full max-w-[440px] min-h-screen flex flex-col bg-background shadow-xl px-5 py-8 gap-5">
        <Link to="/" className="text-sm font-bold text-primary">
          ← Accueil
        </Link>
        <h1 className="text-2xl font-black text-center">Nouveau mot de passe</h1>
        {done ? (
          <p className="text-center text-base">✅ Mot de passe mis à jour. Redirection…</p>
        ) : !ready ? (
          <p className="text-center text-muted-foreground">
            Ouvrez cette page depuis le lien reçu par e-mail.
          </p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <input
              type="password"
              required
              placeholder="Nouveau mot de passe"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              className={inputCls}
            />
            {err && <p className="text-sm text-destructive text-center">{err}</p>}
            <button className="btn-huge bg-primary text-primary-foreground">Enregistrer</button>
          </form>
        )}
      </div>
    </div>
  );
}
