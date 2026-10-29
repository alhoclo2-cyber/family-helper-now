import { test } from "node:test";
import assert from "node:assert/strict";
import { meetsContractNotice } from "./contractTerms";
import { meetsContractLeadTime, companionAnswerDeadline } from "./contractSignature";
const now = Date.parse("2026-10-29T08:00:00Z");
test("mission à 24 h : information courte affichée, parcours contrat ouvert", () => {
  const missionTs = now + 24 * 3_600_000;
  assert.equal(meetsContractNotice(missionTs, now), false); // information ContractShortNoticeInfo
  assert.equal(meetsContractLeadTime(missionTs, now), true); // ContractFlow ne bloque pas
});
test("ouverture refusée seulement si l'échéance compagnon dépasse le début", () => {
  assert.equal(meetsContractLeadTime(now + 7 * 3_600_000, now), false);
  assert.equal(companionAnswerDeadline(now), now + 8 * 3_600_000);
});
