/**
 * Audit 3 — UX & behaviour verification at the component level.
 *
 * Renders the REAL Production and QA pages under the REAL state
 * provider and drives them like a user: toggling build type, editing
 * the job number, generating output, running both QAs, and watching
 * the deliverable gate lock / release / re-lock. (A real-browser pass
 * was attempted separately; this suite is the executable record.)
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import ProductionPage from "@/app/page";
import QaPage from "@/app/qa/page";
import PreviewPage from "@/app/preview/page";
import { StateProvider } from "@/components/StateProvider";
import { STORAGE_KEY } from "@/lib/state";

const WINBACK_LINE =
  "EM5 2027 OE IFP WinBack Email 5 More Choice (dynamic) 12/22 - REF4113200 A57222IFP-EM5-(multi)_1026";

const PASSING_BUILD = `
<h1 style="font-weight: 200; font-size: 34px; line-height: 38px;">Questions? Call the number on your Blue Shield member ID card.</h1>
<div>
<p class="mar-0T--G">More choice is coming to your 2027 plan. Compare your options side by side to find the coverage that fits you best.</p>
<p>Enroll by December 22 to keep your doctors and the care you count on.</p>
<p class="mar-0B--G">Questions? Call the number on your Blue Shield member ID card.</p>
</div>
<div>
<p>Apple and the Apple logo are trademarks of Apple Inc. App Store is a service mark of Apple Inc.</p>
<p>Google Play and the Google Play logo are trademarks of Google LLC.</p>
<p>For more help and resources, visit our website or call Customer Service at the number on your Blue Shield member ID card. If you do not have your ID card, you can call (800) 393-6130 (TTY: 711).</p>
<p>This is a promotional email from Blue Shield of California, an independent member of the Blue Shield Association.</p>
<p>If you'd like to be removed from all future email communications from Blue Shield of California, unsubscribe here.</p>
<p>Language Assistance Notice — free help in your language.</p>
<p>Nondiscrimination Notice — we do not discriminate.</p>
<p>Blue Shield of California | 601 12th Street | Oakland, CA 94607</p>
</div>`;

function renderApp() {
  return render(
    <StateProvider>
      <ProductionPage />
      <QaPage />
    </StateProvider>
  );
}

describe("app flow — Production ↔ QA gate", () => {
  it("runs the full journey: fill → generate → QA pass → release → edit → re-lock", async () => {
    const user = userEvent.setup();
    const { container } = renderApp();

    // --- Production opens EMPTY (owner's call): no field is occupied ---
    const fileNameOut = container.querySelector("output.filename");
    expect(fileNameOut?.textContent).not.toContain("REF4113200");
    const winBodies = container.querySelectorAll(".winbody");
    expect(winBodies[0]?.textContent?.trim()).toBe("");
    expect(winBodies[1]?.textContent?.trim()).toBe("");

    // --- Fill the WinBack job in by hand ---
    const monoInputs = () =>
      container.querySelectorAll<HTMLInputElement>("input.field.mono");
    const [jobInput, keycodesField, complianceField] = Array.from(
      monoInputs()
    ) as HTMLInputElement[];
    fireEvent.change(jobInput, { target: { value: WINBACK_LINE } });
    fireEvent.change(keycodesField, {
      target: { value: "SAC, SD, LOC_PL" },
    });
    fireEvent.change(complianceField, {
      target: { value: "BSC-COMP-2026-001" },
    });
    // Dynamic: a DIFFERENT A number per keycode (2026-10-20 ruling).
    // The per-keycode A fields appear once keycodes exist: [3],[4],[5].
    const monos = Array.from(monoInputs()) as HTMLInputElement[];
    fireEvent.change(monos[3], {
      target: { value: "A57222IFP-EM5-(multi)_1026" },
    });
    fireEvent.change(monos[4], {
      target: { value: "A58333IFP-EM5-(multi)_1026" },
    });
    fireEvent.change(monos[5], {
      target: { value: "A59444IFP-EM5-(multi)_1026" },
    });
    const textFields =
      container.querySelectorAll<HTMLInputElement>("input.field:not(.mono)");
    fireEvent.change(textFields[0], {
      target: { value: "You have more choice in your coverage" },
    });
    fireEvent.change(textFields[1], {
      target: { value: "See what is new for your 2027 plan" },
    });
    const deckBox =
      container.querySelector<HTMLTextAreaElement>("textarea.field")!;
    fireEvent.change(deckBox, {
      target: {
        value:
          "More choice is coming to your 2027 plan. Compare your options side by side to find the coverage that fits you best.\n" +
          "Enroll by December 22 to keep your doctors and the care you count on.\n\n" +
          "Questions? Call the number on your Blue Shield member ID card.",
      },
    });
    expect(fileNameOut?.textContent).toContain(
      "REF4113200_EM5_2027_OE_IFP_WinBack_Email_5_More_Choice_(dynam"
    );
    const keycodesInput = () =>
      screen.queryByDisplayValue("SAC, SD, LOC_PL");
    expect(keycodesInput()).not.toBeNull();

    // --- Static/Dynamic toggle swaps the field set ---
    const typeRadios = container.querySelectorAll<HTMLInputElement>(
      'input[name="email-type"]'
    );
    await user.click(typeRadios[0]); // STATIC
    expect(keycodesInput()).toBeNull();
    expect(
      screen.queryByDisplayValue("You have more choice in your coverage")
    ).not.toBeNull(); // subject remains in Static
    await user.click(typeRadios[1]); // back to DYNAMIC
    expect(keycodesInput()).not.toBeNull();

    // --- File-name window updates live with the job number ---
    fireEvent.change(jobInput, {
      target: { value: WINBACK_LINE.replace("EM5", "EM9") },
    });
    expect(fileNameOut?.textContent).toContain(
      "REF4113200_EM9_2027_OE_IFP_WinBack_Email_5_More_Choice_(dynam"
    );
    fireEvent.change(jobInput, { target: { value: WINBACK_LINE } });
    expect(fileNameOut?.textContent).toContain(
      "REF4113200_EM5_2027_OE_IFP_WinBack_Email_5_More_Choice_(dynam"
    );

    // --- Generate: Window 1 (golden structure) and Window 2 (separate) ---
    await user.click(
      screen.getByRole("button", { name: "GENERATE OUTPUT" })
    );
    const win1 = container.querySelector(".win.dark .winbody pre");
    expect(win1?.textContent).toContain('SET @refNumber = "REF4113200"');
    expect(win1?.textContent?.match(/ContentBlockByKey/g)).toHaveLength(12);
    const win2 = container.querySelector(".win.light .winbody");
    expect(win2?.textContent).toContain("first in series → mar-0T--G");
    expect(win2?.textContent).toContain("stand-alone → mar-0TB--G");
    expect(container.querySelectorAll(".win")).toHaveLength(2);

    // --- Gate starts LOCKED on both pages' deliverable bars ---
    const filerows = () =>
      Array.from(container.querySelectorAll(".filerow"));
    expect(filerows()).toHaveLength(2);
    expect(
      filerows().every((el) => el.textContent?.includes("LOCKED"))
    ).toBe(true);

    // --- QA page: two separate QAs, each with its own run ---
    expect(screen.getByText(/QA 1 — TEXT FORMAT QA/)).toBeTruthy();
    expect(screen.getByText(/QA 2 — CONTENT QA/)).toBeTruthy();
    const paste = container.querySelector<HTMLTextAreaElement>(
      "textarea.paste"
    )!;
    fireEvent.change(paste, { target: { value: PASSING_BUILD } });

    await user.click(
      screen.getByRole("button", { name: "RUN TEXT FORMAT QA" })
    );
    await user.click(screen.getByRole("button", { name: "RUN CONTENT QA" }));

    await waitFor(() => {
      expect(
        Array.from(container.querySelectorAll(".qastatus")).some((el) =>
          el.textContent?.startsWith("TEXT FORMAT QA:")
        )
      ).toBe(true);
    });
    const statuses = Array.from(
      container.querySelectorAll(".qastatus")
    ).map((el) => el.textContent ?? "");
    expect(
      statuses.some(
        (s) => s.startsWith("TEXT FORMAT QA:") && s.includes("✓ PASS")
      )
    ).toBe(true);
    expect(
      statuses.some((s) => s.startsWith("CONTENT QA:") && s.includes("✓ PASS"))
    ).toBe(true);

    // --- Both pass → deliverable RELEASED everywhere ---
    expect(
      filerows().every((el) => el.textContent?.includes("RELEASED"))
    ).toBe(true);

    // --- Editing the pasted build voids the pass and re-locks ---
    fireEvent.change(paste, {
      target: { value: `${PASSING_BUILD}\n<!-- edited -->` },
    });
    await waitFor(() => {
      expect(
        filerows().every((el) => el.textContent?.includes("LOCKED"))
      ).toBe(true);
    });
    const voided = Array.from(container.querySelectorAll(".qastatus")).map(
      (el) => el.textContent ?? ""
    );
    expect(voided.some((s) => s.includes("VOID"))).toBe(true);

    // --- State persisted to localStorage ---
    const saved = window.localStorage.getItem(STORAGE_KEY);
    expect(saved).toBeTruthy();
    expect(JSON.parse(saved!).buildType).toBe("dynamic");
    expect(JSON.parse(saved!).pastedBuild).toContain("edited");
  });
});

describe("vital fields (owner's ruling, 2026-10-19/20)", () => {
  const fillExceptA = (container: HTMLElement) => {
    const monoInputs = () =>
      container.querySelectorAll<HTMLInputElement>("input.field.mono");
    const [jobInput, keycodesField] = Array.from(
      monoInputs()
    ) as HTMLInputElement[];
    fireEvent.change(jobInput, { target: { value: WINBACK_LINE } });
    fireEvent.change(keycodesField, {
      target: { value: "SAC, SD, LOC_PL" },
    });
    const textFields =
      container.querySelectorAll<HTMLInputElement>("input.field:not(.mono)");
    fireEvent.change(textFields[0], {
      target: { value: "You have more choice in your coverage" },
    });
    fireEvent.change(textFields[1], {
      target: { value: "See what is new for your 2027 plan" },
    });
    // Per-keycode A fields are [3],[4],[5] in mono order.
    return () => Array.from(monoInputs()) as HTMLInputElement[];
  };

  it("missing A numbers: generate refuses, flags each keycode's field, outputs nothing — then recovers", async () => {
    window.localStorage.clear();
    const user = userEvent.setup();
    const { container } = renderApp();
    const monos = fillExceptA(container);
    await user.click(container.querySelector<HTMLButtonElement>("button.btn")!);
    const win1 = () =>
      container.querySelector(".win.dark .winbody")?.textContent?.trim();
    expect(win1()).toBe("");
    const aFirst = monos()[3];
    expect(aFirst.classList.contains("invalid")).toBe(true);
    expect(container.querySelector(".errorbar")?.textContent).toContain(
      "A number (SAC) is missing"
    );

    // Fill every keycode's A number: error clears, output generates.
    fireEvent.change(monos()[3], {
      target: { value: "A57222IFP-EM5-(multi)_1026" },
    });
    fireEvent.change(monos()[4], {
      target: { value: "A58333IFP-EM5-(multi)_1026" },
    });
    fireEvent.change(monos()[5], {
      target: { value: "A59444IFP-EM5-(multi)_1026" },
    });
    await user.click(container.querySelector<HTMLButtonElement>("button.btn")!);
    expect(win1()).toContain('SET @refNumber = "REF4113200"');
    expect(win1()).toContain('SET @aNumber = "A59444IFP-EM5-(multi)_1026"');
    expect(container.querySelector(".errorbar")).toBeNull();

    // Clearing a vital field re-blocks AND wipes the previous output.
    fireEvent.change(monos()[3], { target: { value: "" } });
    await user.click(container.querySelector<HTMLButtonElement>("button.btn")!);
    expect(win1()).toBe("");
    expect(container.querySelector(".errorbar")?.textContent).toContain(
      "A number"
    );
  });

  it("gibberish in a vital field throws 'isn't recognized' and outputs nothing", async () => {
    window.localStorage.clear();
    const user = userEvent.setup();
    const { container } = renderApp();
    const monos = fillExceptA(container);
    fireEvent.change(monos()[3], { target: { value: "gibberish!!" } });
    fireEvent.change(monos()[4], {
      target: { value: "A58333IFP-EM5-(multi)_1026" },
    });
    fireEvent.change(monos()[5], {
      target: { value: "A59444IFP-EM5-(multi)_1026" },
    });
    await user.click(container.querySelector<HTMLButtonElement>("button.btn")!);
    const win1 = container.querySelector(".win.dark .winbody");
    expect(win1?.textContent?.trim()).toBe("");
    expect(monos()[3].classList.contains("invalid")).toBe(true);
    expect(container.querySelector(".errorbar")?.textContent).toContain(
      "isn't recognized"
    );
  });
});

describe("component decks (owner's design, 2026-10-29)", () => {
  it("caps copy deck windows at 7 and removes them again", async () => {
    window.localStorage.clear();
    const user = userEvent.setup();
    const { container } = render(
      <StateProvider>
        <ProductionPage />
      </StateProvider>
    );
    const addBtn = () =>
      container.querySelector<HTMLButtonElement>(".adddeckbtn")!;
    const deckBoxes = () =>
      container.querySelectorAll("textarea.deckinput");
    expect(deckBoxes()).toHaveLength(1);
    for (let i = 0; i < 6; i++) await user.click(addBtn());
    expect(deckBoxes()).toHaveLength(7);
    expect((addBtn() as HTMLButtonElement).disabled).toBe(true);
    await user.click(
      container.querySelector<HTMLButtonElement>(
        '[aria-label="Remove copy deck 7"]'
      )!
    );
    expect(deckBoxes()).toHaveLength(6);
    expect((addBtn() as HTMLButtonElement).disabled).toBe(false);
  });

  it("generates component blocks from bracket-labelled decks and previews both builds", async () => {
    window.localStorage.clear();
    const user = userEvent.setup();
    const { container } = render(
      <StateProvider>
        <ProductionPage />
        <PreviewPage />
      </StateProvider>
    );

    // Static job: one A number, shared subject/preheader.
    const typeRadios = container.querySelectorAll<HTMLInputElement>(
      'input[name="email-type"]'
    );
    await user.click(typeRadios[0]); // STATIC
    const monos = Array.from(
      container.querySelectorAll<HTMLInputElement>("input.field.mono")
    );
    fireEvent.change(monos[0], { target: { value: WINBACK_LINE } });
    fireEvent.change(monos[1], {
      target: { value: "A57222IFP-EM5-(multi)_1026" },
    });
    const textFields =
      container.querySelectorAll<HTMLInputElement>("input.field:not(.mono)");
    fireEvent.change(textFields[0], {
      target: { value: "You have more choice in your coverage" },
    });
    fireEvent.change(textFields[1], {
      target: { value: "See what is new for your 2027 plan" },
    });

    const deckBoxes = () =>
      container.querySelectorAll<HTMLTextAreaElement>("textarea.deckinput");
    fireEvent.change(deckBoxes()[0], {
      target: {
        value:
          "[HEADLINE]\nCare that comes to you\n[marquee copy]\nBody copy here.\n[CTA NAME]\nSchedule now\n[CTALINK]\nhttps://example.com/schedule\n[text1]\nIntro copy one.\n[disclaimer1]\nLegal copy one.",
      },
    });
    await user.click(
      container.querySelector<HTMLButtonElement>(".adddeckbtn")!
    );
    fireEvent.change(deckBoxes()[1], {
      target: { value: "[text1]\nIntro copy two." },
    });

    await user.click(container.querySelector<HTMLButtonElement>("button.btn")!);

    // Component panel: one button per built block; tap to view its HTML.
    const compBtn = (name: string) =>
      Array.from(container.querySelectorAll(".compbtn")).find((b) =>
        b.textContent?.includes(name)
      )!;
    expect(compBtn("Marquee component")).toBeTruthy();
    expect(compBtn("Disclaimer")).toBeTruthy();
    await user.click(compBtn("Content 1"));
    const code = container.querySelector(".componentcode");
    expect(code?.textContent).toContain("Intro copy one.");
    expect(code?.textContent).not.toContain("[text1]");

    // Preview page: two builds, arrows shift between them.
    const frame = () =>
      container.querySelector<HTMLIFrameElement>("iframe.previewframe");
    expect(frame()?.getAttribute("srcdoc")).toContain(
      "Care that comes to you"
    );
    expect(container.querySelector(".previewcount")?.textContent).toContain(
      "Build 1 of 2"
    );
    await user.click(
      container.querySelector<HTMLButtonElement>('[aria-label="Next build"]')!
    );
    expect(container.querySelector(".previewcount")?.textContent).toContain(
      "Build 2 of 2"
    );
    expect(frame()?.getAttribute("srcdoc")).toContain("Intro copy two.");
    await user.click(
      container.querySelector<HTMLButtonElement>(
        '[aria-label="Previous build"]'
      )!
    );
    expect(container.querySelector(".previewcount")?.textContent).toContain(
      "Build 1 of 2"
    );
  });
});
