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

  it("ONLY a comma separates keycodes (owner's ruling, 2026-10-20)", () => {
    // From his live screenshot: this is TWO keycodes, not three.
    expect(parseKeycodes("MAPD IHV,GMAPD-CCPOA,")).toEqual([
      "MAPD IHV",
      "GMAPD-CCPOA",
    ]);
    // Spaces, hyphens, dashes and em dashes stay inside the keycode.
    expect(parseKeycodes("SAC SD")).toEqual(["SAC SD"]);
    expect(parseKeycodes("A-B, C—D, E – F")).toEqual(["A-B", "C—D", "E – F"]);
    expect(parseKeycodes("SAC;SD")).toEqual(["SAC;SD"]);
    expect(parseKeycodes("SAC\nSD")).toEqual(["SAC\nSD"]);
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
