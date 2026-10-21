# Runtime API: scenes, timing, components

## Contents
1. How a project is wired
2. Timing helpers
3. Scenes
4. Low-level helpers
5. Components (UI.*)
   - Text: text, headline, kicker, kinetic, underline
   - Cards: titleCard, endCard, card, chip, equation, counter
   - Charts: hbars, vbars, lineChart, table
   - Time: timeline, lane, marker, progress
   - Diagrams: flow, steps, pairs, filter, chipGrid, heatmap, walks, converge, curve, figure
   - Annotations: bracket, stamp, strike, move
6. Patterns
7. Sound cues

## 1. How a project is wired

A project holds:
- `config.json`: title, authors, colors, voice, music, formats
- `script.txt`: the narration (shared by every format)
- `scenes.js`: the landscape (16:9) visuals, and `scenes.portrait.js` (4:5) for the phone cut; `scenes.vertical.js` (9:16) and `scenes.square.js` if those formats are listed in `video.formats`
- `assets/`: optional images

`pmv narrate` turns the script into `build/timeline.json`. For each format the renderer loads `runtime/engine.js`, `runtime/components.js` and that format's scenes file into one page. Everything below is a global in the scenes files.

**Format-aware globals.** `FORMAT` (`{name, w, h}`), `LAY` (geometry: `W, H, M, R, CW, CX, top, bottom, subTop, portrait`) and `TYPE` (type scale: `kicker, label, label2, body, value, lead, tagline, headline, statement, min`) are computed per format; see `references/design.md` §2–3. Write sizes as `TYPE.body`, `TYPE.label`… and positions relative to `LAY.M`, `LAY.CW`, `LAY.bottom` so a layout stays readable and inside the frame. Every component's defaults already use them.

```js
scene('result', S('r1') - .4, S('r2') - .25, el => {
  UI.headline(el, 'Accuracy <em>improves</em>', { at: S('r1') - .2 });
  UI.hbars(el, { at: S('r1'), rows: [{ label: 'Baseline', value: 61, color: 'neutral', at: W('r1', '61%') },
                                     { label: 'Ours', value: 78, color: 'accent', bold: true, at: W('r1', '78%') }] });
}, { label: '02 — Results', energy: .7 });
```

## 2. Timing helpers

All times are absolute seconds on the video timeline.

| Helper | Returns |
|---|---|
| `S('cue')` / `E('cue')` | start / end of a narration cue |
| `W('cue', 'word', n = 0)` | onset of a word in the cue. Case and punctuation are ignored; an exact word wins over a word starting with `'word'`, which wins over a word containing it, and `n` picks the n-th hit. A miss logs an error, which `pmv review` prints |
| `DUR` | total duration; `TL.cues[id].words` holds `[{d, s, t0, t1}]` |
| `P(t, t0, d, easing)` | progress 0→1 of an animation starting at `t0`, lasting `d` (default ease-out cubic) |
| `win(t, a, b, fi, fo)` | 0→1→0 visibility window |
| `ease.{lin, outCubic, outQuart, inOutCubic, inOutSine, outExpo, inOutExpo, outBack}` | easing functions |

Key visuals to the words: a bar grows at `W('s1', '1.5')`, and a caption appears at `S('cue') + .3`. Never hard-code seconds; re-narration would break the sync.

## 3. Scenes

```js
scene(id, a, b, (el, sc) => { /* build: create components inside el */ return t => { /* optional per-frame code */ }; }, options)
```

- The scene is visible from `a` to `b` and crossfades over `fi`/`fo` (0.5 s).
- Overlap neighbouring scenes slightly: the next scene starts ~0.25–0.45 s before the current one ends.
- The usual window is `S(firstCue) - .4` to `S(nextScenesFirstCue) - .25`.
- The first scene starts at `-1` with `fi: .01`. The last scene ends at `DUR + 1` with `fo: .01`.

| Option | Meaning |
|---|---|
| `label` | section name in the running head, e.g. `'03 — Method'`. `''` blanks it (the title card does this) |
| `energy` | 0–1, drives the music. ~.35 hook, .5 title/problem, .7–.85 method/results, .5 close |
| `whoosh` | `false` silences the transition sound |
| `push` | slow zoom amount (default 0; keep it ≤ .01) |

Other functions:
- `section(t, label)` changes the running-head label mid-scene.
- `nosub(cueId)` hides a cue's subtitle when its words are already on screen. `UI.kinetic` does this for you.

## 4. Low-level helpers

Use these for custom elements:

- `add(parent, html)` creates and appends an element. `layer(parent)` adds a full-stage container (group and fade parts of a scene). `svgLayer(parent)` plus `sv(svg, tag, attrs)` add SVG.
- `A(el, {o, x, y, s, sx, sy, r, b})` sets opacity, translate, scale, rotation and blur in one call. Keep blur at 0 in this design.
- `rise(t, t0, d = .8, dist = 14)` returns the standard entrance as a style object; `out(style, t, t1)` adds the exit. Combine: `A(el, out(rise(t, at), t, outAt))`.
- `draw(path, k)` draws an SVG path to fraction k (the path needs `pathLength="1"`).
- `tex(el, '\\LaTeX')` renders KaTeX. `words(el, [...])` splits into word spans, and `speak(spans, cue, t)` reveals them in sync with the voice.
- `rng(seed)` is a deterministic random generator. Never use `Math.random`, `Date` or CSS animations: frames render out of order.
- Hide a custom group with `el.style.opacity` and `el.style.display`, never `visibility` (a child set to visible would show through).
- Give your own text containers the class `card`, `chip` or `box`; the audit then checks that their text stays inside them. Text placed over a card must be a child of that card (or carry `data-within="<card id>"`); otherwise the audit reports it as sitting on a card it doesn't belong to.

Colors accept semantic names everywhere:
- `accent`, `contrast`, `neutral`, `good`, `bad`, `ink`, `dim`, `faint`
- fill variants: `accentLight`, `contrastLight`, `neutralLight`, `neutralDark`
- or any CSS color

CSS variables are available for custom HTML: `var(--accent)`, `--accent-text`, `--accent-mid`, `--accent-soft`, `--ink`, `--dim`, `--rule`, `--grid`, `--paper`.

Text classes:
- `.serif`, `.tab` (tabular numbers), `.kicker`, `.em` (accent italic), `.emC` (contrast italic), `.card`, `.chip`
- color classes: `.accent`, `.contrast`, `.good`, `.bad`, `.dim`

## 5. Components

Every constructor takes `(parent, options)`, returns `{ el, update, …helpers }` and registers itself, so you never call `update`. `at` is when it starts (defaults to scene start + 0.3 s); `out` (where supported) is when it leaves. `el` is a container you can move with `UI.move`.

### Text

**`UI.headline(parent, html, {at, out, x = 170, y = 128, size = 60})`**
The serif scene title. `<em>word</em>` sets the accent italic. Auto-shrinks to 1580 px.

**`UI.kicker(parent, html, {at, x, y = LAY.top, size = TYPE.kicker, color, w, align})`**
A small uppercase label. `<b>` inside is accent-colored; Greek letters keep their case (ρ stays ρ).

**`UI.text(parent, html, {at, out, x, y, w, size = 22, color, align, cls, style, maxW})`**
Any text block.

**`UI.kinetic(parent, cueId, {lines, top = 380, x, emph, emphClass = 'em', words, out, nosub})`**
The words of `cueId` appear as they are spoken, and that cue's subtitle is hidden.
- `lines`: `[{n, size, font: 'serif'|'sans', color, weight, top, gap}]`. The `n` values must add up to the cue's word count. Defaults: a serif last line of 120 px, sans lines of 46 px in dim.
- `emph`: word indices or words, e.g. `[9, 10]` or `['scale']`.
- `x` left-aligns the lines (default: centered).
- A line wider than the frame shrinks to fit automatically; in portrait, split statements into 2–3 lines anyway (see `design.md` §4).
```js
UI.kinetic(el, 'q', { lines: [{ n: 4, size: 50 }, { n: 7, size: 140, top: 432 }], emph: [9, 10] });
```

**`UI.underline(parent, targets, at, {color = 'accent', weight = 4, d = .6, dy})`**
Draws a line under one or more elements (e.g. `$$('.em', layerEl)`).

### Cards

**`UI.titleCard(parent, {at, top = 300, size = 112})`**
Venue, title (`config.titleHtml`), subtitle, a short accent rule, authors and affiliations. It tells the score where the title is and dims the running head.

**`UI.endCard(parent, {at, taglineCue | tagline, links, top = 318, size = 88})`**
Title, tagline, authors, and QR codes for `config.links` (up to 3).
- `taglineCue` reveals the tagline word by word with that cue.
- The music resolves to its final chord here.

**`UI.card(parent, {at, out, x, y, w, h, html, pad, border, fill, style})`**
A white card with a hairline border. `border` and `fill` take semantic colors (soft tints). Give it a `w` that fits its longest line, or let long text wrap (don't set `white-space: nowrap` on text that might be too wide). The audit flags text that runs outside a card.

**`UI.chip(parent, html, {at, out, x, y, color, dot = true, sound})`**
A pill label.

**`UI.equation(parent, {at, out, x, y, w, tex, size = 30, caption, card = true})`**
KaTeX in a card (or bare with `card: false`).

**`UI.counter(parent, {at, t0, t1, from = 0, to, decimals = 1, thousands, prefix, suffix, size = 132, label, caption, x, y, align: 'right', w, color, ease})`**
A big number that counts up between `t0` and `t1`. Values ≥ 1,000 get a thousands separator (`thousands: false` to turn it off).

### Charts

**`UI.hbars(parent, {at, title, x = 360, y = 290, labelW = 400, trackW = 800, rowH = 92, barH = 30, max = 100, decimals = 1, unit, labelSize = 25, valueSize = 22, track = true, stagger = .14, rows})`**
Horizontal bars.
- `rows`: `[{label, tag, value, color, bold, labelColor, tagColor, at}]`. Each bar grows at its `at`, and the values count up.
- Returns `xOf(value)`, `rowY(i)` and `rowMid(i)` for annotations.

**`UI.vbars(parent, {at, x = 300, y = 300, w = 1020, h = 500, max, ticks, tickDecimals = 1, decimals = 2, barW = 104, inner = 18, groupGap = 130, bars, groups, band, refs})`**
Vertical bars.
- `bars`: `[{label, value, color, hatch, bold, group, at}]`. `hatch: true` makes a striped bar, e.g. for "has seen the future" or an oracle.
- `groups`: `[{label, sub, color, at}]`, centered under each group.
- `band`: `{from, to, label, at}`, a shaded reference range (e.g. the market).
- `refs`: `[{value, from, to, at, color}]`, dashed lines from bar `from` to bar `to`.
- `values: false` hides all value labels (illustrative bars); `showValue: false` on a bar hides one. `ticks: [0], tickLabels: false` draws only a baseline.
- In portrait, prefer group labels plus one legend line over per-bar labels, and `band.label: ''` with the band explained in the legend.
- Returns `Y(v)` and `barX(i)`.

**`UI.lineChart(parent, {at, x = 260, y = 300, w = 1120, h = 520, yMin, yMax, yTicks, yLog, yFormat, xTicks: [[index, label]], xFormat, xTitle, yTitle, yTitleX, series, refs})`**
A line chart that draws itself.
- `yLog: true` uses a log10 y axis (`yMin`/`yMax`/`yTicks` in data units, e.g. `[1e-8, 1e-4, 1]`); ticks are written as `10^k` unless `yFormat(v)` is given. `xFormat(label)` formats x tick labels.
- `yTitleX` moves the rotated y title (default: just left of the tick labels). In portrait, put the axis title above the chart with `UI.text` instead.
- `xValues: [...]` places points at numeric x (one per value), with `xLog: true` for a log10 x axis; `xTicks` are then `[[xValue, label]]`. Returns `XV(x)` too. Leave ~200 px right of the plot for line-end labels.
- `series`: `[{name, values, color = 'accent', width = 3, markers = true, t0, t1, label: {i, dy, html: 'Ours {v}', unit: '%', decimals, size, at}}]`. Each line draws from `t0` to `t1`, and `{v}` in the label counts along with it.
- `refs`: `[{value, label, color, dash = '5 5', labelDy, at, highlight: [t0, t1]}]`, horizontal reference lines labelled at the right. `highlight` thickens one while it is mentioned.
- Returns `X(i)`, `Y(v)` and `el` (the container; shrink it later with `UI.move`).

**`UI.table(parent, {at, x, y, cols: [{label, w, align = 'right'}], rows: [{cells, highlight, dim, at}], best: [[r, c]], rowH = 56, size = 21, stagger = .12})`**
Rows rise one by one. The highlighted row gets a soft accent background, and `best` cells are accent bold.

### Time

**`UI.timeline(parent, {at, from, to, x0 = 170, x1 = 1750, y = 800, step = 1, labelEvery = 1, format, marks: [{value, label}], highlight: [{value, t0, t1, color}]})`**
An axis that draws in. Returns `X(value)` for placing anything on it.

**`UI.lane(parent, {X, from, to, y, h = 56, color, label, labelAlign: 'right', labelX, text, textSide: 'left', textDelay, at, d, dim: [[t, level]], ticks: {from, to, step}})`**
A band on a timeline (the period a method covers). `ticks` adds markers under it (vintages, releases).

**`UI.marker(parent, {x, y0 = 350, y1 = 800, color = 'bad', dashed = true, grow: 'up', label, labelAlign: 'right'|'left'|'center', at, out})`**
A vertical line such as a cutoff or event.

**`UI.progress(parent, {cells, chips, t0, t1, x = 170, y = 560, w = 1580, cellH = 68, counter: {to, decimals, suffix, label, x, y, size, at}})`**
A playhead sweeps the cells from `t0` to `t1`, filling them. A chip appears under each cell as the playhead passes, and the counter counts in sync. Use it for training over time, epochs or pipeline stages.

### Diagrams

**`UI.flow(parent, {at, nodes, edges})`**
Boxes joined by arrows.
- `nodes`: `[{id, x, y, w, h, html, kind: 'card'|'key'|'chip', at}]`. `key` is the emphasized box (accent border, soft fill); chips are about 40 px tall.
- `edges`: `[{from, to, at, color, arrow}]` run from the right edge to the left edge, straight or as an S-curve. `{path: 'M..'}` gives a custom route.

**`UI.steps(parent, {at, x, y = 262, w, gap = 90, widths, steps: [{title, at}], chevrons})`**
Numbered panel headers with arrows between them. Returns `boxes: [{x, y, w}]` for placing visuals (heatmap, walks, equations) under each step.

**`UI.pairs(parent, {at, cols: [{top, bottom}], x = 290, dx = 223, yTop = 330, yBot = 510, colW = 190, topH = 76, stagger = .2})`**
Columns of "A → B" cards, e.g. "model of year t−1 → news of year t".

**`UI.filter(parent, {at, items: [{text, keep}], x, y, w = 540, gateX = 1000, keepX = 1080, label, caption, keepLabel, dropLabel, spacing = .5})`**
Items pass a gate: kept ones slide through, dropped ones fade and get struck through.

**`UI.chipGrid(parent, {at, rows, cols, x = 340, y = 300, cellW = 108, cellH = 58, gapX, gapY, labelX = 170, wave = .07, rowLag = 1.6, text: (r, c) => html})`**
A grid of cells that light up in a wave (checkpoints, datasets, languages).

**`UI.heatmap(parent, {at, x, y, cols = 16, rows = 11, cell = 24, cellH = 20, gap = 3, values, seed, sweep})`**
A matrix in a diverging accent/contrast colormap. Without `values` it is decorative, so label it illustrative.

**`UI.walks(parent, {at, x, y, w, n = 34, steps = 60, seed, d})`**, **`UI.converge(parent, {at, fromX, ys, toX, toY})`**, **`UI.curve(parent, {at, x, y, w, drift, noise, seed, color, d})`**
Illustrative "many signals → one combination → result" visuals. `walks` returns `ends` and `endX` to feed `converge`. Always mark them illustrative.

**`UI.figure(parent, {src: 'assets/fig.png', at, out, x, y, w, card = true, caption, kb: [1, 1.03]})`**
A figure from the paper (make PNGs with `pmv figures`), with a gentle zoom. Rebuilding the chart is better whenever the data is available.

### Annotations

**`UI.bracket(parent, {x, y0, y1, label, labelW, labelY, side, color, size, at})`**
A vertical bracket between two values with a label ("+28 pts").

**`UI.stamp(parent, {text, x, y, at, color = 'bad', rot = -3, size})`**
A verdict stamp ("INVALID BACKTEST"), with a soft thud sound.

**`UI.strike(parent, {x, y, w, at, color})`**
A strike-through line.

**`UI.move(el, {at, x, y, s, d = 1, origin})`**
Moves or scales any container from its rest position: `UI.move(chart.el, {at: S('r3'), s: .8, y: 40})`. Scaling shrinks its text too, and the audit measures text at its on-screen size, so a chart shrunk below ~0.8 will fail the size check; use a second page (two layers crossfading) instead.

**`UI.arrow(parent, {from: [x, y], to: [x, y], bend, path, at, d = .7, color = 'faint', width, dashed, head = true})`**
An arrow drawn on at `at`, straight or bent (`bend` -1..1), or along any SVG `path`. Use it for custom diagrams instead of hand-built SVG.

## 6. Patterns

**Several "pages" inside one scene.** Build each page in its own `layer`, then crossfade the layers in the returned update function:
```js
const PA = layer(el), PB = layer(el);
// ... components into PA and PB ...
return t => { const k = P(t, S('m3') - .4, .7, ease.inOutCubic); PA.style.opacity = 1 - k; PB.style.opacity = k; PB.style.display = k > 0 ? 'block' : 'none'; };
```

**Swap the headline while a scene continues.** Give each headline its `at`, and set `out` to the next one's `at - .35`.

**Annotate a chart value.** Use the helpers a chart returns: `UI.bracket(ch.el, {x: 1366, y0: ch.Y(72.2), y1: ch.Y(44), label: '+28 pts', at: W('r2', '44')})`. Put annotations inside `ch.el` so they move with the chart.

**Highlight a word in kinetic type.** Use `emph`, plus `UI.underline(layerEl, $$('.em', layerEl), W(cue, 'word'))`.

**Custom SVG.** `const s = svgLayer(el); const p = sv(s, 'path', {d, pathLength: 1, stroke: 'var(--accent)', fill: 'none'});` then `draw(p, P(t, at, .8))` in the update function.

## 7. Sound cues

Components emit their own cues: blips on bars and lines, ticks on chips and grids, a thud on stamps, an impact on the title and end cards, and a soft whoosh on each scene start. Add your own with `sfx(type, t, {gain, note, f0, f1, dur, pan})`:

| Type | Use |
|---|---|
| `tick` | `note` = MIDI pitch |
| `blip` | `f0` → `f1` Hz glide over `dur` s |
| `whoosh` | |
| `impact` | |
| `thud` | |

Pass `sound: false` to a component to silence it. Set `config.music.sfx: false` to drop all effects.
