"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ComponentBuild } from "@/lib/componentBuild";

interface ComponentOutputPanelProps {
  builds: ComponentBuild[];
  selectedBuildId: string;
  selectedComponentId: string;
  onSelect: (buildId: string, componentId: string) => void;
}

/**
 * The Component HTML Output (owner's design, 2026-10-29; corrected
 * 2026-10-30): it replaces the old Window 2. EVERY deck gets its own
 * row of buttons leading to its built blocks — tap one to view that
 * block's HTML and copy it. Once blocks are rendered, a button to
 * the Preview page appears at the bottom.
 */
export function ComponentOutputPanel({
  builds,
  selectedBuildId,
  selectedComponentId,
  onSelect,
}: ComponentOutputPanelProps) {
  const selectedBuild =
    builds.find((b) => b.id === selectedBuildId) ??
    builds.find((b) => b.components.length > 0) ??
    builds[0];
  const component =
    selectedBuild.components.find((c) => c.id === selectedComponentId) ??
    selectedBuild.components[0];
  const anyComponents = builds.some((b) => b.components.length > 0);

  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setCopied(false);
  }, [component?.id, selectedBuild.id]);

  const copy = async () => {
    if (!component) return;
    try {
      await navigator.clipboard.writeText(component.html);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="componentpanel" aria-label="Component HTML output">
      <div className="componentpanelhead">
        COMPONENT HTML OUTPUT — BUILT BLOCKS
        <span>bracket variables replaced with the deck&apos;s copy</span>
      </div>
      <div className="componentpanelbody">
        {builds.map((build, buildIndex) => (
          <div className="deckblocks" key={build.id}>
            <div className="deckblockshead">
              DECK {buildIndex + 1} — {build.deckName}
            </div>
            {build.warnings.map((warning) => (
              <div className="deckline warnline" key={warning}>
                ⚠ {warning}
              </div>
            ))}
            {build.components.length > 0 ? (
              <div className="componenttabs">
                {build.components.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={
                      selectedBuild.id === build.id && component?.id === c.id
                        ? "compbtn on"
                        : "compbtn"
                    }
                    onClick={() => onSelect(build.id, c.id)}
                  >
                    {c.name}
                    <span>{c.fileName}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ))}

        {component ? (
          <>
            <div className="componentcodehead">
              <span>
                {selectedBuild.deckName} — {component.name} —{" "}
                {component.fileName}
              </span>
              <button type="button" className="copybtn dark" onClick={copy}>
                {copied ? "✓ Copied" : "Copy HTML"}
              </button>
            </div>
            <pre className="componentcode">{component.html}</pre>
            {component.missingLabels.length > 0 ? (
              <div className="deckline warnline">
                ⚠ No copy in the deck for:{" "}
                {component.missingLabels
                  .map((label) => `[${label}]`)
                  .join(", ")}{" "}
                — those variables are still in the block above.
              </div>
            ) : null}
          </>
        ) : null}

        {anyComponents ? (
          <div className="previewcta">
            <Link className="btn previewlink" href="/preview">
              PREVIEW ALL BUILDS →
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}
