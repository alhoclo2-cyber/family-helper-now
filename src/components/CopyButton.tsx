import { useState } from "react";

/** Petit bouton qui copie une valeur dans le presse-papiers. */
export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* presse-papiers indisponible */
        }
      }}
      className="shrink-0 rounded-xl border-2 border-border px-2 py-0.5 text-xs font-bold text-primary"
    >
      {copied ? "Copié" : "Copier"}
    </button>
  );
}
