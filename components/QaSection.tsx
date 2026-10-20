"use client";

import type { QaRun } from "@/lib/qaTypes";

interface QaSectionProps {
  heading: string;
  headingNote: string;
  runLabel: string;
  onRun: () => void;
  run: QaRun | null;
  /** True when inputs changed after this run — its verdict is void. */
  stale: boolean;
  statusLabel: string;
}

/** One QA gate's run button, per-check results table, and verdict line. */
export function QaSection({
  heading,
  headingNote,
  runLabel,
  onRun,
  run,
  stale,
  statusLabel,
}: QaSectionProps) {
  const failCount = run?.checks.filter((c) => c.status === "fail").length ?? 0;

  return (
    <section>
      {heading ? (
        <div className="qahead">
          {heading} <span>{headingNote}</span>
        </div>
      ) : null}
      <button className="btn qa" type="button" onClick={onRun}>
        {runLabel}
      </button>

      {run ? (
        <>
          <table>
            <thead>
              <tr>
                <th style={{ width: "38%" }}>Check</th>
                <th style={{ width: "37%" }}>Rule</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {run.checks.map((check) => (
                <tr key={check.id}>
                  <td>{check.label}</td>
                  <td>{check.rule}</td>
                  <td className={check.status === "pass" ? "pass" : "fail"}>
                    {check.status === "pass" ? "✓ MATCH" : "✗ MISMATCH"}
                    {check.detail ? (
                      <div className="checkdetail">{check.detail}</div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div
            className={
              run.passed && !stale ? "qastatus pass" : "qastatus fail"
            }
          >
            {statusLabel}:{" "}
            {stale
              ? "⟳ VOID — inputs changed since this run; re-run QA"
              : run.passed
                ? "✓ PASS"
                : `✗ FAIL — ${failCount} mismatch${failCount === 1 ? "" : "es"}`}
          </div>
        </>
      ) : (
        <div className="qastatus" style={{ color: "#5b7f9d" }}>
          {statusLabel}: not run yet
        </div>
      )}
    </section>
  );
}
