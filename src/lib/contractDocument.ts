import { format } from "date-fns";
import type { ContractAnswers, ContractKind } from "./contractDecision";
import { PUBLIC_HOLIDAYS, WEEKDAYS, WEEKLY_HOURS, fixedWeeklyMinutes, formatWeekly, type ContractTerms } from "./contractTerms";
import { emploiFor, isEmploiPending } from "./contractEmploi";
import { grossHourlyFromNet } from "./salary";

/* ------------------------------------------------------------------
   Document du contrat de travail (fonction pure, sans React).
   Calqué sur les modèles URSSAF de septembre 2026 (NAT 6998).
   Rappelée côté serveur à la signature. Aucune formule de signature :
   elle est ajoutée par l'écran.
------------------------------------------------------------------- */

export const CONTRACT_DOCUMENT_VERSION = 1;
export const IDCC = "3239";

export type PartyIdentity = {
  birthName: string;
  lastName: string;
  firstName: string;
  address: string;
  phone: string;
  email: string;
};
export type EmployerIdentity = PartyIdentity & { cesuNumber: string };
export type CompanionIdentity = PartyIdentity & { nir: string; cesuActive: boolean; demo?: boolean };

export type EditTarget = { q: 1 } | { q: 2; step: 1 | 2 | 3 | 4 | 5 } | { q: "booking" };

export type ContractSection = {
  number: number;
  key: string;
  title: string;
  paragraphs: string[];
  edit?: EditTarget;
};

export type ContractField = { label: string; value: string };

export type ContractDocument = {
  version: number;
  kind: ContractKind;
  title: string;
  idcc: string;
  employer: ContractField[];
  companion: ContractField[];
  sections: ContractSection[];
  /** Vrai tant qu'un emploi-repère vaut « à confirmer ». */
  emploiPending: boolean;
};

export type BuildContractInput = {
  kind: ContractKind;
  answers: ContractAnswers;
  terms: ContractTerms;
  employer: EmployerIdentity;
  companion: CompanionIdentity;
  mission: { address: string; needs: string[] };
  salary: { netHourly: number };
};

const fmtDay = (v?: string) => (v ? format(new Date(`${v}T00:00:00`), "dd/MM/yyyy") : "…");
const euro = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;
const trialText = (d: number) => (d === 0 ? "Aucune période d'essai n'est prévue." : `Période d'essai : ${d} jour${d > 1 ? "s" : ""} calendaires.`);
const unitText = { days: "jour(s)", weeks: "semaine(s)", months: "mois" } as const;

export const PAY_CESU_ACTIVE = "Le salaire est versé au salarié par l'URSSAF (Cesu+), à partir des déclarations établies pour l'employeur.";
export const PAY_CESU_PENDING =
  "Tant que le salarié n'a pas informé l'employeur et Solélia Accompagnement de l'obtention de son numéro Cesu, l'employeur règle directement le salaire au salarié. Des acomptes peuvent être versés en cours de mois, notamment à l'issue de chaque mission, et le salaire du mois est soldé au plus tard le 5 du mois suivant. À compter de cette information, le salaire est versé par l'URSSAF (Cesu+).";

export function buildContractDocument(input: BuildContractInput): ContractDocument {
  const { kind, answers, terms, employer, companion, mission, salary } = input;
  const isCdd = kind === "cdd";
  const emplois = Array.from(new Set(mission.needs)).map((n) => ({ need: n, ...emploiFor(n) }));
  const rest = [...terms.weeklyRestDays].sort((a, b) => a - b).map((d) => WEEKDAYS[d - 1]);
  const holidays = PUBLIC_HOLIDAYS.filter((h) => terms.workedHolidays.includes(h.key)).map((h) => h.label);
  const gross = grossHourlyFromNet(salary.netHourly);

  const dateSection: string[] = isCdd
    ? [
        "Contrat à durée déterminée.",
        `Motif : remplacement de ${answers.replaced?.firstName ?? ""} ${answers.replaced?.lastName ?? ""}, ${answers.replaced?.role ?? ""}.`,
        `Date de début : ${fmtDay(terms.startDate)}.`,
        answers.endMode === "return"
          ? "Date de fin : au retour du salarié remplacé."
          : `Date de fin : ${fmtDay(answers.endDate)}.`,
        ...(answers.endMode === "return" && terms.minDuration
          ? [`Durée minimale : ${terms.minDuration.value} ${unitText[terms.minDuration.unit]}.`]
          : []),
        trialText(terms.trialDays),
      ]
    : [
        "Contrat à durée indéterminée.",
        `Date d'embauche : ${fmtDay(terms.startDate)}.`,
        trialText(terms.trialDays),
      ];

  const organization =
    terms.organization.mode === "irregular"
      ? [
          `Durée de travail irrégulière, de ${WEEKLY_HOURS.min} à ${WEEKLY_HOURS.max} heures par semaine.`,
          "Le planning est généré par la plateforme Solélia Accompagnement à partir des missions réservées. Il est envoyé par e-mail au salarié et consultable par les deux parties dans Mes contrats.",
          "Délai de prévenance : 5 jours calendaires.",
        ]
      : [
          `Planning défini : ${formatWeekly(fixedWeeklyMinutes(terms.organization.days))} par semaine.`,
          ...terms.organization.days.map((d) => `${WEEKDAYS[d.weekday - 1]} : de ${d.start} à ${d.end}.`),
          "Toute modification du planning est communiquée au salarié au moins 5 jours calendaires à l'avance.",
        ];

  const sections: ContractSection[] = [
    {
      number: 1, key: "engagement", title: "Engagement",
      paragraphs: [
        "Le présent contrat est régi par la convention collective nationale du secteur des particuliers employeurs et de l'emploi à domicile (IDCC 3239).",
        "Le salarié bénéficie de la retraite complémentaire et de la prévoyance auprès de l'Ircem.",
      ],
    },
    { number: 2, key: "date", title: "Date d'effet et durée du contrat", paragraphs: dateSection, edit: { q: 2, step: 1 } },
    {
      number: 3, key: "lieu", title: "Lieu de travail",
      paragraphs: [
        `Adresse : ${mission.address}.`,
        "Le salarié peut être amené à effectuer des déplacements ponctuels pour les besoins de l'emploi (courses, accompagnement).",
      ],
      edit: { q: "booking" },
    },
    {
      number: 4, key: "emploi", title: "Nature de l'emploi",
      paragraphs: emplois.map((e) => `${e.need} : ${e.intitule} (classification : ${e.classification}).`),
      edit: { q: "booking" },
    },
    { number: 5, key: "duree", title: "Durée du travail et horaires", paragraphs: organization, edit: { q: 2, step: 2 } },
    {
      number: 6, key: "presence", title: "Présence responsable et présence de nuit",
      paragraphs: ["Sans objet : aucune mission de nuit (6 h à 21 h), aucune présence responsable."],
    },
    {
      number: 7, key: "repos", title: "Repos hebdomadaire",
      paragraphs: [
        `Jour${rest.length > 1 ? "s" : ""} de repos hebdomadaire : ${rest.join(", ") || "…"}.`,
        "Le salarié bénéficie d'un repos quotidien de 11 heures consécutives.",
        "Le repos hebdomadaire n'est pas travaillé.",
      ],
      edit: { q: 2, step: 3 },
    },
    {
      number: 8, key: "feries", title: "Jours fériés",
      paragraphs: [
        terms.mayFirst === "worked"
          ? "Le 1er mai est travaillé : les heures sont majorées de 100 %."
          : "Le 1er mai est chômé.",
        holidays.length
          ? `Jours fériés ordinaires travaillés : ${holidays.join(", ")} ; les heures sont majorées de 10 %.`
          : "Aucun jour férié ordinaire n'est travaillé.",
        "Le chômage d'un jour férié tombant un jour habituellement travaillé n'entraîne aucune réduction de la rémunération.",
      ],
      edit: { q: 2, step: 3 },
    },
    {
      number: 9, key: "remuneration", title: "Rémunération",
      paragraphs: [
        "Cas n° 1 : salaire net majoré de 10 % au titre des congés payés.",
        `Salaire horaire net de base : ${euro(salary.netHourly)}.`,
        `Salaire horaire brut (estimation) : ${euro(gross)}.`,
        "Heures supplémentaires : rémunérées, majorées de 25 % de la 41e à la 48e heure puis de 50 %.",
        "Présence de nuit : sans objet.",
        "Prestations en nature (repas, logement) : sans objet.",
        "Conduite de véhicule et indemnités kilométriques : sans objet.",
        "Transport en commun : prise en charge de l'abonnement sur présentation des justificatifs, conformément à la convention collective.",
        companion.cesuActive ? PAY_CESU_ACTIVE : PAY_CESU_PENDING,
      ],
      edit: { q: "booking" },
    },
    {
      number: 10, key: "conges", title: "Congés payés",
      paragraphs: [
        "Les congés payés annuels doivent être pris.",
        `L'employeur fixe les dates de congés en respectant un délai de prévenance de ${terms.leaveNoticeMonths} mois.`,
      ],
      edit: { q: 2, step: 4 },
    },
    {
      number: 11, key: "confidentialite", title: "Confidentialité",
      paragraphs: [
        "Le salarié est tenu à une obligation de discrétion sur tout ce qu'il voit et entend au domicile de l'employeur, pendant et après l'exécution du contrat.",
      ],
    },
    {
      number: 12, key: "particulieres", title: "Conditions particulières",
      paragraphs: [
        ...(terms.specialConditions?.trim() ? [terms.specialConditions.trim()] : []),
        "a) Le salarié peut refuser ce contrat à tout moment avant de l'avoir accepté, sans justification ni pénalité.",
        "b) Toute mission est réservée au moins 5 jours avant son début.",
        "c) Le salarié s'engage à informer sans délai l'employeur et Solélia Accompagnement dès qu'il obtient son numéro Cesu.",
      ],
      edit: { q: 2, step: 5 },
    },
  ];

  const party = (p: PartyIdentity): ContractField[] => [
    { label: "Nom de naissance", value: p.birthName },
    { label: "Nom d'usage", value: p.lastName },
    { label: "Prénom", value: p.firstName },
    { label: "Adresse", value: p.address },
    { label: "Téléphone", value: p.phone },
    { label: "E-mail", value: p.email },
  ];

  return {
    version: CONTRACT_DOCUMENT_VERSION,
    kind,
    title: isCdd ? "Contrat de travail à durée déterminée" : "Contrat de travail à durée indéterminée",
    idcc: IDCC,
    employer: [...party(employer), { label: "N° CESU", value: employer.cesuNumber }],
    companion: [
      ...(companion.demo ? [{ label: "Avertissement", value: "[DONNÉES DE DÉMONSTRATION]" }] : []),
      ...party(companion),
      { label: "N° de sécurité sociale", value: companion.nir },
    ],
    sections,
    emploiPending: emplois.some(isEmploiPending),
  };
}

/** Sérialisation stable (clés triées) pour l'empreinte du document. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).filter((k) => obj[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}
