import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Exercise the actual shared route function without importing the SSR/auth UI graph.
const source = readFileSync(new URL("../routes/index.tsx", import.meta.url), "utf8");
const functionSource = source.match(/function estimateMissionCost\([\s\S]*?\n\}/)?.[0];
assert.ok(functionSource, "Shared estimateMissionCost function must exist");
const feeSource = source.match(/const SERVICE_FEE = [^;]+;/)?.[0];
const sapSource = source.match(/const sapDeclarationActive = [^;]+;/)?.[0];
assert.ok(feeSource);
assert.ok(sapSource);
const js = ts.transpileModule(`${feeSource}\n${sapSource}\n${functionSource}`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;
const estimate = runInNewContext(`${js}\nestimateMissionCost`) as (
  rate: number, hours: number, sapActive?: boolean,
) => { salaireEtCotisations: number; avant: number; apres: number };

test("SAP inactive: 11.50 €/h × 2 h totals include the fixed fee once", () => {
  const result = estimate(11.5, 2, false);
  assert.equal(result.salaireEtCotisations, 38.76);
  assert.equal(result.avant, 44.76);
  assert.equal(result.apres, 25.38);
});

test("SAP active: 50% credit applies to the total including the fee", () => {
  const result = estimate(11.5, 2, true);
  assert.equal(result.salaireEtCotisations, 38.76);
  assert.equal(result.avant, 44.76);
  assert.equal(result.apres, 22.38);
});

test("Default SAP status stays inactive", () => {
  assert.equal(estimate(11.5, 2).apres, 25.38);
});

test("Service fee remains 6 € regardless of duration; return values are rounded to cents", () => {
  for (const hours of [1, 2, 4]) {
    const result = estimate(11.5, hours);
    assert.equal(Math.round((result.avant - result.salaireEtCotisations) * 100), 600);
    for (const value of Object.values(result)) {
      assert.equal(value, Math.round(value * 100) / 100);
    }
  }
});