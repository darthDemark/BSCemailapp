import { describe, expect, it } from "vitest";
import {
  parseDeckText,
  pClassFor,
  renderDeckHtml,
} from "@/lib/copyDeck";

describe("deck parsing (SPEC §5)", () => {
  it("splits series on blank lines and paragraphs on single lines", () => {
    const series = parseDeckText("One.\nTwo.\n\nThree.");
    expect(series).toEqual([["One.", "Two."], ["Three."]]);
  });

  it("ignores empty input and stray blank lines", () => {
    expect(parseDeckText("")).toEqual([]);
    expect(parseDeckText("\n\n  \n")).toEqual([]);
  });
});

describe("p-class assignment (the bible: position in series)", () => {
  it("stand-alone paragraph gets mar-0TB--G", () => {
    expect(pClassFor(1, 0)).toBe("mar-0TB--G");
  });

  it("first gets mar-0T--G, last gets mar-0B--G", () => {
    expect(pClassFor(3, 0)).toBe("mar-0T--G");
    expect(pClassFor(3, 2)).toBe("mar-0B--G");
    expect(pClassFor(2, 0)).toBe("mar-0T--G");
    expect(pClassFor(2, 1)).toBe("mar-0B--G");
  });

  it("middle paragraphs get NO class", () => {
    expect(pClassFor(3, 1)).toBe("");
    expect(pClassFor(5, 2)).toBe("");
  });

  it("renders <p> blocks with positional classes", () => {
    const html = renderDeckHtml([["Alpha", "Beta", "Gamma"], ["Solo"]]);
    expect(html).toContain('<p class="mar-0T--G">Alpha</p>');
    expect(html).toContain("<p>Beta</p>");
    expect(html).toContain('<p class="mar-0B--G">Gamma</p>');
    expect(html).toContain('<p class="mar-0TB--G">Solo</p>');
  });

  it("HTML-escapes deck text", () => {
    const html = renderDeckHtml([['Prices <b>drop</b> & "save"']]);
    expect(html).toContain("Prices &lt;b&gt;drop&lt;/b&gt; &amp; &quot;save&quot;");
    expect(html).not.toContain("<b>drop</b>");
  });
});
