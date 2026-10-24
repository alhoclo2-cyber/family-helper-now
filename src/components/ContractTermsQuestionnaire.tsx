import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { contractIdentityKey, useContractIdentity, useCesuStatus } from "@/lib/contractIdentity";
import { CesuNumberField } from "@/components/CesuNumberField";
import { fetchContractTerms, saveContractTerms } from "@/lib/contractDraft";
import type { ContractAnswers, ContractKind } from "@/lib/contractDecision";
import {
  CDI_MAX_TRIAL_DAYS, MIN_LEAVE_NOTICE_MONTHS, PUBLIC_HOLIDAYS, SPECIAL_CONDITIONS_MAX, WEEKDAYS, WEEKLY_HOURS,
  cddTrialMax, defaultTerms, fixedWeeklyMinutes, formatWeekly, validateTerms,
  type ContractTerms, type FixedDay, type TermsField, type Weekday,
} from "@/lib/contractTerms";
import { ContractNoticeSentence } from "@/components/ContractQuestionnaire";

/* ------------------------------------------------------------------
   Questionnaire 2 du parcours contrat : choix du Particulier.
   Aucune donnée du Compagnon n'est demandée ni affichée.
------------------------------------------------------------------- */

type Step = 0 | 1 | 2 | 3 | 4 | 5;
const STEP_FIELDS: Record<number, TermsField[]> = {
  1: ["trialDays", "minDuration"],
  2: ["days"],
  3: ["weeklyRestDays", "mayFirst"],
  4: ["salaryPayDay", "leaveNoticeMonths"],
  5: ["trialDays", "minDuration", "days", "weeklyRestDays", "mayFirst", "salaryPayDay", "leaveNoticeMonths", "specialConditions"],
};
const SAVE_ERROR = "Impossible d'enregistrer vos réponses, réessayez.";
const fmtDay = (v?: string) => (v ? format(new Date(`${v}T00:00:00`), "dd/MM/yyyy") : "");
const trialLabel = (d: number) => (d === 0 ? "Sans période d'essai" : d === 7 ? "1 semaine" : d === 14 ? "2 semaines" : d === 30 ? "1 mois" : `${d} jour${d > 1 ? "s" : ""}`);
const unitLabel = { days: "jour(s)", weeks: "semaine(s)", months: "mois" } as const;

function Choice({ label, selected, onSelect }: { label: string; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" role="radio" aria-checked={selected} onClick={onSelect}
      className={`w-full text-left p-4 rounded-2xl border-2 font-semibold ${selected ? "border-primary bg-accent" : "border-border bg-card"}`}>
      {label}
    </button>
  );
}

const inputCls = "w-full p-3 rounded-2xl border-2 bg-card border-border";

export function ContractTermsQuestionnaire({
  draftId, kind, answers, missionTs, onBack, onDone,
}: {
  draftId: string;
  kind: ContractKind;
  answers: ContractAnswers;
  missionTs: number;
  onBack: () => void;
  onDone: () => void;
}) {
  const ctx = { kind, missionTs, answers };
  const { session } = useSession();
  const userId = session?.user.id;
  const qc = useQueryClient();
  const identity = useContractIdentity(userId);
  const cesu = useCesuStatus(userId);
  const names = useQuery({
    queryKey: ["profile-last-name", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("last_name").eq("id", userId!).maybeSingle();
      return data?.last_name ?? "";
    },
  });
  const stored = useQuery({ queryKey: ["contract-terms", draftId], queryFn: () => fetchContractTerms(draftId), staleTime: 0, gcTime: 0 });

  const [terms, setTerms] = useState<ContractTerms | null>(null);
  const [step, setStep] = useState<Step | null>(null);
  const [errors, setErrors] = useState<{ field: TermsField; message: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [idForm, setIdForm] = useState({ birth_name: "", address_line: "", postal_code: "", city: "" });
  const [sameName, setSameName] = useState(false);
  const [restOpen, setRestOpen] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Initialisation : choix déjà enregistrés pour ce brouillon, sinon valeurs par défaut.
  useEffect(() => {
    if (terms || stored.isLoading || identity.isLoading || cesu.isLoading) return;
    const base = defaultTerms(ctx);
    const prev = stored.data ?? {};
    setTerms({ ...base, ...prev, startDate: base.startDate });
    setStep((identity.data?.missing.length ?? 0) > 0 || cesu.data?.hasCesu === false ? 0 : 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored.isLoading, identity.isLoading, cesu.isLoading, terms]);

  useEffect(() => { titleRef.current?.focus(); }, [step]);

  if (!terms || step === null) {
    return <div className="flex-1 flex items-center justify-center px-6 py-10"><p className="text-muted-foreground">Chargement…</p></div>;
  }

  const missing = identity.data?.profile ?? null;
  const need = {
    birth_name: !missing?.birth_name?.trim(),
    address_line: !missing?.address_line?.trim(),
    postal_code: !missing?.postal_code?.trim(),
    city: !missing?.city?.trim(),
  };
  const set = (patch: Partial<ContractTerms>) => setTerms((t) => (t ? { ...t, ...patch } : t));
  const err = (f: TermsField) => errors.find((e) => e.field === f)?.message;
  const ErrorText = ({ f }: { f: TermsField }) => (err(f) ? <p className="text-xs font-semibold text-destructive mt-1">{err(f)}</p> : null);
  const trialMax = kind === "cdi" ? CDI_MAX_TRIAL_DAYS : cddTrialMax(terms, ctx);
  const fixedDays = terms.organization.mode === "fixed" ? terms.organization.days : [];
  const weekly = fixedWeeklyMinutes(fixedDays);
  const effectiveUntil = kind === "cdd" && answers.endMode === "date" ? answers.endDate ?? null : null;

  const saveIdentity = async () => {
    const patch: Partial<Record<keyof typeof need, string>> = {};
    (Object.keys(need) as (keyof typeof need)[]).forEach((k) => { if (need[k]) patch[k] = idForm[k].trim(); });
    if (Object.values(patch).some((v) => !v)) return;
    setSaving(true);
    setSaveError(false);
    const { error } = await supabase.from("profiles").update(patch).eq("id", userId!);
    setSaving(false);
    if (error) return setSaveError(true);
    await qc.invalidateQueries({ queryKey: contractIdentityKey(userId) });
    setStep(1);
  };

  const goNext = async () => {
    if (step === 0) return saveIdentity();
    const errs = validateTerms(terms, ctx).filter((e) => STEP_FIELDS[step].includes(e.field));
    setErrors(errs);
    if (errs.length > 0) return;
    setSaving(true);
    setSaveError(false);
    try {
      await saveContractTerms({ draftId, terms, effectiveUntil });
    } catch {
      setSaveError(true);
      return;
    } finally {
      setSaving(false);
    }
    if (step === 5) return onDone();
    setStep((step + 1) as Step);
  };

  const goBack = () => {
    setErrors([]);
    if (step === 0 || step === 1) return onBack();
    setStep((step - 1) as Step);
  };

  const idComplete = (Object.keys(need) as (keyof typeof need)[]).every((k) => !need[k] || !!idForm[k].trim());

  const setDay = (weekday: Weekday, patch: Partial<FixedDay> | null) => {
    const others = fixedDays.filter((d) => d.weekday !== weekday);
    const current = fixedDays.find((d) => d.weekday === weekday) ?? { weekday, start: "", end: "" };
    const days = patch === null ? others : [...others, { ...current, ...patch }].sort((a, b) => a.weekday - b.weekday);
    set({ organization: { mode: "fixed", days } });
  };

  const Title = ({ children }: { children: React.ReactNode }) => (
    <h2 ref={titleRef} tabIndex={-1} className="text-xl font-black outline-none">{children}</h2>
  );
  const progress = step > 0 && <p className="text-sm font-semibold text-muted-foreground">Étape {step} sur 5</p>;
  const Edit = ({ to }: { to: Step }) => (
    <button type="button" onClick={() => { setErrors([]); setStep(to); }} className="text-sm font-bold text-primary underline">Modifier</button>
  );

  return (
    <div className="flex-1 flex flex-col px-5 py-6 gap-4">
      <ContractNoticeSentence />
      {saveError && <p role="alert" className="text-sm font-semibold text-destructive">{SAVE_ERROR}</p>}

      {step === 0 && (
        <>
          <Title>Complétez vos informations</Title>
          <p className="text-sm text-muted-foreground">Ces informations figureront sur votre contrat de travail.</p>
          {need.birth_name && (
            <div className="flex flex-col gap-2">
              <label htmlFor="ct-birth" className="text-sm font-bold">Nom de naissance</label>
              <input id="ct-birth" className={inputCls} value={idForm.birth_name}
                onChange={(e) => { setSameName(false); setIdForm((f) => ({ ...f, birth_name: e.target.value })); }} />
              {!!names.data && (
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1 accent-primary" checked={sameName}
                    onChange={(e) => { setSameName(e.target.checked); if (e.target.checked) setIdForm((f) => ({ ...f, birth_name: names.data ?? "" })); }} />
                  <span>Mon nom de naissance est identique à mon nom d'usage</span>
                </label>
              )}
            </div>
          )}
          {need.address_line && (
            <div><label htmlFor="ct-street" className="block text-sm font-bold mb-1">Rue</label>
              <input id="ct-street" className={inputCls} value={idForm.address_line} onChange={(e) => setIdForm((f) => ({ ...f, address_line: e.target.value }))} /></div>
          )}
          {need.postal_code && (
            <div><label htmlFor="ct-pc" className="block text-sm font-bold mb-1">Code postal</label>
              <input id="ct-pc" inputMode="numeric" className={inputCls} value={idForm.postal_code} onChange={(e) => setIdForm((f) => ({ ...f, postal_code: e.target.value }))} /></div>
          )}
          {need.city && (
            <div><label htmlFor="ct-city" className="block text-sm font-bold mb-1">Ville</label>
              <input id="ct-city" className={inputCls} value={idForm.city} onChange={(e) => setIdForm((f) => ({ ...f, city: e.target.value }))} /></div>
          )}
        </>
      )}

      {step === 1 && (
        <>
          <Title>Début du contrat et période d'essai</Title>
          {progress}
          {kind === "cdi" ? (
            <>
              <div className="rounded-2xl border-2 border-border bg-card p-4 text-sm">
                <p><b>Date d'embauche :</b> {fmtDay(terms.startDate)}</p>
                <p className="text-muted-foreground mt-1">C'est la date de votre première mission avec ce compagnon.</p>
              </div>
              <p className="text-base font-bold">Prévoyez-vous une période d'essai ?</p>
              <div role="radiogroup" aria-label="Période d'essai" className="flex flex-col gap-3">
                <Choice label="Non" selected={terms.trialDays === 0} onSelect={() => set({ trialDays: 0 })} />
                <Choice label="Oui" selected={terms.trialDays > 0} onSelect={() => terms.trialDays === 0 && set({ trialDays: 7 })} />
              </div>
              {terms.trialDays > 0 && (
                <div role="radiogroup" aria-label="Durée de la période d'essai" className="flex flex-col gap-3">
                  {[7, 14, 30].map((d) => <Choice key={d} label={trialLabel(d)} selected={terms.trialDays === d} onSelect={() => set({ trialDays: d })} />)}
                </div>
              )}
              <p className="text-xs text-muted-foreground">La période d'essai doit être écrite dans le contrat signé au plus tard le premier jour de travail.</p>
            </>
          ) : (
            <>
              <div className="rounded-2xl border-2 border-border bg-card p-4 text-sm flex flex-col gap-1">
                <p><b>Motif :</b> remplacement de {answers.replaced?.firstName} {answers.replaced?.lastName}, {answers.replaced?.role}</p>
                <p><b>Début :</b> {fmtDay(terms.startDate)}</p>
                <p><b>Fin :</b> {answers.endMode === "return" ? "au retour du salarié remplacé" : fmtDay(answers.endDate)}</p>
              </div>
              {answers.endMode === "return" && (
                <div>
                  <p className="text-base font-bold mb-1">Durée minimale du contrat</p>
                  <div className="flex gap-2">
                    <input type="number" min={1} aria-label="Durée minimale" className={`${inputCls} w-24`} value={terms.minDuration?.value ?? ""}
                      onChange={(e) => set({ minDuration: { value: Math.floor(Number(e.target.value)), unit: terms.minDuration?.unit ?? "weeks" }, trialDays: 0 })} />
                    <select aria-label="Unité" className={inputCls} value={terms.minDuration?.unit ?? "weeks"}
                      onChange={(e) => set({ minDuration: { value: terms.minDuration?.value ?? 1, unit: e.target.value as "days" }, trialDays: 0 })}>
                      <option value="days">jours</option><option value="weeks">semaines</option><option value="months">mois</option>
                    </select>
                  </div>
                  <ErrorText f="minDuration" />
                  <p className="text-xs text-muted-foreground mt-1">Un contrat sans date de fin doit indiquer une durée minimale.</p>
                </div>
              )}
              <p className="text-base font-bold">Période d'essai</p>
              {trialMax === 0 ? (
                <>
                  <Choice label="Sans période d'essai" selected onSelect={() => set({ trialDays: 0 })} />
                  <p className="text-xs text-muted-foreground">Ce contrat dure moins d'une semaine : aucune période d'essai n'est possible.</p>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">{trialMax} jour{trialMax > 1 ? "s" : ""} au maximum pour la durée de ce contrat</p>
                  <select aria-label="Période d'essai" className={inputCls} value={terms.trialDays} onChange={(e) => set({ trialDays: Number(e.target.value) })}>
                    <option value={0}>Sans période d'essai</option>
                    {Array.from({ length: trialMax }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d} jour{d > 1 ? "s" : ""}</option>)}
                  </select>
                </>
              )}
            </>
          )}
          <ErrorText f="trialDays" />
        </>
      )}

      {step === 2 && (
        <>
          <Title>Comment le travail sera-t-il organisé ?</Title>
          {progress}
          <div role="radiogroup" aria-label="Organisation du travail" className="flex flex-col gap-3">
            <Choice label="Durée irrégulière" selected={terms.organization.mode === "irregular"} onSelect={() => set({ organization: { mode: "irregular" } })} />
            <Choice label="Planning défini" selected={terms.organization.mode === "fixed"} onSelect={() => terms.organization.mode !== "fixed" && set({ organization: { mode: "fixed", days: [] } })} />
          </div>
          {terms.organization.mode === "irregular" ? (
            <p className="text-sm">Les missions varient selon vos demandes, de {WEEKLY_HOURS.min} à {WEEKLY_HOURS.max} heures par semaine. Elles sont communiquées au compagnon par la plateforme Solélia dès leur réservation, au moins 5 jours avant leur début. Le compagnon est libre d'accepter ou de refuser chaque mission.</p>
          ) : (
            <>
              <p className="text-sm">Mêmes jours et mêmes horaires chaque semaine.</p>
              {WEEKDAYS.map((label, i) => {
                const wd = (i + 1) as Weekday;
                const day = fixedDays.find((d) => d.weekday === wd);
                return (
                  <div key={wd} className="rounded-2xl border-2 border-border bg-card p-3 flex flex-col gap-2">
                    <label className="flex items-center justify-between font-bold">
                      <span>{label}</span>
                      <span className="flex items-center gap-2 text-sm font-semibold">Travaillé
                        <input type="checkbox" className="h-5 w-5 accent-primary" checked={!!day} onChange={(e) => setDay(wd, e.target.checked ? {} : null)} />
                      </span>
                    </label>
                    {day && (
                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-xs font-bold">Heure de début
                          <input type="time" className={inputCls} value={day.start} onChange={(e) => setDay(wd, { start: e.target.value })} /></label>
                        <label className="text-xs font-bold">Heure de fin
                          <input type="time" className={inputCls} value={day.end} onChange={(e) => setDay(wd, { end: e.target.value })} /></label>
                      </div>
                    )}
                  </div>
                );
              })}
              <p className={`text-base font-black ${weekly > WEEKLY_HOURS.max * 60 ? "text-destructive" : ""}`}>Durée hebdomadaire : {formatWeekly(weekly)}</p>
              <ErrorText f="days" />
              <p className="text-xs text-muted-foreground">Tout changement de planning doit être communiqué au compagnon au moins 5 jours à l'avance.</p>
            </>
          )}
        </>
      )}

      {step === 3 && (
        <>
          <Title>Repos et jours fériés</Title>
          {progress}
          <div>
            <label htmlFor="ct-rest" className="block text-base font-bold mb-1">Jour de repos hebdomadaire</label>
            <select id="ct-rest" className={inputCls} value={terms.weeklyRestDay ?? ""} onChange={(e) => set({ weeklyRestDay: Number(e.target.value) as Weekday })}>
              {WEEKDAYS.map((l, i) => <option key={l} value={i + 1}>{l}</option>)}
            </select>
            <ErrorText f="weeklyRestDay" />
          </div>
          <p className="text-base font-bold">1er mai</p>
          <div role="radiogroup" aria-label="1er mai" className="flex flex-col gap-3">
            <Choice label="Chômé" selected={terms.mayFirst === "off"} onSelect={() => set({ mayFirst: "off" })} />
            <Choice label="Travaillé" selected={terms.mayFirst === "worked"} onSelect={() => set({ mayFirst: "worked" })} />
          </div>
          <ErrorText f="mayFirst" />
          <p className="text-base font-bold">Jours fériés travaillés</p>
          <p className="text-sm text-muted-foreground">Cochez uniquement les jours fériés où le compagnon pourra travailler.</p>
          <div className="flex flex-col gap-2">
            {PUBLIC_HOLIDAYS.map((h) => (
              <label key={h.key} className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card p-3 text-sm font-semibold">
                <input type="checkbox" className="h-5 w-5 accent-primary" checked={terms.workedHolidays.includes(h.key)}
                  onChange={(e) => set({ workedHolidays: e.target.checked ? [...terms.workedHolidays, h.key] : terms.workedHolidays.filter((k) => k !== h.key) })} />
                {h.label}
              </label>
            ))}
          </div>
        </>
      )}

      {step === 4 && (
        <>
          <Title>Salaire et congés</Title>
          {progress}
          <div>
            <label htmlFor="ct-pay" className="block text-base font-bold mb-1">Jour du mois où vous versez le salaire</label>
            {/* Choix de l'employeur ; Solélia ne l'impose pas. Liaison avec le circuit de paiement de la plateforme à valider par l'avocat. */}
            <select id="ct-pay" className={`${inputCls}${err("salaryPayDay") ? " border-destructive" : ""}`} value={terms.salaryPayDay ?? ""}
              onChange={(e) => set({ salaryPayDay: e.target.value ? Number(e.target.value) : null })}>
              <option value="" disabled>Choisir un jour</option>
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <p className="text-sm text-muted-foreground mt-1">Le salaire du mois écoulé est versé le {terms.salaryPayDay ?? "…"} du mois suivant.</p>
            <ErrorText f="salaryPayDay" />
          </div>
          <div>
            <label htmlFor="ct-leave" className="block text-base font-bold mb-1">Délai de prévenance pour fixer les congés (en mois)</label>
            <input id="ct-leave" type="number" min={MIN_LEAVE_NOTICE_MONTHS} className={`${inputCls}${err("leaveNoticeMonths") ? " border-destructive" : ""}`}
              value={Number.isNaN(terms.leaveNoticeMonths) ? "" : terms.leaveNoticeMonths} onChange={(e) => set({ leaveNoticeMonths: Number(e.target.value) })} />
            <ErrorText f="leaveNoticeMonths" />
          </div>
        </>
      )}

      {step === 5 && (
        <>
          <Title>Conditions particulières et récapitulatif</Title>
          {progress}
          <div>
            <label htmlFor="ct-special" className="block text-base font-bold mb-1">Conditions particulières (facultatif)</label>
            <textarea id="ct-special" maxLength={SPECIAL_CONDITIONS_MAX} rows={4} className={inputCls} value={terms.specialConditions ?? ""}
              onChange={(e) => set({ specialConditions: e.target.value })} />
            <p className="text-xs text-muted-foreground">N'indiquez ni information médicale ni donnée sensible. ({(terms.specialConditions ?? "").length}/{SPECIAL_CONDITIONS_MAX})</p>
            <ErrorText f="specialConditions" />
          </div>
          {errors.length > 0 && <p role="alert" className="text-sm font-semibold text-destructive">{errors[0].message}</p>}
          <div className="rounded-2xl border-2 border-border bg-card p-4 text-sm flex flex-col gap-3">
            <div className="flex justify-between gap-2"><div>
              <p><b>Début :</b> {fmtDay(terms.startDate)}</p>
              {terms.minDuration && answers.endMode === "return" && kind === "cdd" && <p><b>Durée minimale :</b> {terms.minDuration.value} {unitLabel[terms.minDuration.unit]}</p>}
              <p><b>Période d'essai :</b> {trialLabel(terms.trialDays)}</p>
            </div><Edit to={1} /></div>
            <div className="flex justify-between gap-2"><div>
              <p><b>Organisation :</b> {terms.organization.mode === "irregular" ? "Durée irrégulière" : `Planning défini (${formatWeekly(weekly)} par semaine)`}</p>
              {fixedDays.map((d) => <p key={d.weekday}>{WEEKDAYS[d.weekday - 1]} : {d.start} – {d.end}</p>)}
            </div><Edit to={2} /></div>
            <div className="flex justify-between gap-2"><div>
              <p><b>Jour de repos :</b> {terms.weeklyRestDay ? WEEKDAYS[terms.weeklyRestDay - 1] : ""}</p>
              <p><b>1er mai :</b> {terms.mayFirst === "worked" ? "Travaillé" : "Chômé"}</p>
              <p><b>Jours fériés travaillés :</b> {terms.workedHolidays.length ? PUBLIC_HOLIDAYS.filter((h) => terms.workedHolidays.includes(h.key)).map((h) => h.label).join(", ") : "Aucun"}</p>
            </div><Edit to={3} /></div>
            <div className="flex justify-between gap-2"><div>
              <p><b>Versement du salaire :</b> le {terms.salaryPayDay ?? "…"} du mois suivant</p>
              <p><b>Délai de prévenance des congés :</b> {terms.leaveNoticeMonths} mois</p>
            </div><Edit to={4} /></div>
          </div>
          <div className="rounded-2xl border-2 border-border bg-accent p-4 text-sm">
            <p className="font-bold mb-1">Comment fonctionnent les missions</p>
            <p>{terms.organization.mode === "irregular"
              ? "Vous proposez les missions via Solélia ; le compagnon est libre de les accepter ou de les refuser. Il peut aussi refuser ce contrat, à tout moment avant de l'avoir accepté, sans justification ni pénalité."
              : "Le compagnon travaille selon le planning ci-dessus. Il peut refuser ce contrat, à tout moment avant de l'avoir accepté, sans justification ni pénalité."}</p>
          </div>
        </>
      )}

      <div className="flex flex-col gap-2 mt-4">
        <button type="button" onClick={goNext} disabled={saving || (step === 0 && !idComplete)}
          className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-bold disabled:opacity-50">Continuer</button>
        <button type="button" onClick={goBack} className="w-full py-3 rounded-2xl border-2 border-border font-bold text-sm">← Retour</button>
      </div>
    </div>
  );
}
