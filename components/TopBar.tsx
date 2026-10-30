"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppState } from "./StateProvider";
import { gateUnlocked } from "@/lib/state";

export function TopBar() {
  const pathname = usePathname();
  const { state, reset } = useAppState();
  const unlocked = gateUnlocked(state);

  return (
    <>
      <h1 className="app">BlueShield Email Build App</h1>
      <div className="sub">Page 1 Production → Page 2 QA → Page 3 Preview</div>
      <nav className="topnav">
        <Link href="/" className={pathname === "/" ? "navlink on" : "navlink"}>
          Page 1 — Production
        </Link>
        <Link
          href="/qa"
          className={pathname === "/qa" ? "navlink on" : "navlink"}
        >
          Page 2 — QA
        </Link>
        <Link
          href="/preview"
          className={pathname === "/preview" ? "navlink on" : "navlink"}
        >
          Page 3 — Preview
        </Link>
        <span className={unlocked ? "gatebadge open" : "gatebadge"}>
          {unlocked
            ? "✓ DELIVERABLE RELEASED"
            : "🔒 DELIVERABLE LOCKED — QA must pass"}
        </span>
        <button type="button" className="resetbtn" onClick={reset}>
          Field Reset
        </button>
      </nav>
    </>
  );
}
