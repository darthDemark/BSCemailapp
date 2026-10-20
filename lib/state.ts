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
  deckText: string;
  deckFileName: string;
  /** Window 1 content from the last Generate run. */
  generatedAmpscript: string;
  /** Final build HTML pasted on the QA page. */
  pastedBuild: string;
  formatRun: QaRun | null;
  contentRun: QaRun | null;
}

/** The WinBack worked example — the app opens demo-ready, like the mock. */
export const DEFAULT_STATE: AppState = {
  buildType: "dynamic",
  variant: "single",
  jobNumber:
    "EM5 2027 OE IFP WinBack Email 5 More Choice (dynamic) 12/22 - REF4113200 A57222IFP-EM5-(multi)_1026",
  keycodesRaw: "SAC, SD, LOC_PL",
  aNumber: "A57222IFP-EM5-(multi)_1026",
  complianceNumber: "BSC-COMP-2026-001",
  subject: "You have more choice in your coverage",
  preheader: "See what is new for your 2027 plan",
  perKeycode: {},
  deckText:
    "More choice is coming to your 2027 plan. Compare your options side by side to find the coverage that fits you best.\n" +
    "Enroll by December 22 to keep your doctors and the care you count on.\n\n" +
    "Questions? Call the number on your Blue Shield member ID card.",
  deckFileName: "",
  generatedAmpscript: "",
  pastedBuild: "",
  formatRun: null,
  contentRun: null,
};

export const STORAGE_KEY = "bsc-email-build-app:v1";

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
      state.deckText,
      state.generatedAmpscript,
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
