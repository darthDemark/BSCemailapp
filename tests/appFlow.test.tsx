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
    const monoInputs =
      container.querySelectorAll<HTMLInputElement>("input.field.mono");
    const [jobInput, keycodesField, aField, complianceField] = Array.from(
      monoInputs
    ) as HTMLInputElement[];
    fireEvent.change(jobInput, { target: { value: WINBACK_LINE } });
    fireEvent.change(keycodesField, {
      target: { value: "SAC, SD, LOC_PL" },
    });
    fireEvent.change(aField, {
      target: { value: "A57222IFP-EM5-(multi)_1026" },
    });
    fireEvent.change(complianceField, {
      target: { value: "BSC-COMP-2026-001" },
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
      "REF4113200_EM5_2027_OE_IFP_WinB"
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
      "REF4113200_EM9_2027_OE_IFP_WinB"
    );
    fireEvent.change(jobInput, { target: { value: WINBACK_LINE } });
    expect(fileNameOut?.textContent).toContain(
      "REF4113200_EM5_2027_OE_IFP_WinB"
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

describe("vital fields (owner's ruling, 2026-10-19)", () => {
  it("missing a vital field flags it red and outputs nothing; filling it unblocks", async () => {
    window.localStorage.clear(); // isolate from the journey test's saved state
    const user = userEvent.setup();
    const { container } = renderApp();
    const monoInputs =
      container.querySelectorAll<HTMLInputElement>("input.field.mono");
    const [jobInput, keycodesField, aField] = Array.from(
      monoInputs
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
    // A number deliberately left EMPTY — Generate must refuse.
    await user.click(container.querySelector<HTMLButtonElement>("button.btn")!);
    const win1 = container.querySelector(".win.dark .winbody");
    expect(win1?.textContent?.trim()).toBe("");
    expect(aField.classList.contains("invalid")).toBe(true);
    expect(container.querySelector(".errorbar")?.textContent).toContain(
      "A number"
    );
    // Fill it — error clears, output flows.
    fireEvent.change(aField, {
      target: { value: "A57222IFP-EM5-(multi)_1026" },
    });
    expect(aField.classList.contains("invalid")).toBe(false);
    await user.click(container.querySelector<HTMLButtonElement>("button.btn")!);
    expect(win1?.textContent).toContain('SET @refNumber = "REF4113200"');
  });
});
