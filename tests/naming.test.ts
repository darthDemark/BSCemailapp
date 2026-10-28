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
    expect(descriptionSegment(WINBACK_LINE)).toBe("EM5_2027_OE_IFP_WinBack_Email_5_More_Choice_(dynam");
  });

  it("hard-cuts the description at exactly 50 characters, mid-word", () => {
    const segment = descriptionSegment(WINBACK_LINE);
    expect(segment).toHaveLength(50);
    expect(segment.endsWith("(dynam")).toBe(true); // "(dynamic)" cut mid-word
  });

  it("produces the owner-confirmed WinBack SFMC name", () => {
    expect(deriveSfmcName(WINBACK_LINE)).toBe(
      "REF4113200_EM5_2027_OE_IFP_WinBack_Email_5_More_Choice_(dynam"
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

describe("ref in the middle of the job line (owner's note, 2026-10-20)", () => {
  it("moves the ref to the FRONT of the SFMC file name", () => {
    // His real job line shape: ref underscore-glued in the middle.
    const line =
      "5 EMAILS_Advantmed Risk Adjustment emails for ACA/MAD_REF3979650_A55529GMAD_0626";
    expect(extractRef(line)).toBe("REF3979650");
    expect(deriveSfmcName(line)).toBe(
      "REF3979650_5_EMAILS_Advantmed_Risk_Adjustment_emails_for_ACA/"
    );
  });
});
