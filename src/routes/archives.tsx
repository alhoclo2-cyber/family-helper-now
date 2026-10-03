import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SimulatedEmailsDialog } from "@/components/SimulatedEmailsDialog";
import {
  archiveIsExpired, downloadArchiveDoc, getArchive, openArchiveDoc, removeArchive, saveArchive,
  OPEN_DOC_EVT, type Archive, type ArchiveDoc,
} from "@/lib/archive";
import { requestArchiveCode, verifyArchiveCode, RESEND_DELAY_MS } from "@/lib/archiveCode";
import { sendSimulatedEmail } from "@/lib/simulatedEmails";
import { formatDateFr } from "@/lib/accountState";

export const Route = createFileRoute("/archives")({
  validateSearch: (s: Record<string, unknown>): { email?: string } =>
    typeof s.email === "string" ? { email: s.email } : {},
  head: () => ({
    meta: [
      { title: "Mes archives — Solélia" },
      { name: "description", content: "Retrouvez l'historique de vos missions Solélia." },
      { property: "og:title", content: "Mes archives — Solélia" },
      { property: "og:description", content: "Accédez à vos archives Solélia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ArchivesPage,
});

const ERR: Record<string, string> = {
  wrong: "Code incorrect",
  expired: "Code expiré, demandez-en un nouveau",
  locked: "Trop d'essais, demandez un nouveau code",
  none: "Code expiré, demandez-en un nouveau",
};

function ArchiveDocDialog() {
  const [d, setD] = useState<ArchiveDoc | null>(null);
  useEffect(() => {
    const h = (e: Event) => setD((e as CustomEvent<ArchiveDoc>).detail);
    window.addEventListener(OPEN_DOC_EVT, h);
    return () => window.removeEventListener(OPEN_DOC_EVT, h);
  }, []);
  return (
    <Dialog open={!!d} onOpenChange={(o) => !o && setD(null)}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg">
        <DialogHeader><DialogTitle>{d?.title}</DialogTitle></DialogHeader>
        {d && <iframe title={d.title} srcDoc={d.html} className="w-full h-[65vh] rounded-lg border border-border bg-card" />}
      </DialogContent>
    </Dialog>
  );
}

function ArchivesPage() {
  const search = Route.useSearch();
  const [email, setEmail] = useState(search.email ?? "");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [info, setInfo] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [archive, setArchive] = useState<Archive | null>(null);
  const [sentAt, setSentAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [simOpen, setSimOpen] = useState(false);
  const [simMsg, setSimMsg] = useState("");

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const wait = Math.max(0, Math.ceil((sentAt + RESEND_DELAY_MS - now) / 1000));

  const send = () => {
    if (!email.trim()) return;
    requestArchiveCode(email);
    setSentAt(Date.now());
    setInfo("Si une archive existe pour cette adresse, un code vient de vous être envoyé.");
    setError("");
    setCode("");
    setStep(2);
  };
  const validate = () => {
    const r = verifyArchiveCode(email, code);
    if (r.ok) {
      setArchive(r.archive);
      setStep(3);
      setError("");
    } else setError(ERR[r.reason]);
  };
  const quit = () => {
    setArchive(null);
    setCode("");
    setInfo("");
    setError("");
    setStep(1);
  };

  const simArchive = () => {
    const a = getArchive(email);
    if (!a) setSimMsg("Aucune archive pour cette adresse.");
    return a;
  };

  return (
    <div className="min-h-screen bg-background flex justify-center">
      <div className="w-full max-w-[440px] min-h-screen flex flex-col bg-background shadow-xl px-5 py-8 gap-6">
        <Link to="/" className="text-sm font-bold text-primary">← Retour à l'accueil</Link>
        <h1 className="text-2xl font-black">Mes archives</h1>

        {step === 1 && (
          <div className="flex flex-col gap-4 text-base">
            <p>Entrez l'adresse e-mail de votre ancien compte. Nous vous enverrons un code.</p>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 text-base" placeholder="votre@adresse.fr" />
            <Button className="w-full h-12 text-base" onClick={send} disabled={!email.trim()}>Recevoir mon code</Button>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4 text-base">
            {info && <p className="rounded-2xl border border-border bg-card p-4">{info}</p>}
            <label className="flex flex-col gap-2 font-semibold">
              Code à 6 chiffres
              <Input
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="h-12 text-base tracking-widest"
              />
            </label>
            {error && <p className="font-semibold text-destructive">{error}</p>}
            <Button className="w-full h-12 text-base" onClick={validate} disabled={code.length !== 6}>Valider</Button>
            <button type="button" onClick={send} disabled={wait > 0} className="font-semibold text-primary underline disabled:text-muted-foreground disabled:no-underline">
              {wait > 0 ? `Renvoyer le code (${wait} s)` : "Renvoyer le code"}
            </button>
            <Button variant="outline" className="w-full h-12 text-base" onClick={quit}>Changer d'adresse</Button>
          </div>
        )}

        {step === 3 && archive && (
          <div className="flex flex-col gap-4 text-base">
            <p className="font-bold">Archives de {archive.email}</p>
            {archiveIsExpired(archive) ? (
              <p className="rounded-2xl border-2 border-destructive bg-card p-4">
                Vos archives ne sont plus accessibles en ligne. Pour en obtenir une copie, écrivez à{" "}
                <a href="mailto:solelia.accompagnement@gmail.com" className="font-semibold text-primary underline">solelia.accompagnement@gmail.com</a>.
              </p>
            ) : (
              <>
                <p>Accessibles jusqu'au {formatDateFr(archive.accessUntil)}</p>
                {archive.documents.map((d) => (
                  <div key={d.id} className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3">
                    <p className="font-bold">{d.title}</p>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1 h-12" onClick={() => openArchiveDoc(d)}>Voir</Button>
                      <Button variant="outline" className="flex-1 h-12" onClick={() => downloadArchiveDoc(d)}>Télécharger</Button>
                    </div>
                  </div>
                ))}
              </>
            )}
            <Button className="w-full h-12 text-base" onClick={quit}>Quitter mes archives</Button>
          </div>
        )}

        <SimulatedEmailsDialog />
        <div className="rounded-2xl border-2 border-dashed border-border bg-card p-4">
          <button type="button" onClick={() => setSimOpen((o) => !o)} className="w-full text-left font-bold text-base">
            🧪 Simulation (démo) {simOpen ? "▲" : "▼"}
          </button>
          {simOpen && (
            <div className="mt-3 flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">Les boutons agissent sur l'adresse saisie ci-dessus.</p>
              <Button variant="outline" className="w-full h-12" onClick={() => {
                const a = simArchive(); if (!a) return;
                const n = { ...a, accessUntil: Date.now() - 1000 };
                saveArchive(n);
                if (archive) setArchive(n);
                setSimMsg("L'accès de 12 mois est terminé.");
              }}>Terminer l'accès de 12 mois (test)</Button>
              <Button variant="outline" className="w-full h-12" onClick={() => {
                const a = simArchive(); if (!a) return;
                sendSimulatedEmail("archive_reminder_9", a.email, { date: a.accessUntil });
                setSimMsg("Rappel des 9 mois envoyé.");
              }}>Envoyer le rappel des 9 mois</Button>
              <Button variant="outline" className="w-full h-12" onClick={() => {
                const a = simArchive(); if (!a) return;
                sendSimulatedEmail("archive_reminder_11", a.email, { date: a.accessUntil });
                setSimMsg("Rappel des 11 mois envoyé.");
              }}>Envoyer le rappel des 11 mois</Button>
              <Button variant="outline" className="w-full h-12" onClick={() => {
                const a = simArchive(); if (!a) return;
                removeArchive(a.email);
                quit();
                setSimMsg("Archive de démonstration supprimée.");
              }}>Supprimer cette archive de démonstration</Button>
              {simMsg && <p className="text-base">{simMsg}</p>}
            </div>
          )}
        </div>
      </div>
      <ArchiveDocDialog />
    </div>
  );
}
