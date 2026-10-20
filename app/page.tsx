"use client";

import { useMemo, useState } from "react";
import { useAppState } from "@/components/StateProvider";
import { OutputWindow } from "@/components/OutputWindow";
import { DeliverableBar } from "@/components/DeliverableBar";
import { generateAmpscript } from "@/lib/ampscript";
import {
  parseDeckText,
  pClassFor,
  pClassLabel,
  readDeckFile,
  renderDeckHtml,
} from "@/lib/copyDeck";
import { parseKeycodes } from "@/lib/keycodes";
import { validateVitalFields } from "@/lib/validation";
import { deriveSfmcName } from "@/lib/naming";

export default function ProductionPage() {
  const { state, update } = useAppState();
  // Vital-field errors (owner's ruling, 2026-10-19): Job number, A number,
  // Subject line and Preheader are VITAL. Missing any one → error state on
  // the field and NOTHING is output. Compliance stays optional (pruned).
  const [errors, setErrors] = useState<Record<string, string>>({});
  const cls = (base: string, key: string) =>
    errors[key] ? `${base} invalid` : base;
  const clearError = (key: string) =>
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const sfmcName = deriveSfmcName(state.jobNumber);
  const keycodes = useMemo(
    () => parseKeycodes(state.keycodesRaw),
    [state.keycodesRaw]
  );
  const series = useMemo(
    () => parseDeckText(state.generatedDeckText),
    [state.generatedDeckText]
  );
  const deckHtml = useMemo(() => renderDeckHtml(series), [series]);

  const isDynamic = state.buildType === "dynamic";
  const isMulti = isDynamic && state.variant === "multi";

  const onDeckFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const result = await readDeckFile(file);
      update({ deckText: result.text, deckFileName: result.fileName });
    } catch {
      // Unreadable file: leave the deck as-is.
    }
  };

  const setPerKeycode = (
    keycode: string,
    field: "subject" | "preheader",
    value: string
  ) => {
    const current = state.perKeycode[keycode] ?? { subject: "", preheader: "" };
    update({
      perKeycode: {
        ...state.perKeycode,
        [keycode]: { ...current, [field]: value },
      },
    });
  };

  const setPerKeycodeA = (keycode: string, value: string) => {
    update({
      perKeycodeA: { ...state.perKeycodeA, [keycode]: value },
    });
  };

  const aNumberField = (keycode: string) => (
    <div key={keycode}>
      <label>A number — {keycode}</label>
      <input
        className={cls("field mono", `aNumber:${keycode}`)}
        type="text"
        aria-invalid={errors[`aNumber:${keycode}`] ? true : undefined}
        value={state.perKeycodeA[keycode] ?? ""}
        onChange={(e) => {
          clearError(`aNumber:${keycode}`);
          setPerKeycodeA(keycode, e.target.value);
        }}
      />
    </div>
  );

  const generate = () => {
    const errs = validateVitalFields({
      jobNumber: state.jobNumber,
      aNumber: state.aNumber,
      isDynamic,
      perKeycodeA: state.perKeycodeA,
      subject: state.subject,
      preheader: state.preheader,
      isMulti,
      keycodes,
      perKeycode: state.perKeycode,
    });
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      // Nothing gets outputted when a vital field is missing.
      update({ generatedAmpscript: "", generatedDeckText: "" });
      return;
    }
    update({
      generatedDeckText: state.deckText,
      generatedAmpscript: generateAmpscript({
        buildType: state.buildType,
        variant: state.variant,
        jobNumber: state.jobNumber,
        keycodesRaw: state.keycodesRaw,
        aNumber: state.aNumber,
        perKeycodeA: state.perKeycodeA,
        complianceNumber: state.complianceNumber,
        subject: state.subject,
        preheader: state.preheader,
        perKeycode: state.perKeycode,
      }),
    });
  };

  return (
    <div className="page">
      <div className="pagehead">
        PAGE 1 — PRODUCTION{" "}
        <span>gather the job · fill the template · produce the output</span>
      </div>
      <div className="body">
        <label style={{ marginTop: 0 }}>Step 0 — What kind of email?</label>
        <div className="toggle" role="radiogroup" aria-label="Email type">
          <label className={state.buildType === "static" ? "t-opt on" : "t-opt"}>
            <input
              type="radio"
              name="email-type"
              checked={state.buildType === "static"}
              onChange={() => update({ buildType: "static" })}
            />{" "}
            STATIC{state.buildType === "static" ? " ✓" : ""}
          </label>
          <label
            className={state.buildType === "dynamic" ? "t-opt on" : "t-opt"}
          >
            <input
              type="radio"
              name="email-type"
              checked={state.buildType === "dynamic"}
              onChange={() => update({ buildType: "dynamic" })}
            />{" "}
            DYNAMIC{state.buildType === "dynamic" ? " ✓" : ""}
          </label>
        </div>

        {isDynamic ? (
          <div className="variantrow" role="radiogroup" aria-label="Dynamic variant">
            <label className={state.variant === "single" ? "v-opt on" : "v-opt"}>
              <input
                type="radio"
                name="variant"
                checked={state.variant === "single"}
                onChange={() => update({ variant: "single" })}
              />{" "}
              ONE SL/PH
            </label>
            <label className={state.variant === "multi" ? "v-opt on" : "v-opt"}>
              <input
                type="radio"
                name="variant"
                checked={state.variant === "multi"}
                onChange={() => update({ variant: "multi" })}
              />{" "}
              MULTI-SL/PH
            </label>
          </div>
        ) : null}

        <label>Job number</label>
        <input
          className={cls("field mono", "jobNumber")}
          type="text"
          aria-invalid={errors.jobNumber ? true : undefined}
          value={state.jobNumber}
          onChange={(e) => {
            clearError("jobNumber");
            update({ jobNumber: e.target.value });
          }}
        />
        <output className="filename">
          <b>Small window — file name in SFMC (auto, from the job number)</b>
          {sfmcName || "—"}
        </output>

        <div className="grid">
          {isDynamic ? (
            <div>
              <label>Key codes (in order)</label>
              <input
                className="field mono"
                type="text"
                value={state.keycodesRaw}
                onChange={(e) => update({ keycodesRaw: e.target.value })}
              />
            </div>
          ) : null}
          {!isDynamic ? (
          <div>
            <label>A number</label>
            <input
              className={cls("field mono", "aNumber")}
              type="text"
              aria-invalid={errors.aNumber ? true : undefined}
              value={state.aNumber}
              onChange={(e) => {
                clearError("aNumber");
                update({ aNumber: e.target.value });
              }}
            />
          </div>
          ) : null}
          <div>
            <label>Compliance number</label>
            <input
              className="field mono"
              type="text"
              value={state.complianceNumber}
              onChange={(e) => update({ complianceNumber: e.target.value })}
            />
          </div>
        </div>

        {isDynamic && !isMulti && keycodes.length > 0 ? (
          <>
            <label>A numbers — a different one per keycode</label>
            <div className="grid">{keycodes.map(aNumberField)}</div>
          </>
        ) : null}

        {!isMulti ? (
          <div className="grid">
            <div>
              <label>Subject line</label>
              <input
                className={cls("field", "subject")}
                type="text"
                aria-invalid={errors.subject ? true : undefined}
                value={state.subject}
                onChange={(e) => {
                  clearError("subject");
                  update({ subject: e.target.value });
                }}
              />
            </div>
            <div>
              <label>Preheader</label>
              <input
                className={cls("field", "preheader")}
                type="text"
                aria-invalid={errors.preheader ? true : undefined}
                value={state.preheader}
                onChange={(e) => {
                  clearError("preheader");
                  update({ preheader: e.target.value });
                }}
              />
            </div>
          </div>
        ) : (
          <>
            <label>Subject lines + preheaders — one per keycode</label>
            {keycodes.length === 0 ? (
              <div className="deckline">
                Add key codes above — each keycode gets its own subject line
                and preheader row.
              </div>
            ) : (
              keycodes.map((keycode) => (
                <div className="grid" key={keycode}>
                  <div>
                    <label>
                      Subject — {keycode}
                    </label>
                    <input
                      className={cls("field", `subject:${keycode}`)}
                      type="text"
                      aria-invalid={errors[`subject:${keycode}`] ? true : undefined}
                      value={state.perKeycode[keycode]?.subject ?? ""}
                      onChange={(e) => {
                        clearError(`subject:${keycode}`);
                        setPerKeycode(keycode, "subject", e.target.value);
                      }}
                    />
                  </div>
                  <div>
                    <label>Preheader — {keycode}</label>
                    <input
                      className={cls("field", `preheader:${keycode}`)}
                      type="text"
                      aria-invalid={errors[`preheader:${keycode}`] ? true : undefined}
                      value={state.perKeycode[keycode]?.preheader ?? ""}
                      onChange={(e) => {
                        clearError(`preheader:${keycode}`);
                        setPerKeycode(keycode, "preheader", e.target.value);
                      }}
                    />
                  </div>
                  {aNumberField(keycode)}
                </div>
              ))
            )}
          </>
        )}

        <label>Copy deck</label>
        <div className="field">
          📎{" "}
          <input
            type="file"
            accept=".txt,.md,.html,.htm,.docx"
            onChange={(e) => onDeckFile(e.target.files?.[0])}
          />{" "}
          · or paste the deck below · paragraphs sorted into &lt;p&gt; blocks,
          classes per the p-class bible
          {state.deckFileName ? <> · loaded: <b>{state.deckFileName}</b></> : null}
        </div>
        <textarea
          className="field"
          rows={5}
          value={state.deckText}
          onChange={(e) => update({ deckText: e.target.value, deckFileName: "" })}
          placeholder="Paste the copy deck text here — a blank line starts a new series of paragraphs…"
        />

        {Object.keys(errors).length > 0 ? (
          <div className="errorbar">
            ✗ {Object.values(errors).join("; ")} — nothing was output.
          </div>
        ) : null}
        <button className="btn" type="button" onClick={generate}>
          GENERATE OUTPUT
        </button>

        <div className="wins">
          <OutputWindow
            title="WINDOW 1 — AMPscript CODE OUTPUT"
            dark
            copyText={state.generatedAmpscript || undefined}
          >
            {state.generatedAmpscript ? (
              <pre>{state.generatedAmpscript}</pre>
            ) : null}
          </OutputWindow>

          <OutputWindow
            title="WINDOW 2 — COPY DECK CONTENT OUTPUT (its own window)"
            copyText={deckHtml || undefined}
          >
            {series.length === 0 ? null : (
              series.map((paragraphs, si) => (
                <div key={si}>
                  {paragraphs.map((paragraph, pi) => {
                    const cls = pClassFor(paragraphs.length, pi);
                    return (
                      <div className="deckpara" key={pi}>
                        <code>
                          {cls ? `<p class="${cls}">` : "<p>"}
                        </code>{" "}
                        {paragraph}{" "}
                        <code>{"</p>"}</code>
                        <span className={cls ? "chip" : "chip none"}>
                          {pClassLabel(paragraphs.length, pi)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </OutputWindow>
        </div>

        <DeliverableBar />
      </div>
    </div>
  );
}
