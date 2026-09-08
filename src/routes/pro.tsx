import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { bootstrapAccount } from "@/lib/account.functions";
import { inputCls } from "@/lib/auth";
import { GoogleButton } from "@/components/AuthCard";

export const Route = createFileRoute("/pro")({
  head: () => ({
    meta: [
      { title: "Espace Pro — Solélia" },
      {
        name: "description",
        content:
          "Accès réservé au mandataire Solélia : connexion sécurisée avec double authentification.",
      },
      { property: "og:title", content: "Espace Pro — Solélia" },
      { property: "og:description", content: "Connexion sécurisée du mandataire Solélia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProPage,
});

type Step = "credentials" | "otp";

function ProPage() {
  const navigate = useNavigate();
  const bootstrap = useServerFn(bootstrapAccount);
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /** Vérifie le rôle ; renvoie l'accès ou déconnecte si le compte n'est pas Mandataire. */
  const checkAccess = async () => {
    const access = await bootstrap();
    if (!access.isMandataire) {
      await supabase.auth.signOut();
      setErr("Cet espace est réservé au mandataire Solélia.");
      return null;
    }
    return access;
  };

  const submitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setBusy(false);
      setErr("Identifiants incorrects.");
      return;
    }
    const access = await checkAccess();
    if (!access) return setBusy(false);
    // Étape 2 : code à usage unique envoyé par e-mail
    await supabase.auth.signOut();
    const { error: otpErr } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    });
    setBusy(false);
    if (otpErr)
      return setErr("Impossible d'envoyer le code de vérification. Réessayez dans une minute.");
    setStep("otp");
  };

  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    if (error) {
      setBusy(false);
      setErr("Code invalide ou expiré.");
      return;
    }
    const access = await checkAccess();
    setBusy(false);
    if (access) navigate({ to: "/mandataire", replace: true });
  };

  const afterGoogle = async () => {
    setBusy(true);
    const access = await checkAccess();
    setBusy(false);
    if (access) navigate({ to: "/mandataire", replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex justify-center">
      <div className="w-full max-w-[440px] min-h-screen flex flex-col bg-background shadow-xl px-5 py-8 gap-6">
        <Link to="/" className="text-sm font-bold text-primary">
          ← Retour à l'accueil
        </Link>
        <div className="flex flex-col items-center text-center gap-2">
          <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-black">Espace Pro</h1>
          <p className="text-sm text-muted-foreground">Accès réservé au mandataire Solélia.</p>
        </div>

        {step === "credentials" ? (
          <>
            <GoogleButton onSuccess={afterGoogle} onError={setErr} />
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex-1 h-px bg-border" />
              ou par e-mail (double authentification)
              <span className="flex-1 h-px bg-border" />
            </div>
            <form onSubmit={submitCredentials} className="flex flex-col gap-3">
              <input
                required
                type="email"
                placeholder="E-mail professionnel"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
              />
              <input
                required
                type="password"
                placeholder="Mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
              />
              {err && <p className="text-sm text-destructive text-center">{err}</p>}
              <button
                disabled={busy}
                className="btn-huge bg-primary text-primary-foreground disabled:opacity-50"
              >
                {busy ? "Vérification…" : "Continuer"}
              </button>
            </form>
            <p className="text-xs text-muted-foreground text-center">
              Première connexion ? Créez d'abord le compte professionnel via{" "}
              <Link to="/auth" className="underline font-bold">
                la page de connexion
              </Link>{" "}
              puis revenez ici.
            </p>
          </>
        ) : (
          <form onSubmit={submitOtp} className="flex flex-col gap-3">
            <p className="text-center text-base">
              Un code à 6 chiffres a été envoyé à <b>{email}</b>.
            </p>
            <input
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Code reçu"
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={inputCls + " text-center text-2xl tracking-[0.4em] font-black"}
            />
            {err && <p className="text-sm text-destructive text-center">{err}</p>}
            <button
              disabled={busy}
              className="btn-huge bg-primary text-primary-foreground disabled:opacity-50"
            >
              {busy ? "Vérification…" : "Valider le code"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("credentials");
                setCode("");
                setErr(null);
              }}
              className="text-sm underline text-muted-foreground"
            >
              Recommencer
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
