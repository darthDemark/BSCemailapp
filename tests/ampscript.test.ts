import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generateAmpscript, type BuildInputs } from "@/lib/ampscript";

const WINBACK: BuildInputs = {
  buildType: "dynamic",
  variant: "single",
  jobNumber:
    "EM5 2027 OE IFP WinBack Email 5 More Choice (dynamic) 12/22 - REF4113200 A57222IFP-EM5-(multi)_1026",
  keycodesRaw: "SAC, SD, LOC_PL",
  aNumber: "A57222IFP-EM5-(multi)_1026",
  // Dynamic: a DIFFERENT A number per keycode (owner's ruling,
  // 2026-10-20 — supersedes the single-A golden example on this point).
  perKeycodeA: {
    SAC: "A57222IFP-EM5-(multi)_1026",
    SD: "A58333IFP-EM5-(multi)_1026",
    LOC_PL: "A59444IFP-EM5-(multi)_1026",
  },
  complianceNumber: "BSC-COMP-2026-001",
  subject: "You have more choice in your coverage",
  preheader: "See what is new for your 2027 plan",
  perKeycode: {},
};

const golden = readFileSync(
  path.resolve(process.cwd(), "tests/fixtures/golden-dynamic.html"),
  "utf8"
);

/** Remove the commented send-log block (the one place "" may remain). */
function outsideSendLog(output: string): string {
  return output.replace(/<!--[\s\S]*?-->/g, "");
}

describe("dynamic generation vs the golden example", () => {
  const out = generateAmpscript(WINBACK);

  it("matches the golden file except each branch carries its OWN A number", () => {
    // The golden example (approved 2026-10-19) used one A number in all
    // branches; the 2026-10-20 ruling supersedes that single point.
    // The fixture's content keys use ref + "_" + keycode + type only
    // (owner's correction, 2026-10-30 - the description segment stays
    // in the SFMC file name, never in a key). Everything else must
    // still match byte for byte.
    // Rebuild expected by replacing the A occurrences in branch order.
    const parts = golden.split('SET @aNumber = "A57222IFP-EM5-(multi)_1026"');
    expect(parts).toHaveLength(4); // 3 branches => 4 segments
    const expected =
      parts[0] +
      'SET @aNumber = "A57222IFP-EM5-(multi)_1026"' +
      parts[1] +
      'SET @aNumber = "A58333IFP-EM5-(multi)_1026"' +
      parts[2] +
      'SET @aNumber = "A59444IFP-EM5-(multi)_1026"' +
      parts[3];
    expect(out).toBe(expected);
  });

  it("gives every branch a different A number, its own keycode's", () => {
    expect(out).toContain('SET @aNumber = "A57222IFP-EM5-(multi)_1026"');
    expect(out).toContain('SET @aNumber = "A58333IFP-EM5-(multi)_1026"');
    expect(out).toContain('SET @aNumber = "A59444IFP-EM5-(multi)_1026"');
  });

  it("builds one branch per keycode (IF + ELSEIF + ELSEIF + ENDIF)", () => {
    expect(out.match(/^IF @MKT_LOB/gm)).toHaveLength(1);
    expect(out.match(/^ELSEIF @MKT_LOB/gm)).toHaveLength(2);
    expect(out).toContain('IF @MKT_LOB == "SAC" THEN');
    expect(out).toContain('ELSEIF @MKT_LOB == "SD" THEN');
    expect(out).toContain('ELSEIF @MKT_LOB == "LOC_PL" THEN');
    expect(out).toContain("ENDIF");
  });

  it("emits 12 ContentBlockByKey lines (4 per branch × 3 branches)", () => {
    expect(out.match(/ContentBlockByKey\(/g)).toHaveLength(12);
  });

  it("sets @refNumber to the PLAIN ref number only", () => {
    expect(out).toContain('SET @refNumber = "REF4113200"');
    expect(out).not.toContain("@refNumber = \"REF4113200_");
  });

  it("sets @MKT_LOB to the first keycode and derives @utmContent from it", () => {
    expect(out).toContain('SET @MKT_LOB = "SAC"');
    expect(out).toContain("SET @utmContent = @MKT_LOB");
  });

  it("fills each branch's @version with that branch's own keycode", () => {
    expect(out).toContain('SET @version = "SAC"');
    expect(out).toContain('SET @version = "SD"');
    expect(out).toContain('SET @version = "LOC_PL"');
  });

  it("builds content keys as baseName+keycode+type with NO underscores between components", () => {
    expect(out).toContain(
      'ContentBlockByKey("REF4113200_SACMarquee")'
    );
    expect(out).toContain(
      'ContentBlockByKey("REF4113200_SDcontentONE")'
    );
    expect(out).toContain(
      'ContentBlockByKey("REF4113200_LOC_PLcontentTWO")'
    );
  });

  it("uses the same no-keycode Disclaimer key in every branch", () => {
    const matches = out.match(
      /ContentBlockByKey\("REF4113200_Disclaimer"\)/g
    );
    expect(matches).toHaveLength(3);
  });

  it("leaves zero empty strings outside the send-log comment", () => {
    expect(outsideSendLog(out)).not.toContain('""');
    // …and the send-log block itself is preserved untouched:
    expect(out).toContain('SET @TriggeredSendExternalKey = ""');
  });

  it("puts no blank line between a branch header and its content SETs", () => {
    expect(out).toContain('THEN \nSET @version');
  });
});

describe("pruning (SPEC §7 — no empty strings)", () => {
  it("removes an unfilled field's line entirely (dynamic subject)", () => {
    const out = generateAmpscript({ ...WINBACK, subject: "" });
    expect(out).not.toContain("SET @subject");
    expect(outsideSendLog(out)).not.toContain('""');
  });

  it("removes an unfilled A number line from every branch", () => {
    const out = generateAmpscript({ ...WINBACK, perKeycodeA: {} });
    expect(out).not.toContain("SET @aNumber");
    expect(outsideSendLog(out)).not.toContain('""');
  });

  it("no compliance number: build proceeds, compliance simply not mentioned (owner's rule, 2026-10-19)", () => {
    const dyn = generateAmpscript({ ...WINBACK, complianceNumber: "" });
    expect(dyn).toContain('SET @refNumber = "REF4113200"'); // build still generated
    expect(dyn).not.toContain("complianceNumber");
    expect(outsideSendLog(dyn)).not.toContain('""');
    const stat = generateAmpscript({
      ...WINBACK,
      buildType: "static",
      keycodesRaw: "",
      complianceNumber: "",
    });
    expect(stat).not.toContain("complianceNumber");
    expect(outsideSendLog(stat)).not.toContain('""');
  });

  it("drops the whole conditional section when there are no keycodes", () => {
    const out = generateAmpscript({ ...WINBACK, keycodesRaw: "" });
    expect(out).not.toContain("ELSEIF");
    expect(out).not.toContain("/*conditional statements*/");
    expect(outsideSendLog(out)).not.toContain('""');
  });
});

describe("static generation", () => {
  const out = generateAmpscript({
    ...WINBACK,
    buildType: "static",
    variant: "single",
    keycodesRaw: "",
  });

  it("fills ref, subject, preheader, A number, compliance", () => {
    expect(out).toContain('SET @refNumber = "REF4113200"');
    expect(out).toContain('SET @subject = "You have more choice in your coverage"');
    expect(out).toContain('SET @aNumber = "A57222IFP-EM5-(multi)_1026"');
    expect(out).toContain('SET @complianceNumber = "BSC-COMP-2026-001"');
  });

  it("prunes @MKT_LOB and @version lines (no keycodes in Static)", () => {
    expect(out).not.toContain("SET @MKT_LOB");
    expect(out).not.toContain("SET @version");
    expect(outsideSendLog(out)).not.toContain('""');
  });

  it("has no conditionals", () => {
    expect(out).not.toContain("ELSEIF");
    expect(out).not.toContain("ContentBlockByKey");
  });
});

describe("dynamic-multi (subject/preheader per keycode)", () => {
  const out = generateAmpscript({
    ...WINBACK,
    variant: "multi",
    subject: "",
    preheader: "",
    perKeycode: {
      SAC: { subject: "Subject for SAC", preheader: "Preheader for SAC" },
      SD: { subject: "Subject for SD", preheader: "Preheader for SD" },
      LOC_PL: { subject: "Subject for LOC_PL", preheader: "" },
    },
  });

  it("puts each keycode's subject/preheader inside its own branch", () => {
    const sacBranch = out.split('IF @MKT_LOB == "SAC"')[1].split("ELSEIF")[0];
    expect(sacBranch).toContain('SET @subject = "Subject for SAC"');
    expect(sacBranch).toContain('SET @preheader = "Preheader for SAC"');
    const sdBranch = out.split('ELSEIF @MKT_LOB == "SD"')[1].split("ELSEIF")[0];
    expect(sdBranch).toContain('SET @subject = "Subject for SD"');
  });

  it("has no shared top-level @subject line", () => {
    const topLevel = out.split("/*conditional statements*/")[0];
    expect(topLevel).not.toContain("SET @subject");
    expect(topLevel).not.toContain("SET @preheader");
  });

  it("still leaves zero empty strings outside the send-log comment", () => {
    expect(outsideSendLog(out)).not.toContain('""');
  });
});

describe("content keys - ref + keycode only (owner's example, 2026-10-30)", () => {
  it("builds REF3979650_IFP-ACA-IHV-AdvantmedMarquee", () => {
    const out = generateAmpscript({
      ...WINBACK,
      jobNumber:
        "5 EMAILS_Advantmed Risk Adjustment emails for ACA/MAD_REF3979650_A55529GMAD_0626",
      keycodesRaw: "IFP-ACA-IHV-Advantmed",
      perKeycodeA: { "IFP-ACA-IHV-Advantmed": "A55529GMAD_0626" },
    });
    expect(out).toContain(
      'ContentBlockByKey("REF3979650_IFP-ACA-IHV-AdvantmedMarquee")'
    );
    expect(out).toContain(
      'ContentBlockByKey("REF3979650_IFP-ACA-IHV-AdvantmedcontentONE")'
    );
    expect(out).toContain('ContentBlockByKey("REF3979650_Disclaimer")');
    // The description segment never appears in a key.
    expect(out).not.toContain("5_EMAILS");
  });
});
