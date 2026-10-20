/**
 * Vital-field FORMAT validation (owner's ruling, 2026-10-20).
 *
 * The vital fields (Job number, A number, Subject line, Preheader) must
 * not only be present — their content must be RECOGNIZED. Gibberish
 * throws the same gate as a missing field: red outline, an error naming
 * what wasn't recognized, and nothing output.
 *
 * Recognition rules — SIMPLIFIED by the owner 2026-10-20 after his
 * real job data failed the strict WinBack shape (his A numbers look
 * like `A55529GMAD_0626`; his ref sits underscore-glued inside the
 * job line, `...MAD_REF3979650_A...`):
 *   Job number: must contain the letters "REF" in any capacity.
 *   A number:   must start with A, followed by a series of numbers
 *               and letters (separators - _ ( ) . allowed) — the
 *               series must contain at least one digit AND one letter.
 * Subject/preheader keep the readable-text (coherent sense) check.
 */
import type { SubjectPreheader } from "./ampscript";

export function hasRecognizableRef(jobNumber: string): boolean {
  // The letters REF, in any capacity, anywhere in the job line.
  return /REF/i.test(jobNumber);
}

export function looksLikeANumber(value: string): boolean {
  const v = value.trim();
  if (!/^A/i.test(v)) return false;
  const rest = v.slice(1);
  if (rest.length < 4) return false;
  if (!/^[0-9A-Za-z\-_().]+$/.test(rest)) return false;
  // A series of numbers AND letters — both must be present.
  return /\d/.test(rest) && /[A-Za-z]/.test(rest);
}

const KEYBOARD_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

function wordIsReadable(word: string): boolean {
  const letters = word.toLowerCase().replace(/[^a-z]/g, "");
  if (/\d/.test(word) && letters.length <= 2) return true; // years, counts
  if (letters.length === 0) return true; // pure number / punctuation token
  // Keyboard mashing: a run of 4+ from one keyboard row isn't a word.
  for (const row of KEYBOARD_ROWS) {
    for (let i = 0; i + 4 <= letters.length; i++) {
      if (row.includes(letters.slice(i, i + 4))) return false;
    }
  }
  // A "word" with no vowel sound at all isn't readable text.
  return /[aeiouy]/.test(letters);
}

/**
 * Readable-text heuristic for subject lines and preheaders: real copy
 * looks like a short sentence — several words, mostly letters, and
 * words that contain vowels. Keyboard mash and random strings fail.
 */
export function looksLikeReadableText(raw: string): boolean {
  const text = raw.trim();
  if (text.length < 10) return false;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 3) return false;
  const nonSpace = text.replace(/\s/g, "");
  const letterCount = (nonSpace.match(/[A-Za-z]/g) ?? []).length;
  if (letterCount / nonSpace.length < 0.6) return false;
  const readable = words.filter(wordIsReadable).length;
  return readable / words.length >= 0.5;
}

export interface VitalInput {
  jobNumber: string;
  /** Static: the single A number. Dynamic: ignored — see perKeycodeA. */
  aNumber: string;
  /** Dynamic: A number per keycode — each one vital + format-checked. */
  isDynamic: boolean;
  perKeycodeA: Record<string, string>;
  subject: string;
  preheader: string;
  isMulti: boolean;
  keycodes: string[];
  perKeycode: Record<string, SubjectPreheader>;
}

/** Returns field-key → error message. Empty record = all recognized. */
export function validateVitalFields(input: VitalInput): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!input.jobNumber.trim()) {
    errors.jobNumber = "Job number is missing";
  } else if (!hasRecognizableRef(input.jobNumber)) {
    errors.jobNumber =
      "Job number isn't recognized — it must contain a REF number (the letters REF)";
  }

  if (input.isDynamic) {
    // Dynamic = multiple emails: a DIFFERENT A number per keycode,
    // each one vital and format-checked (owner's ruling, 2026-10-20).
    for (const kc of input.keycodes) {
      const value = input.perKeycodeA[kc] ?? "";
      if (!value.trim()) {
        errors[`aNumber:${kc}`] = `A number (${kc}) is missing`;
      } else if (!looksLikeANumber(value)) {
        errors[`aNumber:${kc}`] =
          `A number (${kc}) isn't recognized — it must start with A followed by a series of numbers and letters`;
      }
    }
  } else if (!input.aNumber.trim()) {
    errors.aNumber = "A number is missing";
  } else if (!looksLikeANumber(input.aNumber)) {
    errors.aNumber =
      "A number isn't recognized — it must start with A followed by a series of numbers and letters";
  }

  const checkText = (key: string, label: string, value: string) => {
    if (!value.trim()) {
      errors[key] = `${label} is missing`;
    } else if (!looksLikeReadableText(value)) {
      errors[key] = `${label} isn't recognized as readable text`;
    }
  };

  if (input.isMulti) {
    for (const kc of input.keycodes) {
      const sp = input.perKeycode[kc] ?? { subject: "", preheader: "" };
      checkText(`subject:${kc}`, `Subject line (${kc})`, sp.subject);
      checkText(`preheader:${kc}`, `Preheader (${kc})`, sp.preheader);
    }
  } else {
    checkText("subject", "Subject line", input.subject);
    checkText("preheader", "Preheader", input.preheader);
  }

  return errors;
}
