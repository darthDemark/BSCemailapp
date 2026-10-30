"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAppState } from "@/components/StateProvider";
import type { ComponentBuild } from "@/lib/componentBuild";

/**
 * Page 3 — Preview (owner's design, 2026-10-29): the built component
 * blocks rendered inside a window, one build at a time, shifted
 * through with arrows at the bottom.
 */

const PREVIEW_CSS = `
  body { margin: 0; background: #eef2f6; font-family: 'Fieldwork', Verdana, 'Helvetica Neue', sans-serif; }
  table { border-collapse: collapse; }
  img { max-width: 100%; }
  p { margin: 16px 0; }
  .mar-0T--G { margin-top: 0; }
  .mar-0B--G { margin-bottom: 0; }
  .mar-0TB--G { margin-top: 0; margin-bottom: 0; }
  .footer { font-family: Arial, sans-serif; font-size: 12px; line-height: 1.35; color: #434345; }
`;

function previewDocument(build: ComponentBuild): string {
  const body = build.components.map((c) => c.html).join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${PREVIEW_CSS}</style></head><body>${body}</body></html>`;
}

export default function PreviewPage() {
  const { state } = useAppState();
  const builds = state.componentBuilds.filter(
    (build) => build.components.length > 0
  );
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<"next" | "prev">("next");

  useEffect(() => {
    if (index > builds.length - 1) setIndex(Math.max(0, builds.length - 1));
  }, [builds.length, index]);

  const go = (delta: number) => {
    if (builds.length === 0) return;
    setDirection(delta >= 0 ? "next" : "prev");
    setIndex((i) => (i + delta + builds.length) % builds.length);
  };

  const build = builds[Math.min(index, Math.max(0, builds.length - 1))];

  return (
    <div className="page">
      <div className="pagehead">
        PAGE 3 — PREVIEW{" "}
        <span>the built blocks, rendered — shift through the builds</span>
      </div>
      <div className="body">
        {builds.length === 0 || !build ? (
          <div className="deckline">
            Nothing to preview yet. Add a copy deck on Page 1 — Production
            and press GENERATE OUTPUT; every deck that builds component
            blocks gets a slide here.{" "}
            <Link href="/">← Back to Production</Link>
          </div>
        ) : (
          <>
            <div className="previewmeta">
              <b>{build.deckName}</b>
              <span>
                {build.components
                  .map((c) => c.name)
                  .join(" · ")}
              </span>
            </div>
            <div
              className={`previewstage ${direction}`}
              key={`${build.id}-${index}`}
            >
              <div className="previewwindow">
                <div className="previewwindowbar">
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                  <span className="previewwindowtitle">
                    Rendered build — {build.deckName}
                  </span>
                </div>
                <iframe
                  className="previewframe"
                  title={`Rendered build: ${build.deckName}`}
                  sandbox=""
                  srcDoc={previewDocument(build)}
                />
              </div>
            </div>
            <div className="previewnav">
              <button
                type="button"
                className="arrowbtn"
                onClick={() => go(-1)}
                aria-label="Previous build"
                disabled={builds.length < 2}
              >
                ‹
              </button>
              <div className="previewdots">
                {builds.map((b, i) => (
                  <button
                    key={b.id}
                    type="button"
                    className={i === index ? "pdot on" : "pdot"}
                    aria-label={`Go to build ${i + 1}`}
                    onClick={() => {
                      setDirection(i >= index ? "next" : "prev");
                      setIndex(i);
                    }}
                  />
                ))}
                <span className="previewcount">
                  Build {index + 1} of {builds.length}
                </span>
              </div>
              <button
                type="button"
                className="arrowbtn"
                onClick={() => go(1)}
                aria-label="Next build"
                disabled={builds.length < 2}
              >
                ›
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
