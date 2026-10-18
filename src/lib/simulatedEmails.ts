// E-mails SIMULÉS (localStorage uniquement, aucun envoi réel).
import { useEffect, useState } from "react";
import { formatDateFr } from "@/lib/accountState";

export type EmailKind =
  | "deletion_confirmation"
  | "deletion_reminder"
  | "exit_dossier"
  | "archive_code"
  | "archive_reminder_9"
  | "archive_reminder_11"
  | "pause_reminder_12"
  | "mission_pre_end"
  | "mission_end_reminder"
  | "mission_reminder_24"
  | "mission_auto_validated"
  | "mission_problem_other"
  | "mission_problem_confirmation"
  | "mission_problem_solelia"
  | "mission_incident_solelia"
  | "mission_incident_confirmation"
  | "companion_refused"
  | "family_acceptance_notification"
  | "mission_auto_cancelled";

export type SimulatedEmail = {
  id: string;
  to: string;
  kind: EmailKind;
  subject: string;
  body: string;
  createdAt: number;
  linkLabel?: string;
  linkTo?: string;
};

const KEY = "solelia-simulated-emails";
export const EMAILS_EVT = "solelia-simulated-emails-changed";
const SIGN = "\n\nL'équipe Solélia Accompagnement";

export function readEmails(): SimulatedEmail[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as SimulatedEmail[];
  } catch {
    return [];
  }
}
function writeEmails(list: SimulatedEmail[]) {
  localStorage.setItem(KEY, JSON.stringify(list.slice(-50)));
  window.dispatchEvent(new Event(EMAILS_EVT));
}
export function clearEmails() {
  writeEmails([]);
}

type Params = {
  date?: number;
  code?: string;
  hours?: number;
  missionDate?: string;
  role?: "family" | "companion";
  reason?: string;
  detail?: string;
  companionName?: string;
  need?: string;
};

const OPEN = { linkLabel: "Ouvrir mon espace", linkTo: "/" };
const fmtHours = (h?: number) => (h == null ? "" : String(h).replace(".", ","));

export function build(kind: EmailKind, p: Params): { subject: string; body: string; linkLabel?: string; linkTo?: string } {
  const d = formatDateFr(p.date);
  const h = fmtHours(p.hours);
  const md = p.missionDate ?? "";
  switch (kind) {
    case "family_acceptance_notification":
      return {
        subject: "Un compagnon a accepté votre demande",
        body: "Un compagnon a accepté votre demande, merci de répondre dans les 5 min.",
        ...OPEN,
      };
    case "mission_pre_end":
      return {
        subject: "Votre mission se termine dans 15 minutes",
        body:
          p.role === "companion"
            ? "Votre mission se termine dans 15 minutes. Avant de quitter le domicile, pensez à la valider avec le bouton « Mission effectuée »."
            : "Votre mission se termine dans 15 minutes. Avant que votre compagnon ne quitte votre domicile, pensez à la valider avec le bouton « Mission terminée ».",
        ...OPEN,
      };
    case "mission_end_reminder":
      return {
        subject: "Pensez à valider votre mission",
        body: `Les ${h} h réservées pour la mission du ${md} sont écoulées. Si ce n'est pas encore fait, merci de la valider : elle sera validée automatiquement dans 48 h.`,
        ...OPEN,
      };
    case "mission_reminder_24":
      return {
        subject: "Rappel : votre mission est à valider",
        body: `Il reste 24 h pour valider la mission du ${md}. Sans validation de votre part, elle sera validée automatiquement dans 24 h.`,
        ...OPEN,
      };
    case "mission_auto_validated":
      return {
        subject: "Votre mission a été validée automatiquement",
        body: `Faute de validation dans les 48 h, la mission du ${md} a été validée automatiquement. ${h} h seront déclarées, soit le nombre d'heures réservées.`,
        ...OPEN,
      };
    case "mission_problem_other":
      return {
        subject: "Un problème a été signalé sur votre mission",
        body: `La mission du ${md} a été signalée comme non effectuée. Raison indiquée : « ${p.reason ?? ""} ». Les heures de cette mission ne seront pas déclarées. Pour toute question, écrivez à solelia.accompagnement@gmail.com.`,
        ...OPEN,
      };
    case "mission_problem_confirmation":
      return {
        subject: "Votre signalement a bien été transmis",
        body: `Nous avons bien reçu votre signalement pour la mission du ${md}. Les heures de cette mission ne seront pas déclarées par Solélia Accompagnement.`,
        ...OPEN,
      };
    case "mission_problem_solelia":
      return {
        subject: "Mission non effectuée signalée",
        body: `Mission du ${md}, signalée par ${p.role === "companion" ? "Compagnon" : "Famille"}. Raison : « ${p.reason ?? ""} ». Les heures ne sont pas déclarées.`,
        ...OPEN,
      };
    case "mission_incident_solelia":
      return {
        subject: "Incident signalé pendant une mission",
        body: `Signalement de : ${p.role === "companion" ? "Compagnon" : "Famille"}. Motif : « ${p.reason ?? ""} ».${p.detail ? ` Détail : « ${p.detail} ».` : ""} Mission du ${md}, compagnon : ${p.companionName ?? "non renseigné"}. Ce signalement est une trace : il ne clôture pas la mission.`,
        ...OPEN,
      };
    case "mission_incident_confirmation":
      return {
        subject: "Votre signalement d'incident a bien été enregistré",
        body: `Nous avons bien enregistré votre signalement pour la mission du ${md} (motif : « ${p.reason ?? ""} »). Solélia en garde une trace, mais ne tranche pas les litiges : la suite se décide directement entre le particulier et le compagnon.`,
        ...OPEN,
      };
    case "companion_refused":
      return {
        subject: "Votre proposition n'a pas été retenue",
        body: `Le particulier n'a pas retenu votre proposition pour la mission « ${p.need ?? ""} » : ${p.reason ?? ""}.`,
        ...OPEN,
      };
    case "mission_auto_cancelled":
      return {
        subject: "Mission annulée automatiquement",
        body:
          p.role === "companion"
            ? `La mission « ${p.need ?? ""} » a été annulée : le particulier n'a pas répondu à temps. Vous pouvez de nouveau accepter d'autres missions.`
            : `Vous n'avez pas répondu dans les 5 minutes qui suivent l'acceptation du compagnon pour la mission « ${p.need ?? ""} ». Votre demande a été annulée, sans aucun frais. Vous pouvez réserver une nouvelle mission.`,
        ...OPEN,
      };
    case "deletion_confirmation":
      return {
        subject: "Votre demande de suppression de compte",
        body: `Nous avons bien reçu votre demande. Votre compte sera supprimé le ${d}. Vous pouvez annuler à tout moment avant cette date.`,
        linkLabel: "Annuler la suppression",
        linkTo: "/compte/suppression",
      };
    case "deletion_reminder":
      return {
        subject: "Votre compte sera bientôt supprimé",
        body: `Votre compte sera supprimé le ${d}. Si vous avez changé d'avis, vous pouvez encore annuler.`,
        linkLabel: "Annuler la suppression",
        linkTo: "/compte/suppression",
      };
    case "exit_dossier":
      return {
        subject: "Votre compte est supprimé : votre dossier de sortie",
        body: `Votre compte a été supprimé. Vos documents importants sont conservés dans vos archives, que vous pouvez consulter jusqu'au ${d}.`,
        linkLabel: "Accéder à mes archives",
        linkTo: "/archives",
      };
    case "archive_code":
      return {
        subject: "Votre code d'accès à vos archives",
        body: `Votre code est ${p.code}. Il est valable 10 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.`,
      };
    case "archive_reminder_9":
    case "archive_reminder_11":
      return {
        subject: "Vos archives ne seront bientôt plus accessibles en ligne",
        body: `Vous pouvez consulter et télécharger vos documents jusqu'au ${d}. Pensez à les enregistrer. Après cette date, vous pourrez en demander une copie en écrivant à solelia.accompagnement@gmail.com.`,
        linkLabel: "Accéder à mes archives",
        linkTo: "/archives",
      };
    case "pause_reminder_12":
      return {
        subject: "Votre compte est en pause depuis un an",
        body: "Souhaitez-vous le réactiver ou le supprimer ?",
        linkLabel: "Gérer mon compte",
        linkTo: "/compte/pause",
      };
  }
}

export function sendSimulatedEmail(kind: EmailKind, to: string | undefined, params: Params = {}) {
  if (typeof window === "undefined") return;
  const b = build(kind, params);
  const mail: SimulatedEmail = {
    id: crypto.randomUUID(),
    to: to ?? "",
    kind,
    subject: b.subject,
    body: b.body + SIGN,
    createdAt: Date.now(),
    linkLabel: b.linkLabel,
    linkTo: b.linkTo,
  };
  writeEmails([...readEmails(), mail]);
}

export function useSimulatedEmails() {
  const [list, setList] = useState<SimulatedEmail[]>([]);
  useEffect(() => {
    const sync = () => setList(readEmails());
    sync();
    window.addEventListener(EMAILS_EVT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EMAILS_EVT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return list;
}
