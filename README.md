# BlueShield Email Build App

A one-page (two-route) app for Blue Shield / SFMC email builds, built to
Spec v1 as amended through 2026-10-19. It replaces the manual
fill-the-template-by-hand workflow:

- **Page 1 — Production (`/`)**: establish the kind of email (Static or
  Dynamic), enter the job's fields, and generate the filled AMPscript
  from the template cluster for that build type. The copy deck is
  organised into `<p>` content blocks in its own window.
- **Page 2 — QA (`/qa`)**: paste the final build and run **two separate
  QAs** — QA 1 Text Format QA (tags vs the formatting guide) and QA 2
  Content QA (build content vs the copy deck). **Both must pass** on the
  current inputs before the cut-and-paste build is released. Any change
  to the build, the deck, or the production inputs voids a pass and
  re-locks the deliverable.

## Stack

Next.js (App Router) + React + TypeScript only — the owner's settled
stack. Hand-written CSS ported from the approved shell
(navy `#0f4c81` / teal `#0f8a7d`, two-window layout). No UI kits.
State is shared between the two routes via React context and persisted
to `localStorage`. Everything runs client-side; there is no backend
and no data leaves the browser.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm run start      # serve the production build
npm test           # Vitest suite (unit + app-flow integration)
npm run lint       # ESLint (next core-web-vitals + typescript)
```

The app opens with **every field empty** and both output windows
unoccupied — content appears only when you fill the job in and press
GENERATE OUTPUT. (The WinBack job — line with `REF4113200`, keycodes
`SAC, SD, LOC_PL`, A number `A57222IFP-EM5-(multi)_1026` — remains the
worked example the test suite runs against.)

## Vital fields

**Job number, A number, Subject line and Preheader are vital** (owner's
ruling, 2026-10-19): if any is missing, GENERATE OUTPUT flags the field
with a red outline and outputs nothing. In MULTI-SL/PH the subject /
preheader requirement applies per keycode. Every other field follows
the pruning rule — absent means simply not mentioned in the output
(e.g. no compliance number → no `@complianceNumber` line, no block).

Vital fields must also be RECOGNIZED, not just present. The rules were
SIMPLIFIED by the owner on 2026-10-20 after his real job data failed
the strict WinBack shapes (his A numbers look like `A55529GMAD_0626`;
his ref sits underscore-glued in the job line, `...MAD_REF3979650_A...`):

- **Job number:** must contain the letters `REF` in any capacity.
- **A number:** must start with `A` followed by a series of numbers
  and letters (separators `- _ ( ) .` allowed); the series must
  contain at least one digit and at least one letter.
- **Subject / preheader:** must read as coherent text (sentence-like:
  several words, mostly letters, vowel-bearing words — keyboard mash
  and nonsense fail).

Unrecognized input gets the same treatment as missing: red outline, an
"isn't recognized" error naming the field, and nothing output.
Validation lives in `lib/validation.ts`.

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel: **Add New → Project → Import** the repository.
3. Framework preset auto-detects **Next.js**; no environment variables
   are needed; no build settings to change.
4. Deploy. (`/` and `/qa` prerender as static content.)

## How it works

### Naming (Production)

The SFMC file name is derived live from the Job number field and shown
in the small window directly under it:

```
EM5 2027 OE IFP WinBack Email 5 More Choice (dynamic) 12/22 - REF4113200 …
        →  REF4113200_EM5_2027_OE_IFP_WinBack_Email_5_More_Choice_(dynam
```

Ref number first, then `_`, then the description from the **beginning**
of the line, words underscore-joined, **hard cut at 50 characters**
(raised from 20 by the owner on 2026-10-28).
This names the file **in SFMC** — it is not a local file and carries no
extension. In the AMPscript, `@refNumber` gets the **plain ref number
only**.

### Template clusters as objects

The three clusters in `templates/` are uneditable objects, called by
build type (`lib/templates.ts` registry):

| Cluster | Used for |
|---|---|
| `ampscript_file.html` | Static |
| `ampscript-file-dynamic.html` | Dynamic, one subject/preheader |
| `ampscript-file-dynamic-2.html` | Dynamic, subject/preheader **per keycode** |

Generation (`lib/ampscript.ts`) is a line-by-line transform of the
verbatim template, so comments and the commented send-log block pass
through untouched:

- `@MKT_LOB` = first keycode; one conditional branch per keycode
  (`IF` first, `ELSEIF` for the rest, `ENDIF`).
- Per branch: `@version` = that branch's keycode, `@aNumber`, and the
  fixed content set Marquee / contentONE / contentTWO / Disclaimer as
  `ContentBlockByKey(ref + "_" + keycode + type)` (owner's correction,
  2026-10-30: only the ref number and the keycode — the description
  segment lives in the SFMC file name, never in a key; Disclaimer is
  `ref + "_Disclaimer"`) — **no underscores
  between the components**; the Disclaimer key takes no keycode and is
  the same in every branch.
- **Pruning:** any unfilled field's line is removed entirely — no
  `SET @x = ""` or `ContentBlockByKey("")` ever appears (the only `""`
  left is the template's own commented `@TriggeredSendExternalKey`).
  With no keycodes, the whole conditional section is dropped.
- The generator reproduces the owner-approved golden example
  (`tests/fixtures/golden-dynamic.html`) **byte for byte** from the
  WinBack inputs — that is the acceptance test, and it runs in the
  suite.

### Copy deck parsing (under Content QA)

Paste the deck or upload a file (`.txt` / `.md` / `.html`; `.docx` via
mammoth). A blank line starts a new series; each line is a paragraph.
Every paragraph is wrapped in `<p>` with the class its **position** in
its series dictates, per the p-class bible
(`text-formatting-guide.html`): first `mar-0T--G`, middle **no class**,
last `mar-0B--G`, stand-alone `mar-0TB--G`. Deck text is HTML-escaped.

### Component building — deck records name the object (2026-10-29, corrected 2026-10-30)

The Production page holds **up to 7 copy deck windows** (the styled
**+ Add copy deck** button adds more; window 1 is the primary deck —
the one Content QA reads). A deck marks its areas with **records**
in the owner's format:

```
[marquee-component-1 [HEADLINE]]
Care that comes to you
[END]
```

The record names the template object (`templates/components/`,
registry in `lib/componentBuild.ts`) and the variable; the copy
after the marker — the content in the middle — replaces that
variable in that object at GENERATE OUTPUT. A record runs to the
next record marker, an `[END]`, or the end of the deck, whichever
comes first: `[END]` is a terminator when present, never a
requirement (real decks write `[component-2-b.html [bullet 1 a] ]`
with the copy on the same line and no `[END]` per record). The file
name, the bracketed variable marker and the `[END]` are deck-side
only and never appear in the built output. A deck may name both
marquee files (both get built); a record naming a file the app
doesn't carry is skipped with a warning. Decks written label-first
(`[HEADLINE]` copy `[text1]` copy …) still build through a label
fallback, with the called variant chosen by which labels the deck
provides. Copy is HTML-escaped into the styled slots; a variable
with no deck copy stays visible in the block and is named in a
warning — nothing is silently blanked. The disclaimer's AMPscript
(`%%…%%`) passes through untouched.

| Block | Objects |
|---|---|
| Marquee component | `marquee-component-1.html` / `marquee-component-2.html` |
| Content 1 | `component-1-a.html` |
| Content 2 | `component-2-a.html` / `component-2-b.html` |
| Disclaimer | `disclaimer-component.html` |

**Window 2 is retired** (owner's correction, 2026-10-30): the
Component HTML Output replaces it, and Window 1 (AMPscript) stretches
across alone. The panel gives **every deck its own row of buttons**
leading to its built blocks — tap one to view that block's HTML and
copy it — and once blocks are rendered, a **PREVIEW ALL BUILDS**
button appears, leading to **Page 3 — Preview**, which renders each
deck's built blocks stacked in an email window, with bottom arrows
(and dots) to shift through the builds, animated in the direction
of travel.

### The two QAs

- **QA 1 — Text Format QA** (`lib/qaFormat.ts`): parses the pasted
  build and checks H1 (34/38, weight 200), H2 (24/28 weight 200, or
  16/24 weight 600 in H3 context), H3 (16/24 weight 600), the
  positional `<p>` margin classes (footer legal paragraphs excluded —
  in the guide they are bare `<p>`s governed by the footer checks), and
  the footer's fixed legal blocks, present and in guide order.
- **QA 2 — Content QA** (`lib/qaContent.ts`): the build's text content
  vs the deck — every deck paragraph present, nothing extra in the
  build — ignoring AMPscript and known template chrome ("View this
  email as a web page", "Follow us:", the fixed legal footer blocks).
- **The gate** (`lib/state.ts`): each run is stamped with a hash of
  the pasted build + deck + production inputs. The deliverable unlocks
  only when both runs passed **and** their hashes match the current
  inputs; any edit re-locks it.

## Project structure

```
app/            routes: layout, / (Production), /qa (QA)
components/     StateProvider (context + localStorage), TopBar,
                OutputWindow, DeliverableBar, QaSection
lib/            naming, keycodes, templates (registry), templatesData
                (verbatim cluster sources), ampscript (generator),
                copyDeck, qaFormat, qaContent, qaTypes, state
templates/      the three AMPscript clusters — source of truth, unedited
tests/          Vitest: naming, keycodes, ampscript (incl. golden
                byte-equality + pruning), copyDeck, qaFormat,
                qaContent, appFlow (full user journey)
```

## Open items (from the spec/handoff — surfaced, not silently decided)

1. **Copy deck format** — the owner's real deck sample is still to be
   provided. Plain text (paste or `.txt`) is the implemented first
   format; `.md` / `.html` / `.docx` also work.
2. **Dynamic-2 derivation** — the delivered `ampscript-file-dynamic-2.html`
   is byte-identical to dynamic-1. As implemented: the variant moves
   `@subject` / `@preheader` into each branch (values from the
   per-keycode input rows) and moves `@title = @subject` into the
   branch after them, since a top-level `@title` can no longer refer
   to a per-branch subject. Top-level subject/preheader lines are
   removed. Owner to confirm placement.
3. **Static `@version` / `@MKT_LOB`** — Static has no keycodes and no
   Version field, so those empty template lines are **pruned** (the
   spec's candidate rule). Owner to confirm.
4. **The guide's "96"** beside Subject Line (character count?) —
   unconfirmed; not enforced anywhere.
5. **B1 stitching** — implemented as: Windows 1/2 are the production
   output; QA runs on the user-pasted final build; a both-pass
   releases the build for cut-and-paste into SFMC under its SFMC name.
6. **QA header identity** — the guide's job-header block (REF /
   Version / Subject line / Preheader) is not auto-checked against the
   job fields; the spec does not settle which §6 checks are automated.
7. **Duplicate keycodes** — exact duplicates are dropped at parse time
   (first occurrence kept): a repeated keycode would generate an
   identical, unreachable branch. The spec's ordered-array rule does
   not address duplicates.

## Notes

- `npm audit` could not be run in the build sandbox (its managed
  registry blocks the audit endpoint). Dependencies were installed at
  current majors (next 16.4.2, react 19.3.1, mammoth 1.13.0); run
  `npm audit` in your own environment or CI.
- The repository is initialised but deliberately **not committed** —
  no git identity was invented. Set `git config user.name/email`,
  commit, add your GitHub remote, and push when ready.
