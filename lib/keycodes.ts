/**
 * Keycode handling (SPEC §4.1 + owner's ruling, 2026-10-20): keycodes
 * are an ordered array, in the order provided. ONLY A COMMA separates
 * one keycode from the next — a space, hyphen, dash or em dash inside
 * a token is part of that keycode ("MAPD IHV" is ONE keycode;
 * "GMAPD-CCPOA" is ONE keycode). Tokens are trimmed at the edges,
 * empties (e.g. from a trailing comma) are dropped, and duplicates
 * collapse to the first occurrence.
 */
export function parseKeycodes(raw: string): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  return raw
    .split(",")
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
