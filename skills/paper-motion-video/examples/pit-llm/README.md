# Worked example: PIT-LLM (NeurIPS 2026)

This is a complete 2:06 video, in a landscape 16:9 cut and a portrait 4:5 phone cut, for *Scaling Point-in-Time Language Models: Enabling Economic Evaluation of Embeddings* (Kelly, Malamud, Schwab, Xu).

- `script.txt` has 22 cues and 268 words, with spoken-form markup for years, percentages and model names.
- `scenes.js` (landscape) has nine scenes built almost entirely from `UI.*` components; `scenes.portrait.js` lays the same nine scenes out for a phone (one column, stacked panels, a legend instead of per-bar labels):

| Scene | What it shows | Components |
|---|---|---|
| hook | text → model → signals, then the hook as kinetic type | flow, kinetic, underline |
| title | the title card | titleCard |
| problem | the lookahead problem on a timeline, then the A/B/C lanes | timeline, flow, marker, chip, stamp, strike, lane, equation |
| gap | prior work vs. models without a cutoff, then the research question | hbars, kinetic |
| method | the chronological training run, then the leakage filter | progress, counter, card, filter |
| nlp | the HellaSwag curves, then the 7-benchmark averages | kinetic, lineChart, bracket, move, hbars |
| econ | the vintage → news schedule, then the 3-step portfolio pipeline | kinetic, pairs, steps, heatmap, walks, converge, curve, equation |
| sharpe | out-of-sample Sharpe ratios | vbars, card |
| outro | open release (36 checkpoints), then the end card with QR codes | kinetic, chipGrid, card, endCard |

All numbers come from the paper (Tables 2–3, Figs. 1–3) or its poster. The random walks and rising curve in the econ scene are marked illustrative.

Rebuild it:

```bash
tools/pmv new ~/Desktop/pit-llm-video --example pit-llm
tools/pmv all ~/Desktop/pit-llm-video
```
