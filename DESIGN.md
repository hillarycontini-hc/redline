---
name: Redline
description: A contract read back as a statement of account, every line quoting the sentence it came from.
colors:
  ledger-green: "#0e5c45"
  ledger-green-deep: "#0a4634"
  rule-soft: "rgba(14, 92, 69, 0.22)"
  rule-hair: "rgba(14, 92, 69, 0.12)"
  due-red: "#b8261a"
  due-red-wash: "rgba(184, 38, 26, 0.12)"
  carbon-violet: "#5b4a8a"
  ledger-stock: "#d7e2d1"
  statement-sheet: "#f3f6f0"
  statement-sunk: "#e9efe5"
  ink: "#16181a"
  ink-2: "#49514a"
  ink-3: "#5a635a"
typography:
  display:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(2.05rem, 5vw, 3.35rem)"
    fontWeight: 800
    lineHeight: 1.04
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(1.7rem, 3vw, 2.45rem)"
    fontWeight: 800
    lineHeight: 1.04
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(1.55rem, 2.6vw, 2.1rem)"
    fontWeight: 800
    lineHeight: 1.04
    letterSpacing: "-0.03em"
  clause:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.08rem"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tabular-nums"
  body-secondary:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 400
    lineHeight: 1.5
  masthead:
    fontFamily: "Archivo Narrow, Archivo, sans-serif"
    fontSize: "0.78rem"
    fontWeight: 600
    letterSpacing: "0.22em"
  label:
    fontFamily: "Archivo Narrow, Archivo, sans-serif"
    fontSize: "0.7rem"
    fontWeight: 600
    letterSpacing: "0.16em"
  label-small:
    fontFamily: "Archivo Narrow, Archivo, sans-serif"
    fontSize: "0.68rem"
    fontWeight: 600
    letterSpacing: "0.14em"
  tier:
    fontFamily: "Archivo Narrow, Archivo, sans-serif"
    fontSize: "0.74rem"
    fontWeight: 600
    letterSpacing: "0.1em"
  document:
    fontFamily: "Tinos, Times New Roman, serif"
    fontSize: "0.98rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "normal"
rounded:
  none: "0"
  pill: "999px"
spacing:
  hair: "0.35rem"
  xs: "0.5rem"
  sm: "0.75rem"
  md: "0.9rem"
  lg: "1rem"
  row: "1.15rem"
  gutter: "1.75rem"
  page: "clamp(0.75rem, 2.5vw, 2.5rem)"
  panel: "clamp(1.25rem, 3vw, 2.1rem)"
  panel-wide: "clamp(1.25rem, 3vw, 2.75rem)"
components:
  sheet:
    backgroundColor: "{colors.statement-sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    width: "78rem"
  button-primary:
    backgroundColor: "{colors.ledger-green}"
    textColor: "{colors.statement-sheet}"
    typography: "{typography.tier}"
    rounded: "{rounded.none}"
    padding: "0.7rem 1.15rem"
  button-primary-hover:
    backgroundColor: "{colors.ledger-green-deep}"
    textColor: "{colors.statement-sheet}"
  button-primary-disabled:
    backgroundColor: "transparent"
    textColor: "{colors.ink-3}"
  field-document:
    backgroundColor: "{colors.statement-sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.document}"
    rounded: "{rounded.none}"
    padding: "0.85rem 0.95rem"
    height: "8rem"
  field-document-drop:
    backgroundColor: "{colors.due-red-wash}"
    textColor: "{colors.ink}"
  panel-aside:
    backgroundColor: "{colors.statement-sunk}"
    textColor: "{colors.ink}"
    typography: "{typography.body-secondary}"
    rounded: "{rounded.none}"
    padding: "0.8rem 1rem"
  tier-critical:
    textColor: "{colors.due-red}"
    typography: "{typography.tier}"
  tier-serious:
    textColor: "{colors.ink}"
    typography: "{typography.tier}"
  tier-worth-knowing:
    textColor: "{colors.carbon-violet}"
    typography: "{typography.tier}"
---

# Design System: Redline

## Overview

**Creative North Star: "Statement of Account"**

Redline is printed, not rendered. The world is the pale columnar green of a real
accounting pad, ruled in ledger green, and every clause arrives as a line item on
a statement: what you are agreeing to, the sentence it came from, and what tier it
sits at. Structure is carried by rules and column alignment rather than by cards,
chrome, or lift. The one sheet on the page is a sheet of paper, and the eye reads
down it the way it reads down a bill.

The density is working density. The scene the build was made for is a kitchen
table at eleven at night with twenty minutes of dense contract text ahead, which
is why the ground is a tinted stock and never a lit white page. Colour is
accounting colour: green owns structure, red is reserved for what a clause costs
you and appears at Critical alone, carbon violet marks copies and the merely
worth knowing. Nothing is centred; the head is asymmetric and the statement body
runs the full measure beneath it.

The build refuses two arrangements by construction. There is no hero-metric
template, because severity is three words and never a number. There is no
headline-plus-shadowed-screenshot composition, because the mechanism itself — a
complete first line item with its quoted sentence and its counter-offer — is what
sits above the fold. No raster asset ships with this build, so the system carries
no imagery vocabulary at all.

**Key Characteristics:**

- Ledger stock ground, never white and never cream.
- Ledger green owns every rule, column head, and frame.
- Red means cost, at Critical alone.
- Zero corner radius on every surface; rules and alignment do the structural work.
- Three typefaces, each with one job.

## Colors

An accounting palette: a tinted green stock, near-black ink tinted toward the
ground, and two reserved accents that each mean one thing.

### Primary
- **Ledger Green** (`colors.ledger-green`): Every structural line in the build —
  the double rules that close the account head, the statement foot and the notes
  band; the single rule under the column heads; the entry field frame on hover;
  the column-head and masthead caps; the submit button's fill; links and the
  focus ring; text selection. If a line organises the page, it is this green.
- **Ledger Green Deep** (`colors.ledger-green-deep`): The submit button's hover
  fill only.
- **Rule Soft / Rule Hair** (`colors.rule-soft`, `colors.rule-hair`): The same
  green at 22% and 12%. Soft draws the sheet border, panel dividers, the masthead
  hairline, and the resting field frame; hair draws the between-row rules in the
  statement body, where a full-strength rule would out-weigh the entries.

### Secondary
- **Due Red** (`colors.due-red`): What a clause costs you. It carries the
  Critical tier word and its double rule, the underline that appears under a
  quoted sentence when its entry is open, the error band's rule and text, and the
  caret in every field. `colors.due-red-wash` at 12% fills the entry field while
  a file is being dragged onto it.

- **Ochre** (`colors.ochre`): The third ledger ink, after red and black. It
  carries the Serious tier word and its single rule, and nothing else. Added
  2026-10-02 so the three tiers read as a ladder rather than as red, black, and
  violet: Serious previously used plain ink, which made the middle tier the
  weakest signal on the page.

### Amount-column fields
- **Field Critical / Serious / Worth** (`colors.field-critical`,
  `colors.field-serious`, `colors.field-worth`): The due red, ochre, and carbon
  violet at 13%, 15%, and 12%, washing the right 9.5rem of each statement row so
  the amount column reads as a field down the page. **The wash is never the only
  cue.** Every tier still carries its word and its own rule, so the colour can be
  removed without losing the tier.
- **Field Head** (`colors.field-head`): Ledger green at 12%, washing the same
  9.5rem behind the column-head row so the field starts at its heading.

### Tertiary
- **Carbon Violet** (`colors.carbon-violet`): The carbon-copy colour. It carries
  the Worth-knowing tier word and its dotted rule, and the counter-offer panel's
  left rule and head.

### Neutral
- **Ledger Stock** (`colors.ledger-stock`): The page ground behind the sheet.
- **Statement Sheet** (`colors.statement-sheet`): The sheet itself, and the fill
  of a field sitting on a sunk panel.
- **Statement Sunk** (`colors.statement-sunk`): The recessed register — the entry
  panel, the notes band, the summary and counter-offer panels, and the row hover
  state.
- **Ink** (`colors.ink`): Body and heading text; also the Serious tier word and
  its single rule, which is how Serious reads as the unmarked middle.
- **Ink 2** (`colors.ink-2`): Consequence lines, subcopy, notes, the statement
  foot.
- **Ink 3** (`colors.ink-3`): Placeholders, disabled label text, a closed quoted
  sentence, and the reference mark.

### Named Rules

**The Never-White Rule.** No surface in this world is `#fff` or cream. The ground
is tinted stock, the sheet is a lighter tint of the same stock, and the recessed
register is a darker one. Three tints, one hue family.

**The Cost Rule.** Red is reserved for what a clause costs the reader. It appears
on the Critical tier, on an open quote's underline, on error, and on the caret —
nowhere else. It is never used for emphasis, decoration, or a second accent.

**The Tinted Ink Rule.** Secondary and tertiary ink are tinted from the ground's
hue. Neutral gray does not appear in this palette.

## Typography

**Display Font:** Archivo (with `system-ui`, `sans-serif`)
**Body Font:** Archivo (with `system-ui`, `sans-serif`)
**Label Font:** Archivo Narrow (with Archivo, `sans-serif`)
**Document Font:** Tinos (with Times New Roman, `serif`)

**Character:** A grotesk that speaks in the product's own voice, a condensed
grotesk for everything the statement sets in caps, and a Times-metric serif used
only when the reader's own document is on screen. The pairing is clerical rather
than editorial: the serif is not decoration, it is a label saying "this is your
paper, not ours."

### Hierarchy
- **Display** (800, `clamp(2.05rem, 5vw, 3.35rem)`, 1.04, `-0.03em`): The hook in
  the account head, held to a 23ch measure.
- **Headline** (800, `clamp(1.7rem, 3vw, 2.45rem)`, 1.04): The statement
  section title, held to 24ch.
- **Title** (800, `clamp(1.55rem, 2.6vw, 2.1rem)`, 1.04): The notes band title,
  held to 26ch.
- **Clause** (600, 1.08rem, `-0.01em`): The line item's clause name — the one
  thing in a row that sits above body weight.
- **Body** (400, 1rem, 1.5, tabular figures): Default text. Prose measures are
  capped per block: 62ch for subcopy and notes, 58ch for a consequence, 72–74ch
  for panels, 44ch for the closing line. The global `--measure` token is 68ch.
- **Label** (600, 0.7rem, `0.16em`, uppercase): Column heads, the summary head,
  the entry field's own head.
- **Masthead** (600, 0.78rem, `0.22em`, uppercase): The account head line, with
  the widest tracking in the system.
- **Tier** (600, 0.74rem, `0.1em`, uppercase): The tier word, right-aligned in
  the amount column.
- **Document** (400, 0.98rem, 1.5, lining figures): Applied only through the
  global `.docType` class.

### Named Rules

**The Three Voices Rule.** Archivo is the product speaking. Archivo Narrow carries
every uppercase role — masthead, column heads, tier words, panel heads, buttons,
the statement foot. Tinos carries every specimen of the reader's document: the
quoted source sentence, the counter-offer body, the pasted-text preview, and the
entry field itself. A typeface never crosses into another's job.

**The .docType Rule.** Any text that is or quotes the reader's document carries
the global `.docType` class, which switches to Tinos and turns tabular figures
off. New surfaces add the class; they do not re-declare the serif.

**The Tabular Figures Rule.** `font-variant-numeric: tabular-nums` is set on
`body`, so every count and figure in the product's own voice aligns in a column.
`.docType` is the only place figures run proportional, because the document is
quoted as it was set.

**The No-Number-Severity Rule.** Severity is rendered as one of three words and
never as a numeral, a bar, a meter, or a percentage. There is no type role for a
score because no score exists.

## Layout

One sheet, centred in the viewport at a maximum of 78rem, on a page padded
`spacing.page`. Everything inside the sheet is asymmetric.

**The account head** is a two-column grid, `1.35fr / 0.85fr`, divided by a soft
hairline and closed by a 3px double ledger-green rule. The left column holds the
masthead, hook, and subcopy; the right holds the single action, on a sunk panel,
where a statement prints its account number.

**The statement body** runs on a three-column grid used twice, identically: the
column head row and every line item share
`minmax(0, 1fr) minmax(0, 1.15fr) 8.5rem` with a `spacing.gutter` gap. Clause and
consequence sit left, the quoted sentence centre, the tier right in a fixed
8.5rem amount column. Rows are separated by hair rules, padded `spacing.row`
vertically, and have no horizontal padding, so the first and last columns run to
the sheet's text edges. The statement's foot and the notes band are each closed
by a double rule; the closing footer by a single one.

**Rhythm.** Vertical spacing works in a short ladder — 0.35, 0.5, 0.75, 0.9, 1,
1.15, 1.4, 1.75rem — and section padding is fluid (`spacing.panel` for head and
entry, `spacing.panel-wide` for statement, notes, and close).

**Responsive.** Two breakpoints, both in rem.
- At **62rem** the account head and the statement head each collapse to one
  column; the head's vertical divider becomes a bottom divider.
- At **40rem** the row becomes a single column and reorders to clause →
  consequence → tier → quoted sentence → counter-offer. The column head row is
  hidden, the quoted sentence loses its 14px offset and takes a left rule and
  indent instead, and the per-row reference mark appears.

### Named Rules

**The Shared Grid Rule.** The column head row and the line item are one grid
definition used twice. A new column cannot be added to one without the other, and
alignment between them is never faked with padding.

**The Nothing-Centred Rule.** The sheet is centred in the viewport; no content
inside it is. Headings, panels, and prose are left-aligned on an asymmetric grid.

**The Stack Names Itself Rule.** Below 40rem the column head row is removed,
because each stacked line carries its own field name. A stacked row never relies
on a head that is no longer on screen.

## Elevation & Depth

Almost flat, and tonal by intent. Depth comes from three tints of one stock —
ground, sheet, sunk — plus ledger-green rules of four weights. Panels recede by
taking the sunk fill and a 1px left rule in the colour of the thing they belong
to; nothing is lifted to make it important. The single sheet carries one ambient
drop so the paper reads as paper against the pad; no other element in the build
has a shadow, and no element gains one on hover or focus.

### Shadow Vocabulary
- **Sheet ambient** (`box-shadow: 0 18px 44px -26px rgba(22, 24, 26, 0.5)`): The
  statement sheet against the ledger ground. This is the system's only elevation.

### Named Rules

**The One Sheet Rule.** Exactly one element in a surface may carry elevation: the
statement sheet. Rows, panels, buttons, and fields are flat and stay flat in every
state.

**The Rule-Weight Rule.** Depth and hierarchy are spent in border weight, not
shadow. Four weights exist: 3px double green closes an account section; 1px solid
green divides a head from its body; 1px soft green frames a surface; 1px hair
green separates rows.

## Shapes

Zero radius, everywhere. Every surface in the build — sheet, panel, field,
button, quote underline — has square corners, and that is the form language: cut
paper and ruled lines. The only curve in the system is the scrollbar thumb
(`rounded.pill`), which belongs to the browser surface rather than the page.

Borders carry all the form. A panel is a sunk fill plus a 1px left rule; a tier is
a word plus a bottom rule; a field is a 1px soft frame that goes full-strength
green on hover; an open quote grows a red bottom rule from transparent. The quoted
sentence uses `box-decoration-break: clone` so its rule survives a line wrap.

### Named Rules

**The Square Rule.** No radius on any page element. A rounded corner reads as
software and this world is printed.

## Components

### Buttons
- **Shape:** Square (`rounded.none`), 1px border in its own fill colour.
- **Primary:** Ledger green fill, sheet-coloured caps text in Archivo Narrow,
  `0.7rem 1.15rem` padding, `0.12em` tracking.
- **Hover:** Fill shifts to Ledger Green Deep over 180ms on the system easing.
  No lift, no shadow, no scale.
- **Disabled:** Transparent fill, Ink 3 text, soft green border, `not-allowed`.
  The button loses its weight rather than its legibility.
- **Ghost / link action:** The file-pick label is ledger green underlined text at
  0.82rem, sitting beside the primary button in the same action row. The
  secondary action in this world is a link, not a second filled button.
- **Focus:** Global only — a 2px ledger-green outline at 3px offset. No component
  overrides it.

### Cards / Containers
- **Statement sheet:** Sheet fill, 1px soft green border, square, max 78rem,
  carries the only ambient shadow.
- **Aside panels** (summary, counter-offer): Sunk fill, `0.8rem 1rem` padding,
  square, and a single 1px left rule whose colour names the panel's owner —
  ledger green for the summary, carbon violet for a counter-offer, due red for an
  error, green for a success note. There is no top, right, or bottom border.
- **Notes band:** Sunk fill across the sheet's full width, opened by a double
  rule, items indented 1rem behind a soft green left rule.

### Inputs / Fields
- **Style:** Sheet fill on the sunk entry panel, 1px soft green frame, square, set
  in Tinos at 1rem — the reader's text is shown in the document's own face from
  the moment it is pasted. Minimum height 8rem, vertically resizable.
- **Hover:** Frame goes full-strength ledger green.
- **Drag-over:** Frame goes due red and the fill becomes the 12% red wash, which
  is the only time red fills an area.
- **Placeholder:** Ink 3.
- **Caret:** Due red, globally, in every input and textarea.

### Statement line item (signature component)
The system's defining component. A full-width button laid on the shared
three-column grid: clause (600, 1.08rem) with its consequence beneath in Ink 2;
the quoted source sentence in Tinos in the reference column; the tier word
right-aligned in the 8.5rem amount column. Hover fills the row with the sunk
tint over 160ms. Open state is driven by `aria-expanded`, and one entry is open at
a time. Opening reveals the counter-offer panel beneath the row.

**Tier marks.** Each tier carries its word plus its own accounting rule, in its
own colour: Critical is due red with a 3px double bottom rule, Serious is ink with
a 1px solid rule, Worth knowing is carbon violet with a 1px dotted rule. The three
words are the only severity vocabulary.

**The reference column.** Closed, the quoted sentence sits in Ink 3 and offset
`translateX(14px)` — off the line. Opening moves it to zero offset and Ink, and
grows a due-red underline beneath the quote: alignment is the found-it state. The
transition runs 420ms on the system easing (360ms for the underline). Below 40rem
the offset is replaced by a left rule that turns due red when open.

### Navigation
There is no navigation chrome in this build. The only in-page link is the closing
"back to the entry" anchor, set in Archivo Narrow caps at 0.78rem with `0.12em`
tracking.

### Browser surfaces
Treated as part of the design. Selection is ledger green with sheet-coloured
text; the focus ring is a 2px ledger-green outline at 3px offset; scrollbars are
thin with a soft-green thumb that goes full green on hover; `color-scheme` is
pinned to light. Motion is a single easing, `cubic-bezier(0.16, 1, 0.3, 1)`, at
160/180/360/420ms, and all of it collapses to 0.001ms under
`prefers-reduced-motion: reduce`.

## Do's and Don'ts

### Do:
- **Do** build structure from ledger-green rules at the four established weights
  (3px double, 1px solid, 1px soft, 1px hair) and from column alignment.
- **Do** carry every tier with its word *and* its own rule style, so the tier
  survives in grayscale.
- **Do** put every specimen of the reader's document in Tinos via the global
  `.docType` class, and every uppercase role in Archivo Narrow.
- **Do** keep every corner square and every surface flat; the statement sheet's
  ambient drop is the only elevation the system owns.
- **Do** spend red only on what a clause costs the reader: Critical, an open
  quote's underline, errors, and the caret.

### Don't:
- **Don't** render severity as a number, bar, meter, or percentage, and don't
  introduce a fourth tier. Three words is the whole scale.
- **Don't** express a closed or inactive quoted sentence with opacity. The closed
  state is colour plus a 14px offset; opacity was built, measured below 4.5:1 on
  the quoted sentence, and dropped. The quoted sentence is the one thing the
  product exists to prove.
- **Don't** use white, off-white, or cream as a surface, and don't use neutral
  gray for secondary ink.
- **Don't** add a corner radius, a card shadow, or a hover lift to rows, panels,
  buttons, or fields.
- **Don't** add glyph or emoji icons, hard blurless offset shadows, or a
  system display face; none of the three is part of this world.
