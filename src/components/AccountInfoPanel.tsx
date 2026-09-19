import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";

const inputCls =
  "w-full px-4 py-3 rounded-2xl border-2 border-border bg-background text-base focus:border-primary outline-none";

type ProfileForm = {
  first_name: string;
  last_name: string;
  address_line: string;
  postal_code: string;
  city: string;
  phone: string;
};

const EMPTY: ProfileForm = {
  first_name: "",
  last_name: "",
  address_line: "",
  postal_code: "",
  city: "",
  phone: "",
};

/**
 * Panneau dépliable d'édition des informations personnelles (profil, email, mot de passe).
 * Utilisé dans l'espace Client et l'espace Compagnon.
 */
export function AccountInfoPanel() {
  const { session } = useSession();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ProfileForm>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [emailMsg, setEmailMsg] = useState<string | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);

  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => {
    if (!session) return;
    setEmail(session.user.email ?? "");
    supabase
      .from("profiles")
      .select("first_name,last_name,address_line,postal_code,city,phone")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setForm({ ...EMPTY, ...data });
      });
  }, [session?.user.id]);

  if (!session) {
    return (
      <section className="rounded-2xl border-2 border-border bg-card p-4">
        <p className="text-sm font-black">👤 Mes informations personnelles</p>
        <p className="text-xs text-muted-foreground mt-1">
          Connectez-vous pour modifier vos informations.
        </p>
      </section>
    );
  }

  const set = (k: keyof ProfileForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const saveProfile = async () => {
    setLoading(true);
    setError(null);
    const { error: err } = await supabase
      .from("profiles")
      .update({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        address_line: form.address_line.trim(),
        postal_code: form.postal_code.trim(),
        city: form.city.trim(),
        phone: form.phone.trim(),
      })
      .eq("id", session.user.id);
    setLoading(false);
    if (err) {
      setError("Une erreur est survenue. Réessayez.");
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const changeEmail = async () => {
    const next = email.trim();
    if (!next || next === session.user.email) return;
    setEmailBusy(true);
    setEmailMsg(null);
    const { error: err } = await supabase.auth.updateUser({ email: next });
    setEmailBusy(false);
    if (err) {
      setEmailMsg(
        err.message.toLowerCase().includes("rate") ||
          err.message.toLowerCase().includes("after")
          ? "⏳ Une demande vient d'être envoyée. Patientez environ 1 minute avant de réessayer, et vérifiez votre boîte mail."
          : "Impossible de modifier l'adresse email. Réessayez.",
      );
      return;
    }
    setEmailMsg(
      "📧 Vérifiez votre boîte mail : un lien de confirmation a été envoyé à votre nouvelle adresse (et parfois aussi à l'ancienne).",
    );
  };

  const changePassword = async () => {
    setPwMsg(null);
    if (pw1.length < 8) {
      setPwMsg("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (pw1 !== pw2) {
      setPwMsg("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setPwBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password: pw1 });
    setPwBusy(false);
    if (err) {
      setPwMsg("Impossible de modifier le mot de passe. Réessayez.");
      return;
    }
    setPw1("");
    setPw2("");
    setPwMsg("✅ Mot de passe mis à jour");
  };

  return (
    <section className="rounded-2xl border-2 border-border bg-card p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <span>
          <span className="text-sm font-black">👤 Mes informations personnelles</span>
          <span className="block text-xs text-muted-foreground mt-0.5">
            {form.first_name || form.last_name
              ? `${form.first_name} ${form.last_name}`.trim()
              : "Nom, adresse, téléphone, email, mot de passe"}
          </span>
        </span>
        <span className="text-sm font-bold text-primary shrink-0">{open ? "Fermer" : "Modifier"}</span>
      </button>

      {open && (
        <div className="mt-4 flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Prénom" value={form.first_name} onChange={set("first_name")} className={inputCls} />
              <input placeholder="Nom" value={form.last_name} onChange={set("last_name")} className={inputCls} />
            </div>
            <input placeholder="Adresse" value={form.address_line} onChange={set("address_line")} className={inputCls} />
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Code postal" value={form.postal_code} onChange={set("postal_code")} className={inputCls} />
              <input placeholder="Ville" value={form.city} onChange={set("city")} className={inputCls} />
            </div>
            <input placeholder="Téléphone" type="tel" value={form.phone} onChange={set("phone")} className={inputCls} />
            <button
              type="button"
              onClick={saveProfile}
              disabled={loading}
              className="btn-huge bg-primary text-primary-foreground disabled:opacity-50"
            >
              {loading ? "Enregistrement…" : "Enregistrer mes informations"}
            </button>
            {saved && <p className="text-sm font-bold text-success">✅ Informations mises à jour</p>}
            {error && <p className="text-sm font-bold text-destructive">{error}</p>}
          </div>

          <div className="border-t-2 border-border pt-4 flex flex-col gap-3">
            <p className="text-sm font-bold">Adresse email</p>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
            <button
              type="button"
              onClick={changeEmail}
              disabled={emailBusy || !email.trim() || email.trim() === session.user.email}
              className="py-3 rounded-2xl border-2 border-primary text-primary font-bold disabled:opacity-50"
            >
              {emailBusy ? "Envoi…" : "Modifier mon email"}
            </button>
            {emailMsg && <p className="text-sm font-semibold text-muted-foreground">{emailMsg}</p>}
          </div>

          <div className="border-t-2 border-border pt-4 flex flex-col gap-3">
            <p className="text-sm font-bold">Changer mon mot de passe</p>
            <input
              type="password"
              placeholder="Nouveau mot de passe (8 caractères min.)"
              value={pw1}
              onChange={(e) => setPw1(e.target.value)}
              className={inputCls}
            />
            <input
              type="password"
              placeholder="Confirmer le nouveau mot de passe"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              className={inputCls}
            />
            <button
              type="button"
              onClick={changePassword}
              disabled={pwBusy || !pw1 || !pw2}
              className="py-3 rounded-2xl border-2 border-primary text-primary font-bold disabled:opacity-50"
            >
              {pwBusy ? "Mise à jour…" : "Mettre à jour le mot de passe"}
            </button>
            {pwMsg && (
              <p
                className={`text-sm font-bold ${pwMsg.startsWith("✅") ? "text-success" : "text-destructive"}`}
              >
                {pwMsg}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default AccountInfoPanel;
