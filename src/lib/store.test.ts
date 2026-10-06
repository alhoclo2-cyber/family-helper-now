import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { store } from "./store";

describe("Isolation des demandes d'exemple", () => {
  for (const id of ["seed-1", "seed-2"]) {
    test(`${id} est exclusivement une mission démo`, () => {
      const request = store.getState().requests.find((r) => r.id === id);
      assert.equal(request?.demo, true);
      const outsideTest = store.getState().requests.filter((r) => !r.demo);
      assert.equal(outsideTest.some((r) => r.id === id), false);
    });
  }
});