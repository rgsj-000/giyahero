import { expect, it } from "vitest";
import { assertDemoTarget } from "../../scripts/demo/target.mjs";

it("refuses seeding any project other than the designated GHDB testing project", () => {
  for (const ref of [
    "",
    "production",
    "psdrzqbqsvpkjscwirog.evil",
    "abcdefghijklmnopqrst",
  ]) {
    expect(() => assertDemoTarget(ref)).toThrow("GHDB testing project");
  }
  expect(() => assertDemoTarget("psdrzqbqsvpkjscwirog")).not.toThrow();
});
