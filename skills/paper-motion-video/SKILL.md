---
name: paper-motion-video
description: >-
  Turn an academic paper (LaTeX source, PDF, arXiv link, poster or slides) into a ~2-minute narrated
  explainer video in a refined, editorial motion-design style, in a 16:9 cut and a phone-first 4:5 cut.
  Charts are rebuilt from the paper's real numbers, a neural voice-over comes with word-synced subtitles
  and a quiet synthesized score, and everything renders locally to MP4. Use this skill whenever someone
  wants a video, teaser, trailer, video abstract, explainer, conference or poster-session loop, or a
  social-media clip about a paper or research project, even if they only say "make a video of my paper",
  "animate our results" or "something for LinkedIn about our NeurIPS paper".
license: MIT
compatibility: macOS or Linux with bash and Python 3.10-3.12. Internet is needed for the first setup. Google Chrome is recommended (otherwise Chromium is downloaded).
metadata:
  version: "1.1.0"
---

# Paper → explainer video

You turn a paper into a ~2-minute video whose only job is to get the paper's message across as clearly as possible. The look is that of a well-designed journal figure or quality newspaper graphic coming to life: paper-white background, serif headlines, flat charts, calm motion synced to the voice. It is not a tech demo.

Most viewers will watch on a phone, so a project ships **two cuts of the same narration**: landscape 16:9 (YouTube, talks, desktop) and portrait 4:5 (LinkedIn, Instagram and X feeds). Vertical 9:16 and square are available too. The deliverables are:

- `out/<name>.mp4` (landscape, 1080p60) and `out/<name>_share.mp4` (30 fps, small)
- `out/<name>_portrait.mp4` (1080×1350, 30 fps)
- `out/<name>.srt` (subtitles, shared by all cuts)

The pipeline is built, so your work is the parts that need judgment: the story, the script, the scene design for each format, and visual review.

- **Voice:** Kokoro-82M runs offline on CPU and returns word timestamps. The animation is keyed to those timestamps, so visuals land on the spoken words, in every format.
- **Visuals:** an HTML/JS motion engine with ~30 animated components (`runtime/`), sized from a per-format type scale so text stays readable on phones. Headless Chrome renders it in parallel.
- **Sound:** a synthesized score plus soft sound cues that the components emit. The music ducks under the voice, and the mix is normalized to −16 LUFS.

Paths are relative to this skill's folder (the directory containing this file). The CLI is `<skill-dir>/tools/pmv`, called `pmv` below. Its first call installs everything into `~/.cache/paper-motion-video` (3–6 min, one time). If anything looks off, run `pmv doctor`. Every command after `narrate` runs for each format in `config.json` → `video.formats`; add `--format portrait` (or `landscape`, a comma list, `all`) to pick.

| Step | Command | Time for 2 min of video |
|---|---|---|
| Create a project | `pmv new <dir>` (add `--example pit-llm` for the worked example) | instant |
| Paper text, searchable | `pmv text <paper.pdf>` | seconds |
| Voice-over + timeline | `pmv narrate <dir>` | ~1 min, cached per sentence |
| Review stills + contact sheets + layout audit | `pmv review <dir>` | ~10 s per format |
| Interactive preview in a browser | `pmv preview <dir>` (prints file:// URLs) | instant |
| Quick motion check | `pmv video <dir> --preview` then `pmv final <dir> --preview` | ~1 min per format |
| Render (re-mixes the sound if needed) | `pmv video <dir>` | ~3–6 min per format, 8-core laptop |
| Package | `pmv final <dir>` | ~30 s |
| Final pass through the finished videos | `pmv check <dir>` | ~15 s per format + your visual pass |
| Everything after the review loop | `pmv all <dir> --skip-narrate` | the sum of the above |

## Workflow

### 1. Gather the material and check in briefly

Find the best source. SSRN, journal sites and some preprint servers block automated downloads (HTTP 403); if a fetch fails, ask the user to download the PDF in their browser and tell you where it is, rather than retrying. LaTeX beats PDF: tables, `pgfplots` coordinates and captions give exact numbers. Look for poster and slide sources next to the paper; they hold clean data and the authors' own framing of the story. For a PDF, run `pmv text paper.pdf` and search the text file it writes (page markers included) instead of reading the PDF page by page.

Ask only what you cannot infer, in one message, then proceed:
- **Where to save.** Never inside the paper's synced folder (Overleaf/Dropbox/the paper's repo). The default is `~/Desktop/<short-name>-video/`.
- **Length, audience and formats**, if not "~2 minutes for smart non-specialists, landscape + portrait".
- **Voice**, if they care (see `references/storytelling.md`).

If the user is around, show them the narration and a one-line-per-scene storyboard before the final render, and offer changes. Don't block on it if they asked you to just go.

### 2. Write a fact sheet before any visuals

Create `<project>/facts.md` with every number, label and claim you plan to show or say. Give each one its source (Table 2, Fig. 3, §4.2, poster); on-screen numbers come only from this sheet. Viewers screenshot these videos, and the authors' credibility rides on every figure.

- **Keep the paper's qualifiers, word for word.** If the abstract says "generically", "unconditionally", "in our sample" or "approaches", the claim keeps that word in the narration and on screen. Copy each claim's exact wording from the paper into the fact sheet next to your version, so the comparison is easy.
- **Keep formulas exact.** A lower bound stays a lower bound; don't turn `liminf > 0` into a limit.
- **Label made-up visuals.** Anything decorative that looks like data gets a small "illustrative" note.
- **No fake real-world content.** No invented quotes, no headlines attributed to real outlets, no logos you don't own.

### 3. Write the narration, then synthesize it

Read `references/storytelling.md`; it has the arc, the word budget, the spoken-form rules and what to do with theory papers that have no data. In short:

- 2 minutes ≈ 235–250 words, 18–22 sentences at `voice.speed` 1.1 (about 230 for jargon-heavy or theory papers, which are spoken more slowly). If `pmv narrate` reports you are over, cut a sentence.
- Write numbers, years and acronyms in spoken form with `{Shown|spoken}`, and break subtitles with ` / `.
- Put a 3–4 s pause after the hook for the title card.
- Plain, specific sentences in the authors' own vocabulary. Hype words make the video sound machine-made.
- The end card's tagline must make sense on its own (no "them" pointing back).
- Music: `music.preset` `hopeful` (default) suits results papers, `reflective` theory and conceptual papers, `driving` systems and benchmark papers.

```bash
pmv new ~/Desktop/mypaper-video
# edit config.json (title, authors, venue, links, theme colors, formats, music preset) and script.txt
pmv narrate ~/Desktop/mypaper-video      # per-cue timings + total duration + how many words to cut/add
```

### 4. Design the scenes, one file per format

Before writing scenes, read:
- `references/design.md`: the visual rules (with the explicit "Don't" list of AI-looking effects), the type scale, and how to design the phone cut
- `references/components.md`: the API
- `examples/pit-llm/scenes.js` and `examples/pit-llm/scenes.portrait.js`: the same 2-minute video in both formats

Write `scenes.js` (landscape) first, then `scenes.portrait.js`: same scene ids and windows, same timing anchors, a new one-column layout. Then:
- **One scene per story beat** (8–10 scenes). Each holds 1–3 ideas, and something changes every 2–3 s.
- **Time everything from the narration.** Use `S('cue')`, `E('cue')` and `W('cue','word')`; never hard-code seconds. A bar grows when its number is spoken, and a label appears with its noun.
- **Rebuild charts from the data** (`UI.hbars`, `UI.vbars`, `UI.lineChart`, `UI.table`) rather than pasting figures. Highlight the paper's method in `accent`, keep the rest `neutral`, and annotate the one difference the narration states with `UI.bracket`.
- **Kinetic type for 3–5 key sentences only** (`UI.kinetic`): hook, question, main claim, closing line. Those cues automatically drop their subtitle.
- **Readable on a phone.** Take sizes from `TYPE` and positions from `LAY`; never go below `TYPE.min` (20 px landscape, 24 px portrait). If something only fits small, cut words or split it across two pages. Don't shrink a chart with `UI.move` to make room.
- **Balanced frames.** Fill the content area top to bottom: in landscape, center the content block vertically (or use the space for a second panel or a key-number card) instead of leaving the lower half empty.
- **Per-format text.** Title, authors and affiliations can differ per cut: put overrides in `config.json` under `"portrait": {"titleHtml": …, "affiliations": […]}` (shorter lines for the narrow frame).
- **Text stays inside its card**, and labels never touch each other.
  - Size every box for its longest line, with padding to spare. If text doesn't fit, widen the box, shorten the text or let it wrap.
  - For your own containers, add the class `card`, `chip` or `box` (or `data-within="<box id>"` on a text overlay) so the audit checks them.
- **Keep the editorial look.** If you write custom HTML, use the CSS variables and classes (`--accent`, `--ink`, `.card`, `.serif`), flat fills and hairlines. Don't add glows, gradients, blur (including on exits: fade instead), dark backgrounds or monospace labels.

### 5. Review loop: look at every scene before rendering

```bash
pmv review ~/Desktop/mypaper-video                  # every format: end of every cue, scene transitions, title and end cards
pmv review ~/Desktop/mypaper-video --format portrait --times 41.5,63   # specific moments (written to review/times/)
```

This writes `build/review/` (and `build/portrait/review/`) contact sheets with labelled frames, and prints a layout audit per format. The audit flags:
- overlapping or touching text, and text sitting on a card or bar it doesn't belong to
- text running outside its card
- text too small for phones
- text entering the subtitle band or leaving the safe frame
- JavaScript errors

Open every sheet (the Read tool shows images) and check what the audit cannot:
- labels crossing lines
- elements still fading in at the end of their sentence
- empty or crowded areas
- claims and numbers that disagree with `facts.md`

Go through `references/design.md` § 8, fix, and re-run. Two or three rounds per format is normal, and this is where the quality comes from. To judge motion, render a fast preview: `pmv video <dir> --preview` (~1 min) or a range with `--start 40 --end 55`.

### 6. Render and package

```bash
pmv all <dir> --skip-narrate      # for each format: music -> video -> final -> check
```

Run it in the background; it prints progress. `pmv video` on its own also rebuilds the mix whenever the scenes' sound cues or the timings changed, so a scenes edit never leaves the sound out of sync.

### 7. Final pass through the finished videos (always, before handing them over)

The review loop looks at the page at chosen moments. This pass looks at the actual MP4s, from start to end, in every format. Do it every time a video is rendered, including after small fixes.

```bash
pmv check <dir>
```

For each format, the command does three things:
1. **Checks the file:** resolution, fps, duration against the narration, audio stream, loudness (−16 LUFS), true peak, subtitles.
2. **Re-runs the layout audit every 0.25 s across the whole timeline**, transitions included.
3. **Decodes the final video** to flag empty frames (nothing in the content area) and write contact sheets: `build/check/final_sheet_NN.png` and `build/portrait/check/…`, a labelled frame every 2 s.

Then watch it through: open **every** sheet in order, and check that
- every automatic problem is gone
- nothing is empty or waiting for content (a card or axes with nothing in them for more than ~1.5 s, a blank gap between scenes)
- each element appears when the subtitle under it says its words
- transitions are clean: no two layers fighting, no labels crossing
- all text is comfortably readable at the sheet's small size (if you squint, a phone viewer can't read it)
- numbers, names, links and qualifiers match `facts.md` and `config.json`
- the portrait cut tells the same story as the landscape cut
- the end card holds long enough to read

If anything is off, fix it, run `pmv all <dir> --skip-narrate` (or `pmv video` + `pmv final` + `pmv check` for one `--format`), and look again. Only a clean pass (automatic checks passed, every sheet of every format looked at) is ready to hand over.

Contact sheets are downscaled, so faint residue of a fading element can look worse than it is. If you suspect a lingering ghost, render that exact moment with `pmv review <dir> --times T` and judge it at full size.

### 8. Report

When you report back, give:
- the paths and durations of every cut
- that the final pass came back clean, and what you fixed during it
- what you could not verify yourself: **you cannot hear the audio**, so ask the user to listen for pronunciation, pacing and the voice choice
- anything marked illustrative, and anything you inferred (links, affiliations) that the authors should confirm
- how to iterate: edit `script.txt` → `pmv narrate` → `pmv all --skip-narrate`; or edit a scenes file → `pmv review` → `pmv all --skip-narrate`

## Gotchas

- **Frames render out of order in parallel.** Everything must be a pure function of `t`: no `Math.random()` (use `rng(seed)`), no `Date`, no CSS transitions or animations, no state carried across frames.
- **Hide groups with `opacity`/`display`, never `visibility`.** A child with `visibility: visible` shows through a hidden parent.
- **Safe frame**: content within `LAY.M`–`LAY.R` and `LAY.top`–`LAY.bottom` (landscape 170–1750 × ~100–920, portrait 80–1000 × ~112–1136). Subtitles live below `LAY.bottom`.
- **`W(cue, 'word')`** prefers an exact word, then a word starting with it, then any word containing it (punctuation and case ignored). Check that short queries (`'to'`, `'a'`) hit the word you mean, or pass the occurrence index: `W('s1', 'to', 1)`.
- **Both scenes files share the cues.** If you add, remove or rename a cue in `script.txt`, update every scenes file. Missed `W()` lookups and kinetic word-count errors appear as JavaScript errors in `pmv review`; read them.
- **Online-only cloud files** (0-byte Dropbox/iCloud placeholders) can't be read. Ask the user to make them available offline.
- **More**: setup, platform, render and audio issues are in `references/troubleshooting.md`.
