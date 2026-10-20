import { describe, expect, it } from "vitest";
import { runFormatQa } from "@/lib/qaFormat";

const FOOTER = `
<p>Apple and the Apple logo are trademarks of Apple Inc. App Store is a service mark of Apple Inc.</p>
<p>Google Play and the Google Play logo are trademarks of Google LLC.</p>
<p>For more help and resources, visit our website or call Customer Service at the number on your Blue Shield member ID card. If you do not have your ID card, you can call (800) 393-6130 (TTY: 711).</p>
<p>This is a promotional email from Blue Shield of California, an independent member of the Blue Shield Association.</p>
<p>If you'd like to be removed from all future email communications, unsubscribe here.</p>
<p>Language Assistance Notice — call for help in your language.</p>
<p>Nondiscrimination Notice — we do not discriminate.</p>
<p>Blue Shield of California | 601 12th Street | Oakland, CA 94607</p>`;

const PASSING_BUILD = `
<h1 style="font-weight: 200; font-size: 34px; line-height: 38px;">More choice for 2027</h1>
<h2 style="font-weight: 200; font-size: 24px; line-height: 28px;">Your options</h2>
<div>
  <p class="mar-0T--G">First paragraph of the series.</p>
  <p>Middle paragraph of the series.</p>
  <p class="mar-0B--G">Last paragraph of the series.</p>
</div>
<div>
  <p class="mar-0TB--G">A stand-alone paragraph.</p>
</div>
${FOOTER}`;

describe("QA 1 — Text Format QA", () => {
  it("passes a build that follows the guide", () => {
    const outcome = runFormatQa(PASSING_BUILD);
    if (!outcome.passed) {
      // Surface the failing checks to make failures debuggable.
      console.log(outcome.checks.filter((c) => c.status === "fail"));
    }
    expect(outcome.passed).toBe(true);
  });

  it("fails an H1 with the wrong type size", () => {
    const build = PASSING_BUILD.replace("font-size: 34px", "font-size: 30px");
    const outcome = runFormatQa(build);
    expect(outcome.passed).toBe(false);
    const h1 = outcome.checks.find((c) => c.id.startsWith("h1"));
    expect(h1?.status).toBe("fail");
  });

  it("fails when an H1 is missing entirely", () => {
    const build = PASSING_BUILD.replace(/<h1[\s\S]*?<\/h1>/, "");
    const outcome = runFormatQa(build);
    expect(outcome.passed).toBe(false);
  });

  it("accepts an H2 in H3 context (16/24, weight 600)", () => {
    const build = PASSING_BUILD.replace(
      'style="font-weight: 200; font-size: 24px; line-height: 28px;"',
      'style="font-weight: 600; font-size: 16px; line-height: 24px;"'
    );
    const outcome = runFormatQa(build);
    const h2 = outcome.checks.find((c) => c.id.startsWith("h2"));
    expect(h2?.status).toBe("pass");
  });

  it("fails a last-in-series paragraph missing mar-0B--G, located by its text", () => {
    const build = PASSING_BUILD.replace(
      '<p class="mar-0B--G">Last paragraph of the series.</p>',
      "<p>Last paragraph of the series.</p>"
    );
    const outcome = runFormatQa(build);
    expect(outcome.passed).toBe(false);
    const failing = outcome.checks.find(
      (c) => c.status === "fail" && c.label.includes("Last paragraph")
    );
    expect(failing).toBeDefined();
    expect(failing?.detail).toContain("mar-0B--G");
  });

  it("fails a middle paragraph carrying a mar-* class", () => {
    const build = PASSING_BUILD.replace(
      "<p>Middle paragraph of the series.</p>",
      '<p class="mar-0T--G">Middle paragraph of the series.</p>'
    );
    const outcome = runFormatQa(build);
    expect(outcome.passed).toBe(false);
  });

  it("fails a missing footer legal block", () => {
    const build = PASSING_BUILD.replace(/Nondiscrimination Notice/g, "Fairness Notice");
    const outcome = runFormatQa(build);
    expect(outcome.passed).toBe(false);
    const block = outcome.checks.find((c) => c.id === "footer-nondiscrimination");
    expect(block?.status).toBe("fail");
  });

  it("fails footer blocks that are out of order", () => {
    const build = `
<h1 style="font-weight: 200; font-size: 34px; line-height: 38px;">Headline</h1>
<p>Google Play and the Google Play logo are trademarks of Google LLC.</p>
<p>Apple and the Apple logo are trademarks of Apple Inc. App Store is a service mark of Apple Inc.</p>
<p>For more help and resources, visit our website or call Customer Service at the number on your Blue Shield member ID card. If you do not have your ID card, you can call (800) 393-6130 (TTY: 711).</p>
<p>This is a promotional email from Blue Shield of California, an independent member of the Blue Shield Association.</p>
<p>If you'd like to be removed from all future email communications, unsubscribe here.</p>
<p>Language Assistance Notice — call for help in your language.</p>
<p>Nondiscrimination Notice — we do not discriminate.</p>
<p>Blue Shield of California | 601 12th Street | Oakland, CA 94607</p>`;
    const outcome = runFormatQa(build);
    const order = outcome.checks.find((c) => c.id === "footer-order");
    expect(order?.status).toBe("fail");
  });

  it("fails on an empty paste window", () => {
    const outcome = runFormatQa("   ");
    expect(outcome.passed).toBe(false);
  });
});
