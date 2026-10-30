"use client";

import { useEffect, useState } from "react";
import type { ComponentBuild } from "@/lib/componentBuild";

interface ComponentOutputPanelProps {
  builds: ComponentBuild[];
  selectedBuildId: string;
  selectedComponentId: string;
  onSelectBuild: (id: string) => void;
  onSelectComponent: (id: string) => void;
}

/**
 * The window that appears below Generate with the built component
 * blocks (owner's design, 2026-10-29): one button per component block
 * — tap it to view that block's HTML and copy it.
 */
export function ComponentOutputPanel({
  builds,
  selectedBuildId,
  selectedComponentId,
  onSelectBuild,
  onSelectComponent,
}: ComponentOutputPanelProps) {
  const build =
    builds.find((b) => b.id === selectedBuildId) ?? builds[0];
  const component =
    build.components.find((c) => c.id === selectedComponentId) ??
    build.components[0];

  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setCopied(false);
  }, [component?.id, build.id]);

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
        <span>
          bracket variables replaced with the deck&apos;s copy
        </span>
      </div>
      <div className="componentpanelbody">
        {builds.length > 1 ? (
          <div className="buildtabs" role="tablist" aria-label="Copy decks">
            {builds.map((b, i) => (
              <button
                key={b.id}
                type="button"
                role="tab"
                aria-selected={b.id === build.id}
                className={b.id === build.id ? "buildtab on" : "buildtab"}
                onClick={() => onSelectBuild(b.id)}
              >
                Deck {i + 1} · {b.deckName}
              </button>
            ))}
          </div>
        ) : null}

        {build.warnings.map((warning) => (
          <div className="deckline warnline" key={warning}>
            ⚠ {warning}
          </div>
        ))}

        {component ? (
          <>
            <div className="componenttabs">
              {build.components.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={c.id === component.id ? "compbtn on" : "compbtn"}
                  onClick={() => onSelectComponent(c.id)}
                >
                  {c.name}
                  <span>{c.fileName}</span>
                </button>
              ))}
            </div>
            <div className="componentcodehead">
              <span>
                {component.name} — {component.fileName}
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
      </div>
    </section>
  );
}
