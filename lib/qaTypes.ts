/** Shared result types for the two QA gates (SPEC §6). */

export interface QaCheck {
  id: string;
  /** What was checked, with the offending item located when it failed. */
  label: string;
  /** The rule it was checked against. */
  rule: string;
  status: "pass" | "fail";
  detail?: string;
}

export interface QaRun {
  checks: QaCheck[];
  passed: boolean;
  /** Hash of the exact inputs this run was performed against. */
  runHash: string;
}

export function snippet(text: string, max = 56): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}
