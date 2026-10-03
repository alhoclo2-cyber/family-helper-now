import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import type { SimKey, useAccountState } from "@/lib/accountState";

const ITEMS: { key: SimKey; label: string }[] = [
  { key: "mission", label: "Simuler une mission à venir" },
  { key: "refund", label: "Simuler un remboursement en cours" },
  { key: "payment", label: "Simuler un paiement en cours" },
  { key: "hours", label: "Simuler des heures non confirmées" },
];

export function AccountSimulationPanel({
  account,
  showAdvance,
}: {
  account: ReturnType<typeof useAccountState>;
  showAdvance?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border-2 border-dashed border-border bg-card p-4">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full text-left font-bold text-base">
        🧪 Simulation (démo) {open ? "▲" : "▼"}
      </button>
      {open && (
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Cet encart sert uniquement à tester. Il disparaîtra à l'ouverture réelle.
          </p>
          {ITEMS.map((it) => (
            <label key={it.key} className="flex items-center justify-between gap-3 text-base">
              <span>{it.label}</span>
              <Switch checked={account.state.sim[it.key]} onCheckedChange={(v) => account.setSim(it.key, v)} />
            </label>
          ))}
          <Button variant="outline" className="w-full h-12" onClick={account.resetAll}>
            Remettre le compte à zéro
          </Button>
          {showAdvance && account.state.status === "deletion_pending" && (
            <Button variant="outline" className="w-full h-12" onClick={() => account.advanceDays()}>
              Avancer de 14 jours (test)
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
