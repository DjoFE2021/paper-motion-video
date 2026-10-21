# Storytelling for a short paper video

## Contents
1. The arc
2. Word budget and pacing
3. Writing for the ear
4. Spoken-form markup
5. Choosing what to show
6. Papers without data
7. The end card
8. Voices
9. Worked example

The video has one job: get the paper's message into a smart non-specialist's head in the time it has (`video.targetSeconds`, two minutes unless the user asked for another length). Every sentence must earn its place by moving that message forward, and it must come with something to show.

## 1. The arc

Most papers fit this shape. Merge or drop beats rather than squeezing in more.

| Beat | Length | Purpose | Typical visual |
|---|---|---|---|
| Hook | 8–12 s | Why anyone should care: the problem as one concrete image | flow diagram, kinetic sentence |
| Title | 3–4 s pause | Paper title, authors, venue | `UI.titleCard` |
| Problem | 15–20 s | What goes wrong today, through a concrete example | timeline, before/after, stamp |
| Idea | 10–15 s | The key idea in one sentence | lanes, diagram + one equation |
| Question | ~3 s | The research question, as kinetic type | `UI.kinetic` |
| Method | 15–20 s | How it works, at whiteboard level | progress, flow, steps, filter |
| Result 1 | ~15 s | The headline result: one chart, one spoken number | `UI.lineChart`, `UI.hbars` |
| Result 2 | 15–20 s | Second result or downstream impact | `UI.vbars`, `UI.table` |
| Limitation | 1 sentence | Honesty builds trust | text or a chart annotation |
| Close | ~10 s | Takeaway, open release, end card | kinetic line, `UI.chipGrid`, `UI.endCard` |

Open on the problem, not on "In this paper we…". The title card comes *after* the hook, in a 3–4 s pause.

**Other lengths.** The table is for 2:00. For other lengths, cut or add whole beats rather than speeding everything up:
- **0:45–1:15 (Reels, Shorts, a feed teaser).** Hook, title, the problem and the idea as one beat, one result, close: 4–6 scenes. Drop the question beat, the second result and the method's detail. Keep the limitation as half a sentence.
- **1:30.** The 2:00 arc without the second result, or with the problem and the idea merged.
- **2:30–3:00 (a talk, a lab page).** Give the method a second beat, or add the downstream-impact result. Still show two or three results, never a fourth chart.

The title card and the end card keep their time at every length, so a shorter video loses words from the middle.

## 2. Word budget and pacing

- **Word count.** Kokoro at `speed` 1.1 speaks ~2.7 words/s; with pauses, the title card and the end-card hold that is ~2.2 words/s overall. **2:00 ≈ 235–250 words**, 18–22 sentences (measured: 268 words gave 2:06, 273 gave 2:10, and 246 words of theory-paper vocabulary gave 2:03). For another length, allow 2.05–2.2 words per second of everything but the first 6 s: 1:00 ≈ 110–120 words, 1:30 ≈ 170–185, 3:00 ≈ 355–385. `pmv new` prints this budget for the project's length. Technical terms are spoken more slowly, so aim for ~230 words for a jargon-heavy paper. `pmv narrate` prints the real duration and how many words to add or cut. If you are a few seconds over, cut a sentence rather than speeding up the voice.
- **Sentence length.** Aim for 8–20 words, with one idea per sentence. Break each sentence into subtitle cards of ≤ 45 characters with ` / `, at natural phrase boundaries.
- **Pauses** (`[id +pause]`):

  | Where | Pause |
  |---|---|
  | Within a scene | 0.3–0.45 s |
  | Between scenes | 0.7–0.9 s |
  | After the hook (title card) | 3.5–4 s |
  | Before the closing line | ~0.9 s |
- **Speed.** Keep it between 1.0 and 1.15. Faster sounds rushed; cut words instead.

## 3. Writing for the ear

- **Concrete beats abstract.** "Backtest a strategy on 2015, and the model already knows how 2016 turned out" lands; "temporal leakage contaminates evaluation" does not.
- **One name per thing.** Name the method once and reuse exactly that name; synonyms make listeners think there are several things.
- **Numbers.** Use at most one or two per sentence. Round them in speech ("seventy-two percent") and show them exactly on screen (72.2%). Say what a number means ("more than double the stock market").
- **Keep the paper's strength of claim, word for word.** If the abstract says "generically", "unconditionally", "in our sample", "approaches" or "close to", the spoken sentence keeps that word. Paraphrasing a hook is where qualifiers get lost, so check every claim sentence against the paper before narrating. Include one sentence on what remains open. Overclaiming in a video is worse than in a paper, because nobody can check the footnote.
- **Use the authors' voice.** Borrow phrasing from the abstract, introduction and conclusion; it is already vetted.
- **Avoid machine-sounding prose.** No "revolutionize", "game-changer", "unlock the power", "delve", "in today's fast-paced world", or rhetorical triplets. Plain, specific sentences sound human.
- **Avoid what doesn't survive speech.** No parentheses, citations, acronym chains, or symbols read aloud.
- **Every sentence needs a visual.** If you can't say what appears on screen while it is spoken, cut the sentence.

## 4. Spoken-form markup

The voice reads literally, so write anything ambiguous in spoken form. `{Shown|spoken}` shows the first part in subtitles (and in kinetic type) and speaks the second.

| Write | Subtitle shows | Voice says |
|---|---|---|
| `{2015,\|twenty-fifteen,}` | 2015, | twenty-fifteen |
| `{72%\|seventy-two percent}` | 72% | seventy-two percent |
| `{1.0 to 1.5\|one to one-point-five}` | 1.0 to 1.5 | one to one-point-five |
| `{4B\|four-billion}` | 4B | four-billion |
| `{ChronoGPT\|Chrono G P T}` | ChronoGPT | Chrono G P T |
| `{HellaSwag\|Hella Swag}` | HellaSwag | Hella Swag |
| `{LoRA\|lora}` | LoRA | lora |
| `{e.g.\|for example}` | e.g. | for example |
| `{R²\|R squared}` | R² | R squared |

- **Escaping.** In `script.txt` write a plain `|`; the backslash in the table above is only Markdown escaping.
- **Punctuation.** Put it inside the braces when it belongs to the word (`{2024.|twenty-twenty-four.}`); otherwise it becomes a separate subtitle token.
- **Misread acronyms.** Respell them phonetically ("Chrono G P T", "N L P"), or replace them with a phrase ("our four-billion model").
- **Kinetic type** uses the *shown* words, so word counts in `UI.kinetic` lines refer to the display words of the cue.

## 5. Choosing what to show

- **Show two or three results at most**, normally the ones in the abstract. A third chart is usually one too many.
- **Every on-screen number comes from `facts.md`**, with its source.
- **Rebuild charts from the data** instead of pasting figures. Highlight the paper's method in the accent color and keep everything else neutral. Annotate the one difference the narration states (a bracket with "+28 pts").
- **Use kinetic type for 3–5 sentences:** the hook line, the research question, the main claim and the closing line. More than that feels like a lyric video.
- **Mark made-up visuals** (random walks, schematic curves, stand-in heatmaps) as illustrative on screen.

## 6. Papers without data (theory, methods, position papers)

A theory paper has few numbers to animate, but it still has a story: an assumption everyone makes, why it fails, what replaces it, and why it matters in practice.

- **Make the objects visible.** Draw the thing the theorems are about: a spectrum, a decision boundary, a mechanism, a timeline. Use the paper's own examples and parameters (a closed-form case, a figure's caption values) so the curves are exact, not decorative.
- **One theorem per scene, said in words.** Narrate the statement in plain language ("the eigenvalue at every fixed rank keeps growing"), show the formula once, small, as a card. Write it exactly as the paper states it (a lower bound stays a lower bound, `\liminf` stays `\liminf`).
- **Tables of cases** (`UI.table`) work well for "under assumption A you get X, under B you get Y".
- **Evidence the paper cites** can carry the "why it matters" beat, labelled as earlier work with its citation.
- **Mark schematics as illustrative**, and keep them qualitatively faithful (shape, direction, ordering) to what the theorem says.

## 7. The end card

The end card's tagline is read on its own, often as the thumbnail. It must stand alone: no "them", "this" or "it" pointing back to the previous sentence. Prefer the paper's main claim in one line ("Truncating to a few factors discards priced risk", not "Truncating them discards priced risk"). If the closing narration sentence works alone, use it with `taglineCue`; otherwise write a tagline.

## 8. Voices

Kokoro-82M ships several English voices; set `voice.name` in `config.json`, or pass `--voice` to `pmv new` (and to `pmv defaults` to keep it for every project).

| Accent | Female | Male |
|---|---|---|
| American | `af_heart` (default, warm, the most natural), `af_bella`, `af_nicole` | `am_michael`, `am_puck` |
| British | `bf_emma`, `bf_isabella` | `bm_george`, `bm_fable` |

The voice is synthetic, and the user should hear it before sharing the video widely. If a word is mispronounced, respell it in the spoken half of `{Shown|spoken}` and re-run `pmv narrate`; only the changed sentences are re-synthesized.

## 9. Worked example

`examples/pit-llm/script.txt` is a complete 268-word script (2:06, a few seconds over budget). Its shape:

```
[h1] Language models are now a standard tool / in finance and economics.            <- context in one line
[h2 +0.35] But a model trained on today's internet / has already read the future.     <- the hook (kinetic)
[p1 +3.8] Backtest a strategy on {2015,|twenty-fifteen,} / and the model already knows how {2016|twenty-sixteen} turned out.
[p2 +0.3] That's lookahead bias, / and it invalidates the backtest.                  <- name the problem after showing it
[p3 +0.45] The usual fix, testing after the training cutoff, / leaves only a year or two of data.
[c1 +0.7] Point-in-time models fix this by construction: / each reads only text published before its cutoff.
[c2 +0.35] But until now, / they lagged far behind standard models.
[c3 +0.55] So how much performance / do you really have to give up?                  <- the research question
...
[r3 +0.4] A gap remains on knowledge-heavy tasks, / but it narrows with scale.        <- the honest limitation
...
[o3 +0.45] Point-in-time language models, / for research that respects time.         <- the closing line
```
