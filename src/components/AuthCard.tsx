import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { inputCls } from "@/lib/auth";

type Mode = "login" | "signup" | "forgot" | "check-email";

export function GoogleButton({
  onSuccess,
  onError,
}: {
  onSuccess: () => void;
  onError: (m: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const result = await lovable.auth.signInWithOAuth("google", {
          redirect_uri: window.location.origin,
        });
        setBusy(false);
        if (result.error) return onError("Connexion Google impossible. Réessayez.");
        if (result.redirected) return;
        onSuccess();
      }}
      className="w-full py-4 rounded-2xl border-2 border-border bg-card font-bold text-base flex items-center justify-center gap-3 disabled:opacity-50"
    >
      <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
        <path
          fill="#EA4335"
          d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.8 6C12.3 13.4 17.7 9.5 24 9.5z"
        />
        <path
          fill="#4285F4"
          d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8C43.8 38 46.5 31.8 46.5 24.5z"
        />
        <path
          fill="#FBBC05"
          d="M10.4 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.8-6A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.8-6z"
        />
        <path
          fill="#34A853"
          d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.7-3.9-13.6-9.6l-7.8 6C6.5 42.6 14.6 48 24 48z"
        />
      </svg>
      {busy ? "Connexion…" : "Continuer avec Google"}
    </button>
  );
}

/** Connexion / inscription pour les particuliers et les compagnons. */
export function AuthCard({
  onSuccess,
  title = "Connexion",
  subtitle,
  initialMode = "login",
}: {
  onSuccess: () => void;
  title?: string;
  subtitle?: string;
  initialMode?: "login" | "signup";
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      setErr(
        error.message.toLowerCase().includes("confirm")
          ? "Votre adresse e-mail n'est pas encore vérifiée. Consultez votre boîte mail."
          : "E-mail ou mot de passe incorrect.",
      );
      return;
    }
    onSuccess();
  };

  const signup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setErr("Le mot de passe doit contenir au moins 8 caractères.");
    setBusy(true);
    setErr(null);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          address_line: address.trim(),
          postal_code: postalCode.trim(),
          city: city.trim(),
          phone: phone.trim(),
        },
      },
    });
    setBusy(false);
    if (error) {
      setErr(
        error.message.toLowerCase().includes("already")
          ? "Un compte existe déjà avec cet e-mail. Connectez-vous."
          : error.message.toLowerCase().includes("rate")
            ? "Trop de tentatives, réessayez dans quelques minutes."
            : "Inscription impossible : " + error.message,
      );
      return;
    }
    if (data.session) onSuccess();
    else setMode("check-email");
  };

  const forgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) return setErr("Envoi impossible. Vérifiez l'adresse.");
    setMode("check-email");
  };

  if (mode === "check-email") {
    return (
      <div className="flex flex-col items-center text-center gap-4 px-2 py-6">
        <div className="text-6xl">📬</div>
        <h2 className="text-2xl font-black">Vérifiez votre boîte mail</h2>
        <p className="text-base text-muted-foreground">
          Nous avons envoyé un lien de vérification à <b className="text-foreground">{email}</b>.
          Cliquez dessus pour valider votre adresse, puis revenez vous connecter.
        </p>
        <button
          onClick={() => setMode("login")}
          className="text-sm font-bold text-primary underline"
        >
          Retour à la connexion
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center">
        <h2 className="text-2xl font-black">
          {mode === "signup"
            ? "Créer mon compte"
            : mode === "forgot"
              ? "Mot de passe oublié"
              : title}
        </h2>
        {subtitle && mode === "login" && (
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        )}
      </div>

      {mode !== "forgot" && (
        <>
          <GoogleButton onSuccess={onSuccess} onError={setErr} />
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex-1 h-px bg-border" />
            ou par e-mail
            <span className="flex-1 h-px bg-border" />
          </div>
        </>
      )}

      <form
        onSubmit={mode === "login" ? login : mode === "signup" ? signup : forgot}
        className="flex flex-col gap-3"
      >
        {mode === "signup" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <input
                required
                placeholder="Prénom"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={inputCls}
              />
              <input
                required
                placeholder="Nom"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={inputCls}
              />
            </div>
            <input
              required
              placeholder="Adresse (n° et rue)"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className={inputCls}
            />
            <div className="grid grid-cols-[1fr_2fr] gap-3">
              <input
                required
                placeholder="Code postal"
                inputMode="numeric"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                className={inputCls}
              />
              <input
                required
                placeholder="Ville"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className={inputCls}
              />
            </div>
            <input
              required
              type="tel"
              placeholder="Téléphone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputCls}
            />
          </>
        )}
        <input
          required
          type="email"
          autoComplete="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputCls}
        />
        {mode !== "forgot" && (
          <input
            required
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            placeholder={mode === "signup" ? "Mot de passe (8 caractères min.)" : "Mot de passe"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
          />
        )}
        {err && <p className="text-sm text-destructive text-center">{err}</p>}
        <button
          type="submit"
          disabled={busy}
          className="btn-huge bg-primary text-primary-foreground disabled:opacity-50"
        >
          {busy
            ? "Un instant…"
            : mode === "login"
              ? "Se connecter"
              : mode === "signup"
                ? "Créer mon compte"
                : "Envoyer le lien"}
        </button>
      </form>

      <div className="flex flex-col items-center gap-2 text-sm">
        {mode === "login" && (
          <>
            <button
              onClick={() => {
                setMode("signup");
                setErr(null);
              }}
              className="font-bold text-primary underline"
            >
              Pas encore de compte ? Créer un compte
            </button>
            <button
              onClick={() => {
                setMode("forgot");
                setErr(null);
              }}
              className="text-muted-foreground underline"
            >
              Mot de passe oublié
            </button>
          </>
        )}
        {mode !== "login" && (
          <button
            onClick={() => {
              setMode("login");
              setErr(null);
            }}
            className="font-bold text-primary underline"
          >
            J'ai déjà un compte — me connecter
          </button>
        )}
      </div>
    </div>
  );
}
