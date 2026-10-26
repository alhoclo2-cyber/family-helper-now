import type { ContractDocument } from "./contractDocument";

/** A final signed document remains accessible after the employment relationship ends. */
export function hasFinalContractStatus(status: string): boolean {
  return ["in_force", "ended", "terminated", "closed"].includes(status);
}

export function readableFinalDocument(status: string, document: unknown): ContractDocument | null {
  return hasFinalContractStatus(status) ? document as ContractDocument | null : null;
}