import { describe, expect, it } from "vitest";
import {
  deriveSfmcName,
  descriptionSegment,
  extractRef,
} from "@/lib/naming";

const WINBACK_LINE =
  "EM5 2027 OE IFP WinBack Email 5 More Choice (dynamic) 12/22 - REF4113200 A57222IFP-EM5-(multi)_1026";

describe("naming transform (SPEC §3)", () => {
  it("extracts the ref number from the job line", () => {
    expect(extractRef(WINBACK_LINE)).toBe("REF4113200");
  });

  it("builds the description segment from the BEGINNING of the line", () => {
    expect(descriptionSegment(WINBACK_LINE)).toBe("EM5_2027_OE_IFP_WinB");
  });

  it("hard-cuts the description at exactly 20 characters, mid-word", () => {
    const segment = descriptionSegment(WINBACK_LINE);
    expect(segment).toHaveLength(20);
    expect(segment.endsWith("WinB")).toBe(true); // "WinBack" cut to "WinB"
  });

  it("produces the owner-confirmed WinBack SFMC name", () => {
    expect(deriveSfmcName(WINBACK_LINE)).toBe(
      "REF4113200_EM5_2027_OE_IFP_WinB"
    );
  });

  it("never adds an .html extension", () => {
    expect(deriveSfmcName(WINBACK_LINE)).not.toContain(".html");
  });

  it("returns empty string when the line has no ref number", () => {
    expect(deriveSfmcName("EM5 2027 OE IFP WinBack")).toBe("");
    expect(extractRef("no ref here")).toBe("");
  });
});
