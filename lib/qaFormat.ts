import { snippet, type QaCheck } from "./qaTypes";

/**
 * QA 1 — Text Format QA (SPEC §6).
 *
 * Parses the pasted final build and checks its tags against
 * reference/text-formatting-guide.html — "the p-class bible":
 *  - H1 default: 34px / 38px, weight 200
 *  - H2: 24px / 28px, weight 200  (or 16/24 weight 600 in H3 context)
 *  - H3: 16px / 24px, weight 600
 *  - <p> positional margin classes per series of consecutive <p>
 *    siblings: first mar-0T--G, middle NO mar-* class, last mar-0B--G,
 *    stand-alone mar-0TB--G
 *  - the footer's fixed legal blocks, present and in guide order
 */

export interface FooterBlock {
  id: string;
  label: string;
  pattern: RegExp;
}

export const FOOTER_BLOCKS: FooterBlock[] = [
  {
    id: "apple",
    label: "Footer — Apple trademarks",
    pattern: /Apple and the Apple logo are trademarks of Apple Inc/i,
  },
  {
    id: "google",
    label: "Footer — Google Play trademarks",
    pattern: /Google Play and the Google Play logo are trademarks of Google LLC/i,
  },
  {
    id: "service",
    label: "Footer — Customer Service line",
    pattern:
      /Customer Service at the number on your Blue Shield member ID card/i,
  },
  {
    id: "promo",
    label: "Footer — promotional / Association disclosure",
    pattern:
      /promotional email from Blue Shield of California, an independent member of the Blue Shield Association/i,
  },
  {
    id: "unsubscribe",
    label: "Footer — unsubscribe line",
    pattern: /(unsubscribe here|removed from all future email communications)/i,
  },
  {
    id: "language",
    label: "Footer — Language Assistance Notice",
    pattern: /Language Assistance Notice/,
  },
  {
    id: "nondiscrimination",
    label: "Footer — Nondiscrimination Notice",
    pattern: /Nondiscrimination Notice/,
  },
  {
    id: "address",
    label: "Footer — Oakland address line",
    pattern: /601 12th Street\s*\|\s*Oakland, CA 94607/,
  },
];

interface TypeRule {
  fontSize: string;
  lineHeight: string;
  fontWeight: string;
}

const H1_RULE: TypeRule = { fontSize: "34px", lineHeight: "38px", fontWeight: "200" };
const H2_RULES: TypeRule[] = [
  { fontSize: "24px", lineHeight: "28px", fontWeight: "200" },
  { fontSize: "16px", lineHeight: "24px", fontWeight: "600" }, // H2 in H3 context
];
const H3_RULE: TypeRule = { fontSize: "16px", lineHeight: "24px", fontWeight: "600" };

function parseBuild(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

function elementType(el: Element): TypeRule {
  const style = (el as HTMLElement).style;
  return {
    fontSize: style.fontSize ?? "",
    lineHeight: style.lineHeight ?? "",
    fontWeight: style.fontWeight ?? "",
  };
}

function matchesRule(actual: TypeRule, rule: TypeRule): boolean {
  return (
    actual.fontSize === rule.fontSize &&
    actual.lineHeight === rule.lineHeight &&
    actual.fontWeight === rule.fontWeight
  );
}

function describeType(t: TypeRule): string {
  const parts = [t.fontSize, t.lineHeight, t.fontWeight].filter(Boolean);
  return parts.length ? parts.join(" / ") : "no inline type styles";
}

function headingChecks(doc: Document): QaCheck[] {
  const checks: QaCheck[] = [];

  const h1s = Array.from(doc.querySelectorAll("h1"));
  if (h1s.length === 0) {
    checks.push({
      id: "h1-missing",
      label: "<h1> headline",
      rule: "H1 default 34/38, weight 200",
      status: "fail",
      detail: "No <h1> found in the build",
    });
  }
  h1s.forEach((h1, i) => {
    const actual = elementType(h1);
    const ok = matchesRule(actual, H1_RULE);
    checks.push({
      id: `h1-${i}`,
      label: `<h1> “${snippet(h1.textContent ?? "")}”`,
      rule: "H1 default 34/38, weight 200",
      status: ok ? "pass" : "fail",
      detail: ok ? undefined : `Found ${describeType(actual)}`,
    });
  });

  Array.from(doc.querySelectorAll("h2")).forEach((h2, i) => {
    const actual = elementType(h2);
    const ok = H2_RULES.some((rule) => matchesRule(actual, rule));
    checks.push({
      id: `h2-${i}`,
      label: `<h2> “${snippet(h2.textContent ?? "")}”`,
      rule: "H2 24/28 weight 200 (or 16/24 weight 600 in H3 context)",
      status: ok ? "pass" : "fail",
      detail: ok ? undefined : `Found ${describeType(actual)}`,
    });
  });

  Array.from(doc.querySelectorAll("h3")).forEach((h3, i) => {
    const actual = elementType(h3);
    const ok = matchesRule(actual, H3_RULE);
    checks.push({
      id: `h3-${i}`,
      label: `<h3> “${snippet(h3.textContent ?? "")}”`,
      rule: "H3 16/24, weight 600",
      status: ok ? "pass" : "fail",
      detail: ok ? undefined : `Found ${describeType(actual)}`,
    });
  });

  return checks;
}

/** Runs of consecutive <p> element siblings, per parent element. */
function paragraphSeries(doc: Document): Element[][] {
  const series: Element[][] = [];
  const parents = [doc.body, ...Array.from(doc.body.querySelectorAll("*"))];
  for (const parent of parents) {
    let run: Element[] = [];
    for (const child of Array.from(parent.children)) {
      if (child.tagName === "P") {
        run.push(child);
      } else if (run.length > 0) {
        series.push(run);
        run = [];
      }
    }
    if (run.length > 0) series.push(run);
  }
  return series;
}

function expectedMarClass(seriesLength: number, index: number): string | null {
  if (seriesLength <= 1) return "mar-0TB--G";
  if (index === 0) return "mar-0T--G";
  if (index === seriesLength - 1) return "mar-0B--G";
  return null; // middle: no mar-* class allowed
}

function positionLabel(seriesLength: number, index: number): string {
  if (seriesLength <= 1) return "stand-alone";
  if (index === 0) return "first in series";
  if (index === seriesLength - 1) return "last in series";
  return "middle of series";
}

/** Footer legal paragraphs are governed by the footer checks, not the
 *  mar-class bible — in the guide itself they are bare <p> elements. */
function isFooterParagraph(p: Element): boolean {
  const text = p.textContent ?? "";
  return FOOTER_BLOCKS.some((block) => block.pattern.test(text));
}

function paragraphChecks(doc: Document): QaCheck[] {
  const checks: QaCheck[] = [];
  paragraphSeries(doc).forEach((rawRun) => {
    const run = rawRun.filter((p) => !isFooterParagraph(p));
    if (run.length === 0) return;
    run.forEach((p, i) => {
      const classes = (p.getAttribute("class") ?? "")
        .split(/\s+/)
        .filter(Boolean);
      const marClasses = classes.filter((c) => c.startsWith("mar-"));
      const expected = expectedMarClass(run.length, i);
      const position = positionLabel(run.length, i);
      let ok: boolean;
      let detail: string | undefined;
      if (expected === null) {
        ok = marClasses.length === 0;
        detail = ok
          ? undefined
          : `Middle paragraph must carry no mar-* class; found ${marClasses.join(", ")}`;
      } else {
        ok = marClasses.length === 1 && marClasses[0] === expected;
        detail = ok
          ? undefined
          : marClasses.length === 0
            ? `Class ${expected} missing`
            : `Expected ${expected}; found ${marClasses.join(", ")}`;
      }
      checks.push({
        id: `p-${checks.length}`,
        label: `<p> ${position} — “${snippet(p.textContent ?? "")}”`,
        rule:
          expected === null
            ? "no special class (p-class bible)"
            : `class ${expected} (p-class bible)`,
        status: ok ? "pass" : "fail",
        detail,
      });
    });
  });
  return checks;
}

function footerChecks(doc: Document): QaCheck[] {
  const text = (doc.body.textContent ?? "").replace(/\s+/g, " ");
  const checks: QaCheck[] = [];
  const indices: number[] = [];
  for (const block of FOOTER_BLOCKS) {
    const match = text.match(block.pattern);
    indices.push(match?.index ?? -1);
    checks.push({
      id: `footer-${block.id}`,
      label: block.label,
      rule: "present, in the guide's fixed footer order",
      status: match ? "pass" : "fail",
      detail: match ? undefined : "Block not found in the build",
    });
  }
  const allPresent = indices.every((i) => i >= 0);
  const inOrder = indices.every((v, i) => i === 0 || v > indices[i - 1]);
  checks.push({
    id: "footer-order",
    label: "Footer blocks in guide order",
    rule: "Apple → Google Play → Customer Service → disclosure → unsubscribe → Language Assistance → Nondiscrimination → address",
    status: allPresent && inOrder ? "pass" : "fail",
    detail:
      allPresent && inOrder
        ? undefined
        : allPresent
          ? "Blocks are present but out of order"
          : "Cannot be in order while blocks are missing",
  });
  return checks;
}

export interface FormatQaOutcome {
  checks: QaCheck[];
  passed: boolean;
}

export function runFormatQa(buildHtml: string): FormatQaOutcome {
  if (!buildHtml.trim()) {
    return {
      checks: [
        {
          id: "empty",
          label: "Final build",
          rule: "a final build must be pasted before QA can run",
          status: "fail",
          detail: "The paste window is empty",
        },
      ],
      passed: false,
    };
  }
  const doc = parseBuild(buildHtml);
  const checks = [
    ...headingChecks(doc),
    ...paragraphChecks(doc),
    ...footerChecks(doc),
  ];
  return { checks, passed: checks.every((c) => c.status === "pass") };
}
