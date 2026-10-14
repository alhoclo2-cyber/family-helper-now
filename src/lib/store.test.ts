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
import { store as _s } from "./store";
import { test as _t, expect as _e } from "vitest";
_t("createRequest never stores a duration below 1 h", () => {
  const id = _s.createRequest({ need: "Pharmacie", address: "1 rue A, Paris", phone: "0600000000", durationHours: 0 });
  _e(_s.getState().requests.find((r) => r.id === id)?.durationHours).toBe(1);
});
