/**
 * Job-number → SFMC file-name transformation (SPEC §3).
 *
 * Confirmed output format (owner, 2026-10-19):
 *   (refnumber)_(description segment)
 * - the ref number comes first, then an underscore;
 * - the description segment is taken from the BEGINNING of the job line,
 *   words separated by underscores, HARD cut at 20 characters
 *   (mid-word cut allowed — worked example: "WinBack" → "WinB");
 * - the resulting name is the name of the file IN SFMC when building.
 *   It is not a local file name and carries NO extension.
 */

/** Extract the first REF<number> token from a job line, e.g. "REF4113200". */
export function extractRef(jobLine: string): string {
  const match = jobLine.match(/REF\d+/i);
  return match ? match[0].toUpperCase() : "";
}

/**
 * The 20-character description segment: text from the beginning of the
 * job line (everything before the ref token), words underscore-joined,
 * hard-cut at 20 characters.
 */
export function descriptionSegment(jobLine: string): string {
  const refMatch = jobLine.match(/REF\d+/i);
  const beginning = refMatch ? jobLine.slice(0, refMatch.index) : jobLine;
  const words = beginning.trim().split(/\s+/).filter(Boolean);
  return words.join("_").slice(0, 20);
}

/**
 * Full SFMC file/base name, e.g. "REF4113200_EM5_2027_OE_IFP_WinB".
 * Returns "" when the line contains no ref number.
 */
export function deriveSfmcName(jobLine: string): string {
  const ref = extractRef(jobLine);
  if (!ref) return "";
  const segment = descriptionSegment(jobLine);
  return segment ? `${ref}_${segment}` : ref;
}

/**
 * Small deterministic content hash (FNV-1a). Used by the QA gate: a QA
 * pass is bound to the exact pasted build + deck + production inputs it
 * ran against; any change produces a different hash and re-locks the
 * deliverable.
 */
export function contentHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
