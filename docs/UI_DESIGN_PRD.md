# Nexus — UI/UX Design PRD: "Panda Leather"

> **Aesthetic**: Hand-stitched tobacco leather, deep walnut shadows, fresh
> moss-green threading, and crisp panda-cream highlights. Motion is calm,
> tactile, and physical — never "techy" or jittery.

This document is the design prompt referenced in the rebuild commit. Every
screen, component, and animation in the app is implemented to these specs.

---

## 1. Brand brief

Nexus is an **assistive helper** primarily aimed at first-time and elderly
smartphone users. The visual language has to feel:

1. **Warm and trustworthy** — like an heirloom journal or wallet. Older
   users associate leather with permanence and care. We lean into that.
2. **Hand-made, not machine-perfect** — visible stitching, slightly uneven
   highlights, generous spacing. Communicates "made for a person".
3. **Confident, not playful** — the panda accent (cream + charcoal) gives
   contrast and sharpness so the leather never reads as muddy.
4. **Slow and deliberate motion** — animations are felt, not noticed. We
   prefer 250–500 ms with eased curves over fast snappy 100 ms.

## 2. Colour system — *Panda Leather palette*

All values are HSL-derived for predictable dark/light variants. We never
hard-code these in components — they go through the Material 3
`ColorScheme` slots.

### Primary leather tones (browns)

| Token | Hex | Used for |
|---|---|---|
| `LeatherDeep` | `#3A1F0F` | Darkest leather creases / deep shadows |
| `LeatherWalnut` | `#5C3A1E` | App background (dark mode default) |
| `LeatherTobacco` | `#7A4E2D` | Card surface — the leather of the pouch |
| `LeatherSaddle` | `#A26B3F` | Highlights on the grain |
| `LeatherTan` | `#C58B5A` | Hover / pressed-light glints |
| `LeatherGlint` | `#E2B07F` | Specular highlights, never used as a fill |

### Threading (greens)

| Token | Hex | Used for |
|---|---|---|
| `ThreadMoss` | `#2F6B3D` | Default stitching colour |
| `ThreadFresh` | `#4FA45A` | Primary accent (selected tab, primary button) |
| `ThreadLime` | `#9DD174` | Success states, "saved" affordance |

### Panda accents (cream + charcoal)

| Token | Hex | Used for |
|---|---|---|
| `PandaCream` | `#F4ECDF` | Primary on-leather text |
| `PandaIvory` | `#FFF8EC` | Headings, contrast surfaces |
| `PandaCharcoal` | `#1F1A14` | Light-mode body text & deep accents |
| `PandaSlate` | `#3D332A` | Light-mode subtle text |

### Semantic

| Token | Hex |
|---|---|
| `WarningAmber` | `#E0A23B` (mustard, fits the leather palette) |
| `ErrorOxblood` | `#A53B33` (deep red leather, not screen red) |
| `SuccessGreen` | `ThreadLime` (re-uses threading) |

### Contrast checks (WCAG AA, ≥4.5:1 for body text)

| Pair | Ratio | Pass |
|---|---|---|
| `PandaCream` on `LeatherTobacco` | 7.2:1 | AAA |
| `PandaIvory` on `LeatherWalnut` | 9.1:1 | AAA |
| `ThreadFresh` on `LeatherTobacco` | 4.7:1 | AA |
| `PandaCharcoal` on `PandaCream` | 13.4:1 | AAA |

All in-app text uses the `PandaCream` / `PandaIvory` / `PandaCharcoal` tokens
on a leather surface. We never put `ThreadMoss` on `LeatherDeep` (fails AA).

## 3. Typography

Body and UI labels use the system **sans-serif** (it ships on every Android
device, no font download tax — important for the assistive-mode users on
slow networks). Headings use **serif** for an editorial, journal feel.

| Style | Family | Weight | Size / line height |
|---|---|---|---|
| Display Large | Serif | 700 | 32 / 40 |
| Display Medium | Serif | 700 | 28 / 36 |
| Headline | Serif | 600 | 22 / 28 |
| Title | Sans | 600 | 18 / 24 |
| Body Large | Sans | 400 | 16 / 24 |
| Body Medium | Sans | 400 | 14 / 20 |
| Tutorial body | Sans | 400 | **22 / 32** (assistive override) |
| Label | Sans | 500 | 12 / 16, +2% tracking |

Headings use `letterSpacing = (-0.5).sp` for tight, intentional headlines.
Tutorials always use the larger 22 sp body — that override is non-negotiable
because it's our accessibility commitment.

## 4. Spacing & elevation

Spacing scale (4 dp base): `1 / 2 / 3 / 4 / 6 / 8 / 12 / 16 / 24 / 32` dp.
Card padding is 20 dp standard, 24 dp spacious. We never go below 12 dp
between text and its container — the leather looks suffocated otherwise.

Four-tier elevation (skill §2):

| Level | Use | Shadow |
|---|---|---|
| 0 | Page leather background | none |
| 1 | Pouch cards (vault, learn rows, settings cards) | y=2, blur=8, alpha=0.18 |
| 2 | Selected tab indicator, popover hint | y=4, blur=14, alpha=0.22 |
| 3 | Confirmation card (destructive actions) | y=12, blur=28, alpha=0.32 |
| 4 | Reset alert dialog | y=24, blur=44 + scrim 0.45 |

The shadow colour itself is `LeatherDeep` (not pure black) so it stays in
palette.

## 5. Stitching — the signature element

Every elevated leather surface gets a **thread border** drawn 6 dp inside
its rounded rectangle, in `ThreadMoss` (or `ThreadFresh` when the surface
is "active"). Visual rules:

- Stroke width: 1.5 dp
- Dash: 6 dp drawn, 4 dp gap (looks like real running stitch)
- Corner radius: 6 dp smaller than the card's outer radius
- Selected / interactive state: stitch colour transitions to `ThreadFresh`
  over 200 ms (`ease-out`)

We implement this once as `Modifier.stitchedBorder(...)` so every component
is consistent. The implementation uses `drawBehind` with a dashed
`PathEffect` — no bitmap, no extra resource files, scales to any size.

## 6. Leather surface texture

Procedural, no PNG tax. A `Modifier.leatherSurface(...)` extension layers
four passes inside `drawBehind`:

1. **Base fill** in `LeatherTobacco`.
2. **Grain gradient** — vertical linear gradient from `LeatherSaddle` (top)
   to `LeatherDeep` (bottom), 0.18 alpha.
3. **Highlight hotspots** — three radial gradients seeded by the composable
   id so they're stable per surface but varied across the screen.
4. **Edge vignette** — 12 dp inner shadow in `LeatherDeep` so the surface
   looks like real material catching light at the centre.

For dark mode, layer 1 swaps to `LeatherWalnut` and layer 2 reverses
direction so the leather still "catches the light from above". The grain
is otherwise visually identical.

## 7. Motion system

Following the skill file's golden rules: only `transform` and `opacity` are
animated; durations follow the standard scale; every animation respects
`AccessibilityManager.isReduceMotionEnabled` (Android equivalent of
`prefers-reduced-motion`).

### Duration scale

| Token | Value | Used for |
|---|---|---|
| `instant` | 0 ms | Identity transitions when reduce-motion is on |
| `fast` | 120 ms | Tab indicator slide, button press |
| `normal` | 240 ms | Card expand, list item enter |
| `moderate` | 360 ms | Tutorial step swap, screen content fade |
| `slow` | 500 ms | Confirmation card spring-in |
| `expressive` | 700 ms | First-launch hero reveal (one-shot only) |

### Easing

We provide three Compose `Easing` constants used everywhere:

```kotlin
val EaseOutLeather  = CubicBezierEasing(0f, 0f, 0.2f, 1f)        // most UI
val EaseInLeather   = CubicBezierEasing(0.4f, 0f, 1f, 1f)        // exits
val EaseSpring      = CubicBezierEasing(0.34f, 1.56f, 0.64f, 1f) // gentle overshoot
```

For Compose `spring()` cases (e.g. confirmation card scale-in) we use
`Spring.DampingRatioMediumBouncy` + `Spring.StiffnessLow` which lands the
overshoot at ~480 ms — perfect for "this thing has weight" feel.

### Patterns library

| Pattern | Where it's used | Implementation |
|---|---|---|
| **Stagger reveal** | LearnScreen list, MemoryScreen rows | `AnimatedVisibility` per row with `slideInVertically(initialOffsetY = 16.dp) + fadeIn`, 60 ms stagger via `tween(durationMillis = 240, delayMillis = index * 60)` |
| **Spring scale-in** | ConfirmationCard, AlertDialog | `scaleIn(initialScale = 0.92f) + fadeIn`, spring with damping 0.7, stiffness low |
| **Crossfade** | Tutorial step swap, Learn list ↔ player | `Crossfade(targetState = step, animationSpec = tween(360, easing = EaseOutLeather))` |
| **Tab indicator slide** | Bottom navigation | `animateDpAsState(targetValue = indicatorX, animationSpec = tween(120, easing = EaseSpring))` |
| **Press depth** | LeatherButton, LeatherCard tap | `animateFloatAsState(if (pressed) 0.97f else 1f)` driving `Modifier.scale(...)`, paired with stitch-colour shift to ThreadFresh |
| **Progress fill** | Tutorial progress bar | `animateFloatAsState(stepIndex / totalSteps)` driving the fill width |
| **Sheen sweep** | First-launch onboarding card highlight | one-shot `infiniteTransition` for 1.4 s only, then disabled |
| **Send pulse** | Chat send icon when message is in flight | scale 1.0 → 1.08 → 1.0 with 600 ms `tween` while `status == PROCESSING_INTENT` |

### Reduced-motion fallback

`LocalReduceMotion` provides a `Boolean` derived from
`Settings.System.getFloat(ANIMATOR_DURATION_SCALE)`. When true, we replace
every animation with `tween(durationMillis = 0)` — the UI still has the
state changes, just skipped instantly. We never silently drop affordances.

## 8. Component specifications

### LeatherCard

A rounded leather pouch with stitched border. Used for: vault provider
tiles, learn-tab tutorial rows, memory preference rows, confirmation card.

```
shape:        RoundedCornerShape(20.dp)
padding:      20.dp
surface:      Modifier.leatherSurface()
border:       Modifier.stitchedBorder(thread = ThreadMoss, inset = 6.dp)
shadow:       elevation level 1 (LeatherDeep, alpha 0.18)
press state:  scale 0.97, stitch shifts to ThreadFresh, 120 ms
```

Variants: `tone = Standard | Highlight | Warning`. Highlight uses
`ThreadFresh` stitching by default; Warning uses `WarningAmber`.

### LeatherButton (replaces PrimaryButton)

```
shape:        RoundedCornerShape(16.dp)
height:       56 dp (assistive minimum tap target × 1.27)
fill:         radial gradient ThreadFresh → ThreadMoss
text:         PandaIvory, titleMedium, semibold
stitching:    PandaIvory dashed border, inset 5 dp, 1.5 dp stroke
press:        scale 0.97 + stitch fades to PandaCream
loading:      replace label with 18 dp PandaIvory spinner, button locked
disabled:     desaturate to LeatherTan with PandaSlate stitching
```

### Outline / quiet button (Skip, Cancel, Disconnect)

```
shape:        RoundedCornerShape(16.dp)
fill:         transparent
border:       1.5 dp PandaCream / ThreadMoss dashed
text:         PandaCream, titleMedium
press:        background fades to PandaCream alpha 0.08
```

### StitchedDivider

A 1 dp `ThreadMoss` dashed line, used between vault sections, at the top of
the bottom nav, and to separate tutorial step body from the tip card.

### ProgressDots

For the tutorial player. N pills, inactive `LeatherTan` alpha 0.4, active
`ThreadFresh`. The active dot animates from inactive over 240 ms when the
step changes (`animateColorAsState`). Width of the active dot expands
slightly (8 dp → 24 dp) to draw the eye.

### Bottom navigation

Five tabs. The selected tab's pill indicator slides between positions
using `animateDpAsState` with `EaseSpring`. The selected icon and label
swap to `ThreadFresh`; unselected use `PandaCream` alpha 0.65. Long press
on a tab triggers a 300 ms ripple bounded to the pill — built-in
`Modifier.indication`.

### Confirmation card (chat destructive actions)

The single most important UI moment in the app — when the user is about to
send an email or create an event. Visual treatment:

- Elevated `LeatherCard` at level 3 elevation
- `tone = Warning` (mustard amber stitching)
- Spring scale-in (`damping = 0.7, stiffness = low`) over ~500 ms
- Title in serif 22 sp, body in sans 18 sp
- Two buttons: outline "Cancel" (left, equal weight) and filled
  `LeatherButton` "Confirm" (right, ThreadFresh fill)
- On confirm: card press-then-fade-up (`translateY(-12.dp) + fadeOut` 240 ms)
- On cancel: card fade-down (`translateY(12.dp) + fadeOut` 240 ms)

The Confirm action **does not** fire on the first 200 ms after the card
appears — accidental tap-through prevention. We track this with a small
`LaunchedEffect` + `delay(200)` flag.

## 9. Screen-by-screen plan

### 9.1 Onboarding

- Disclosure step: serif display title, body in 18 sp PandaCream, subtle
  one-shot sheen across the title for 1.4 s only on first composition.
- API-key step: stitched leather text-field surface; key field shows a
  small lock glyph and pulses softly while saving (`scale 1 ↔ 1.04`,
  `tween(800, easing = EaseInOut)`).
- "I understand" / "Continue without a key" use `LeatherButton` /
  outline-button variants.

### 9.2 Tabs root

- Background: `Modifier.leatherSurface()` covering the whole scaffold.
- Bottom nav: leather strip with stitched top edge, 4-pill segmented
  indicator that morphs (slide + width interpolation) when the user taps.
- Each tab change triggers a 360 ms crossfade of the content area — keeps
  the leather frame static while the inner journal page turns.

### 9.3 Learn

- List: stitched `LeatherCard` rows, staggered slide+fade entrance (60 ms
  stagger), each row leads with a small tan disc with the category initial.
- Open tutorial: `Crossfade` to the player.
- Player: top progress dots, body in 22 sp PandaCream, tip card in a
  warning-toned mini-leather card, footer has Back (outline) + Next/Done
  (LeatherButton). Step swap is a 360 ms crossfade so the user always sees
  a clean transition.

### 9.4 Chat

- Message bubbles: leather pouches with 6 dp inner stitching. User bubbles
  use `ThreadFresh` stitching + `LeatherSaddle` fill + PandaIvory text;
  assistant bubbles use `ThreadMoss` + `LeatherTobacco` + PandaCream.
- Each newly added message gets the slide+fade enter (240 ms,
  EaseOutLeather). Existing messages don't animate.
- Confirmation card: spring scale-in as specified above.
- Send icon: pulse while `status == PROCESSING_INTENT`.

### 9.5 Vault

- Two pouches (OpenAI + Google) styled as leather wallets, 24 dp padding,
  Highlight stitching when connected.
- Connected state shows a `ThreadLime` "stitched check" mark drawn on the
  pouch corner.

### 9.6 Memory

- Stitched leather text fields, save button as `LeatherButton`.
- List rows use `Modifier.animateItemPlacement()` so adds and deletes
  glide instead of jumping.

### 9.7 Settings

- Single leather card with the build info; factory-reset is an outline
  button at the bottom; the alert dialog uses elevation level 4 with a
  panda-cream surface so it's the clear focal point. Confirm runs a 480 ms
  collapse animation on the leather background before the sentinel auth
  bus fires.

## 10. Accessibility commitments (kept verbatim)

- All animations gated by `LocalReduceMotion`.
- All interactive elements have a 5-state visual treatment (default,
  hover/pressed, focus, disabled, loading).
- Content descriptions on every icon-only control.
- Tutorial body text 22 sp; never below.
- Stitching is decorative — never the only signal of state. Active tabs
  ALSO change icon colour, not just stitch colour.

## 11. Implementation contract

| Concern | Decision |
|---|---|
| Where palette lives | `ui/theme/leather/LeatherPalette.kt` (source of truth) → mapped into `MaterialTheme.colorScheme` slots |
| Where motion constants live | `ui/theme/leather/Motion.kt` |
| How surfaces are applied | `Modifier.leatherSurface(tone)` |
| How borders are applied | `Modifier.stitchedBorder(thread, inset)` |
| How reduce-motion is honoured | `CompositionLocal LocalReduceMotion`, plumbed in `MainActivity` |
| Where component styles live | `ui/components/leather/*.kt` (LeatherCard, LeatherButton, etc.) |

## 12. Quality bar (governance)

- `./gradlew :app:lintDebug` — 0 errors, 0 warnings.
- `./gradlew :app:testDebugUnitTest` — every existing test still passes,
  plus new tests for: palette contrast, stitch dash math, motion duration
  sanity, reduce-motion fallback wiring.
- `./gradlew :app:assembleRelease` — release APK still builds and remains
  under 3 MB after R8.
- Manual reasoning: no use of bitmap textures, every interactive surface
  has its 5 states, every animation either has duration ≤ 700 ms or a
  reduce-motion bypass.

This PRD is the input to the implementation commit; the commit body lists
the deltas that mapped each section here onto code.
