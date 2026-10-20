import { deckParagraphs, type DeckSeries } from "./copyDeck";
import { FOOTER_BLOCKS } from "./qaFormat";
import { snippet, type QaCheck } from "./qaTypes";

/**
 * QA 2 — Content QA (SPEC §6, owner re-stated 2026-10-19).
 *
 * Ensures the CONTENT of the pasted final build matches the copy deck
 * provided in Production:
 *  - every deck paragraph is present in the build (nothing missing);
 *  - no content in the build beyond the deck (nothing extra) — ignoring
 *    AMPscript/code and known template chrome (web-view link text,
 *    "Follow us:", and the guide's fixed legal footer blocks).
 *
 * Comparison is word-for-word in spirit: text is normalized to a word
 * stream (case/whitespace/punctuation-insensitive) before matching.
 */

export function normalizeWords(text: string): string {
  return text
    .toLowerCase()
    .replace(/&nbsp;/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Strip AMPscript blocks from raw pasted HTML before parsing. */
function stripAmpscript(html: string): string {
  return html
    .replace(/%%\[[\s\S]*?\]%%/g, " ")
    .replace(/%%=[\s\S]*?%%/g, " ");
}

const CHROME_PATTERNS: RegExp[] = [
  /view this email as a web page/i,
  /follow us/i,
  ...FOOTER_BLOCKS.map((b) => b.pattern),
];

function isChrome(normalizedBlockText: string, rawBlockText: string): boolean {
  if (!normalizedBlockText) return true;
  return CHROME_PATTERNS.some((pattern) => pattern.test(rawBlockText));
}

/** Text blocks of the build: paragraph/heading/list-item level text. */
function buildBlocks(doc: Document): string[] {
  doc.querySelectorAll("script, style").forEach((el) => el.remove());
  const blocks: string[] = [];
  doc.body
    .querySelectorAll("p, h1, h2, h3, h4, h5, h6, li")
    .forEach((el) => {
      const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
      if (text) blocks.push(text);
    });
  if (blocks.length === 0) {
    const all = (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
    if (all) blocks.push(all);
  }
  return blocks;
}

export interface ContentQaOutcome {
  checks: QaCheck[];
  passed: boolean;
  missing: string[];
  extra: string[];
}

export function runContentQa(
  buildHtml: string,
  deck: DeckSeries[]
): ContentQaOutcome {
  const deckParas = deckParagraphs(deck);
  if (deckParas.length === 0) {
    return {
      checks: [
        {
          id: "no-deck",
          label: "Copy deck",
          rule: "a copy deck must be provided in Production",
          status: "fail",
          detail: "No copy deck content — nothing to compare the build against",
        },
      ],
      passed: false,
      missing: [],
      extra: [],
    };
  }
  if (!buildHtml.trim()) {
    return {
      checks: [
        {
          id: "empty-build",
          label: "Final build",
          rule: "a final build must be pasted before QA can run",
          status: "fail",
          detail: "The paste window is empty",
        },
      ],
      passed: false,
      missing: deckParas,
      extra: [],
    };
  }

  const doc = new DOMParser().parseFromString(
    stripAmpscript(buildHtml),
    "text/html"
  );
  const blocks = buildBlocks(doc);
  const buildStream = normalizeWords(blocks.join(" "));
  const deckStream = normalizeWords(deckParas.join(" "));

  // Nothing in the deck missing from the build.
  const missing = deckParas.filter(
    (para) => !buildStream.includes(normalizeWords(para))
  );

  // Nothing in the build that isn't in the deck.
  const extra = blocks.filter((block) => {
    const normalized = normalizeWords(block);
    if (!normalized) return false;
    if (deckStream.includes(normalized)) return false;
    if (isChrome(normalized, block)) return false;
    return true;
  });

  const checks: QaCheck[] = [
    {
      id: "deck-present",
      label: `Deck paragraphs in the build (${deckParas.length - missing.length}/${deckParas.length})`,
      rule: "every paragraph from the deck is present",
      status: missing.length === 0 ? "pass" : "fail",
      detail:
        missing.length === 0
          ? undefined
          : `${missing.length} deck paragraph(s) not found in the build`,
    },
    ...missing.map((para, i) => ({
      id: `missing-${i}`,
      label: `Missing deck copy — “${snippet(para)}”`,
      rule: "deck copy must appear in the build, word for word",
      status: "fail" as const,
    })),
    {
      id: "no-extra",
      label: "Extra text in the build",
      rule: "nothing in the build that isn't in the deck",
      status: extra.length === 0 ? "pass" : "fail",
      detail:
        extra.length === 0
          ? undefined
          : `${extra.length} block(s) in the build are not in the deck`,
    },
    ...extra.map((block, i) => ({
      id: `extra-${i}`,
      label: `Extra build copy — “${snippet(block)}”`,
      rule: "build content must come from the deck (template chrome ignored)",
      status: "fail" as const,
    })),
  ];

  return {
    checks,
    passed: missing.length === 0 && extra.length === 0,
    missing,
    extra,
  };
}
