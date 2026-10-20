"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAppState } from "@/components/StateProvider";
import { QaSection } from "@/components/QaSection";
import { DeliverableBar } from "@/components/DeliverableBar";
import { currentInputsHash, gateUnlocked } from "@/lib/state";
import { parseDeckText, deckParagraphs } from "@/lib/copyDeck";
import { runFormatQa } from "@/lib/qaFormat";
import { runContentQa } from "@/lib/qaContent";

export default function QaPage() {
  const { state, update } = useAppState();
  const [copied, setCopied] = useState(false);

  const currentHash = currentInputsHash(state);
  const unlocked = gateUnlocked(state);
  const series = useMemo(
    () => parseDeckText(state.deckText),
    [state.deckText]
  );
  const paragraphCount = deckParagraphs(series).length;

  const formatStale = Boolean(
    state.formatRun && state.formatRun.runHash !== currentHash
  );
  const contentStale = Boolean(
    state.contentRun && state.contentRun.runHash !== currentHash
  );

  const runFormat = () => {
    const outcome = runFormatQa(state.pastedBuild);
    update({
      formatRun: {
        checks: outcome.checks,
        passed: outcome.passed,
        runHash: currentInputsHash(state),
      },
    });
  };

  const runContent = () => {
    const outcome = runContentQa(state.pastedBuild, series);
    update({
      contentRun: {
        checks: outcome.checks,
        passed: outcome.passed,
        runHash: currentInputsHash(state),
      },
    });
  };

  const copyBuild = async () => {
    try {
      await navigator.clipboard.writeText(state.pastedBuild);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="page">
      <div className="pagehead">
        PAGE 2 — QA <span>after production · its own page</span>
      </div>
      <div className="body">
        <div className="deckline" style={{ marginTop: 0 }}>
          Two separate QAs run on this page. <b>Both must pass</b> on the
          current build + deck before the build is released. Changing
          anything in Production — or the pasted build — voids a pass.
        </div>

        <label>Final build — paste the HTML code here</label>
        <textarea
          className="paste"
          rows={8}
          value={state.pastedBuild}
          onChange={(e) => update({ pastedBuild: e.target.value })}
          placeholder="Paste the final build HTML here — both QAs run against this exact build…"
        />

        <QaSection
          heading="QA 1 — TEXT FORMAT QA"
          headingNote="rule book: text-formatting-guide.html (the p-class bible)"
          runLabel="RUN TEXT FORMAT QA"
          onRun={runFormat}
          run={state.formatRun}
          stale={formatStale}
          statusLabel="TEXT FORMAT QA"
        />

        <div className="qahead">
          QA 2 — CONTENT QA <span>based on the copy deck provided</span>
        </div>
        <div className="deckline">
          Copy deck: 📎{" "}
          <b>{state.deckFileName || "pasted in Production"}</b> —{" "}
          {paragraphCount} paragraph{paragraphCount === 1 ? "" : "s"} · the
          content of the final build above is compared against this deck, word
          for word.{" "}
          <Link href="/">Review it on Page 1</Link>
        </div>
        <QaSection
          heading=""
          headingNote=""
          runLabel="RUN CONTENT QA"
          onRun={runContent}
          run={state.contentRun}
          stale={contentStale}
          statusLabel="CONTENT QA"
        />

        <div className="verdict">
          <div className="vfail">
            <b>✗ EITHER QA FAILS</b> — no build is released. Fix, paste
            again, re-run the failed QA.
          </div>
          <div className="vpass">
            <b>✓ BOTH QAs PASS</b> — the cut-and-paste build is released,
            under its SFMC name.
            {unlocked ? (
              <button type="button" className="copybtn dark" onClick={copyBuild}>
                {copied ? "✓ Copied" : "Copy final build"}
              </button>
            ) : null}
          </div>
        </div>

        <DeliverableBar />
      </div>
    </div>
  );
}
