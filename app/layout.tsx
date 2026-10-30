import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { StateProvider } from "@/components/StateProvider";
import { TopBar } from "@/components/TopBar";

export const metadata: Metadata = {
  title: "BlueShield Email Build App — Production + QA",
  description:
    "One-page app for SFMC email builds: Production (AMPscript assembly from template clusters) and QA (text-format + content gates).",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <StateProvider>
          <div className="sheet">
            <TopBar />
            {children}
            <div className="foot">
              Production and QA are separate pages. Window 1 is the
              AMPscript output; the Component HTML Output below it
              carries the built blocks, and Page 3 renders the preview.
              Text Format QA compares against the guide
              (text-formatting-guide.html); Content QA compares against
              the copy deck provided. Both must pass.
            </div>
          </div>
        </StateProvider>
      </body>
    </html>
  );
}
