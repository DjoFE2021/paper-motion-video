# Troubleshooting

## Setup
- **`pmv doctor` first.** It checks the Python packages, ffmpeg, the browser, the voice model and network access.
- **Python.** Kokoro needs Python 3.10–3.12. The first `pmv` call picks `python3.12`/`3.11`/`3.10`, `py -3.12`/`-3.11`/`-3.10` (the Windows launcher), `python3` or `python`, else uses `uv` if it is installed (also when creating the venv fails, as on Debian/Ubuntu without `python3-venv`). Otherwise install one (`brew install python@3.12`, `winget install Python.Python.3.12`, `uv python install 3.12`) and run `pmv setup`.
- **Intel Macs (x86_64).** PyTorch stopped shipping wheels after 2.2.2, so setup pins `torch==2.2.2`, `numpy<2`, `transformers<4.46` and `scipy<1.14` through a constraints file. If you install extra packages into the venv by hand, pass `-c ~/.cache/paper-motion-video/constraints.txt`; otherwise numpy 2 sneaks in and torch fails with "Numpy is not available".
- **Linux.** Setup installs CPU-only torch. If Chromium won't start: `sudo ~/.cache/paper-motion-video/venv/bin/python -m playwright install-deps chromium`.
- **Windows.** Use `tools\pmv.cmd` in cmd or PowerShell, and `tools/pmv` in Git Bash; both share one environment in `%USERPROFILE%\.cache\paper-motion-video`. WSL2 works too, as Linux. If pip fails with a path-too-long error, enable long paths in Windows or set `PMV_HOME` to a short folder such as `C:\pmv`.
- **"Error processing file '…/phontab'".** espeak-ng, which the voice uses for words outside its dictionary, reads its data from a path of at most 159 characters (229 on Windows), and `PMV_HOME` is too deep for that. Setup stops with this explanation; set `PMV_HOME` to a shorter folder and run `pmv setup`.
- **Setup options.** `pmv new` reads `~/.config/paper-motion-video/defaults.json` (or the file `PMV_DEFAULTS` names), which `pmv defaults` writes, and then applies its flags on top. `pmv defaults` prints what a new project would get; `pmv defaults --reset` forgets it. A worked example (`--example`) keeps its own setup unless a flag changes it.
- **Start over.** Delete `~/.cache/paper-motion-video` (`rm -rf` on macOS and Linux, `Remove-Item -Recurse -Force` in PowerShell) and run any `pmv` command. Set `PMV_HOME` to install elsewhere.

## Progress pane (Claude Code plugin)
- **It stays empty.** It follows the `pmv` runs this session started: the plugin sets `PMV_PROGRESS_DIR` for the session, and each run writes a small record there. A run in another terminal or session doesn't show. Nothing is written where the variable is unset, so other agents are unaffected.
- **It doesn't open.** Unasked, it opens only in a wide terminal. `/video-progress` opens it at any width, and the one-line status under the prompt shows the same progress meanwhile.
- **A step looks stuck.** A record that hasn't changed for two minutes counts as a stopped run (killed, or the machine slept). Run the command again.

## Narration
- **A word is mispronounced.** Respell it in the spoken half: `{LoRA|lora}`, `{ChronoGPT|Chrono G P T}`, `{SQL|sequel}`. Re-run `pmv narrate`; unchanged sentences come from `build/tts_cache/`.
- **The timing feels rushed or slow.** Adjust `voice.speed` (1.0–1.15) or the `+pause` values; don't go below 0.3 s between sentences.
- **"W miss" errors in review.** `W(cue, 'word')` didn't find the word. It matches the shown *or* spoken form, case-insensitively, as a substring; check spelling and the cue id.
- **Kinetic word-count errors.** The `lines[].n` values must add up to the number of *shown* words in the cue (a `{Shown|spoken}` group counts as one word per space in the shown part).
- **Subtitles show a stray "," token.** Move the punctuation inside the braces: `{2015,|twenty-fifteen,}`.

## Visuals
- **An element never appears.** Check its `at`: it must lie inside the scene's window `[a, b]`. Also check for opacity set by a parent layer and for JavaScript errors in the review output.
- **Something shows through a hidden group.** You used `visibility:hidden` on a parent. Use `opacity` and `display` instead.
- **Frames differ between runs or flicker.** Something depends on state, `Math.random`, `Date` or CSS animations. Make it a pure function of `t` (use `rng(seed)`).
- **Text falls back to Georgia or a system font.** The font cache failed to download (offline at first use). Delete `~/.cache/paper-motion-video/assets` and run `pmv review` online once. `build/index.html` (the browser preview) loads fonts from the web.
- **"text too small for phones".** The text is below `TYPE.min` on screen (20 px landscape, 24 px portrait). Use a `TYPE` size, shorten the text so a bigger size fits, or split the content across two pages. Text inside a container scaled with `UI.move` counts at its scaled size.
- **"texts touch".** Two labels on the same line are less than 8 px apart (e.g. a value and an annotation). Move one, or put the annotation on its own line.
- **"text sits on a card / bar it does not belong to".** A label overlaps a card or a bar that isn't its parent. Move it into free space, or into the card it describes.
- **"scenes.portrait.js not found".** `video.formats` lists portrait but the project has no portrait layout yet. Write one (start from `templates/project/scenes.portrait.js` or `examples/pit-llm/scenes.portrait.js`), or render only landscape with `--format landscape`.
- **"text runs outside its card".** The text is wider or taller than its box minus padding. Widen the box (`w`), shorten the text, lower its font size, or let it wrap. For `UI.flow` nodes, a wider `w` re-routes the arrows automatically.
- **Problems only in `pmv check`, not `pmv review`.** They happen mid-transition, where one scene's elements are still leaving while the next arrive. Delay the incoming element, or move or fade the outgoing one earlier.
- **"empty frames".** Nothing but background in the content area at that moment: a gap between scenes, or a scene whose content arrives too late. Start the next scene's first element earlier, or end the previous scene later.
- **The audit flags overlapping big kinetic lines.** Tall serif lines have tall glyph boxes. Add `gap` or a lower `top` to the second line, and confirm on the sheet image.

## Render
- **"page did not become ready".** Usually a JavaScript error in `scenes.js`; it is printed. The renderer retries each page 3 times.
- **Slow renders.** Each format of a 2-minute video takes ~3–6 min on an 8-core laptop (landscape at `video.fps` = 60, phone formats at `video.phoneFps` = 30). Render one format with `--format`. Iterate with `pmv video <dir> --preview` (960×540 @ 30 fps, about 1 min for 2 minutes of video) or a time range: `--start 40 --end 55`.
- **Fewer workers.** `--workers N` (default: half the CPU threads, max 8).
- **File size.** The master is H.264 CRF 18 at 1080p60, typically 15–40 MB for 2 minutes. `out/*_share.mp4` is a 30 fps CRF 23 copy (~5–10 MB) for messaging and social media.

## Audio
- **Music too loud or soft.** Set `music.bedLufs` in `config.json`: −30 is the default, −34 quieter, −27 more present. Then run `pmv music` and `pmv final` (for all formats). There's no need to re-render the video: `pmv final` re-muxes.
- **No music or effects.** Set `music.enabled: false` and/or `music.sfx: false`.
- **Different mood.** Set `music.preset`: `hopeful` (default), `reflective` or `driving`. `music.key` and `music.bpm` also work.
