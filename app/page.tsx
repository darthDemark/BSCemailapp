"use client";

import { useMemo, useState } from "react";
import { useAppState } from "@/components/StateProvider";
import { OutputWindow } from "@/components/OutputWindow";
import { DeliverableBar } from "@/components/DeliverableBar";
import { ComponentOutputPanel } from "@/components/ComponentOutputPanel";
import { generateAmpscript } from "@/lib/ampscript";
import {
  parseDeckText,
  pClassFor,
  pClassLabel,
  readDeckFile,
  renderDeckHtml,
} from "@/lib/copyDeck";
import { parseKeycodes } from "@/lib/keycodes";
import {
  buildComponentsForDeck,
  MAX_DECK_WINDOWS,
  type DeckEntry,
} from "@/lib/componentBuild";
import { validateVitalFields } from "@/lib/validation";
import { deriveSfmcName } from "@/lib/naming";

export default function ProductionPage() {
  const { state, update } = useAppState();
  // Vital-field errors (owner's ruling, 2026-10-19): Job number, A number,
  // Subject line and Preheader are VITAL. Missing any one → error state on
  // the field and NOTHING is output. Compliance stays optional (pruned).
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedBuildId, setSelectedBuildId] = useState("");
  const [selectedComponentId, setSelectedComponentId] = useState("");
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

  const onDeckFile = async (index: number, file: File | undefined) => {
    if (!file) return;
    try {
      const result = await readDeckFile(file);
      updateDeck(index, { text: result.text, name: result.fileName });
    } catch {
      // Unreadable file: leave the deck as-is.
    }
  };

  // Deck windows (owner's design, 2026-10-29): up to 7 copy decks at
  // once. Window 1 is the primary deck (deckText/deckFileName — the
  // deck Window 2 and Content QA have always used); windows 2..7 live
  // in extraDecks. ALL windows feed the component builder at Generate.
  const deckEntries: DeckEntry[] = [
    {
      id: "deck-1",
      name: state.deckFileName || "Copy deck 1",
      text: state.deckText,
    },
    ...state.extraDecks,
  ];

  const updateDeck = (index: number, patch: Partial<DeckEntry>) => {
    if (index === 0) {
      update({
        ...(patch.text !== undefined ? { deckText: patch.text } : {}),
        ...(patch.name !== undefined ? { deckFileName: patch.name } : {}),
      });
      return;
    }
    update({
      extraDecks: state.extraDecks.map((deck, i) =>
        i === index - 1 ? { ...deck, ...patch } : deck
      ),
    });
  };

  const addDeck = () => {
    if (deckEntries.length >= MAX_DECK_WINDOWS) return;
    update({
      extraDecks: [
        ...state.extraDecks,
        {
          id: `deck-${Date.now()}`,
          name: `Copy deck ${deckEntries.length + 1}`,
          text: "",
        },
      ],
    });
  };

  const removeDeck = (index: number) => {
    if (index === 0) return;
    update({
      extraDecks: state.extraDecks.filter((_, i) => i !== index - 1),
    });
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
      update({
        generatedAmpscript: "",
        generatedDeckText: "",
        componentBuilds: [],
      });
      return;
    }
    update({
      generatedDeckText: state.deckText,
      componentBuilds: deckEntries
        .filter((deck) => deck.text.trim().length > 0)
        .map((deck) => buildComponentsForDeck(deck)),
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

        <div className="decksectionhead">
          <label style={{ margin: 0 }}>
            Copy decks — component build ({deckEntries.length}/
            {MAX_DECK_WINDOWS} windows)
          </label>
          <button
            type="button"
            className="adddeckbtn"
            onClick={addDeck}
            disabled={deckEntries.length >= MAX_DECK_WINDOWS}
            aria-label="Add a copy deck window"
            title={
              deckEntries.length >= MAX_DECK_WINDOWS
                ? "Window limit reached (7)"
                : "Add a copy deck window"
            }
          >
            <span className="plus" aria-hidden="true">
              +
            </span>{" "}
            Add copy deck
          </button>
        </div>

        {deckEntries.map((deck, index) => (
          <div className="deckcard" key={deck.id}>
            <div className="deckcardhead">
              <span>
                COPY DECK {index + 1}
                {index === 0 ? " — PRIMARY" : ""}
                {deck.name && deck.name !== `Copy deck ${index + 1}` ? (
                  <>
                    {" "}· loaded: <b>{deck.name}</b>
                  </>
                ) : null}
              </span>
              {index > 0 ? (
                <button
                  type="button"
                  className="removedeck"
                  onClick={() => removeDeck(index)}
                  aria-label={`Remove copy deck ${index + 1}`}
                >
                  ✕
                </button>
              ) : null}
            </div>
            <div className="field">
              📎{" "}
              <input
                type="file"
                accept=".txt,.md,.html,.htm,.docx"
                onChange={(e) => onDeckFile(index, e.target.files?.[0])}
              />{" "}
              · or paste the deck below
            </div>
            <textarea
              className="field deckinput"
              rows={5}
              value={deck.text}
              onChange={(e) =>
                updateDeck(index, {
                  text: e.target.value,
                  ...(index === 0 ? { name: "" } : {}),
                })
              }
              placeholder="Paste the copy deck here — bracket labels like [HEADLINE] mark where each area of copy goes…"
              aria-label={`Copy deck ${index + 1}`}
            />
          </div>
        ))}

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

        {state.componentBuilds.length > 0 ? (
          <ComponentOutputPanel
            builds={state.componentBuilds}
            selectedBuildId={selectedBuildId}
            selectedComponentId={selectedComponentId}
            onSelectBuild={(id) => {
              setSelectedBuildId(id);
              setSelectedComponentId("");
            }}
            onSelectComponent={setSelectedComponentId}
          />
        ) : null}

        <DeliverableBar />
      </div>
    </div>
  );
}
