import { contentHash } from "./naming";
import type { SubjectPreheader } from "./ampscript";
import type { BuildType, DynamicVariant } from "./templates";
import type { QaRun } from "./qaTypes";

/**
 * Whole-app state, shared between Production (/) and QA (/qa) via
 * React context and persisted to localStorage so it survives the
 * Production → QA page move.
 */
export interface AppState {
  buildType: BuildType;
  variant: DynamicVariant;
  jobNumber: string;
  keycodesRaw: string;
  aNumber: string;
  complianceNumber: string;
  subject: string;
  preheader: string;
  perKeycode: Record<string, SubjectPreheader>;
  /** Dynamic: A number per keycode (owner's ruling, 2026-10-20). */
  perKeycodeA: Record<string, string>;
  deckText: string;
  deckFileName: string;
  /** Window 1 content from the last Generate run. */
  generatedAmpscript: string;
  /** Deck snapshot taken at the last Generate run — Window 2 renders
   *  only this, so the window stays empty until Generate is pressed. */
  generatedDeckText: string;
  /** Final build HTML pasted on the QA page. */
  pastedBuild: string;
  formatRun: QaRun | null;
  contentRun: QaRun | null;
}

/** The app opens with every field empty (owner's call, 2026-10-19) —
 *  output windows stay unoccupied until GENERATE OUTPUT is pressed. */
export const DEFAULT_STATE: AppState = {
  buildType: "dynamic",
  variant: "single",
  jobNumber: "",
  keycodesRaw: "",
  aNumber: "",
  complianceNumber: "",
  subject: "",
  preheader: "",
  perKeycode: {},
  perKeycodeA: {},
  deckText: "",
  deckFileName: "",
  generatedAmpscript: "",
  generatedDeckText: "",
  pastedBuild: "",
  formatRun: null,
  contentRun: null,
};

export const STORAGE_KEY = "bsc-email-build-app:v2";

/**
 * Hash of everything a QA pass is bound to: the pasted build, the
 * deck, and the production inputs (including the generated output).
 * Any change to any of them changes the hash and voids the pass.
 */
export function currentInputsHash(state: AppState): string {
  return contentHash(
    JSON.stringify([
      state.buildType,
      state.variant,
      state.jobNumber,
      state.keycodesRaw,
      state.aNumber,
      state.complianceNumber,
      state.subject,
      state.preheader,
      state.perKeycode,
      state.perKeycodeA,
      state.deckText,
      state.generatedAmpscript,
      state.generatedDeckText,
      state.pastedBuild,
    ])
  );
}

/** The hard gate: BOTH QAs passed against the CURRENT inputs. */
export function gateUnlocked(state: AppState): boolean {
  if (!state.generatedAmpscript || !state.pastedBuild.trim()) return false;
  const hash = currentInputsHash(state);
  return Boolean(
    state.formatRun?.passed &&
      state.formatRun.runHash === hash &&
      state.contentRun?.passed &&
      state.contentRun.runHash === hash
  );
}
