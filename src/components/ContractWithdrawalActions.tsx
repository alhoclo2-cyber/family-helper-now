import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { withdrawContractAsEmployer } from "@/lib/contractWithdrawal.functions";
import { store, type Request } from "@/lib/store";
import { withdrawalEditRequest } from "@/lib/contractWithdrawal";
import { sendSimulatedEmail } from "@/lib/simulatedEmails";

export function ContractWithdrawalActions({ contractId, onWithdrawn, onModify }: { contractId: string; onWithdrawn?: () => void; onModify: (request: Request) => void }) {
  const withdraw = useServerFn(withdrawContractAsEmployer);
  const qc = useQueryClient();
  const [action, setAction] = useState<"withdraw" | "modify" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const confirm = async () => {
    const request = store.getState().requests.find(r => r.contractId === contractId);
    if (action === "modify" && !request) { setError("Les informations de cette mission ne sont plus disponibles dans cette session. Vous pouvez retirer la demande puis en créer une nouvelle."); return; }
    setBusy(true); setError("");
    try {
      const result = await withdraw({ data: { contractId } });
      if (!result.ok) { setError(result.message); await qc.invalidateQueries({ queryKey: ["contract-status", contractId] }); return; }
      store.withdrawContractRequest(contractId);
      sendSimulatedEmail("contract_withdrawn", undefined, { role: "companion", contractId });
      sendSimulatedEmail("contract_withdrawn", undefined, { role: "family", contractId });
      await Promise.all(["contract-status", "contract-draft", "my-contracts", "my-contract-links", "contracts-in-force", "mandataire-contracts"].map(key => qc.invalidateQueries({ queryKey: [key] })));
      if (action === "modify" && request) onModify(withdrawalEditRequest(request));
      else onWithdrawn?.();
      setAction(null);
    } catch { setError("Le retrait n'a pas pu être confirmé. Réessayez."); }
    finally { setBusy(false); }
  };
  return <div className="w-full space-y-3 text-base text-left">
    <Button variant="outline" className="w-full h-auto py-3 whitespace-normal text-base" disabled={busy} onClick={() => { setAction("withdraw"); setError(""); }}>Retirer ma demande</Button>
    <Button variant="outline" className="w-full h-auto py-3 whitespace-normal text-base" disabled={busy} onClick={() => { setAction("modify"); setError(""); }}>Modifier ma demande</Button>
    {action && <div role="dialog" aria-label={action === "modify" ? "Confirmer la modification" : "Confirmer le retrait"} className="border border-border rounded-lg p-4 space-y-3">
      <p className="font-bold">{action === "modify" ? "Modifier cette demande ?" : "Retirer cette demande ?"}</p>
      <p>Le retrait est libre, sans frais et sans motif obligatoire.</p>
      {action === "modify" && <p>La demande actuelle sera retirée. Le formulaire sera pré-rempli ; un nouveau contrat sera généré et devra être signé à nouveau.</p>}
      <Button variant="outline" className="text-base" disabled={busy} onClick={() => setAction(null)}>Retour</Button>
      <Button className="ml-2 h-auto whitespace-normal text-base" disabled={busy} onClick={confirm}>{busy ? "Retrait en cours…" : "Confirmer"}</Button>
    </div>}
    {error && <p role="alert" className="text-destructive text-base">{error}</p>}
  </div>;
}