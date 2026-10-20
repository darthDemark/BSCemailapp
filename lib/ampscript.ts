import { deriveSfmcName, extractRef } from "./naming";
import { parseKeycodes } from "./keycodes";
import {
  selectTemplate,
  type BuildType,
  type DynamicVariant,
  type TemplateCluster,
} from "./templates";

export interface SubjectPreheader {
  subject: string;
  preheader: string;
}

export interface BuildInputs {
  buildType: BuildType;
  variant: DynamicVariant;
  jobNumber: string;
  /** Raw keycodes field (Dynamic only), parsed as an ordered array. */
  keycodesRaw: string;
  /** Static: the single A number (top-level in the static template). */
  aNumber: string;
  /** Dynamic: a DIFFERENT A number per keycode (owner's ruling,
   *  2026-10-20) — each branch's @aNumber comes from this map. */
  perKeycodeA?: Record<string, string>;
  complianceNumber: string;
  /** Shared subject/preheader (Static, and Dynamic "single" variant). */
  subject: string;
  preheader: string;
  /** Dynamic "multi" variant: subject/preheader per keycode. */
  perKeycode: Record<string, SubjectPreheader>;
}

/** Content types in fixed branch order, with their key suffixes (SPEC §4.4). */
const CONTENT_TYPES = [
  { variable: "@contentMarquee", suffix: "Marquee" },
  { variable: "@contentOne", suffix: "contentONE" },
  { variable: "@contentTwo", suffix: "contentTWO" },
  { variable: "@disclaimer", suffix: "Disclaimer" },
] as const;

const EMPTY_SET_RE = /^SET @(\w+) = ""(\s*)$/;

/**
 * Fill one `SET @x = ""` line with a value, or prune it (return null)
 * when the value is empty — the no-empty-strings rule (SPEC §7).
 * Any trailing whitespace on the template line is preserved.
 */
function fillOrPrune(line: string, value: string | undefined): string | null {
  if (value === undefined || value === "") return null;
  return line.replace('""', `"${value}"`);
}

/**
 * Generate the filled AMPscript for a build.
 *
 * The transform works line-by-line on the template cluster's verbatim
 * source, so everything not being filled — instruction comments, the
 * commented send-log block (including its @TriggeredSendExternalKey
 * line), global vars — passes through untouched.
 */
export function generateAmpscript(inputs: BuildInputs): string {
  const cluster = selectTemplate(inputs.buildType, inputs.variant);
  return fillTemplate(cluster, inputs);
}

export function fillTemplate(
  cluster: TemplateCluster,
  inputs: BuildInputs
): string {
  const ref = extractRef(inputs.jobNumber);
  const baseName = deriveSfmcName(inputs.jobNumber);
  const keycodes = parseKeycodes(inputs.keycodesRaw);
  const isDynamic = cluster.buildType === "dynamic";
  const isMulti = isDynamic && cluster.variant === "multi";

  // Values for top-level SET lines. `undefined` => prune the line.
  const topValues: Record<string, string | undefined> = {
    // Static has no keycodes, so @MKT_LOB / @version are pruned there
    // (OPEN ITEM in the spec — pruning is the recorded candidate rule).
    MKT_LOB: isDynamic ? keycodes[0] : undefined,
    refNumber: ref || undefined,
    version: undefined, // dynamic: lives inside branches; static: pruned
    subject: isMulti ? undefined : inputs.subject || undefined,
    preheader: isMulti ? undefined : inputs.preheader || undefined,
    aNumber: inputs.aNumber || undefined, // static top-level; dynamic: per-branch
    complianceNumber: inputs.complianceNumber || undefined,
  };

  const lines = cluster.source.split("\n");
  const ifIdx = lines.findIndex((l) => l.startsWith("IF @MKT_LOB"));
  const endifIdx = lines.findIndex((l) => l.trim() === "ENDIF");
  const hasConditional = ifIdx >= 0 && endifIdx > ifIdx;

  const out: string[] = [];
  let inCommentBlock = false;

  const processOrdinaryLine = (line: string): void => {
    if (line.includes("<!--")) inCommentBlock = true;
    if (inCommentBlock) {
      // Send-log comment block: preserved untouched.
      out.push(line);
      if (line.includes("-->")) inCommentBlock = false;
      return;
    }
    if (isMulti && line === "SET @title = @subject") {
      // Dynamic-multi: @title moves into each branch with its subject.
      return;
    }
    const match = line.match(EMPTY_SET_RE);
    if (match) {
      const variable = match[1];
      if (variable in topValues) {
        const filled = fillOrPrune(line, topValues[variable]);
        if (filled !== null) out.push(filled);
        return;
      }
    }
    out.push(line);
  };

  if (!hasConditional) {
    lines.forEach(processOrdinaryLine);
    return asTextFile(out.join("\n"));
  }

  // Lines before the conditional region.
  lines.slice(0, ifIdx).forEach(processOrdinaryLine);

  // Rebuild the conditional region: one branch per keycode.
  if (keycodes.length > 0) {
    const headerTemplate = lines[ifIdx];
    // Branch body = the contiguous non-blank SET lines under the IF line.
    const bodyTemplate: string[] = [];
    for (let i = ifIdx + 1; i < endifIdx; i++) {
      if (lines[i].trim() === "") break;
      if (/^(ELSE)?IF @MKT_LOB/.test(lines[i])) break;
      bodyTemplate.push(lines[i]);
    }

    keycodes.forEach((keycode, branchIndex) => {
      if (branchIndex > 0) out.push("", "");
      const keyword = branchIndex === 0 ? "IF" : "ELSEIF";
      out.push(
        headerTemplate
          .replace(/^(ELSE)?IF/, keyword)
          .replace('""', `"${keycode}"`)
      );

      if (isMulti) {
        const sp = inputs.perKeycode[keycode] ?? { subject: "", preheader: "" };
        if (sp.subject) out.push(`SET @subject = "${sp.subject}"`);
        if (sp.preheader) out.push(`SET @preheader = "${sp.preheader}" `);
        if (sp.subject) out.push("SET @title = @subject");
      }

      for (const bodyLine of bodyTemplate) {
        const contentType = CONTENT_TYPES.find((c) =>
          bodyLine.startsWith(`SET ${c.variable} `)
        );
        if (contentType) {
          if (!baseName) continue; // no base name => no key can be formed; prune
          const key =
            contentType.suffix === "Disclaimer"
              ? `${baseName}Disclaimer`
              : `${baseName}${keycode}${contentType.suffix}`;
          out.push(bodyLine.replace('""', `"${key}"`));
          continue;
        }
        if (bodyLine.startsWith("SET @version ")) {
          out.push(bodyLine.replace('""', `"${keycode}"`));
          continue;
        }
        if (bodyLine.startsWith("SET @aNumber ")) {
          const filled = fillOrPrune(
            bodyLine,
            inputs.perKeycodeA?.[keycode] || undefined
          );
          if (filled !== null) out.push(filled);
          continue;
        }
        out.push(bodyLine);
      }
    });
    out.push("");
    out.push(lines[endifIdx]); // ENDIF
  } else {
    // No keycodes: the whole conditional section is pruned (SPEC §7),
    // including its "/*conditional statements*/" comment line.
    for (let i = out.length - 1; i >= 0; i--) {
      if (out[i].includes("/*conditional statements*/")) {
        out.splice(i, 1);
        break;
      }
    }
  }

  // Lines after the conditional region.
  lines.slice(endifIdx + 1).forEach(processOrdinaryLine);
  return asTextFile(out.join("\n"));
}

/** A generated build is a text file: it ends with exactly one newline. */
function asTextFile(text: string): string {
  return text.endsWith("\n") ? text : `${text}\n`;
}
