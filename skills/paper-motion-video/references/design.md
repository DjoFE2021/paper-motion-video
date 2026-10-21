# Design rules

## Contents
1. Direction: clarity first, editorial not "AI"
2. Formats and stage geometry
3. Typography and legibility on phones
4. Designing the phone cut (portrait)
5. Color
6. Charts
7. Motion
8. Review checklist

## 1. Direction: clarity first, editorial not "AI"

The goal is to deliver the paper's message as clearly as possible, in a look that feels like a well-designed journal figure or a quality newspaper graphic coming to life. The model is the visual journalism of the FT, The Economist or Distill, not a startup landing page. Viewers should remember the finding, not the effects.

**Do**
- **Background:** paper-white (`#faf9f6`), near-black ink, generous whitespace.
- **Color:** one accent for the paper's method, one muted contrast color for the problem or baseline, grays for everything else.
- **Typography:** a serif for headlines and big statements, a clean sans for labels, numbers and charts.
- **Charts:** flat fills, hairline rules, direct labels, numbers that count up as they are spoken.
- **Motion:** calm. Fades, short rises, lines that draw themselves, everything timed to the voice.

**Don't.** These read as generic AI or tech-demo output:
- Neon colors, glows, bloom, drop-shadow halos, glassmorphism.
- Gradient text, rainbow or purple-to-blue gradients, conic "orbs".
- Dark mode by default. (Available via `"theme": {"mode": "dark"}` for a dark venue, still without glows.)
- Blur-in or glitch effects, film grain, scanlines, particle fields, fake terminal or HUD readouts (timecodes, frame counters).
- Monospace uppercase letter-spaced labels everywhere.
- Stock icons, emoji, 3D, isometric illustrations, logos you don't own.

The runtime defaults already follow these rules; keep them when you write custom elements.

## 2. Formats and stage geometry

Most people will watch on a phone. A 16:9 video in a vertical feed (LinkedIn, Instagram, X) fills only a third of the screen, so a project usually ships **two cuts of the same narration**:

| Format | Size | Scenes file | Use |
|---|---|---|---|
| `landscape` | 1920×1080 (16:9) | `scenes.js` | YouTube, talks, poster-session screens, desktop |
| `portrait` | 1080×1350 (4:5) | `scenes.portrait.js` | the phone cut: LinkedIn / Instagram / X feeds |
| `vertical` | 1080×1920 (9:16) | `scenes.vertical.js` | Reels, Shorts, TikTok, Stories |
| `square` | 1080×1080 (1:1) | `scenes.square.js` | feeds that crop to square |

List the formats in `config.json` → `video.formats` (the template has `["landscape", "portrait"]`). All formats share `script.txt`, the voice, the timings and the subtitles; each has its own layout file and build folder (`build/<format>/`), and every `pmv` command takes `--format`.

Use `LAY` for geometry instead of hard-coded pixels. It is computed per format:

| Value | Landscape | Portrait | Meaning |
|---|---|---|---|
| `LAY.W × LAY.H` | 1920×1080 | 1080×1350 | stage |
| `LAY.M`, `LAY.R` | 170, 1750 | 80, 1000 | left and right content edges |
| `LAY.CW` | 1580 | 920 | content width |
| `LAY.top` | 104 | 112 | kicker line; the headline sits just below |
| `LAY.bottom` | ~920 | ~1136 | keep all content above this; subtitles live below |

- **Margins:** content within `LAY.M`–`LAY.R`. Center big statements; align everything else to the left margin.
- **Subtitles:** one line of 40 px in landscape, up to two lines of 44 px in portrait, bottom-anchored. The audit flags anything entering their band.
- **One focal point per moment:** if two things compete for attention, dim or remove one (`UI.lane` `dim`, layer opacity).
- **Text lives inside its box:** a card, chip, cell or lane is sized for its longest line, with its padding intact. If something doesn't fit, widen the box, shorten the words or step the font down; never let text touch or cross an edge. `pmv review` and `pmv check` flag `text runs outside its card`.
- **Balance the frame vertically:** in landscape, a chart or table that sits at the top with an empty lower half looks unfinished. Center the content block between the headline and `LAY.bottom`, make the chart taller, or add the second panel or key-number card the narration supports.
- **Leave room for line-end labels:** a label at the end of a line or reference line needs ~180–260 px to its right; shorten the chart (`w`) rather than letting labels run off the frame or into each other.
- **Fill the frame with purpose:** large empty areas look unfinished, but crowding is worse. Give charts room (most of `LAY.CW`), and put a key-number card beside (landscape) or below (portrait) a chart that leaves space empty.

## 3. Typography and legibility on phones

A 1080p frame shown on a phone held sideways is about 2.5× smaller than on a laptop, so printed-figure sizes (14–16 px) become unreadable. Every size comes from the `TYPE` scale, and **the audit flags any text below `TYPE.min`** (20 px landscape, 24 px portrait), measured on screen, so a shrunken chart counts at its shrunken size.

| Role (`TYPE.*`) | Landscape | Portrait | Font |
|---|---|---|---|
| `statement` (kinetic) | 120 (110–150) | 96 (96–120) | Source Serif 4, 500 |
| `headline` | 64 | 68 | Source Serif 4, 500; ≤ 7 words; may wrap to 2 lines in portrait |
| `tagline` | 40 | 42 | Source Serif 4 italic |
| `lead` | 32 | 36 | subtitles of statements, equations |
| `value` | 28 | 34 | numbers on bars, card titles |
| `body` | 26 | 32 | card text, lane text, group names |
| `label2` / `label` | 24 / 22 | 30 / 28 | axis ticks, chart labels, captions |
| `kicker` / `min` | 20 / 20 | 24 / 24 | uppercase section labels; the floor for everything |

- Numbers use tabular figures (`.tab`) so counters don't jitter. Code, URLs and IDs use IBM Plex Mono, nothing else does.
- Italic serif in the accent color is the single emphasis device. Don't combine it with bold, underline and color at once.
- Use sentence case everywhere except the small kicker labels.
- **Bigger type means less text.** If labels don't fit at these sizes, cut words (shorter labels, a legend instead of per-bar labels, two pages instead of one crowded one), never shrink below `TYPE.min`.
- Sub- and superscripts and math indices are measured at their base size; they may be smaller.

## 4. Designing the phone cut (portrait)

Lay the portrait cut out as its own design, not a squeezed landscape: same narration, same scene windows (`scene(id, a, b)` identical), new layouts. `examples/pit-llm/scenes.portrait.js` is a complete reference.

- **One column.** Side-by-side panels become stacked: card above diagram, chart above its key-number cards, three pipeline steps on top of each other.
- **Fewer, larger labels.** Drop per-bar labels in favour of group labels plus one legend line; shorten lane and axis text ("too few years", '’15' instead of '2015'); keep reference lines to the ones the narration mentions.
- **Kinetic statements** split into 2–3 short lines (`lines: [{n: 4, size: 44}, {n: 3, size: 116}, …]`). Lines that are still too wide shrink to fit automatically.
- **Long rows** (12 yearly cells, 7 model-year pairs) become compact cells ('’13'), checkmark chips, or one row per item.
- **Headlines** may wrap to two lines; put the kicker above (at `LAY.top`), and leave 20 px before the content starts.
- **Kickers** are a single line in portrait: keep them under ~40 characters (shorten "Theorem 1 · any factor structure for stocks" to "Theorem 1").
- **Title and end card** lines can be overridden for the portrait cut in `config.json` → `"portrait": {…}`, e.g. a shorter affiliation line.
- **Vertical 9:16** is the same idea with more height: give charts more vertical room, and keep important content out of the top and bottom ~12% where app buttons sit.

## 5. Color

Set the colors in `config.json` → `theme`: `accent`, `contrast`, `neutral` (+ optional `good`, `bad`, `bg`, `ink`). The engine derives text, mid and soft tints automatically.

| Name | Meaning | Default |
|---|---|---|
| `accent` | the paper's method, "ours", the key idea | muted cobalt `#2f5da8` |
| `contrast` | the problem, the unconstrained or oracle baseline, a warning | terracotta `#b8572a` |
| `neutral` | prior work, other baselines, context | gray `#8e949d` |
| `good` / `bad` | keep/drop, valid/invalid | muted green / red |

- Use color for meaning, never for decoration. Each meaning keeps the same color for the whole video.
- The blue/orange pair is safe for color-blind viewers. Never encode meaning in red vs. green alone; add a label ("KEEP"/"DROP").
- To match a lab or venue identity, change `accent` only, and keep it dark enough for text on white (contrast ≥ 4.5:1).
- In dark mode (`"mode": "dark"`), choose lighter versions of the colors, e.g. accent `#6f9be0` and contrast `#e0915f`.

## 6. Charts

- **Rebuild from the paper's numbers.** Bars start at zero, and axes show units.
- **Direct labels, no legends:** the series name sits next to its line, and reference lines are labelled at the right edge.
- **Highlight one thing:** "ours" in accent (strongest fill for the best variant), everything else neutral or contrast. Use lighter tints (`accentLight`, `neutralLight`) for secondary variants.
- **Annotate the one comparison the narration states** with `UI.bracket` ("+28 pts", "≈4 pts"), timed to the spoken number.
- **Reveal in narrative order:** bars grow when their value is spoken (`at: W(cue, '1.0')`), and the baseline appears when the narration mentions it.
- **Keep it legible:** at most ~7 bars, ~3 lines and ~5 reference lines per chart. Split anything bigger across scenes.
- **Tables** (`UI.table`): ≤ 5 rows × 5 columns, the paper's method highlighted, best values in accent bold.

## 7. Motion

- **Entrances:** fade + 14 px rise over 0.6–0.9 s (`rise`, ease-out cubic). Stagger related items by 0.1–0.2 s.
- **Moves and morphs:** ease-in-out over 0.8–1.2 s (`UI.move`). Never move and fade more than about three things at once.
- **Sync:** anything that appears should be named in the narration within about a second. Use `W(cue, 'word')`, never hard-coded seconds.
- **Hand-offs:** when one group of elements replaces another in the same area, let the old one finish fading before the new one arrives (0.1–0.3 s apart). Overlapping fades read as clutter.
- **Holds:** a final state should stay at least 1.5 s before its scene fades. Scenes crossfade over 0.5 s; there are no wipes, zooms or spins.
- **Kinetic type:** words appear as they are spoken. Use it for the 3–5 key sentences only.
- **Pacing:** something should change every 2–3 s. A static frame longer than ~5 s feels stalled, so add a counter, a highlight or a second element.

## 8. Review checklist (for every `pmv review` sheet and every `pmv check` final sheet, in every format)

- [ ] The audit reports no issues and the JavaScript error list is empty.
- [ ] Every frame has one clear focal point and reads in under 3 seconds.
- [ ] Nothing crosses or touches anything else: labels vs. lines, text vs. cards, labels vs. labels, content vs. the subtitle band.
- [ ] All text reads at phone size: nothing under `TYPE.min`, nothing crammed (if it only fits small, cut words or split the frame).
- [ ] Every text inside a card / chip / cell sits within it with padding to spare.
- [ ] No container sits empty waiting for its content: cards, axes and tables fill in within ~1.5 s of appearing.
- [ ] Landscape frames are balanced: no chart pinned to the top with an empty lower half.
- [ ] Every key number stays on screen at least ~1.5 s after it is spoken.
- [ ] Numbers match `facts.md`. Units and labels are present. Illustrative visuals are marked.
- [ ] Every claim keeps the paper's qualifiers ("generically", "unconditionally", "in our sample", "approaches"), on screen and in the narration.
- [ ] Each element is complete at the end of its sentence, not still fading in.
- [ ] Colors mean the same thing everywhere; only one accent is used.
- [ ] Nothing from the "Don't" list in section 1 has crept in through custom code.
- [ ] Title card and end card: names spelled right, affiliations, venue, links and QR targets correct.
- [ ] The end card's tagline makes sense on its own (no "them" or "this" pointing back to an earlier sentence).
- [ ] The portrait cut tells the same story as the landscape cut, with nothing important dropped.
