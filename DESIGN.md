---
name: idcheck
description: Self-service account recovery for Microsoft Entra ID — a lit work surface on a calm night desk.
colors:
  night: "#07131f"
  night-raised: "#0a1c2b"
  aurora-blue: "#236db9"
  aurora-teal: "#138c91"
  signal-teal: "#75d7d0"
  signal-teal-deep: "#279b8b"
  action-blue: "#3a74f7"
  action-blue-deep: "#2868ef"
  focus-blue: "#85a7f7"
  focus-ring: "#77c9cf"
  verified-green: "#168267"
  verified-green-bg: "#e9f7f1"
  real-amber-bg: "#fffaf2"
  real-amber-line: "#f0e2cf"
  real-amber-text: "#7e6747"
  alert-rust: "#c75b36"
  alert-rust-bg: "#fff3ee"
  code-mint-bg: "#f1faf8"
  code-mint-line: "#afd2ce"
  code-ink: "#173f45"
  headline-on-night: "#f6fafb"
  body-on-night: "#a8b7c0"
  muted-on-night: "#8c9ca7"
  ink: "#142431"
  ink-body: "#132331"
  slate: "#53636d"
  muted: "#72808a"
  line: "#e8edef"
  soft: "#f6f8fa"
  paper: "#ffffff"
typography:
  display:
    fontFamily: "Nunito Sans, Avenir Next, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(2.125rem, 1.4rem + 2.6vw, 3.375rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Nunito Sans, Avenir Next, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(1.625rem, 1.25rem + 1.3vw, 2.25rem)"
    fontWeight: 650
    lineHeight: 1.15
    letterSpacing: "-0.028em"
  title:
    fontFamily: "Nunito Sans, Avenir Next, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(1.3125rem, 1.1rem + 0.8vw, 1.75rem)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title-s:
    fontFamily: "Nunito Sans, Avenir Next, Segoe UI, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  lead:
    fontFamily: "Nunito Sans, Avenir Next, Segoe UI, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.65
  body:
    fontFamily: "Nunito Sans, Avenir Next, Segoe UI, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.6
  control:
    fontFamily: "Nunito Sans, Avenir Next, Segoe UI, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.2
  small:
    fontFamily: "Nunito Sans, Avenir Next, Segoe UI, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
  meta:
    fontFamily: "Nunito Sans, Avenir Next, Segoe UI, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.4
  label:
    fontFamily: "Nunito Sans, Avenir Next, Segoe UI, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0.14em"
  code:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "clamp(1.375rem, 1.2rem + 0.7vw, 1.75rem)"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.08em"
rounded:
  xs: "5px"
  sm: "7px"
  md: "10px"
  lg: "17px"
  xl: "22px"
  stage: "30px"
  pill: "99px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "20px"
  lg: "30px"
  xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.action-blue}"
    textColor: "{colors.paper}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "54px"
  button-primary-landing:
    backgroundColor: "{colors.action-blue}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "58px"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.slate}"
    rounded: "{rounded.sm}"
    height: "43px"
  button-approve:
    backgroundColor: "{colors.verified-green-bg}"
    textColor: "{colors.verified-green}"
    rounded: "{rounded.sm}"
    height: "43px"
  input-field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-body}"
    rounded: "{rounded.md}"
    height: "55px"
  recovery-card:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.xl}"
    padding: "30px"
  panel:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.lg}"
    padding: "25px 22px"
  real-tap-notice:
    backgroundColor: "{colors.real-amber-bg}"
    textColor: "{colors.real-amber-text}"
    rounded: "{rounded.sm}"
    padding: "13px"
  tap-code:
    backgroundColor: "{colors.code-mint-bg}"
    textColor: "{colors.code-ink}"
    typography: "{typography.code}"
    rounded: "{rounded.md}"
    padding: "22px 10px"
  live-pill:
    backgroundColor: "#f3fbf7"
    textColor: "#387b65"
    rounded: "{rounded.pill}"
    padding: "7px 9px"
---

# Design System: idcheck

## Overview

**Creative North Star: "The Night Desk"**

idcheck is a calm control room after hours. The whole screen is a deep navy night (`night`), barely moving: two blurred aurora fields drift slowly behind a faint 72px grid that fades out at the edges. In front of it there is one bright, white work surface: the recovery card. Everything that matters happens on that surface; the night around it only exists to keep the user steady and focused. The user arrives locked out and stressed, and the room says: one thing at a time, here.

On the surface the tone is **crisp and confident**: a clear blue primary action, strong ink-on-white contrast, decisive headings with tight negative tracking, and neat, gently rounded fields. Color has a job. Blue means "do this", green means "verified", amber means "this is real", teal is the signal light on the night side. Decoration (aurora, glow, the orbit around the shield) belongs to the night and the side illustration, never to the controls.

Type sizes come from one token scale on `:root`; new screens use those tokens and respect the minimum sizes in Typography.

**Key Characteristics:**
- A dark, near-still navy backdrop with one bright work surface in front.
- Exactly one blue primary action per surface; secondary actions are white with a thin border.
- Uppercase, widely tracked eyebrow labels in teal (on night) or grey (on paper) that name the step.
- Status colors are semantic and restrained: green verified, amber "real TAP", rust error.
- The TAP code is the only large monospace element on screen: it is the moment's most important object, and every character must be unambiguous.
- Responsive from 380px, mobile first: the card loses its frame on phones and the flow becomes one column.

## Colors

A cool, nearly monochrome navy-and-paper palette, where one blue drives action and a few small semantic colors carry status.

### Primary
- **Action Blue** (`action-blue`, gradient from `action-blue-deep`): primary buttons ("Start nå", "Fortsett", "Lag engangskode", "Neste" in the guide). The button runs as a 100° gradient from the deep tone to Action Blue, with a soft blue shadow. Also used for links in the guide (`#276bc7`/`#3174d5`).
- **Focus Blue** (`focus-blue`): the border on fields with focus, together with a 3px ring at 10% blue.

### Secondary
- **Signal Teal** (`signal-teal`, deep `signal-teal-deep`): the night side's signal light. Eyebrows, the brand mark, the underline on the landing-page highlight, status dots, the active step in the step rail, progress bars (gradient deep→light), the spinner's active segment. On paper it appears only as thin accents (the side number, a guide tip).
- **Focus Ring** (`focus-ring`): the global `:focus-visible` outline, 3px with a 3px offset. Chosen so that it reads on both night and paper.

### Tertiary (semantic status)
- **Verified Green** (`verified-green` on `verified-green-bg`): a found/verified account, the "Simuler godkjenning" button, the final "Fjern koden ✓" button in the guide, the live indicator on the TAP panel.
- **Real Amber** (`real-amber-bg` / `real-amber-line` / `real-amber-text`): reserved for the warning that the action creates a real sign-in code, plus admin setup warnings and warning tips in the guide.
- **Alert Rust** (`alert-rust` on `alert-rust-bg`): the error icon in the generic error state. Used sparingly; the error state is otherwise neutral.
- **Code Mint** (`code-mint-bg`, dashed `code-mint-line`, text `code-ink`): only for the TAP code field.

### Neutral
- **Night** (`night`) and **Night Raised** (`night-raised`): the page background and its gradient center. `html` has Night as its fallback.
- **Aurora Blue / Aurora Teal**: only in the blurred background fields at 17% opacity.
- **Headline / Body / Muted on Night**: text on a dark background, from near-white headings to grey-blue secondary text.
- **Ink** (`ink`): headings on paper. **Ink Body** (`ink-body`): field values and body text.
- **Slate** (`slate`) and **Muted** (`muted`): field labels, help text, secondary buttons.
- **Line** (`line`): 1px borders on panels, badges and dividers. **Soft** (`soft`): light grey fill in nested boxes.
- **Paper** (`paper`): the work surface.

### Named Rules
**The One Lamp Rule.** Each surface has exactly one Action Blue element. If two things are blue, one of them is wrong.

**The Amber Means Real Rule.** Amber is used only where something is real and consequential (a real TAP, a real setup error). Never for decoration or neutral info.

**The Night Is Not a Surface Rule.** Forms, codes and choices are never placed directly on the night. They sit on paper. The night carries only headings, eyebrows, the step rail and the brand.

## Typography

**Display Font:** Nunito Sans (self-hosted via `next/font`, variable weight), falling back to Avenir Next, Segoe UI, system-ui
**Body Font:** Nunito Sans (same stack)
**Label/Mono Font:** JetBrains Mono (self-hosted), only for credentials: the TAP value and reference codes

**Character:** One geometric humanist family carries the whole interface, the same on Mac, Windows and Android. Hierarchy comes from weight (400–700) and the contrast between gently negative tracking on headings and wide positive tracking on uppercase labels. The monospace face appears only where a person must read characters back exactly.

All sizes are tokens on `:root` (`--text-display` … `--text-label`, `--text-code`) and in rem, so browser font settings and zoom are respected. Components use the tokens; they don't set their own sizes.

### Hierarchy
- **Display** (700, `--text-display` 34→54px, 1.1, −0.035em): the landing-page heading on the night.
- **Headline** (650 on paper, 700 on the night, `--text-headline` 26→36px, 1.15, −0.028em): the stage heading above the card and the heading in the result states. Light-on-dark headings get one weight step more.
- **Title** (700, `--text-title` 21→28px, 1.2, −0.025em): card, guide and admin headings.
- **Title S** (700, `--text-title-s` 20px, 1.25, −0.02em): the TAP panel heading and slide headings in the guide.
- **Lead** (400, `--text-lead` 16px, 1.65): result text, the landing intro on the night, and **all form fields** (16px prevents iOS from zooming on focus).
- **Body** (400, `--text-body` 15px, 1.6): instruction text, the side caption, the real-TAP notice. Emphasis in body copy uses 650.
- **Control** (600, `--text-control` 14px): secondary buttons and text buttons. The primary button uses Body at 650.
- **Small** (400, `--text-small` 13px, 1.5): help text, tips, mail notice, footnotes, reference line.
- **Meta** (600, `--text-meta` 12px): step rail, step badge, live pill, the "secure" label. Numerals tabular.
- **Label** (700, `--text-label` 11px, 0.14em, uppercase in the copy): eyebrows, field labels, card kickers.
- **Code** (JetBrains Mono 600, `--text-code` 22→28px, 0.08em, ligatures off): only the TAP value; the reference code uses the same face at Small.

### Named Rules
**The Readable Floor Rule.** No readable text under 12px (Meta), and no uppercase label under 11px (Label). Only the miniature phone and browser mockups in the guide, which are illustrations, may go below.

**The Tight Head, Wide Label Rule.** Headings are negatively tracked (−0.02 to −0.035em, never tighter); uppercase labels are positively tracked (0.14em). Never the other way round, and never untracked uppercase.

**The Exact Characters Rule.** Anything the user must read back or type exactly (TAP, reference) is set in JetBrains Mono with ligatures off. Mono is never used as decoration elsewhere.

## Layout

The page is a vertical stack: topbar (76px, brand on the left, a "secure" label on the right) → stage heading with the step rail on the right → one wide recovery card. Max width is `min(1480px, 100% − 64px)`; the landing page has its own panel up to 1180px.

Inside the card, the form flow uses a two-column grid: the form (max 620px, vertically centered) next to an illustrated side panel (`minmax(330px, .88fr)`), with a gap of clamp(32px, 6vw, 100px). The TAP phase switches to a tool layout: a narrow code panel (300–350px) next to a wide guide panel, together filling the viewport height.

Rhythm: 8–12px within a group, 18–25px between fields and sections, 30px of card padding.

**Breakpoints:** 1050px (narrower margins, tighter TAP layout), 940px, **760px** (the main breakpoint: everything becomes one column, the card loses its frame in the TAP phase, the step rail stretches full width, the side illustration shrinks to a 190px band), 410px and 380px (fine-tuning for small phones).

## Elevation & Depth

Depth comes from contrast between night and paper, not from shadow stacks. The night is the lowest layer; the recovery card lifts out of it with one large, soft drop shadow and a faint teal-blue glow behind it. On paper, everything is nearly flat: nested panels separate by a 1px Line border and a light tint (Soft / `#fafcfc`), not by shadow. Shadows on paper are reserved for floating elements (the dropdown) and the device mockups in the guide.

### Shadow Vocabulary
- **Card lift** (`0 26px 85px rgba(0,0,0,.25), 0 3px 8px rgba(0,0,0,.05)`): the recovery card and the admin card over the night.
- **Card glow** (blurred 25px gradient `rgba(101,201,194,.17)` → `rgba(61,102,181,.13)`, inset −10px): a light halo behind the card.
- **Action shadow** (`0 5px 13px rgba(51,110,232,.18)`): the primary button only.
- **Float** (`0 12px 30px rgba(16,37,51,.14)`): dropdowns and lists over the content.
- **Device** (`0 19px 38px rgba(34,66,79,.2)`): the phone and browser mockups in the guide.

### Named Rules
**The Flat Paper Rule.** Inside the work surface everything is flat at rest. A new shadow on paper requires the element to actually float over other content.

## Shapes

Gently rounded, consistent corners that grow with the size of the element: 5px on small chips and the reference code, 7px on small buttons and badges, 10px on fields and primary buttons, 17px on panels and the guide visual, 22px on the recovery card, 30px on the landing panel. Status dots and avatar icons are circles; the live indicator is a pill. The brand mark is a 31px rounded square rotated −8°, with three teal bars. The TAP field is the only element with a **dashed** border, which marks it as a "ticket" to take with you. The shield silhouette (a clip-path polygon) recurs in the side illustration and the guide.

## Components

### Buttons
- **Shape:** gently rounded (10px for the primary, 7–9px for the rest).
- **Primary:** Action Blue gradient, white 14px/600 text, 54px tall (58px on the landing page), full width in forms. The label on the left and an arrow "→" on the right (`space-between`).
- **Hover / Focus:** lifts 1px and brightens 5% (0.18s). Focus uses the global 3px teal ring. Disabled: 52% opacity, `not-allowed`.
- **Secondary:** white with a 1px Line border, slate text ("Kopier engangskode", "Forrige", "Simuler avvisning").
- **Approve (simulation):** light green with a green border and text; the only colored secondary.
- **Text button:** no frame, muted grey, blue and underlined on hover ("Avbryt", "Ferdig — fjern koden fra skjermen").

### Chips
- **Live pill:** a green pill with a dot and a 3px halo ("Aktiv").
- **Step badge:** a thin bordered box with uppercase text in the card head.

### Cards / Containers
- **Recovery card:** 22px corners, ~98.5% white paper, card lift + glow, 30px padding. In the TAP phase it gets a light grey background (`#f2f5f6`) and hosts two white panels.
- **Panels:** white, 1px border `#e4eaec`, 17px corners.
- **Nested boxes** (simulation panel, account preview, mail notice, store options): a light tint, 1px Line border, 9–13px corners, 12–20px padding.

### Inputs / Fields
- **Style:** 55px tall, white, 1px border `#dfe5e8`, 10px corners. An icon column (48px) on the left; the phone field has a fixed "+47" prefix with a thin vertical divider.
- **Focus:** the border shifts to Focus Blue plus a 3px blue ring at 10%, 0.2s transition.
- **Labels:** uppercase, tracked labels above the field.

### Navigation
- **Topbar:** the brand ("idcheck" with a teal dot, 800 weight, −1px tracking) on the left, a lock + the label "En løsning fra x99" on the right, separated from the content by a 10% light line. The label text disappears below 760px; the lock remains.
- **Step rail:** numbered circles (22px) joined by short lines. Active: teal border and fill; done: dimmed teal; upcoming: grey.

### TAP Code (signature component)
The moment the whole flow leads to. A dashed Code Mint box with large, tracked, centered text that wraps anywhere. It is set in JetBrains Mono so 0/O and l/1/I can be told apart. Directly below: a copy button, a countdown row with tabular numerals, and a 4px progress bar (teal gradient) that shrinks linearly. Nothing else on screen competes with it.

### Authenticator Guide (signature component)
A paging guide with a counter ("02 / 06"), a thin progress bar, and controls at the bottom (Forrige · dots · Neste). Each slide pairs text with a stylized mockup: a miniature phone (7px dark frame, 30px corners, a blue app toolbar) or browser. The mockups are illustrations, not real UI, and use simplified Microsoft colors only inside the mockup. Slides animate in from the right (0.28s).

### Identity Scan (signature moment, landing only)
The one authored motion moment in the product, played once when the landing page appears (~1.7s, all `cubic-bezier` ease-out/in-out, no library):
1. **Scan** (0.2–1.35s): a 2px teal light beam with a soft elliptical trail sweeps left to right across the headline. Text ahead of the beam sits at 22% opacity ("not yet identified") and resolves to full strength behind it, through an animated `mask-image` driven by the registered custom property `--scan`.
2. **Highlight** (from 1.05s): "identifiserer deg" turns Signal Teal and its underline draws left to right.

The final state is the default state: every animation lives under `prefers-reduced-motion: no-preference` with `both` fill, so reduced motion (or an unsupported browser) shows the finished composition immediately. The tenant card stays still: the scan belongs to the headline only.

### Tenant Identity
The demo tenant's logo in a rounded square with a thin yellow frame on a black background, the tenant name in white, and a round teal "locked" mark: the tenant is fixed, not selectable.

### Legacy CSS
`globals.css` still contains rules for components that `demo.tsx` no longer renders (the tenant combobox `.tenant-list`, the provider chips `.vipps-chip`/`.provider-soon`, `.footer`, `.card-bottom`, `.demo-note`), and several components are defined twice (the old hero version and the later "Full-width recovery flow" override). The rules that come last in the file are the ones in effect; this document describes them.

## Do's and Don'ts

### Do:
- **Do** keep the night calm: aurora at ≤17% opacity, drift of 18–21s, and stop all motion under `prefers-reduced-motion`.
- **Do** keep the Identity Scan as the only choreographed moment; other screens use state transitions, not entrances.
- **Do** put all interaction on paper and name each step with a tracked uppercase eyebrow.
- **Do** use exactly one Action Blue button per surface, with the arrow on the right.
- **Do** show the amber real-TAP warning before issuing, and make it visible that Vipps is simulated. (The old `demo-note` marking is hidden with `display:none` today; PRODUCT.md requires the marking, so new screens should show it.)
- **Do** give the TAP code its own dashed mint box with countdown and progress bar, and nothing else in the same visual tier.
- **Do** design mobile first and verify at 380px and 760px.

### Don't:
- **Don't** set font sizes directly on components; use the `--text-*` tokens, and stay above The Readable Floor Rule.
- **Don't** place forms, codes or choices directly on the navy background.
- **Don't** use amber for anything other than "this is real / consequential".
- **Don't** add shadows to elements on paper that don't actually float.
- **Don't** color the generic error state as an alarm; rust is reserved for the small icon, and the text stays neutral and identical for every rejection.
- **Don't** use Microsoft, Vipps or BankID colors outside their own marks and the guide mockups.
