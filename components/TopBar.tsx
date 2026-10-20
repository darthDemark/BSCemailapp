"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppState } from "./StateProvider";
import { gateUnlocked } from "@/lib/state";

export function TopBar() {
  const pathname = usePathname();
  const { state } = useAppState();
  const unlocked = gateUnlocked(state);

  return (
    <>
      <h1 className="app">BlueShield Email Build App</h1>
      <div className="sub">Page 1 Production → Page 2 QA</div>
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
        <span className={unlocked ? "gatebadge open" : "gatebadge"}>
          {unlocked
            ? "✓ DELIVERABLE RELEASED"
            : "🔒 DELIVERABLE LOCKED — QA must pass"}
        </span>
      </nav>
    </>
  );
}
