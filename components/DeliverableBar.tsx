"use client";

import { useState } from "react";
import { useAppState } from "./StateProvider";
import { gateUnlocked } from "@/lib/state";
import { deriveSfmcName } from "@/lib/naming";

export function DeliverableBar() {
  const { state } = useAppState();
  const unlocked = gateUnlocked(state);
  const sfmcName = deriveSfmcName(state.jobNumber);
  const [copied, setCopied] = useState(false);

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
    <div className={unlocked ? "filerow open" : "filerow"}>
      📄 Cut-and-paste build: <b>{sfmcName || "— no ref in job number —"}</b> —
      the name it carries in SFMC —{" "}
      {unlocked ? (
        <>
          ✓ <b>RELEASED</b> — both QAs passed on the current build
          <button type="button" className="copybtn dark" onClick={copyBuild}>
            {copied ? "✓ Copied" : "Copy final build"}
          </button>
        </>
      ) : (
        <>🔒 LOCKED until both QAs pass on Page 2</>
      )}
    </div>
  );
}
