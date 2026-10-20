/**
 * Copy deck handling (SPEC §5 + the p-class bible in
 * reference/text-formatting-guide.html).
 *
 * A deck is a list of SERIES; a series is a list of paragraphs.
 * Plain-text decks: a blank line starts a new series, each non-empty
 * line is a paragraph. HTML decks are reduced to text first.
 *
 * Every paragraph is wrapped in a <p> whose class is decided by its
 * POSITION in its series:
 *   first      -> mar-0T--G   (top margin removed)
 *   middle     -> (no class)  (default margins)
 *   last       -> mar-0B--G   (bottom margin removed)
 *   stand-alone-> mar-0TB--G  (both margins removed)
 */

export type DeckSeries = string[];

export function parseDeckText(text: string): DeckSeries[] {
  if (!text) return [];
  const normalized = text.replace(/\r\n?/g, "\n");
  return normalized
    .split(/\n\s*\n/)
    .map((block) =>
      block
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
    )
    .filter((series) => series.length > 0);
}

/** All deck paragraphs, flattened in order. */
export function deckParagraphs(series: DeckSeries[]): string[] {
  return series.flat();
}

/** The bible's positional class for a paragraph. */
export function pClassFor(seriesLength: number, index: number): string {
  if (seriesLength <= 1) return "mar-0TB--G";
  if (index === 0) return "mar-0T--G";
  if (index === seriesLength - 1) return "mar-0B--G";
  return "";
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Render the deck as Window 2 output: <p> blocks with bible classes. */
export function renderDeckHtml(series: DeckSeries[]): string {
  return series
    .map((paragraphs) =>
      paragraphs
        .map((paragraph, i) => {
          const cls = pClassFor(paragraphs.length, i);
          const attr = cls ? ` class="${cls}"` : "";
          return `<p${attr}>${escapeHtml(paragraph)}</p>`;
        })
        .join("\n")
    )
    .join("\n\n");
}

/** Human label for a positional class, used by the Window 2 annotations. */
export function pClassLabel(seriesLength: number, index: number): string {
  if (seriesLength <= 1) return "stand-alone → mar-0TB--G";
  if (index === 0) return "first in series → mar-0T--G";
  if (index === seriesLength - 1) return "last in series → mar-0B--G";
  return "middle → no class";
}

/** Reduce an HTML document/fragment to its plain text (for .html decks). */
export function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style").forEach((el) => el.remove());
  const blocks: string[] = [];
  doc.body
    .querySelectorAll("p, h1, h2, h3, h4, h5, h6, li")
    .forEach((el) => {
      const text = (el.textContent ?? "").trim();
      if (text) blocks.push(text);
    });
  if (blocks.length > 0) return blocks.join("\n\n");
  return (doc.body.textContent ?? "").trim();
}

export interface DeckFileResult {
  text: string;
  fileName: string;
}

/**
 * Read an uploaded copy deck file into plain deck text.
 * Supports .txt / .md / .html directly; .docx via mammoth (bonus).
 * OPEN ITEM (spec §8.4): the owner's real deck format is not yet
 * provided — plain text is the reasonable first format.
 */
export async function readDeckFile(file: File): Promise<DeckFileResult> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return { text: result.value, fileName: file.name };
  }
  const raw = await file.text();
  if (lower.endsWith(".html") || lower.endsWith(".htm")) {
    return { text: htmlToText(raw), fileName: file.name };
  }
  return { text: raw, fileName: file.name };
}
