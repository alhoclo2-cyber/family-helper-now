import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cesuStatusKey, contractIdentityKey } from "@/lib/contractIdentity";
import { clientDossierKey } from "@/lib/clientDossier";

/* ------------------------------------------------------------------
   Champ « J'ai obtenu mon numéro CESU » partagé : modale du seuil et
   étape 0 du questionnaire 2. Sans numéro CESU, aucun contrat.
------------------------------------------------------------------- */

export function CesuNumberField({ userId, onSaved }: { userId: string; onSaved?: () => void }) {
  const qc = useQueryClient();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const cesu = value.trim();
    if (!cesu) return setError("Champ obligatoire");
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ has_cesu_number: true, cesu_number: cesu })
      .eq("id", userId);
    setSaving(false);
    if (updateError) return setError("Impossible d'enregistrer votre numéro, réessayez.");
    await Promise.all([
      qc.invalidateQueries({ queryKey: cesuStatusKey(userId) }),
      qc.invalidateQueries({ queryKey: clientDossierKey(userId) }),
      qc.invalidateQueries({ queryKey: contractIdentityKey(userId) }),
    ]);
    onSaved?.();
  };

  return (
    <div className="flex flex-col gap-2 mt-3">
      <label htmlFor="cesu-number" className="text-sm font-bold">J'ai obtenu mon numéro CESU</label>
      <input
        id="cesu-number"
        autoComplete="off"
        value={value}
        onChange={(e) => { setValue(e.target.value); setError(null); }}
        className={`w-full p-3 rounded-2xl border-2 bg-card ${error ? "border-destructive" : "border-border"}`}
      />
      {error && <p className="text-xs font-semibold text-destructive">{error}</p>}
      <button
        type="button"
        onClick={save}
        disabled={saving || !value.trim()}
        className="w-full py-3 rounded-2xl border-2 border-primary text-primary font-bold disabled:opacity-50"
      >
        Enregistrer mon numéro
      </button>
    </div>
  );
}
