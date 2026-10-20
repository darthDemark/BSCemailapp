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

  it("reproduces the owner-approved golden file exactly", () => {
    expect(out).toBe(golden);
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
      'ContentBlockByKey("REF4113200_EM5_2027_OE_IFP_WinBSACMarquee")'
    );
    expect(out).toContain(
      'ContentBlockByKey("REF4113200_EM5_2027_OE_IFP_WinBSDcontentONE")'
    );
    expect(out).toContain(
      'ContentBlockByKey("REF4113200_EM5_2027_OE_IFP_WinBLOC_PLcontentTWO")'
    );
  });

  it("uses the same no-keycode Disclaimer key in every branch", () => {
    const matches = out.match(
      /ContentBlockByKey\("REF4113200_EM5_2027_OE_IFP_WinBDisclaimer"\)/g
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
    const out = generateAmpscript({ ...WINBACK, aNumber: "" });
    expect(out).not.toContain("SET @aNumber");
    expect(outsideSendLog(out)).not.toContain('""');
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
