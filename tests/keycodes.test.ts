import { describe, expect, it } from "vitest";
import { parseKeycodes } from "@/lib/keycodes";

describe("keycode parsing (SPEC §4.1)", () => {
  it("parses the WinBack example in order", () => {
    expect(parseKeycodes("SAC, SD, LOC_PL")).toEqual(["SAC", "SD", "LOC_PL"]);
  });

  it("preserves case and internal underscores", () => {
    expect(parseKeycodes("loc_pl, Sac")).toEqual(["loc_pl", "Sac"]);
    expect(parseKeycodes("LOC_PL")).toEqual(["LOC_PL"]);
  });

  it("accepts newlines, semicolons and bare spaces as separators", () => {
    expect(parseKeycodes("SAC\nSD;LOC_PL")).toEqual(["SAC", "SD", "LOC_PL"]);
    expect(parseKeycodes("SAC SD")).toEqual(["SAC", "SD"]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseKeycodes("")).toEqual([]);
    expect(parseKeycodes(" , ")).toEqual([]);
  });

  it("drops exact duplicates, keeping first-occurrence order", () => {
    expect(parseKeycodes("SAC, SD, SAC, LOC_PL, SD")).toEqual([
      "SAC",
      "SD",
      "LOC_PL",
    ]);
  });
});
