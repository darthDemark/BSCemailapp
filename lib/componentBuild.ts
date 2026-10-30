import {
  COMPONENT_1_A,
  COMPONENT_2_A,
  COMPONENT_2_B,
  DISCLAIMER_COMPONENT,
  MARQUEE_COMPONENT_1,
  MARQUEE_COMPONENT_2,
} from "./componentTemplatesData";
import { escapeHtml } from "./copyDeck";

/**
 * Component building from copy decks (owner's design, 2026-10-29).
 *
 * The component HTML files are OBJECTS, called when the copy deck's
 * bracket-labelled areas call for them:
 *
 *   Marquee component — marquee-component-1.html / marquee-component-2.html
 *   Content 1         — component-1-a.html
 *   Content 2         — component-2-a.html / component-2-b.html
 *   Disclaimer        — disclaimer-component.html
 *
 * A copy deck marks its areas with RECORDS in the owner's format
 * (corrected by the owner, 2026-10-30):
 *
 *   [file name [variable]] copy [END]
 *
 * The record names the template object and the variable; the copy
 * between the marker and [END] — the content in the middle — replaces
 * that variable in that object. The file name, the bracketed variable
 * marker and the [END] are deck-side only: NONE of them appear in
 * the built output.
 *
 * Decks written label-first ([HEADLINE] copy [text1] copy …) still
 * build through the label fallback below, with the called variant
 * chosen by which labels the deck provides.
 */

export const MAX_DECK_WINDOWS = 7;

export interface DeckEntry {
  id: string;
  name: string;
  text: string;
}

export interface BuiltComponent {
  /** Stable id: deck id + group id. */
  id: string;
  groupId: string;
  /** Button name, as the owner listed them. */
  name: string;
  /** The template object that was called. */
  fileName: string;
  html: string;
  /** Bracket labels (as written in the template) filled from the deck. */
  matchedLabels: string[];
  /** Bracket labels left unfilled — still visible in the HTML. */
  missingLabels: string[];
}

export interface ComponentBuild {
  id: string;
  deckName: string;
  components: BuiltComponent[];
  warnings: string[];
}

interface ComponentTemplateObject {
  id: string;
  groupId: string;
  fileName: string;
  source: string;
  placeholders: string[];
}

interface ComponentGroup {
  id: string;
  name: string;
  variants: ComponentTemplateObject[];
}

/** Canonical key for a bracket label: case, spacing and punctuation
 *  don't matter ("CTA LINK" and "CTALINK" are the same label). */
export function normalizeLabelKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function isTemplatePlaceholder(label: string): boolean {
  const key = normalizeLabelKey(label);
  // Outlook conditional comments (<!--[if !mso]> … <![endif]-->) are
  // part of the template machinery, not copy variables.
  return key !== "endif" && !key.startsWith("if");
}

/** The bracket variables a template carries, in order, de-duplicated. */
export function extractPlaceholders(source: string): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const match of source.matchAll(/\[([^\[\]\n]{1,100})\]/g)) {
    const label = match[1].trim();
    if (!isTemplatePlaceholder(label)) continue;
    const key = normalizeLabelKey(label);
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push(label);
  }
  return labels;
}

function templateObject(
  id: string,
  groupId: string,
  fileName: string,
  source: string
): ComponentTemplateObject {
  return { id, groupId, fileName, source, placeholders: extractPlaceholders(source) };
}

export const COMPONENT_GROUPS: ComponentGroup[] = [
  {
    id: "marquee",
    name: "Marquee component",
    variants: [
      templateObject("marquee-1", "marquee", "marquee-component-1.html", MARQUEE_COMPONENT_1),
      templateObject("marquee-2", "marquee", "marquee-component-2.html", MARQUEE_COMPONENT_2),
    ],
  },
  {
    id: "content1",
    name: "Content 1",
    variants: [
      templateObject("content-1-a", "content1", "component-1-a.html", COMPONENT_1_A),
    ],
  },
  {
    id: "content2",
    name: "Content 2",
    variants: [
      templateObject("content-2-a", "content2", "component-2-a.html", COMPONENT_2_A),
      templateObject("content-2-b", "content2", "component-2-b.html", COMPONENT_2_B),
    ],
  },
  {
    id: "disclaimer",
    name: "Disclaimer",
    variants: [
      templateObject("disclaimer", "disclaimer", "disclaimer-component.html", DISCLAIMER_COMPONENT),
    ],
  },
];

/** Every bracket label any component template can consume. */
export const ALL_PLACEHOLDER_KEYS: ReadonlySet<string> = new Set(
  COMPONENT_GROUPS.flatMap((group) =>
    group.variants.flatMap((variant) =>
      variant.placeholders.map(normalizeLabelKey)
    )
  )
);

/** Label spellings that may stand in for each other inside a group. */
const GROUP_ALIASES: Record<string, Record<string, string[]>> = {
  marquee: {
    headline: ["header"],
    header: ["headline"],
    marqueecopy: ["marqueebody"],
    marqueebody: ["marqueecopy"],
  },
};

export type BracketSections = Map<string, string[]>;

export interface DeckRecord {
  /** File named in the record, as written in the deck. */
  fileName: string;
  /** Canonical file key (see normalizeFileKey). */
  fileKey: string;
  /** Variable named in the record, as written in the deck. */
  variable: string;
  /** Canonical variable key (see normalizeLabelKey). */
  variableKey: string;
  /** The copy in the middle — between the marker and [END]. */
  copy: string;
}

/** Canonical key for a component file name: case, spacing, underscores
 *  and the .html extension don't matter. */
export function normalizeFileKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\.html?$/, "")
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "");
}

const RECORD_PATTERN =
  /\[\s*([^\[\]\n]{1,120}?)\s*\[\s*([^\[\]\n]{1,100}?)\s*\]\s*\]\s*([\s\S]*?)\[\s*END\s*\]/gi;

/**
 * Parse a deck's records: [file name [variable]] copy [END].
 * The copy is everything between the marker and [END] — the content
 * in the middle, brackets and all. Records whose copy is empty are
 * dropped.
 */
export function parseDeckRecords(text: string): DeckRecord[] {
  const records: DeckRecord[] = [];
  for (const match of text.matchAll(RECORD_PATTERN)) {
    const copy = match[3].trim();
    if (!copy) continue;
    records.push({
      fileName: match[1].trim(),
      fileKey: normalizeFileKey(match[1]),
      variable: match[2].trim(),
      variableKey: normalizeLabelKey(match[2]),
      copy,
    });
  }
  return records;
}

/** The template object a deck record names, by file key. */
export function findTemplateByFileKey(
  fileKey: string
): { group: ComponentGroup; template: ComponentTemplateObject } | null {
  for (const group of COMPONENT_GROUPS) {
    for (const template of group.variants) {
      if (normalizeFileKey(template.fileName) === fileKey) {
        return { group, template };
      }
    }
  }
  return null;
}

function cleanSectionValue(raw: string): string {
  return raw
    .replace(/^[\s:;,.—–-]+/, "")
    .replace(/\s+$/, "")
    .trim();
}

/**
 * Split a copy deck into its bracket-labelled areas. A known bracket
 * label starts a new area; the text up to the next known label is that
 * area's content. A repeated label yields several values, consumed in
 * order by repeated placeholders. Text before the first label (deck
 * titles, job headers) is not copy for any component.
 */
export function parseBracketSections(
  text: string,
  knownKeys: ReadonlySet<string> = ALL_PLACEHOLDER_KEYS
): BracketSections {
  const markers: { key: string; start: number; end: number }[] = [];
  for (const match of text.matchAll(/\[([^\[\]\n]{1,100})\]/g)) {
    const key = normalizeLabelKey(match[1]);
    if (!knownKeys.has(key)) continue;
    markers.push({
      key,
      start: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
    });
  }
  const sections: BracketSections = new Map();
  markers.forEach((marker, i) => {
    const nextStart = i + 1 < markers.length ? markers[i + 1].start : text.length;
    const value = cleanSectionValue(text.slice(marker.end, nextStart));
    if (!value) return;
    const existing = sections.get(marker.key);
    if (existing) existing.push(value);
    else sections.set(marker.key, [value]);
  });
  return sections;
}

function resolveSourceKey(
  key: string,
  groupId: string,
  sections: BracketSections
): string | null {
  if (sections.has(key)) return key;
  for (const alias of GROUP_ALIASES[groupId]?.[key] ?? []) {
    if (sections.has(alias)) return alias;
  }
  return null;
}

function sectionValueToHtml(value: string, placeholderKey: string): string {
  if (placeholderKey === "ctalink") {
    // A link is a single token: first non-empty line, attribute-escaped.
    const firstLine = value.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? "";
    return escapeHtml(firstLine);
  }
  return escapeHtml(value.replace(/\r\n?/g, "\n"))
    .replace(/\n{2,}/g, "<br><br>")
    .replace(/\n/g, "<br>");
}

interface FillResult {
  html: string;
  matchedLabels: string[];
  missingLabels: string[];
}

function fillTemplate(
  template: ComponentTemplateObject,
  sections: BracketSections
): FillResult {
  const matchedLabels: string[] = [];
  const missingLabels: string[] = [];
  const occurrence = new Map<string, number>();

  const html = template.source.replace(
    /\[([^\[\]\n]{1,100})\]/g,
    (whole, rawLabel: string) => {
      const label = rawLabel.trim();
      if (!isTemplatePlaceholder(label)) return whole;
      const key = normalizeLabelKey(label);
      const sourceKey = resolveSourceKey(key, template.groupId, sections);
      if (!sourceKey) {
        if (!missingLabels.includes(label)) missingLabels.push(label);
        return whole;
      }
      if (!matchedLabels.includes(label)) matchedLabels.push(label);
      const values = sections.get(sourceKey)!;
      const index = occurrence.get(sourceKey) ?? 0;
      occurrence.set(sourceKey, index + 1);
      // Repeated placeholders consume repeated deck areas in order;
      // with a single area, every occurrence gets that same content.
      const value = values[Math.min(index, values.length - 1)];
      return sectionValueToHtml(value, key);
    }
  );

  return { html, matchedLabels, missingLabels };
}

/**
 * Choose the variant object a deck calls for in one group: the one
 * whose own bracket labels the deck actually provides (exact label
 * matches score; the marquee copy/body and headline/header spellings
 * only fill gaps once the variant is chosen). No matching labels →
 * the group is not called for this deck.
 */
function chooseVariant(
  group: ComponentGroup,
  sections: BracketSections
): ComponentTemplateObject | null {
  let best: { template: ComponentTemplateObject; matched: number; missing: number } | null =
    null;
  for (const template of group.variants) {
    const matched = template.placeholders.filter((label) =>
      sections.has(normalizeLabelKey(label))
    ).length;
    if (matched === 0) continue;
    const candidate = {
      template,
      matched,
      missing: template.placeholders.length - matched,
    };
    if (
      !best ||
      candidate.matched > best.matched ||
      (candidate.matched === best.matched && candidate.missing < best.missing)
    ) {
      best = candidate;
    }
  }
  return best?.template ?? null;
}

/**
 * Build every component block one copy deck calls for, in email
 * order. Record-format decks build exactly the objects they name;
 * label-format decks fall back to label matching.
 */
export function buildComponentsForDeck(deck: DeckEntry): ComponentBuild {
  const records = parseDeckRecords(deck.text);
  if (records.length > 0) return buildFromRecords(deck, records);
  return buildFromLabels(deck);
}

function buildFromRecords(
  deck: DeckEntry,
  records: DeckRecord[]
): ComponentBuild {
  const warnings: string[] = [];
  const components: BuiltComponent[] = [];

  // Group the records by the object they name.
  const byTemplate = new Map<string, BracketSections>();
  const unknownFiles: string[] = [];
  for (const record of records) {
    const found = findTemplateByFileKey(record.fileKey);
    if (!found) {
      if (!unknownFiles.includes(record.fileName)) {
        unknownFiles.push(record.fileName);
      }
      continue;
    }
    let sections = byTemplate.get(found.template.id);
    if (!sections) {
      sections = new Map();
      byTemplate.set(found.template.id, sections);
    }
    const existing = sections.get(record.variableKey);
    if (existing) existing.push(record.copy);
    else sections.set(record.variableKey, [record.copy]);
  }
  if (unknownFiles.length > 0) {
    warnings.push(
      `This deck names file(s) the app doesn't carry: ${unknownFiles.join(", ")} — those areas were skipped.`
    );
  }

  for (const group of COMPONENT_GROUPS) {
    for (const template of group.variants) {
      const sections = byTemplate.get(template.id);
      if (!sections) continue;
      const filled = fillTemplate(template, sections);
      if (filled.matchedLabels.length === 0) {
        warnings.push(
          `The deck's records for ${template.fileName} name variables that file doesn't carry — nothing was built from them.`
        );
        continue;
      }
      components.push({
        id: `${deck.id}-${group.id}-${template.id}`,
        groupId: group.id,
        name: group.name,
        fileName: template.fileName,
        html: filled.html,
        matchedLabels: filled.matchedLabels,
        missingLabels: filled.missingLabels,
      });
    }
  }

  if (components.length === 0 && warnings.length === 0) {
    warnings.push("No component blocks were built from this deck's records.");
  }

  return { id: deck.id, deckName: deck.name, components, warnings };
}

function buildFromLabels(deck: DeckEntry): ComponentBuild {
  const sections = parseBracketSections(deck.text);
  const components: BuiltComponent[] = [];
  const warnings: string[] = [];

  if (sections.size === 0) {
    warnings.push(
      "No bracket-labelled copy areas were found in this deck, so no component blocks were built."
    );
    return { id: deck.id, deckName: deck.name, components, warnings };
  }

  for (const group of COMPONENT_GROUPS) {
    const template = chooseVariant(group, sections);
    if (!template) continue;
    const filled = fillTemplate(template, sections);
    if (filled.matchedLabels.length === 0) continue;
    components.push({
      id: `${deck.id}-${group.id}`,
      groupId: group.id,
      name: group.name,
      fileName: template.fileName,
      html: filled.html,
      matchedLabels: filled.matchedLabels,
      missingLabels: filled.missingLabels,
    });
  }

  if (components.length === 0) {
    warnings.push(
      "The deck's bracket labels did not match any component template, so no component blocks were built."
    );
  }

  return { id: deck.id, deckName: deck.name, components, warnings };
}
