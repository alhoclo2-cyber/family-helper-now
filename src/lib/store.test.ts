import { describe, expect, test } from "bun:test";
import { store } from "./store";

describe("Isolation des demandes d'exemple", () => {
  for (const id of ["seed-1", "seed-2"]) {
    test(`${id} est exclusivement une mission démo`, () => {
      const request = store.getState().requests.find((r) => r.id === id);
      expect(request?.demo).toBe(true);
      const outsideTest = store.getState().requests.filter((r) => !r.demo);
      expect(outsideTest.some((r) => r.id === id)).toBe(false);
    });
  }
});