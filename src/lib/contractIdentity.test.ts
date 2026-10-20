import { describe, expect, it } from "vitest";
import { missingContractIdentity } from "./contractIdentity";

const complete = { birth_name: "Martin", address_line: "10 rue des Fleurs", postal_code: "75001", city: "Paris" };
describe("Identité requise uniquement pour un futur contrat", () => {
  it("signale le nom de naissance manquant", () => {
    expect(missingContractIdentity({ ...complete, birth_name: " " })).toEqual(["nom de naissance"]);
  });
  it("signale la rue manquante", () => {
    expect(missingContractIdentity({ ...complete, address_line: "" })).toEqual(["adresse"]);
  });
  it("signale le code postal manquant", () => {
    expect(missingContractIdentity({ ...complete, postal_code: null })).toEqual(["code postal"]);
  });
  it("signale la ville manquante", () => {
    expect(missingContractIdentity({ ...complete, city: " " })).toEqual(["ville"]);
  });
  it("accepte une identité complète", () => {
    expect(missingContractIdentity(complete)).toEqual([]);
  });
  it("signale les quatre données pour un profil absent", () => {
    expect(missingContractIdentity(null)).toEqual(["nom de naissance", "adresse", "code postal", "ville"]);
  });
});