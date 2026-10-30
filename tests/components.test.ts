/**
 * Component building (owner's design, 2026-10-29): copy decks mark
 * their areas with the bracket labels the component template objects
 * carry; Generate replaces the bracket variables with the deck's copy.
 * The variant object called is the one whose labels the deck provides.
 */
import { describe, expect, it } from "vitest";
import {
  buildComponentsForDeck,
  extractPlaceholders,
  parseBracketSections,
} from "@/lib/componentBuild";

const DECK_A = `
[HEADLINE]
Care that comes to you
[marquee copy]
Get your checkup at home & save <time>.
[CTA NAME]
Schedule now
[CTALINK]
https://example.com/schedule
[text1]
A short intro block.
[Header1]
First header
[bullet 1 a]
First bullet
[bullet 2 a]
Second bullet
[Header2]
Second header
[bullet 1 b]
Bullet one b
[bullet 2 b]
Bullet two b
[bullet 3 b]
Bullet three b
[Header3]
Third header
[content 1 a]
Content one a copy.
[Header4]
Fourth header
[bullet 1 c]
Bullet one c
[bullet 2 c]
Bullet two c
[Header5]
Fifth header
[content 2 a]
Content two a copy.
[content 2 b]
Content two b copy.
[disclaimer1]
Y0118_26 legal copy goes here.
`;

const DECK_B = `
[Header]
Marquee generic header
[marquee body]
Marquee body copy.
[CTA NAME]
Book today
[CTA LINK]
https://example.com/book
[Header a]
Alpha header
[bullet 1 a]
Alpha bullet one
[bullet 2 a]
Alpha bullet two
[Header]
Second generic header
[bullet 1 b]
Beta bullet one
[bullet 2 b]
Beta bullet two
[content 1 a]
Content one a copy.
[Header b]
Beta header
[content 1 b]
Content one b copy.
`;

describe("bracket section parsing", () => {
  it("splits the deck on known bracket labels only", () => {
    const sections = parseBracketSections(
      "Deck title\n[NOTE] not a component label\n[HEADLINE] Big headline\n[marquee copy] Body [draft] stays as copy"
    );
    expect(sections.get("headline")).toEqual(["Big headline"]);
    expect(sections.get("marqueecopy")).toEqual(["Body [draft] stays as copy"]);
    expect(sections.has("note")).toBe(false);
  });

  it("keeps repeated labels as ordered values", () => {
    const sections = parseBracketSections(DECK_B);
    expect(sections.get("header")).toEqual([
      "Marquee generic header",
      "Second generic header",
    ]);
  });

  it("extracts template placeholders, skipping Outlook conditionals", () => {
    const labels = extractPlaceholders(
      "<!--[if !mso]><!--> x <!--<![endif]--> [HEADLINE] [CTA NAME]"
    );
    expect(labels).toEqual(["HEADLINE", "CTA NAME"]);
  });
});

describe("component building — deck A calls variant 1 / A objects", () => {
  const build = buildComponentsForDeck({
    id: "deck-1",
    name: "Deck A",
    text: DECK_A,
  });

  it("builds all four blocks in email order", () => {
    expect(build.components.map((c) => c.name)).toEqual([
      "Marquee component",
      "Content 1",
      "Content 2",
      "Disclaimer",
    ]);
    expect(build.warnings).toEqual([]);
  });

  it("calls marquee-component-1 and component-2-a", () => {
    expect(build.components[0].fileName).toBe("marquee-component-1.html");
    expect(build.components[2].fileName).toBe("component-2-a.html");
  });

  it("replaces every bracket variable with the deck's copy, escaped", () => {
    const marquee = build.components[0];
    expect(marquee.html).toContain("Care that comes to you");
    expect(marquee.html).toContain(
      "Get your checkup at home &amp; save &lt;time&gt;."
    );
    expect(marquee.html).toContain('href="https://example.com/schedule"');
    expect(marquee.html).not.toContain("[HEADLINE]");
    expect(marquee.missingLabels).toEqual([]);
    const content2 = build.components[2];
    expect(content2.html).toContain("Bullet three b");
    expect(content2.missingLabels).toEqual([]);
  });

  it("leaves the disclaimer's AMPscript expressions untouched", () => {
    const disclaimer = build.components[3];
    expect(disclaimer.html).toContain("Y0118_26 legal copy goes here.");
    expect(disclaimer.html).toContain("%%=v(@aNumber)=%%");
    expect(disclaimer.html).not.toContain("[disclaimer1]");
  });
});

describe("component building — deck B calls variant 2 / B objects", () => {
  const build = buildComponentsForDeck({
    id: "deck-2",
    name: "Deck B",
    text: DECK_B,
  });

  it("calls marquee-component-2 and component-2-b", () => {
    const marquee = build.components.find((c) => c.groupId === "marquee");
    const content2 = build.components.find((c) => c.groupId === "content2");
    expect(marquee?.fileName).toBe("marquee-component-2.html");
    expect(content2?.fileName).toBe("component-2-b.html");
    expect(marquee?.missingLabels).toEqual([]);
    expect(content2?.missingLabels).toEqual([]);
  });

  it("fills repeated [Header] placeholders from repeated deck areas, in order", () => {
    const content2 = build.components.find((c) => c.groupId === "content2")!;
    const first = content2.html.indexOf("Marquee generic header");
    const second = content2.html.indexOf("Second generic header");
    expect(first).toBeGreaterThan(-1);
    expect(second).toBeGreaterThan(first);
  });
});

describe("component building — gaps stay visible", () => {
  it("an unlabeled deck builds nothing and says why", () => {
    const build = buildComponentsForDeck({
      id: "deck-x",
      name: "Plain prose",
      text: "Just paragraphs.\n\nNo labels anywhere.",
    });
    expect(build.components).toEqual([]);
    expect(build.warnings[0]).toContain("No bracket-labelled copy areas");
  });

  it("a partial deck builds the called block with its gaps named", () => {
    const build = buildComponentsForDeck({
      id: "deck-y",
      name: "Partial",
      text: "[HEADLINE]\nOnly a headline",
    });
    const marquee = build.components.find((c) => c.groupId === "marquee");
    expect(marquee).toBeTruthy();
    expect(marquee!.missingLabels).toContain("marquee copy");
    expect(marquee!.html).toContain("[marquee copy]");
    expect(build.components).toHaveLength(1);
  });
});
