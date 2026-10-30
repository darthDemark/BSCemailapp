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
  parseDeckRecords,
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
[Header b]
Second header
[bullet 1 b]
Beta bullet one
[bullet 2 b]
Beta bullet two
[Header c]
Third header
[content 1 a]
Content one a copy.
[Header d]
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
    const sections = parseBracketSections("[Header]\nOne\n[Header]\nTwo");
    expect(sections.get("header")).toEqual(["One", "Two"]);
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

  it("fills the distinct [Header a]-[Header d] areas in order (owner's revision, 2026-10-30)", () => {
    const content2 = build.components.find((c) => c.groupId === "content2")!;
    const positions = ["Alpha header", "Second header", "Third header", "Beta header"].map(
      (h) => content2.html.indexOf(h)
    );
    expect(positions.every((pos) => pos > -1)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
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

const RECORD_DECK = `
[marquee-component-1 [HEADLINE]]
Care that comes to you
[END]
[marquee-component-1 [marquee copy]]
Get your checkup at home.
[END]
[marquee-component-1 [CTA NAME]]
Schedule now
[END]
[marquee-component-1 [CTALINK]]
https://example.com/schedule
[END]
[component-1-a [text1]]
Intro copy here.
[END]
[component-2-b [Header a]]
Alpha header
[END]
[component-2-b [bullet 1 a]]
Alpha bullet one
[END]
[component-2-b [bullet 2 a]]
Alpha bullet two
[END]
[component-2-b [Header b]]
Second header
[END]
[component-2-b [bullet 1 b]]
Beta bullet one
[END]
[component-2-b [bullet 2 b]]
Beta bullet two
[END]
[component-2-b [Header c]]
Third header
[END]
[component-2-b [content 1 a]]
Content one a copy.
[END]
[component-2-b [Header d]]
Beta header
[END]
[component-2-b [content 1 b]]
Content one b copy.
[END]
[disclaimer-component [disclaimer1]]
Legal copy here.
[END]
`;

describe("record grammar (owner's correction, 2026-10-30)", () => {
  it("parses [file name [variable]] copy [END] records", () => {
    const records = parseDeckRecords(RECORD_DECK);
    expect(records).toHaveLength(16);
    expect(records[0]).toMatchObject({
      fileKey: "marquee-component-1",
      variableKey: "headline",
      copy: "Care that comes to you",
    });
  });

  it("builds exactly the objects the deck names", () => {
    const build = buildComponentsForDeck({
      id: "deck-r",
      name: "Record deck",
      text: RECORD_DECK,
    });
    expect(build.components.map((c) => c.name)).toEqual([
      "Marquee component",
      "Content 1",
      "Content 2",
      "Disclaimer",
    ]);
    expect(build.components[0].fileName).toBe("marquee-component-1.html");
    expect(build.components[2].fileName).toBe("component-2-b.html");
    expect(
      build.components.every((c) => c.missingLabels.length === 0)
    ).toBe(true);
    expect(build.components[0].html).toContain("Care that comes to you");
    expect(build.components[2].html).toContain("Beta header");
  });

  it("keeps the file name, the variable marker and [END] OUT of the output", () => {
    const build = buildComponentsForDeck({
      id: "deck-r",
      name: "Record deck",
      text: RECORD_DECK,
    });
    for (const c of build.components) {
      expect(c.html).not.toContain("[END]");
      expect(c.html).not.toContain("[HEADLINE]");
      expect(c.html).not.toContain("marquee-component-1");
      expect(c.html).not.toContain("component-2-b");
      expect(c.html).not.toContain("disclaimer-component");
    }
  });

  it("keeps brackets inside the copy itself", () => {
    const build = buildComponentsForDeck({
      id: "deck-r2",
      name: "Bracket copy",
      text: "[component-1-a [text1]] Read the [draft] notes carefully [END]",
    });
    expect(build.components[0].html).toContain("Read the [draft] notes carefully");
  });

  it("builds both marquees when the deck names both files", () => {
    const build = buildComponentsForDeck({
      id: "deck-r3",
      name: "Both marquees",
      text:
        "[marquee-component-1 [HEADLINE]] First headline [END]\n" +
        "[marquee-component-2 [Header]] Second headline [END]",
    });
    const marquees = build.components.filter((c) => c.groupId === "marquee");
    expect(marquees.map((c) => c.fileName)).toEqual([
      "marquee-component-1.html",
      "marquee-component-2.html",
    ]);
  });

  it("warns on files the app doesn't carry and builds the rest", () => {
    const build = buildComponentsForDeck({
      id: "deck-r4",
      name: "Unknown file",
      text:
        "[mystery-file [text1]] Boo [END]\n" +
        "[component-1-a [text1]] Real copy [END]",
    });
    expect(build.warnings.join(" ")).toContain("mystery-file");
    expect(build.components.map((c) => c.name)).toEqual(["Content 1"]);
  });
});
