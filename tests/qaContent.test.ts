import { describe, expect, it } from "vitest";
import { parseDeckText } from "@/lib/copyDeck";
import { runContentQa } from "@/lib/qaContent";

const DECK = parseDeckText(
  "More choice is coming to your 2027 plan.\nEnroll by December 22 to keep your doctors.\n\nQuestions? Call the number on your ID card."
);

const MATCHING_BUILD = `
<p>View this email as a web page</p>
<h1>More choice is coming to your 2027 plan.</h1>
<p>Enroll by December 22 to keep your doctors.</p>
<p>Questions? Call the number on your ID card.</p>
<p>Follow us:</p>
<p>Apple and the Apple logo are trademarks of Apple Inc. App Store is a service mark of Apple Inc.</p>
<p>Google Play and the Google Play logo are trademarks of Google LLC.</p>
<p>For more help and resources, visit our website or call Customer Service at the number on your Blue Shield member ID card. If you do not have your ID card, you can call (800) 393-6130 (TTY: 711).</p>
<p>This is a promotional email from Blue Shield of California, an independent member of the Blue Shield Association.</p>
<p>If you'd like to be removed from all future email communications from Blue Shield of California, unsubscribe here.</p>
<p>Language Assistance Notice — free help in your language.</p>
<p>Nondiscrimination Notice — we do not discriminate.</p>
<p>Blue Shield of California | 601 12th Street | Oakland, CA 94607</p>`;

describe("QA 2 — Content QA", () => {
  it("passes when the build content matches the deck (chrome ignored)", () => {
    const outcome = runContentQa(MATCHING_BUILD, DECK);
    if (!outcome.passed) console.log(outcome.checks.filter((c) => c.status === "fail"));
    expect(outcome.passed).toBe(true);
    expect(outcome.missing).toEqual([]);
    expect(outcome.extra).toEqual([]);
  });

  it("detects a deck paragraph missing from the build", () => {
    const build = MATCHING_BUILD.replace(
      "<p>Enroll by December 22 to keep your doctors.</p>",
      ""
    );
    const outcome = runContentQa(build, DECK);
    expect(outcome.passed).toBe(false);
    expect(outcome.missing).toContain("Enroll by December 22 to keep your doctors.");
    const check = outcome.checks.find((c) => c.id === "deck-present");
    expect(check?.status).toBe("fail");
  });

  it("detects extra content in the build that is not in the deck", () => {
    const build = MATCHING_BUILD.replace(
      "</p>\n<p>Follow us:</p>",
      "</p><p>Act now for a special bonus offer nobody approved.</p>\n<p>Follow us:</p>"
    );
    const outcome = runContentQa(build, DECK);
    expect(outcome.passed).toBe(false);
    expect(outcome.extra).toContain(
      "Act now for a special bonus offer nobody approved."
    );
  });

  it("ignores AMPscript when comparing content", () => {
    const build = `%%[\nSET @subject = "Hello"\nSET @MKT_LOB = "SAC"\n]%%\n${MATCHING_BUILD}`;
    const outcome = runContentQa(build, DECK);
    expect(outcome.passed).toBe(true);
  });

  it("fails when no deck was provided", () => {
    const outcome = runContentQa(MATCHING_BUILD, []);
    expect(outcome.passed).toBe(false);
  });

  it("fails when the paste window is empty", () => {
    const outcome = runContentQa("  ", DECK);
    expect(outcome.passed).toBe(false);
  });

  it("is case/whitespace-insensitive in spirit (word-for-word content)", () => {
    const build = MATCHING_BUILD.replace(
      "More choice is coming to your 2027 plan.",
      "MORE choice  is coming to your 2027 plan."
    );
    const outcome = runContentQa(build, DECK);
    expect(outcome.passed).toBe(true);
  });
});
