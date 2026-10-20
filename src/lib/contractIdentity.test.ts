import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("./contractIdentity.ts", import.meta.url), "utf8");
const definition = source.slice(source.indexOf("export type ContractIdentity"), source.indexOf("export const contractIdentityKey"));
const js = ts.transpileModule(definition.replaceAll("export ", ""), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;
const missing = runInNewContext(`${js}\nmissingContractIdentity`) as (profile: unknown) => string[];
const missingContractIdentity = (profile: unknown) => Array.from(missing(profile));

const complete = { birth_name: "Martin", address_line: "10 rue des Fleurs", postal_code: "75001", city: "Paris" };
describe("Identité requise uniquement pour un futur contrat", () => {
  it("signale le nom de naissance manquant", () => {
    assert.deepEqual(missingContractIdentity({ ...complete, birth_name: " " }), ["nom de naissance"]);
  });
  it("signale la rue manquante", () => {
    assert.deepEqual(missingContractIdentity({ ...complete, address_line: "" }), ["adresse"]);
  });
  it("signale le code postal manquant", () => {
    assert.deepEqual(missingContractIdentity({ ...complete, postal_code: null }), ["code postal"]);
  });
  it("signale la ville manquante", () => {
    assert.deepEqual(missingContractIdentity({ ...complete, city: " " }), ["ville"]);
  });
  it("accepte une identité complète", () => {
    assert.deepEqual(missingContractIdentity(complete), []);
  });
  it("signale les quatre données pour un profil absent", () => {
    assert.deepEqual(missingContractIdentity(null), ["nom de naissance", "adresse", "code postal", "ville"]);
  });
});