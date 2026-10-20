/**
 * Keycode handling (SPEC §4.1): keycodes are an ordered array, in the
 * order provided. Parsing splits on commas, semicolons, newlines and
 * whitespace; case and internal underscores are preserved exactly
 * (e.g. "LOC_PL" stays "LOC_PL").
 */
export function parseKeycodes(raw: string): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  return raw
    .split(/[\s,;]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .filter((token) => {
      // A repeated keycode would generate an identical, unreachable
      // branch — keep the first occurrence, in the order provided.
      if (seen.has(token)) return false;
      seen.add(token);
      return true;
    });
}
