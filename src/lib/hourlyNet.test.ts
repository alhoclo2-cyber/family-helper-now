import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Test the actual route predicate without importing the SSR/auth UI graph.
const source = readFileSync(new URL("../routes/index.tsx", import.meta.url), "utf8");
const constant = source.match(/const MIN_HOURLY_NET = [^;]+;/)?.[0];
const predicate = source.match(/function isValidHourlyNet\([\s\S]*?\n\}/)?.[0];
assert.ok(constant);
assert.ok(predicate);
const js = ts.transpileModule(`${constant}\n${predicate}`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;
const valid = runInNewContext(`${js}\nisValidHourlyNet`) as (value: unknown) => boolean;

test("Hourly net floor is inclusive at 10.84 €, rejecting amounts below it", () => {
  assert.equal(valid(10.84), true);
  for (const value of [10.83, 4, 0, -1]) assert.equal(valid(value), false);
});

test("Empty, null, nonnumeric and nonfinite salaries cannot be recorded", () => {
  for (const value of ["", null, undefined, "abc", NaN, Infinity, -Infinity]) {
    assert.equal(valid(value), false);
  }
});

test("No ceiling; recommended and demo hourly salaries remain valid", () => {
  for (const value of [11.5, 12, 12.5, 1000, Number.MAX_VALUE]) {
    assert.equal(valid(value), true);
  }
});