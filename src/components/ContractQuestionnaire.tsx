import { useEffect, useRef, useState } from "react";
import { addMonths, format, startOfDay } from "date-fns";
import {
  CDD_MAX_MONTHS_FIXED_END,
  decideContractKind,
  validateAnswers,
  type ContractAnswers,
  type ContractKind,
  type ValidationError,
} from "@/lib/contractDecision";
import { fetchLatestDraftAnswers, saveContractDraft, useContractDraft, type StoredContractAnswers } from "@/lib/contractDraft";
import { useSession } from "@/lib/auth";

/* ------------------------------------------------------------------
   Questionnaire 1 du parcours contrat : détection CDI / CDD.
   Aucune question sur la santé, aucune zone de texte libre.
------------------------------------------------------------------- */

const INTRO =
  "Un contrat de travail écrit est nécessaire avec ce compagnon. Il peut être à durée indéterminée (CDI) ou à durée déterminée (CDD). Vos réponses déterminent le contrat proposé et seront inscrites dans le contrat.";
const SAVE_ERROR = "Impossible d'enregistrer vos réponses, réessayez.";

type Step = "q1" | "q2" | "q3" | "confirm";

function Choice({
  label,
  selected,
  onSelect,
  name,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
  name: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      data-group={name}
      onClick={onSelect}
      className={`w-full text-left p-4 rounded-2xl border-2 font-semibold ${
        selected ? "border-primary bg-accent" : "border-border bg-card"
      }`}
    >
      {label}
    </button>
  );
}

export function ContractQuestionnaire({
  companionId,
  companionName,
  missionTs,
  durationHours,
  onBack,
  onDone,
}: {
  companionId: string;
  companionName: string;
  missionTs: number;
  durationHours: number;
  onBack: () => void;
  onDone: (result: { kind: ContractKind; draftId: string }) => void;
}) {
  const { session } = useSession();
  const userId = session?.user.id;
  const draftQuery = useContractDraft(userId, companionId);

  const [step, setStep] = useState<Step>("q1");
  const [answers, setAnswers] = useState<ContractAnswers>({});
  const [initialized, setInitialized] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [choiceError, setChoiceError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [certified, setCertified] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Préremplissage : brouillon du binôme, sinon brouillon le plus récent d'un autre compagnon.
  useEffect(() => {
    if (initialized || !userId || draftQuery.data === undefined) return;
    const own = draftQuery.data;
    if (own?.answers && typeof own.answers === "object") {
      setAnswers(own.answers as StoredContractAnswers);
      setInitialized(true);
      return;
    }
    if (own) {
      setInitialized(true);
      return;
    }
    let cancelled = false;
    fetchLatestDraftAnswers(userId, companionId)
      .then((latest) => {
        if (cancelled) return;
        if (latest) {
          const { decision_version: _v, certified_at: _c, ...rest } = latest;
          setAnswers(rest);
        }
        setInitialized(true);
      })
      .catch(() => {
        if (!cancelled) setInitialized(true);
      });
    return () => {
      cancelled = true;
    };
  }, [initialized, userId, companionId, draftQuery.data]);

  // Accessibilité : le focus suit le titre à chaque changement d'écran.
  useEffect(() => {
    titleRef.current?.focus();
  }, [step, initialized]);

  if (!userId) return null;

  if (draftQuery.isLoading || !initialized) {
    return (
      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <p className="text-muted-foreground">Chargement…</p>
      </div>
    );
  }

  if (draftQuery.data?.status === "awaiting_companion") {
    return (
      <div className="flex-1 flex flex-col px-5 py-6 gap-4">
        <h2 className="text-xl font-black">Contrat de travail</h2>
        <p className="text-base">
          Une demande de contrat est déjà en attente de la réponse de ce compagnon. Vous pouvez choisir un autre compagnon.
        </p>
        <button type="button" onClick={onBack} className="btn-huge bg-primary text-primary-foreground w-full">
          Retour
        </button>
      </div>
    );
  }

  const questions: Step[] = [
    "q1",
    ...(answers.hasEnd === "yes" ? (["q2"] as Step[]) : []),
    ...(answers.hasEnd === "yes" && answers.replacesAbsentEmployee === true ? (["q3"] as Step[]) : []),
  ];
  const questionIndex = step === "confirm" ? -1 : questions.indexOf(step);
  const missionDay = startOfDay(new Date(missionTs));
  const minDate = format(missionDay, "yyyy-MM-dd");
  const maxDate = format(addMonths(missionDay, CDD_MAX_MONTHS_FIXED_END), "yyyy-MM-dd");
  const kind = decideContractKind(answers, { missionTs });

  const fieldError = (field: ValidationError["field"]) => errors.find((e) => e.field === field)?.message;

  const persist = async (kindValue: ContractKind | null, finalAnswers: StoredContractAnswers) => {
    setSaving(true);
    setSaveError(false);
    try {
      const draftId = await saveContractDraft({ userId, companionRef: companionId, answers: finalAnswers, contractKind: kindValue });
      return draftId;
    } catch {
      setSaveError(true);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const goNext = async () => {
    // Aucune valeur présélectionnée : une réponse explicite est exigée.
    if ((step === "q1" && !answers.hasEnd) || (step === "q2" && answers.replacesAbsentEmployee === undefined)) {
      setChoiceError(true);
      return;
    }
    setChoiceError(false);
    if (step === "q3") {
      const errs = validateAnswers(answers, { missionTs });
      setErrors(errs);
      if (errs.length > 0) return;
    }
    const draftId = await persist(null, answers);
    if (!draftId) return; // ne pas continuer en cas d'erreur d'enregistrement
    const next = questions[questionIndex + 1];
    setStep(next ?? "confirm");
  };

  const goBack = () => {
    setErrors([]);
    if (step === "q1") return onBack();
    if (step === "confirm") return setStep(questions[questions.length - 1]);
    setStep(questions[questionIndex - 1]);
  };

  const confirm = async () => {
    const finalAnswers: StoredContractAnswers = {
      ...answers,
      decision_version: 1,
      certified_at: new Date().toISOString(),
    };
    const draftId = await persist(kind, finalAnswers);
    if (!draftId) return;
    onDone({ kind, draftId });
  };

  const nav = (
    <div className="flex flex-col gap-2 mt-4">
      <button
        type="button"
        onClick={step === "confirm" ? confirm : goNext}
        disabled={saving || (step === "confirm" && !certified)}
        className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-bold disabled:opacity-50"
      >
        {step === "confirm" ? "Confirmer" : "Continuer"}
      </button>
      {step === "confirm" && (
        <button
          type="button"
          onClick={() => setStep("q1")}
          className="w-full py-4 rounded-2xl border-2 border-border font-bold"
        >
          Modifier mes réponses
        </button>
      )}
      <button type="button" onClick={goBack} className="w-full py-3 rounded-2xl border-2 border-border font-bold text-sm">
        ← Retour
      </button>
    </div>
  );

  const progress = step !== "confirm" && (
    <p className="text-sm font-semibold text-muted-foreground">
      Question {questionIndex + 1} sur {questions.length}
    </p>
  );

  return (
    <div className="flex-1 flex flex-col px-5 py-6 gap-4">
      {saveError && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {SAVE_ERROR}
        </p>
      )}
      {choiceError && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          Choisissez une réponse pour continuer.
        </p>
      )}

      {step === "q1" && (
        <>
          <h2 ref={titleRef} tabIndex={-1} className="text-xl font-black outline-none">
            Ce besoin d'accompagnement a-t-il une fin prévue ?
          </h2>
          <p className="text-sm text-muted-foreground">{INTRO}</p>
          {progress}
          <div role="radiogroup" aria-label="Ce besoin d'accompagnement a-t-il une fin prévue ?" className="flex flex-col gap-3">
            <Choice name="hasEnd" label="Non, c'est un besoin régulier, sans date de fin" selected={answers.hasEnd === "no"} onSelect={() => setAnswers({ hasEnd: "no" })} />
            <Choice name="hasEnd" label="Je ne sais pas" selected={answers.hasEnd === "unknown"} onSelect={() => setAnswers({ hasEnd: "unknown" })} />
            <Choice name="hasEnd" label="Oui, il a une fin prévue" selected={answers.hasEnd === "yes"} onSelect={() => setAnswers((a) => ({ ...a, hasEnd: "yes" }))} />
          </div>
          {nav}
        </>
      )}

      {step === "q2" && (
        <>
          <h2 ref={titleRef} tabIndex={-1} className="text-xl font-black outline-none">
            Cette mission sert-elle à remplacer un salarié que vous employez habituellement et qui est absent ?
          </h2>
          <p className="text-sm text-muted-foreground">
            Un contrat à durée déterminée n'est possible que pour remplacer un salarié absent que vous employez
            habituellement (par exemple votre aide à domicile habituelle, absente).
          </p>
          {progress}
          <div role="radiogroup" aria-label="Remplacement d'un salarié absent" className="flex flex-col gap-3">
            <Choice
              name="replaces"
              label="Oui, je remplace un salarié absent"
              selected={answers.replacesAbsentEmployee === true}
              onSelect={() => setAnswers((a) => ({ ...a, replacesAbsentEmployee: true }))}
            />
            <Choice
              name="replaces"
              label="Non"
              selected={answers.replacesAbsentEmployee === false}
              onSelect={() => setAnswers({ hasEnd: "yes", replacesAbsentEmployee: false })}
            />
          </div>
          {nav}
        </>
      )}

      {step === "q3" && (
        <>
          <h2 ref={titleRef} tabIndex={-1} className="text-xl font-black outline-none">
            Le salarié remplacé et la fin du contrat
          </h2>
          {progress}
          <div className="flex flex-col gap-4">
            <div>
              <label htmlFor="cq-firstname" className="block text-sm font-bold mb-1">
                Prénom du salarié remplacé
              </label>
              <input
                id="cq-firstname"
                type="text"
                value={answers.replaced?.firstName ?? ""}
                onChange={(e) => setAnswers((a) => ({ ...a, replaced: { firstName: e.target.value, lastName: a.replaced?.lastName ?? "", role: a.replaced?.role ?? "" } }))}
                className={`w-full p-3 rounded-2xl border-2 bg-card ${fieldError("firstName") ? "border-destructive" : "border-border"}`}
              />
              {fieldError("firstName") && <p className="text-xs font-semibold text-destructive mt-1">{fieldError("firstName")}</p>}
            </div>
            <div>
              <label htmlFor="cq-lastname" className="block text-sm font-bold mb-1">
                Nom du salarié remplacé
              </label>
              <input
                id="cq-lastname"
                type="text"
                value={answers.replaced?.lastName ?? ""}
                onChange={(e) => setAnswers((a) => ({ ...a, replaced: { firstName: a.replaced?.firstName ?? "", lastName: e.target.value, role: a.replaced?.role ?? "" } }))}
                className={`w-full p-3 rounded-2xl border-2 bg-card ${fieldError("lastName") ? "border-destructive" : "border-border"}`}
              />
              {fieldError("lastName") && <p className="text-xs font-semibold text-destructive mt-1">{fieldError("lastName")}</p>}
            </div>
            <div>
              <label htmlFor="cq-role" className="block text-sm font-bold mb-1">
                Emploi ou qualification du salarié remplacé
              </label>
              <input
                id="cq-role"
                type="text"
                placeholder="Par exemple : aide à domicile, employée familiale"
                value={answers.replaced?.role ?? ""}
                onChange={(e) => setAnswers((a) => ({ ...a, replaced: { firstName: a.replaced?.firstName ?? "", lastName: a.replaced?.lastName ?? "", role: e.target.value } }))}
                className={`w-full p-3 rounded-2xl border-2 bg-card ${fieldError("role") ? "border-destructive" : "border-border"}`}
              />
              {fieldError("role") && <p className="text-xs font-semibold text-destructive mt-1">{fieldError("role")}</p>}
            </div>
            <div>
              <p className="text-sm font-bold mb-1">Fin du contrat</p>
              <div role="radiogroup" aria-label="Fin du contrat" className="flex flex-col gap-3">
                <Choice
                  name="endMode"
                  label="À une date précise"
                  selected={answers.endMode === "date"}
                  onSelect={() => setAnswers((a) => ({ ...a, endMode: "date" }))}
                />
                <Choice
                  name="endMode"
                  label="Au retour du salarié remplacé"
                  selected={answers.endMode === "return"}
                  onSelect={() => setAnswers((a) => ({ ...a, endMode: "return", endDate: undefined }))}
                />
              </div>
              {fieldError("endMode") && <p className="text-xs font-semibold text-destructive mt-1">{fieldError("endMode")}</p>}
            </div>
            {answers.endMode === "date" && (
              <div>
                <label htmlFor="cq-enddate" className="block text-sm font-bold mb-1">
                  Date de fin
                </label>
                <input
                  id="cq-enddate"
                  type="date"
                  min={minDate}
                  max={maxDate}
                  value={answers.endDate ?? ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, endDate: e.target.value }))}
                  className={`w-full p-3 rounded-2xl border-2 bg-card ${fieldError("endDate") ? "border-destructive" : "border-border"}`}
                />
                {fieldError("endDate") && <p className="text-xs font-semibold text-destructive mt-1">{fieldError("endDate")}</p>}
              </div>
            )}
          </div>
          {nav}
        </>
      )}

      {step === "confirm" && (
        <>
          <h2 ref={titleRef} tabIndex={-1} className="text-xl font-black outline-none">
            Récapitulatif de vos réponses
          </h2>
          <div className="rounded-2xl border-2 border-border bg-card p-4 text-sm flex flex-col gap-2">
            <p>
              <b>Mission :</b> {format(missionDay, "dd/MM/yyyy")} · {durationHours} h · avec {companionName}
            </p>
            <p>
              <b>Fin prévue :</b>{" "}
              {answers.hasEnd === "yes" ? "Oui, il a une fin prévue" : answers.hasEnd === "unknown" ? "Je ne sais pas" : "Non, c'est un besoin régulier, sans date de fin"}
            </p>
            {answers.hasEnd === "yes" && (
              <p>
                <b>Remplacement d'un salarié absent :</b> {answers.replacesAbsentEmployee ? "Oui" : "Non"}
              </p>
            )}
            {answers.hasEnd === "yes" && answers.replacesAbsentEmployee === true && answers.replaced && (
              <>
                <p>
                  <b>Salarié remplacé :</b> {answers.replaced.firstName} {answers.replaced.lastName} ({answers.replaced.role})
                </p>
                <p>
                  <b>Fin du contrat :</b>{" "}
                  {answers.endMode === "return"
                    ? "Au retour du salarié remplacé"
                    : answers.endDate
                      ? `À une date précise : ${format(new Date(`${answers.endDate}T00:00:00`), "dd/MM/yyyy")}`
                      : "À une date précise"}
                </p>
              </>
            )}
          </div>
          <p className="text-base font-black">
            {kind === "cdd"
              ? "Nous allons générer un contrat à durée déterminée (CDD)"
              : "Nous allons générer un contrat à durée indéterminée (CDI)"}
          </p>
          <label className="flex items-start gap-3 rounded-2xl border-2 border-border bg-card p-4 text-sm font-semibold">
            <input type="checkbox" checked={certified} onChange={(e) => setCertified(e.target.checked)} className="mt-1 h-5 w-5" />
            <span>Je certifie que ces informations sont exactes</span>
          </label>
          {nav}
        </>
      )}
    </div>
  );
}
