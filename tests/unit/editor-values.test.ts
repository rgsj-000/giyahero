import { expect, it } from "vitest";
import {
  manilaDateTimeInput,
  manilaInputToIso,
  currencyScale,
} from "../../src/modules/catalog/editor-values";
it("round trips departure dates in Philippine time independently of device timezone", () => {
  expect(manilaDateTimeInput("2030-01-01T01:30:00Z")).toBe("2030-01-01T09:30");
  expect(manilaInputToIso("2030-01-01T09:30")).toBe("2030-01-01T01:30:00.000Z");
});
it("uses each currency minor-unit precision", () => {
  expect(currencyScale("P")).toBe(100);
  expect(currencyScale("PHP")).toBe(100);
  expect(currencyScale("JPY")).toBe(1);
  expect(currencyScale("KWD")).toBe(1000);
});
