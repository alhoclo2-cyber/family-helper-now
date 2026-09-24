import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";

type DocType = "rib" | "identity" | "identity_front" | "identity_back" | "proof_of_address";
type DocStatus = "missing" | "pending" | "validated" | "rejected";

type DocRow = {
  doc_type: DocType;
  file_path: string | null;
  status: DocStatus;
  reject_reason: string | null;
};

const MAX_SIZE = 5 * 1024 * 1024;

const DOCS: { type: DocType; label: string; hint: string }[] = [
  {
    type: "rib",
    label: "RIB",
    hint: "Nécessaire à l'activation de l'API URSSAF/CESU+ pour le prélèvement automatique du reste à charge.",
  },
  { type: "identity_front", label: "Pièce d'identité — recto", hint: "Nécessaire à la déclaration URSSAF." },
  { type: "identity_back", label: "Pièce d'identité — verso", hint: "Nécessaire à la déclaration URSSAF." },
  {
    type: "proof_of_address",
    label: "Justificatif de domicile",
    hint: "Justificatif de l'adresse d'intervention.",
  },
];

const STATUS_UI: Record<DocStatus, { text: string; cls: string }> = {
  missing: { text: "🔴 Manquant", cls: "text-destructive" },
  pending: { text: "🟡 En attente de validation", cls: "text-warning" },
  validated: { text: "🟢 Validé", cls: "text-success" },
  rejected: { text: "🔴 Refusé", cls: "text-destructive" },
};

/** Espace de dépôt des documents administratifs du Client. */
export function ClientDocumentsPanel() {
  const { session } = useSession();
  const userId = session?.user.id;
  const [rows, setRows] = useState<Record<string, DocRow>>({});
  const [busy, setBusy] = useState<DocType | null>(null);
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("client_documents")
      .select("doc_type,file_path,status,reject_reason")
      .eq("user_id", userId)
      .then(({ data }) => {
        const next: Record<string, DocRow> = {};
        (data ?? []).forEach((r) => {
          next[r.doc_type] = r as DocRow;
        });
        setRows(next);
      });
  }, [userId]);

  if (!userId) return null;

  const upload = async (type: DocType, file: File) => {
    setErrors((e) => ({ ...e, [type]: null }));
    if (file.size > MAX_SIZE) {
      setErrors((e) => ({ ...e, [type]: "Fichier trop volumineux : 5 Mo maximum." }));
      return;
    }
    setBusy(type);
    const ext = (file.name.split(".").pop() || "dat").toLowerCase();
    const path = `${userId}/${type}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("client-docs")
      .upload(path, file, { contentType: file.type });
    if (upErr) {
      setBusy(null);
      setErrors((e) => ({ ...e, [type]: "Envoi impossible, réessayez." }));
      return;
    }
    const { error: dbErr } = await supabase.from("client_documents").upsert(
      {
        user_id: userId,
        doc_type: type,
        file_path: path,
        status: "pending" as const,
        reject_reason: null,
        uploaded_at: new Date().toISOString(),
      },
      { onConflict: "user_id,doc_type" },
    );
    setBusy(null);
    if (dbErr) {
      setErrors((e) => ({ ...e, [type]: "Envoi impossible, réessayez." }));
      return;
    }
    setRows((r) => ({
      ...r,
      [type]: { doc_type: type, file_path: path, status: "pending", reject_reason: null },
    }));
  };

  return (
    <section className="rounded-2xl border-2 border-border bg-card p-4">
      <p className="text-sm font-black">📄 Mes documents</p>
      <p className="text-xs text-muted-foreground mt-1">
        Ces documents sont administratifs : ils ne bloquent pas vos demandes de mission.
      </p>

      <div className="mt-4 flex flex-col gap-4">
        {DOCS.map((d) => {
          const row = rows[d.type];
          const status: DocStatus = row?.status ?? "missing";
          const ui = STATUS_UI[status];
          const fileName = row?.file_path ? row.file_path.split("/").pop() : null;
          return (
            <div key={d.type} className="rounded-2xl border-2 border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold">{d.label}</p>
                <span className={`text-xs font-bold shrink-0 ${ui.cls}`}>{ui.text}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{d.hint}</p>
              {fileName && (
                <p className="text-xs text-muted-foreground mt-2 truncate">📎 {fileName}</p>
              )}
              {status === "rejected" && row?.reject_reason && (
                <p className="text-xs font-bold text-destructive mt-1">Motif : {row.reject_reason}</p>
              )}
              <label className="mt-2 block">
                <span className="inline-block py-2 px-4 rounded-2xl border-2 border-primary text-primary text-sm font-bold cursor-pointer">
                  {busy === d.type ? "Envoi…" : fileName ? "Remplacer le fichier" : "Ajouter un fichier"}
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept="image/jpeg,image/png,application/pdf"
                  disabled={busy === d.type}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void upload(d.type, f);
                  }}
                />
              </label>
              {errors[d.type] && (
                <p className="text-xs font-bold text-destructive mt-2">{errors[d.type]}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default ClientDocumentsPanel;
