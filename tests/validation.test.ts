/**
 * Vital-field FORMAT validation (owner's ruling, 2026-10-20):
 * gibberish in a vital field must throw "isn't recognized" — the
 * formats are the ones from the WinBack build.
 */
import { describe, expect, it } from "vitest";
import {
  hasRecognizableRef,
  looksLikeANumber,
  looksLikeReadableText,
  validateVitalFields,
} from "@/lib/validation";

const WINBACK_LINE =
  "EM5 2027 OE IFP WinBack Email 5 More Choice (dynamic) 12/22 - REF4113200 A57222IFP-EM5-(multi)_1026";

describe("ref number recognition", () => {
  it("recognizes REF + digits inside the job line", () => {
    expect(hasRecognizableRef(WINBACK_LINE)).toBe(true);
    expect(hasRecognizableRef("REF4113200")).toBe(true);
  });
  it("rejects gibberish and REF without digits", () => {
    expect(hasRecognizableRef("asdf qwer zxcv")).toBe(false);
    expect(hasRecognizableRef("REF only, no digits")).toBe(false);
    expect(hasRecognizableRef("")).toBe(false);
  });
});

describe("A number recognition", () => {
  it("accepts the WinBack format and close relatives", () => {
    expect(looksLikeANumber("A57222IFP-EM5-(multi)_1026")).toBe(true);
    expect(looksLikeANumber("A57222IFP-EM5_1026")).toBe(true);
    expect(looksLikeANumber("A12345ABC-XY9_2027")).toBe(true);
  });
  it("rejects gibberish", () => {
    expect(looksLikeANumber("asdfghjkl")).toBe(false);
    expect(looksLikeANumber("12345")).toBe(false);
    expect(looksLikeANumber("A57222")).toBe(false);
    expect(looksLikeANumber("hello world")).toBe(false);
    expect(looksLikeANumber("")).toBe(false);
  });
});

describe("readable text (subject / preheader)", () => {
  it("accepts the WinBack subject and preheader", () => {
    expect(looksLikeReadableText("You have more choice in your coverage")).toBe(true);
    expect(looksLikeReadableText("See what is new for your 2027 plan")).toBe(true);
    expect(looksLikeReadableText("Your 2027 open enrollment starts soon")).toBe(true);
  });
  it("rejects gibberish", () => {
    expect(looksLikeReadableText("asdf qwer zxcv")).toBe(false);
    expect(looksLikeReadableText("sdfg hjkl vbnm")).toBe(false);
    expect(looksLikeReadableText("blahblahblah")).toBe(false);
    expect(looksLikeReadableText("xkcd")).toBe(false);
    expect(looksLikeReadableText("1234 5678 9012")).toBe(false);
  });
});

describe("validateVitalFields", () => {
  const good = {
    jobNumber: WINBACK_LINE,
    aNumber: "A57222IFP-EM5-(multi)_1026",
    isDynamic: true,
    perKeycodeA: { SAC: "A57222IFP-EM5-(multi)_1026" },
    subject: "You have more choice in your coverage",
    preheader: "See what is new for your 2027 plan",
    isMulti: false,
    keycodes: ["SAC"],
    perKeycode: {},
  };
  it("passes the WinBack values clean", () => {
    expect(validateVitalFields(good)).toEqual({});
  });
  it("names what's unrecognized, field by field", () => {
    const errs = validateVitalFields({
      ...good,
      jobNumber: "random words with no reference",
      perKeycodeA: { SAC: "gibberish" },
      subject: "asdf qwer zxcv",
    });
    expect(errs.jobNumber).toContain("isn't recognized");
    expect(errs["aNumber:SAC"]).toContain("isn't recognized");
    expect(errs.subject).toContain("isn't recognized");
    expect(errs.preheader).toBeUndefined();
  });

  it("dynamic: every keycode needs its own A number", () => {
    const errs = validateVitalFields({
      ...good,
      keycodes: ["SAC", "SD"],
      perKeycodeA: { SAC: "A57222IFP-EM5-(multi)_1026" },
    });
    expect(errs["aNumber:SD"]).toContain("missing");
  });

  it("static: the single A number is format-checked", () => {
    const errs = validateVitalFields({
      ...good,
      isDynamic: false,
      keycodes: [],
      aNumber: "nope",
    });
    expect(errs.aNumber).toContain("isn't recognized");
  });
});
