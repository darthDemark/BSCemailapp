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
        →  REF4113200_EM5_2027_OE_IFP_WinB
```

Ref number first, then `_`, then the description from the **beginning**
of the line, words underscore-joined, **hard cut at 20 characters**.
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
  `ContentBlockByKey(baseName + keycode + type)` — **no underscores
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

### Copy deck → Window 2

Paste the deck or upload a file (`.txt` / `.md` / `.html`; `.docx` via
mammoth). A blank line starts a new series; each line is a paragraph.
Every paragraph is wrapped in `<p>` with the class its **position** in
its series dictates, per the p-class bible
(`text-formatting-guide.html`): first `mar-0T--G`, middle **no class**,
last `mar-0B--G`, stand-alone `mar-0TB--G`. Deck text is HTML-escaped.

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
