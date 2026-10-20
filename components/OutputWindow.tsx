"use client";

import { useState, type ReactNode } from "react";

interface OutputWindowProps {
  title: string;
  dark?: boolean;
  /** Plain text offered to the copy button (Window 1). */
  copyText?: string;
  children: ReactNode;
}

export function OutputWindow({
  title,
  dark = false,
  copyText,
  children,
}: OutputWindowProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!copyText) return;
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={dark ? "win dark" : "win light"}>
      <div className="winhead">
        {title}
        {copyText ? (
          <button type="button" className="copybtn" onClick={copy}>
            {copied ? "✓ Copied" : "Copy"}
          </button>
        ) : null}
      </div>
      <div className="winbody">{children}</div>
    </div>
  );
}
