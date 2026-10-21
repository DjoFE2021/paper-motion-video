// PIT-LLM worked example, landscape 16:9: "Scaling Point-in-Time Language Models" (NeurIPS 2026), ~2:06.
// Every number on screen comes from the paper (Tables 2-3, Figs. 1-3) or its poster.
// Structure: hook -> title -> problem (A/B/C lanes) -> gap + question -> method -> NLP results
//            -> economic evaluation -> Sharpe ratios -> open release + end card.
// Text sizes come from TYPE (never below TYPE.min, so the video stays readable on a phone held sideways).
// The phone version of the same video is scenes.portrait.js (same narration and timings, its own layout).

const YEARS = [...Array(12)].map((_, i) => 2013 + i);
const lbl = (txt, c = 'dim') => `<div style="font-size:${TYPE.kicker}px;font-weight:600;letter-spacing:.05em;color:var(--${c})">${txt}</div>`;

// =====================================================================  1. HOOK
scene('hook', -1, E('h2') + .5, el => {
  const L1 = layer(el), L2 = layer(el), h1 = S('h1');
  UI.kicker(L1, '<b>●</b>&nbsp;&nbsp;Text as data in finance &amp; economics', { y: 180, at: h1 - .5 });
  const news = [['NEWSWIRE · 2014-03-12', 'Central bank holds rates, signals patience'], ['NEWSWIRE · 2014-03-12', 'Chipmaker raises full-year guidance'],
                ['NEWSWIRE · 2014-03-13', 'Oil slides as inventories build']];  // generic placeholders, not real headlines
  const nodes = news.map(([d, tt], i) => ({ id: 'n' + i, x: 170, y: 270 + i * 168, w: 600, h: 136, at: h1 - .35 + i * .22,
    html: lbl(d) + `<div class="serif" style="font-size:${TYPE.value}px;font-weight:500;margin-top:8px;white-space:nowrap">${tt}</div><div style="margin-top:12px;height:5px;width:${260 + i * 30}px;border-radius:3px;background:var(--grid)"></div>` }));
  nodes.push({ id: 'llm', kind: 'key', x: 880, y: 375, w: 230, h: 190, at: h1 + .45,
    html: `<div class="serif" style="font-size:56px;font-weight:600">LLM</div><div style="font-size:${TYPE.label}px;color:var(--dim);margin-top:6px">text → signal</div>` });
  ['Sentiment', 'Return forecasts', 'Risk premia', 'In-silico policy experiments'].forEach((c, i) => nodes.push({ id: 'o' + i, kind: 'chip', x: 1300, y: 300 + i * 92, html: c, at: W('h1', 'finance') + i * .2 }));
  UI.flow(L1, { nodes, edges: [
    ...[0, 1, 2].map(i => ({ from: 'n' + i, to: 'llm', at: h1 + .6 + i * .12 })),
    ...[0, 1, 2, 3].map(i => ({ from: 'llm', to: 'o' + i, at: W('h1', 'finance') - .35 + i * .1 })),
  ] });
  // "But a model trained on today's internet / has already read the future."
  UI.kinetic(L2, 'h2', { top: 360, lines: [{ n: 7, size: 46 }, { n: 5, size: 140, top: 430 }], emph: [10, 11], emphClass: 'emC fut' });
  UI.underline(L2, $$('.fut', L2), W('h2', 'future') - .05, { color: 'contrast', d: .4 });
  return t => {
    const sw = P(t, S('h2') - .55, .5, ease.inOutCubic);
    A(L1, { o: 1 - sw });
    L2.style.opacity = sw;
  };
}, { fi: .01, push: .02, label: '01 — Context', energy: .35 });

// =====================================================================  2. TITLE (plays in the pause before p1)
scene('title', E('h2') + .25, S('p1') - .15, el => {
  UI.titleCard(el, { at: E('h2') + .25 });
}, { fi: .35, fo: .5, push: .02, label: '', energy: .5 });

// =====================================================================  3. LOOKAHEAD BIAS -> lanes A / B / C
scene('problem', S('p1') - .45, S('c2') - .15, el => {
  const p1 = S('p1'), p3 = S('p3'), c1 = S('c1');
  UI.kicker(el, 'Backtesting with language models', { at: p1 - .3 });
  const hT = [p1 - .2, W('p2', 'lookahead') - .1, p3 - .1, c1 - .1];
  ['What does the model <em>already know?</em>', '<span class="emC">Lookahead bias</span>', 'Two bad options', 'No look-ahead, <em>by construction</em>']
    .forEach((html, i) => UI.headline(el, html, { at: hT[i], out: hT[i + 1] !== undefined ? hT[i + 1] - .35 : undefined }));
  const t15 = W('p1', '2015'), t16 = W('p1', '2016'), tk = W('p1', 'knows'), ti = W('p2', 'invalidates');
  const { X } = UI.timeline(el, { from: 2008, to: 2027.2, y: 820, at: p1 - .35, labelEvery: 2, marks: [{ value: 2026.8, label: 'today' }],
    highlight: [{ value: 2016, t0: t16, t1: p3, color: 'contrast' }] });

  // p1 / p2: a 2015 backtest with a model trained up to 2025
  const G1 = layer(el);
  UI.text(G1, 'LLM training data, up to 2025', { y: 704, size: TYPE.label, color: 'accent', style: 'font-weight:600;', at: p1 - .1 });
  const train = add(G1, `<div class="abs" style="left:170px;top:742px;width:${X(2025) - 170}px;height:14px;border-radius:2px;background:var(--accent);transform-origin:left center"></div>`);
  const leak = add(G1, `<div class="abs" style="left:${X(2015)}px;top:742px;width:${X(2025) - X(2015)}px;height:14px;border-radius:0 2px 2px 0;background:repeating-linear-gradient(-45deg,var(--contrast) 0 4px,var(--contrast-mid) 4px 8px);transform-origin:left center"></div>`);
  UI.text(G1, 'the future, already in the training data', { x: X(2025) - 640, w: 640, align: 'right', y: 704, size: TYPE.label, color: 'contrast', style: 'font-weight:600;', at: tk + .2 });
  UI.marker(G1, { x: X(2015), y0: 300, y1: 820, color: 'ink', dashed: false, grow: 'up', label: 'backtest · 2015', labelAlign: 'center', at: t15 - .05 });
  UI.flow(G1, { nodes: [
    { id: 'news', x: 270, y: 352, w: 460, h: 140, at: W('p1', 'strategy') - .2,
      html: lbl('NEWSWIRE · JUN 2015') + `<div class="serif" style="font-size:${TYPE.value}px;font-weight:500;margin-top:8px">Firm announces merger plan</div><div style="margin-top:12px;height:5px;width:250px;border-radius:3px;background:var(--grid)"></div>` },
    { id: 'llm', kind: 'key', x: 900, y: 362, w: 280, h: 120, at: p1 + 1.2,
      html: `<div class="serif" style="font-size:40px;font-weight:600">LLM</div><div style="font-size:${TYPE.label}px;color:var(--dim);margin-top:4px">trained to 2025</div>` },
    { id: 'fc', kind: 'chip', dot: false, x: 1250, y: 399, at: p1 + 1.85, html: 'Forecast&nbsp;&nbsp;<span class="good">▲</span>' },
  ], edges: [{ from: 'news', to: 'llm', at: p1 + 1.0 }, { from: 'llm', to: 'fc', at: p1 + 1.7 }], sound: false });
  UI.chip(G1, '2016 · how it turned out', { x: 870, y: 600, color: 'contrast', dot: false, at: t16 + .15 });
  const dot = add(G1, `<div class="abs" style="left:${X(2016) - 8}px;top:741px;width:16px;height:16px;border-radius:50%;background:var(--paper);border:3px solid var(--contrast)"></div>`);
  const s1 = svgLayer(G1);
  const stem = sv(s1, 'path', { d: `M${X(2016)},740 C${X(2016)},700 ${X(2016) + 30},680 ${X(2016) + 52},648`, pathLength: 1, stroke: 'var(--contrast)', 'stroke-width': 2, fill: 'none' });
  const dash = sv(s1, 'path', { d: 'M1040,598 C1040,545 1040,525 1040,486', stroke: 'var(--contrast)', 'stroke-width': 2, fill: 'none', 'stroke-dasharray': '6 5' });
  sfx('blip', t16 + .1, { f0: 900, f1: 300, dur: .4, gain: .9, pan: -.2 });
  UI.strike(G1, { x: 1240, y: 422, w: 190, at: ti - .05 });
  UI.stamp(G1, { text: 'INVALID BACKTEST', x: 1248, y: 478, at: ti });

  // p3 / c1: the three options
  UI.lane(el, { X, from: 2008, to: 2025, y: 386, color: 'contrast', label: 'A · Test on past data', at: p3 - .05, dim: [[c1 + .1, .38]],
    text: 'long, but the model has read it&nbsp;&nbsp;→&nbsp;&nbsp;<b class="contrast">lookahead bias</b>' });
  UI.marker(el, { x: X(2025), y0: 350, y1: 820, color: 'bad', label: 'training cutoff', at: W('p3', 'cutoff') });
  UI.lane(el, { X, from: 2025, to: 2026.8, y: 510, color: 'good', label: 'B · Test after the cutoff', labelAlign: 'right', labelX: X(2025) - 20,
    text: 'clean, but only a year or two&nbsp;&nbsp;→&nbsp;&nbsp;<b class="good">too few observations</b>', textSide: 'left', textDelay: .35,
    at: W('p3', 'leaves') - .1, d: .7, dim: [[c1 + .1, .38]] });
  UI.lane(el, { X, from: 2009, to: 2026.8, y: 634, color: 'accent', label: 'C · Point-in-time LLMs (this work)', at: c1 + .1, d: 1.4, textDelay: .8,
    text: 'a model vintage before each year&nbsp;&nbsp;→&nbsp;&nbsp;<b class="accent">long and clean</b>', ticks: { from: 2009, to: 2026 } });
  UI.equation(el, { x: 1130, y: 138, w: 620, at: W('c1', 'reads') - .2, tex: String.raw`\text{news}_t \;\longrightarrow\; \text{model}_{\tau},\quad \tau < t`,
    caption: 'news dated t is read only by a model with cutoff τ &lt; t' });
  section(c1 - .3, '03 — Point-in-time models');

  return t => {
    const g1o = 1 - P(t, p3 - .25, .6, ease.inOutCubic);
    G1.style.opacity = g1o; G1.style.display = g1o <= 0 ? 'none' : 'block';
    train.style.transform = `scaleX(${P(t, p1 - .1, 1.2, ease.inOutCubic)})`;
    leak.style.transform = `scaleX(${P(t, tk - .1, 1.1, ease.inOutCubic)})`;
    A(dot, { o: P(t, t16 - .2, .4), s: .4 + .6 * P(t, t16 - .2, .6, ease.outBack) });
    draw(stem, P(t, t16, .45, ease.inOutCubic));
    const kl = P(t, t16 + .5, 1.0, ease.inOutCubic);
    dash.style.opacity = kl; dash.style.clipPath = `inset(${(1 - kl) * 100}% 0 0 0)`;
  };
}, { label: '02 — Lookahead bias', energy: .45 });

// =====================================================================  4. THE GAP + THE QUESTION
scene('gap', S('c2') - .3, S('m1') - .25, el => {
  const G = layer(el), c2 = S('c2');
  const hb = UI.hbars(G, { at: c2 - .05, title: 'HellaSwag · zero-shot accuracy (%) · before this work', x: 340, y: 300, max: 100, rows: [
    { label: 'ChronoGPT', tag: 'point-in-time', value: 43.9, color: 'neutral' }, { label: 'DatedGPT', tag: 'point-in-time', value: 53.2, color: 'neutral' },
    { label: 'LLaMA-7B', tag: 'no time cutoff', value: 76.0, color: 'contrast' }, { label: 'Gemma-3-4B', tag: 'no time cutoff', value: 76.0, color: 'contrast' }] });
  const tf = W('c2', 'far');
  const gapLine = add(G, `<div class="abs" style="left:${hb.xOf(43.9) + 90}px;top:${hb.rowMid(0)}px;width:${hb.xOf(76) - hb.xOf(43.9) - 90}px;height:0;border-top:2px dashed var(--bad);transform-origin:left"></div>`);
  UI.text(G, '−32 points', { x: hb.xOf(76) + 16, y: hb.rowMid(0) - TYPE.value * .64, size: TYPE.value, cls: 'tab nowrap', color: 'bad', style: 'font-weight:650;', at: tf + .2 });
  UI.kinetic(el, 'c3', { top: 360, lines: [{ n: 4, size: 50 }, { n: 7, size: 140, top: 432 }], emph: [9, 10] });
  return t => {
    gapLine.style.transform = `scaleX(${P(t, tf - .1, .7, ease.inOutCubic)})`;
    const q = P(t, S('c3') - .3, .7, ease.inOutCubic);
    A(G, { o: 1 - q });
  };
}, { energy: .5 });

// =====================================================================  5. TRAINING AT SCALE + LEAKAGE-FREE SFT
scene('method', S('m1') - .45, S('r1') - .25, el => {
  const PA = layer(el), PB = layer(el), m1 = S('m1'), m3 = S('m3');
  UI.progress(PA, { cells: YEARS, chips: YEARS.map(y => 'Dec ’' + String(y).slice(2)), t0: m1 + .5, t1: W('m2', '2024') + .15, y: 560,
    counter: { to: 1.0, decimals: 2, suffix: '&nbsp;T tokens', label: 'Tokens seen · FineWeb · strict crawl-date order', y: 150, at: m1 - .3 } });
  const spec = UI.card(PA, { x: 1210, y: 130, w: 540, pad: '20px 28px 14px', at: m1 + .2, html:
    `<div style="display:flex;align-items:baseline;justify-content:space-between"><span class="serif" style="font-size:48px;line-height:1;font-weight:600">PIT-4B</span><span style="font-size:${TYPE.label}px;color:var(--dim)">decoder-only transformer</span></div>` +
    [['parameters', '4.2B'], ['layers × width', '20 × 4,096'], ['context', '2,048 tokens'], ['training data', '1T tokens, 1 epoch'], ['compute', '≈ 28k GPU-hours']]
      .map(([k, v]) => `<div class="row tab" style="display:flex;justify-content:space-between;font-size:${TYPE.body}px;padding:6px 0;border-top:1px solid var(--grid);margin-top:4px"><span style="color:var(--dim)">${k}</span><span style="font-weight:500">${v}</span></div>`).join('') });
  const rows = $$('.row', spec.el);
  UI.kicker(PA, 'One chronological training run&nbsp;&nbsp;→', { y: 500, at: m1 + .1 });
  UI.kicker(PA, '12 yearly vintages · each sees only its past', { y: 760, color: 'accent', at: W('m2', 'twelve') - .1 });

  UI.headline(PB, 'Leakage-free <em>instruction tuning</em>', { at: m3 - .2 });
  UI.kicker(PB, 'Supervised fine-tuning with LoRA on temporally filtered data', { y: 222, at: m3 });
  UI.filter(PB, { at: m3, y: 340, w: 600, gateX: 1010, keepX: 1100, label: 'Temporal filter', caption: 'LLM classifier: timeless or time-sensitive?', items: [
    { text: '“The 2024 Olympics were held in Paris”', keep: false }, { text: '“Solve: 2x + 3 = 7”', keep: true }, { text: '“Write a REST API using Flask”', keep: true }] });
  const lora = UI.card(PB, { x: 1100, y: 340, w: 600, h: 92, pad: '10px 26px', at: m3 + 1.4, html:
    `<div style="display:flex;align-items:center;justify-content:space-between;height:100%"><span class="fx" style="font-size:${TYPE.lead}px"></span><span style="font-size:${TYPE.label}px;color:var(--dim);text-align:right;line-height:1.35">LoRA: frozen base,<br>low-rank update, r = 16</span></div>` });
  tex($('.fx', lora.el), 'W = W_0 + BA');
  const td = W('m3', 'dropping') - .1;
  UI.counter(PB, { x: 1310, w: 440, align: 'right', y: 96, from: 0, to: 89, decimals: 0, suffix: '%', size: 112, caption: 'of fine-tuning examples kept', at: td, t0: td, t1: td + 1.2 });
  return t => {
    rows.forEach((r, i) => A(r, rise(t, m1 + .45 + i * .2, .7, 8)));
    const pg = P(t, m3 - .4, .7, ease.inOutCubic);
    A(PA, { o: 1 - pg });
    PB.style.opacity = pg; PB.style.display = pg > 0 ? 'block' : 'none';
  };
}, { label: '04 — Training at scale', energy: .8 });

// =====================================================================  6. LANGUAGE BENCHMARKS
scene('nlp', S('r1') - .45, S('e1') - .25, el => {
  const r1 = S('r1'), r2 = S('r2'), r3 = S('r3'), tL = W('r2', 'LLaMA'), t44 = W('r2', '44');
  const A1 = layer(el), A2 = layer(el);
  UI.kinetic(el, 'r1', { x: 170, top: 126, lines: [{ n: 11, size: 64, font: 'serif' }], emph: [10] });
  const pct = v => `&nbsp;&nbsp;<span class="tab" style="font-size:${TYPE.label}px">${v}%</span>`;
  const ch = UI.lineChart(A1, { at: r2 - .8, x: 280, y: 290, w: 1080, h: 520, yMin: 20, yMax: 82, yTicks: [30, 40, 50, 60, 70, 80],
    xTicks: [[0, 'May ’13'], [2, '2013'], [5, '2016'], [8, '2019'], [11, '2022'], [13, '2024']],
    xTitle: 'checkpoint (training cutoff)', yTitle: 'HellaSwag accuracy (%)',
    refs: [
      { value: 77, label: 'Gemma-3-4B' + pct(77), color: 'contrast', dash: '6 6', labelDy: -17, at: r2 - .4, highlight: [tL - .1, r3] },
      { value: 76, label: 'LLaMA-7B' + pct(76), color: 'contrast', dash: '6 6', labelDy: 17, at: r2 - .27, highlight: [tL - .1, r3] },
      { value: 53.2, label: 'DatedGPT' + pct(53.2), color: 'neutral', at: r2 - .14 },
      { value: 44, label: 'ChronoGPT' + pct(44), color: 'neutral', at: r2 - .01, highlight: [t44 - .1, tL - .2] },
      { value: 25, label: 'Random' + pct(25), color: 'faint', dash: '2 5', at: r2 + .12 }],
    series: [
      { name: 'PIT-1.5B', color: 'accentLight', width: 2.8, t0: r2 + .1, t1: r2 + 3.3, values: [27.06, 31.03, 43.42, 51.27, 54.37, 56.03, 58.03, 59.20, 60.46, 62.19, 62.21, 62.85, 63.83, 64.25],
        label: { i: 7, dy: 18, unit: '%', at: r2 + 1.9, html: 'PIT-1.5B <span style="font-weight:400;color:var(--dim)">(ours)</span>&nbsp;&nbsp;{v}' } },
      { name: 'PIT-4B', color: 'accent', width: 3.8, t0: r2 + .3, t1: W('r2', '72%') + .1, values: [29.01, 38.80, 59.15, 66.17, 67.55, 69.21, 69.90, 71.07, 72.37, 72.05, 72.01, 72.19, 72.25, 72.24],
        label: { i: 7, dy: 20, unit: '%', at: r2 + 1.6, html: 'PIT-4B <span style="font-weight:400;color:var(--dim)">(ours)</span>&nbsp;&nbsp;{v}' } }] });
  UI.bracket(ch.el, { x: 1346, y0: ch.Y(72.24), y1: ch.Y(44), label: '+28 pts', labelW: 130, labelY: (ch.Y(53.2) + ch.Y(64.25)) / 2 - 4, at: t44 - .05 });
  UI.bracket(ch.el, { x: 1346, y0: ch.Y(76), y1: ch.Y(72.24), color: 'contrast', label: '≈4 pts', labelW: 130, labelY: ch.Y(77) - 46, at: tL });
  // r3: a second page with the 7-benchmark averages (Table 2), full size rather than a shrunken chart
  UI.hbars(A2, { at: r3 + .1, title: 'Average zero-shot accuracy · 7 benchmarks (Table 2)', x: 340, y: 340, labelW: 330, trackW: 860, max: 80, rowH: 84,
    track: false, stagger: .12, rows: [
      { label: 'ChronoGPT', value: 48.9, color: 'neutral', labelColor: 'neutral' },
      { label: 'PIT-1.5B', value: 53.8, color: 'accentLight', labelColor: 'accent' },
      { label: 'PIT-4B', value: 58.1, color: 'accent', labelColor: 'accent', bold: true },
      { label: 'LLaMA-7B', value: 66.1, color: 'contrast', labelColor: 'contrast' },
      { label: 'Gemma-3-4B', value: 69.2, color: 'contrast', labelColor: 'contrast' }] });
  UI.text(A2, 'Largest remaining gaps: ARC-easy and BoolQ, the knowledge-heavy tasks', { x: 340, y: 790, size: TYPE.label, color: 'dim', at: W('r3', 'knowledge') - .1 });
  return t => {
    const k = P(t, r3 - .55, .5, ease.inOutCubic);
    A1.style.opacity = 1 - k; A2.style.opacity = k; A2.style.display = k > 0 ? 'block' : 'none';
  };
}, { label: '05 — Language benchmarks', energy: .75 });

// =====================================================================  7. ECONOMIC EVALUATION
scene('econ', S('e1') - .45, S('s1') - .25, el => {
  const K = layer(el), G2 = layer(el), G3 = layer(el), e2 = S('e2'), e3 = S('e3');
  UI.kinetic(K, 'e1', { top: 310, lines: [{ n: 4, size: 136 }, { n: 2, size: 136, top: 462 }], emph: [5] });
  UI.headline(el, 'Economic evaluation of <em>embeddings</em>', { at: e2 - .2 });
  // e2: model of Dec t-1 embeds the news of year t
  UI.kicker(G2, 'Model vintage · cutoff Dec t−1', { x: 195, y: 292, at: e2 - .1 });
  UI.pairs(G2, { at: e2, x: 290, dx: 223, topH: 88, yTop: 330, yBot: 514, botH: 112, cols: [...Array(7)].map((_, i) => ({
    top: lbl('PIT-4B', 'accent-text') + `<div class="tab" style="font-size:${TYPE.value}px;margin-top:2px;font-weight:500">Dec ${2013 + i}</div>`,
    bottom: lbl('news of') + `<div class="serif tab" style="font-size:44px;line-height:1.15;font-weight:500">${2014 + i}</div>` })) });
  UI.kicker(G2, 'embeds the news of year t', { x: 195, y: 650, at: e2 + .3 });
  UI.text(G2, 'Dow Jones Newswire · strictly out of sample · 2014 – May 2020', { x: 195, y: 700, size: TYPE.label, color: 'dim', at: e2 + 1.6 });
  UI.chip(G2, '✓&nbsp;&nbsp;No look-ahead, by construction', { x: 195, y: 760, color: 'good', dot: false, at: W('e2', 'leaks') - .1 });
  // e3: embed -> base portfolios -> max-Sharpe combination
  const tE = W('e3', 'embeddings'), tP = W('e3', 'portfolios'), tC = W('e3', 'combined'), tT = W('e3', 'tested');
  UI.steps(G3, { x: 170, y: 262, widths: [440, 500, 460], gap: 90, chevrons: [true, false],
    steps: [{ title: 'Embed', at: tE }, { title: 'Base portfolios', at: tP }, { title: 'Max-Sharpe combination', at: tC }] });
  UI.heatmap(G3, { x: 170, y: 310, cols: 16, rows: 10, at: tE - .3 });
  UI.equation(G3, { x: 170, y: 580, card: false, at: tE + .1, tex: String.raw`E_t \in \mathbb{R}^{N_t \times 4096}` });
  UI.text(G3, "Each firm's news, embedded and averaged by month", { x: 170, y: 640, w: 440, size: TYPE.label, color: 'dim', style: 'line-height:1.35;', at: tE + .3 });
  const wk = UI.walks(G3, { x: 700, y: 431, w: 500, at: tP - .2 });
  UI.equation(G3, { x: 700, y: 580, card: false, at: tP + .1, tex: String.raw`F_{t,i} = E_{t-1,i}^{\top} R_t` });
  UI.text(G3, 'Each of the 4,096 embedding dimensions is a trading signal', { x: 700, y: 640, w: 500, size: TYPE.label, color: 'dim', style: 'line-height:1.35;', at: tP + .3 });
  UI.converge(G3, { fromX: wk.endX, ys: wk.ends, toX: 1380, toY: 450, at: tC - .1 });
  UI.curve(G3, { x: 1380, y: 450, at: tC + .5 });
  UI.text(G3, 'illustrative', { x: 1620, y: 520, size: TYPE.label, color: 'faint', style: 'font-style:italic;', at: tC + 1.2 });
  UI.equation(G3, { x: 1290, y: 580, size: 26, card: false, at: tC + .2, tex: String.raw`\hat{\lambda}=\arg\min_{\lambda}\tfrac{1}{T}\textstyle\sum_{u}\left(1-\lambda^{\top}F_u\right)^2+z\lVert\lambda\rVert^2` });
  UI.text(G3, 'Maximum Sharpe ratio regression; the portfolio is π<sub>t</sub> = E<sub>t</sub> λ̂', { x: 1290, y: 640, w: 460, size: TYPE.label, color: 'dim', style: 'line-height:1.35;', at: tC + .4 });
  UI.chip(G3, 'Out of sample, 2014 – 2020, expanding window', { x: 170, y: 780, color: 'accent', at: tT - .1 });
  return t => {
    const kx = P(t, e2 - .7, .5, ease.inOutCubic);
    A(K, { o: 1 - kx });
    const k3 = P(t, e3 - .35, .7, ease.inOutCubic);
    A(G2, { o: P(t, e2 - .3, .5) * (1 - k3) });
    G3.style.opacity = k3; G3.style.display = k3 > 0 ? 'block' : 'none';
  };
}, { label: '06 — Economic evaluation', energy: .8 });

// =====================================================================  8. SHARPE RATIOS (Fig. 3)
scene('sharpe', S('s1') - .4, S('o1') - .25, el => {
  const s1 = S('s1'), s2 = S('s2'), tP = W('s1', '1.0'), tM = W('s1', 'stock'), tE = W('s1', 'earlier'), tF = W('s2', 'full-sample'), tS = W('s2', 'seen');
  UI.headline(el, 'Out-of-sample <em>Sharpe ratios</em>', { at: s1 - .3 });
  UI.kicker(el, 'Annualized · MSRR portfolios of news embeddings · 2014 – 2020', { y: 222, at: s1 - .1 });
  UI.vbars(el, { at: s1, x: 300, y: 300, w: 900, h: 470, max: 1.8, ticks: [0, .5, 1, 1.5], groupGap: 84, barW: 98,
    bars: [
      { label: 'base', value: .67, color: 'neutralLight', group: 0, at: tE - .15 }, { label: 'instruct', value: .27, color: 'neutral', group: 0, at: tE },
      { label: 'base', value: 1.02, color: 'accentLight', group: 1, at: tP - .15 }, { label: 'fine-tuned', value: 1.53, color: 'accent', bold: true, group: 1, at: tP + .15 },
      { label: 'base', value: .82, color: 'contrastLight', hatch: true, group: 2, at: tF - .15 }, { label: 'fine-tuned', value: 1.18, color: 'contrast', hatch: true, group: 2, at: tF }],
    groups: [{ label: 'ChronoGPT', sub: 'prior point-in-time', color: 'neutral', at: tE }, { label: 'PIT-4B (ours)', sub: 'point-in-time', color: 'accent', at: tP },
             { label: 'Full sample', sub: 'has seen the future', color: 'contrast', at: tF }],
    band: { from: .4, to: .5, label: 'U.S. market 0.4–0.5', at: tM - .15 },
    refs: [{ value: 1.02, from: 2, to: 5, at: tS - .3 }, { value: 1.53, from: 2, to: 5, at: tS - .15 }] });
  UI.card(el, { x: 1450, y: 286, w: 300, at: tM + .4, html: `<div class="kicker"><b>PIT-4B-FT</b></div><div class="tab" style="font-size:72px;font-weight:300;letter-spacing:-.03em;line-height:1.05;margin-top:6px">1.53</div><div style="font-size:${TYPE.label}px;color:var(--dim);margin-top:4px">≈ 3× the stock market</div>` });
  UI.card(el, { x: 1450, y: 474, w: 300, at: s2 + .2, html: `<div class="kicker"><b>Spanning tests</b></div><div style="font-size:${TYPE.body}px;line-height:1.3;margin-top:8px">PIT-4B-FT: <b class="accent">11–14%</b> annual alpha vs. every other model</div>` });
}, { label: '07 — Sharpe ratios', energy: .85 });

// =====================================================================  9. OPEN RELEASE + END CARD
scene('outro', S('o1') - .4, DUR + 1, el => {
  const K = layer(el), G = layer(el), EC = layer(el), o2 = S('o2'), o3 = S('o3');
  UI.kinetic(K, 'o1', { top: 330, lines: [{ n: 2, size: 150 }, { n: 6, size: 54, top: 520 }], emph: [0, 1] });
  UI.headline(G, 'Everything is <em>open</em>', { at: o2 - .05 });
  UI.kicker(G, 'Data pipeline · training code · evaluation code · 36 checkpoints', { y: 222, at: o2 - .05 });
  UI.chipGrid(G, { at: o2, x: 360, y: 300, cellW: 106, rows: ['PIT-1.5B', 'PIT-4B', 'PIT-4B-FT'], cols: YEARS });
  [[360, 680, 'Code', 'github.com/DjoFE2021/Point-In-Time-LLM'], [1070, 680, 'Models &amp; data', 'huggingface.co/Diamegs']].forEach(([x, w, l, u], i) =>
    UI.card(G, { x, y: 590, w, at: W('o2', 'checkpoints') + i * .2, html: `<div class="kicker">${l}</div><div class="mono" style="font-size:${TYPE.body}px;margin-top:10px">${u}</div>` }));
  UI.endCard(EC, { at: o3 - .3, taglineCue: 'o3' });
  return t => {
    const kx = P(t, o2 - .5, .6, ease.inOutCubic);
    A(K, { o: 1 - kx });
    const ke = P(t, o3 - .45, .8, ease.inOutCubic);
    A(G, { o: P(t, o2 - .1, .6, ease.inOutCubic) * (1 - ke) });
    EC.style.opacity = ke; EC.style.display = ke > 0 ? 'block' : 'none';
  };
}, { fo: .01, label: '08 — Open release', energy: .55 });
