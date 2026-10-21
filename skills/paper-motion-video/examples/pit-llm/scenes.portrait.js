// PIT-LLM worked example, portrait 4:5 (1080x1350): the phone cut for LinkedIn / Instagram / X feeds.
// Same narration, cue timings and scene order as scenes.js; every layout is redesigned for a narrow frame:
// one column, stacked panels, fewer labels (a legend instead of per-bar labels), type from TYPE (min 24 px).
// Safe area: x LAY.M..LAY.R (80..1000), y LAY.top..LAY.bottom (112..~1136); subtitles sit below.

const YEARS = [...Array(12)].map((_, i) => 2013 + i);
const M = LAY.M, R = LAY.R, CW = LAY.CW;
const lbl = (txt, c = 'dim') => `<div style="font-size:${TYPE.kicker}px;font-weight:600;letter-spacing:.05em;color:var(--${c})">${txt}</div>`;

// =====================================================================  1. HOOK
scene('hook', -1, E('h2') + .5, el => {
  const L1 = layer(el), L2 = layer(el), h1 = S('h1');
  UI.kicker(L1, '<b>●</b>&nbsp;&nbsp;Text as data in finance &amp; economics', { y: 150, at: h1 - .5 });
  const news = [['NEWSWIRE · 2014-03-12', 'Central bank holds rates, signals patience'], ['NEWSWIRE · 2014-03-12', 'Chipmaker raises full-year guidance'],
                ['NEWSWIRE · 2014-03-13', 'Oil slides as inventories build']];  // generic placeholders, not real headlines
  const nodes = news.map(([d, tt], i) => ({ id: 'n' + i, x: M, y: 220 + i * 176, w: 500, h: 150, at: h1 - .35 + i * .22,
    html: lbl(d) + `<div class="serif" style="font-size:${TYPE.value}px;font-weight:500;margin-top:6px;line-height:1.15">${tt}</div>` }));
  nodes.push({ id: 'llm', kind: 'key', x: 700, y: 360, w: 300, h: 190, at: h1 + .45,
    html: `<div class="serif" style="font-size:60px;font-weight:600">LLM</div><div style="font-size:${TYPE.label}px;color:var(--dim);margin-top:4px">text → signal</div>` });
  const chips = [['Sentiment', M, 790], ['Return forecasts', 420, 790], ['Risk premia', M, 880], ['In-silico policy experiments', 330, 880]];
  chips.forEach(([c, x, y], i) => nodes.push({ id: 'o' + i, kind: 'chip', x, y, html: c, at: W('h1', 'finance') + i * .2 }));
  UI.flow(L1, { nodes, edges: [
    ...[0, 1, 2].map(i => ({ from: 'n' + i, to: 'llm', at: h1 + .6 + i * .12 })),
    ...chips.map(([, x, y], i) => ({ path: `M850,556 L850,${y - 64} C850,${y - 30} ${x + 90},${y - 50} ${x + 90},${y - 8}`, at: W('h1', 'finance') - .35 + i * .1 })),
  ] });
  // "But a model trained on today's internet / has already read / the future."
  UI.kinetic(L2, 'h2', { top: 400, lines: [{ n: 7, size: 38 }, { n: 3, size: 112, top: 470 }, { n: 2, size: 112, top: 600 }], emph: [10, 11], emphClass: 'emC fut' });
  UI.underline(L2, $$('.fut', L2), W('h2', 'future') - .05, { color: 'contrast', d: .4 });
  return t => {
    const sw = P(t, S('h2') - .55, .5, ease.inOutCubic);
    A(L1, { o: 1 - sw });
    L2.style.opacity = sw;
  };
}, { fi: .01, label: '01 — Context', energy: .35 });

// =====================================================================  2. TITLE
scene('title', E('h2') + .25, S('p1') - .15, el => {
  UI.titleCard(el, { at: E('h2') + .25 });
}, { fi: .35, fo: .5, label: '', energy: .5 });

// =====================================================================  3. LOOKAHEAD BIAS -> lanes A / B / C
scene('problem', S('p1') - .45, S('c2') - .15, el => {
  const p1 = S('p1'), p3 = S('p3'), c1 = S('c1');
  UI.kicker(el, 'Backtesting with language models', { at: p1 - .3 });
  const hT = [p1 - .2, W('p2', 'lookahead') - .1, p3 - .1, c1 - .1];
  ['What does it <em>already know?</em>', '<span class="emC">Lookahead bias</span>', 'Two bad options', 'No look-ahead, <em>by construction</em>']
    .forEach((html, i) => UI.headline(el, html, { at: hT[i], out: hT[i + 1] !== undefined ? hT[i + 1] - .35 : undefined }));
  const t16 = W('p1', '2016'), tk = W('p1', 'knows'), ti = W('p2', 'invalidates');
  const { X } = UI.timeline(el, { from: 2011, to: 2027.2, y: 1010, at: p1 - .35, labelEvery: 4, marks: [{ value: 2026.8, label: 'today' }],
    highlight: [{ value: 2015, t0: W('p1', '2015'), t1: p3, color: 'ink' }] });

  // p1 / p2: news -> model trained to 2025 -> forecast, and the 2016 outcome leaking back
  const G1 = layer(el);
  UI.flow(G1, { nodes: [
    { id: 'news', x: M, y: 300, w: 600, h: 140, at: W('p1', 'strategy') - .2,
      html: lbl('NEWSWIRE · JUN 2015') + `<div class="serif" style="font-size:${TYPE.value}px;font-weight:500;margin-top:8px">Firm announces merger plan</div>` },
    { id: 'llm', kind: 'key', x: M, y: 530, w: 330, h: 140, at: p1 + 1.2,
      html: `<div class="serif" style="font-size:46px;font-weight:600">LLM</div><div style="font-size:${TYPE.label}px;color:var(--dim);margin-top:2px">trained to 2025</div>` },
    { id: 'fc', kind: 'chip', dot: false, x: 530, y: 572, at: p1 + 1.85, html: 'Forecast&nbsp;&nbsp;<span class="good">▲</span>' },
  ], edges: [{ path: `M245,446 L245,522`, at: p1 + 1.0 }, { from: 'llm', to: 'fc', at: p1 + 1.7 }], sound: false });
  UI.strike(G1, { x: 524, y: 599, w: 214, at: ti - .05 });
  UI.stamp(G1, { text: 'INVALID BACKTEST', x: 530, y: 660, at: ti });
  UI.chip(G1, '2016 · how it turned out', { x: 520, y: 770, color: 'contrast', dot: false, at: t16 + .15 });
  // training data to 2025, with the part after the 2015 backtest date hatched: the future, already seen
  const train = add(G1, `<div class="abs" style="left:${X(2011)}px;top:900px;width:${X(2025) - X(2011)}px;height:16px;border-radius:2px;background:var(--accent);transform-origin:left center"></div>`);
  const leak = add(G1, `<div class="abs" style="left:${X(2015)}px;top:900px;width:${X(2025) - X(2015)}px;height:16px;border-radius:0 2px 2px 0;background:repeating-linear-gradient(-45deg,var(--contrast) 0 4px,var(--contrast-mid) 4px 8px);transform-origin:left center"></div>`);
  UI.text(G1, 'training data', { x: M, y: 860, size: TYPE.label, color: 'accent', style: 'font-weight:600;', at: p1 - .1 });
  UI.text(G1, 'the future, already seen', { x: X(2025) - 420, w: 420, align: 'right', y: 932, size: TYPE.label, color: 'contrast', style: 'font-weight:600;', at: tk + .2 });
  UI.marker(G1, { x: X(2015), y0: 880, y1: 1010, color: 'ink', dashed: false, grow: 'up', at: W('p1', '2015') - .05 });
  const dot = add(G1, `<div class="abs" style="left:${X(2016) - 9}px;top:899px;width:18px;height:18px;border-radius:50%;background:var(--paper);border:3px solid var(--contrast)"></div>`);
  const s1 = svgLayer(G1);
  const stem = sv(s1, 'path', { d: `M${X(2016)},898 C${X(2016)},850 480,824 520,800`, pathLength: 1, stroke: 'var(--contrast)', 'stroke-width': 2.2, fill: 'none' });
  const dash = sv(s1, 'path', { d: 'M530,780 C470,760 420,720 380,676', stroke: 'var(--contrast)', 'stroke-width': 2.2, fill: 'none', 'stroke-dasharray': '6 5' });
  sfx('blip', t16 + .1, { f0: 900, f1: 300, dur: .4, gain: .9, pan: -.2 });

  // p3 / c1: the three options, stacked
  UI.lane(el, { X, from: 2011, to: 2025, y: 400, color: 'contrast', label: 'A · Test on past data', at: p3 - .05, dim: [[c1 + .1, .38]],
    text: 'the model has read it&nbsp;&nbsp;→&nbsp;&nbsp;<b class="contrast">lookahead bias</b>' });
  UI.marker(el, { x: X(2025), y0: 380, y1: 790, color: 'bad', label: 'training cutoff', at: W('p3', 'cutoff') });
  UI.lane(el, { X, from: 2025, to: 2026.8, y: 540, color: 'good', label: 'B · Test after the cutoff', labelAlign: 'right', labelX: X(2025) - 16,
    text: 'clean but short&nbsp;&nbsp;→&nbsp;&nbsp;<b class="good">too few years</b>', textSide: 'left', textDelay: .35,
    at: W('p3', 'leaves') - .1, d: .7, dim: [[c1 + .1, .38]] });
  UI.lane(el, { X, from: 2012, to: 2026.8, y: 680, color: 'accent', label: 'C · Point-in-time LLMs (this work)', at: c1 + .1, d: 1.4, textDelay: .8,
    text: 'one model per year&nbsp;&nbsp;→&nbsp;&nbsp;<b class="accent">long and clean</b>', ticks: { from: 2012, to: 2026 } });
  UI.equation(el, { x: M, y: 796, w: CW, at: W('c1', 'reads') - .2, tex: String.raw`\text{news}_t \;\longrightarrow\; \text{model}_{\tau},\quad \tau < t`,
    caption: 'news dated t is read only by models with cutoff τ &lt; t' });
  section(c1 - .3, '03 — Point-in-time');

  return t => {
    const g1o = 1 - P(t, p3 - .25, .6, ease.inOutCubic);
    G1.style.opacity = g1o; G1.style.display = g1o <= 0 ? 'none' : 'block';
    train.style.transform = `scaleX(${P(t, p1 - .1, 1.2, ease.inOutCubic)})`;
    leak.style.transform = `scaleX(${P(t, tk - .1, 1.1, ease.inOutCubic)})`;
    A(dot, { o: P(t, t16 - .2, .4), s: .4 + .6 * P(t, t16 - .2, .6, ease.outBack) });
    draw(stem, P(t, t16, .45, ease.inOutCubic));
    const kl = P(t, t16 + .5, 1.0, ease.inOutCubic);
    dash.style.opacity = kl; dash.style.clipPath = `inset(0 0 ${(1 - kl) * 100}% 0)`;
  };
}, { label: '02 — Lookahead bias', energy: .45 });

// =====================================================================  4. THE GAP + THE QUESTION
scene('gap', S('c2') - .3, S('m1') - .25, el => {
  const G = layer(el), c2 = S('c2');
  const hb = UI.hbars(G, { at: c2 - .05, title: 'HellaSwag accuracy (%), before this work', y: 360, max: 100, rows: [
    { label: 'ChronoGPT', tag: 'point-in-time', value: 43.9, color: 'neutral' }, { label: 'DatedGPT', tag: 'point-in-time', value: 53.2, color: 'neutral' },
    { label: 'LLaMA-7B', tag: 'no time cutoff', value: 76.0, color: 'contrast' }, { label: 'Gemma-3-4B', tag: 'no time cutoff', value: 76.0, color: 'contrast' }] });
  const tf = W('c2', 'far');
  const gapLine = add(G, `<div class="abs" style="left:${hb.xOf(43.9) + 90}px;top:${hb.rowMid(0)}px;width:${hb.xOf(76) - hb.xOf(43.9) - 90}px;height:0;border-top:2px dashed var(--bad);transform-origin:left"></div>`);
  UI.text(G, '−32 points', { x: hb.xOf(76) + 14, y: hb.rowMid(0) - TYPE.value * .64, size: TYPE.value, cls: 'tab nowrap', color: 'bad', style: 'font-weight:650;', at: tf + .2 });
  UI.kinetic(el, 'c3', { top: 400, lines: [{ n: 4, size: 44 }, { n: 3, size: 116, top: 470 }, { n: 4, size: 116, top: 604 }], emph: [9, 10] });
  return t => {
    gapLine.style.transform = `scaleX(${P(t, tf - .1, .7, ease.inOutCubic)})`;
    A(G, { o: 1 - P(t, S('c3') - .7, .45, ease.inOutCubic) });   // gone before the question's first word
  };
}, { energy: .5 });

// =====================================================================  5. TRAINING AT SCALE + LEAKAGE-FREE SFT
scene('method', S('m1') - .45, S('r1') - .25, el => {
  const PA = layer(el), PB = layer(el), m1 = S('m1'), m3 = S('m3');
  UI.progress(PA, { cells: YEARS.map(y => '’' + String(y).slice(2)), chips: YEARS.map(() => '✓'), t0: m1 + .5, t1: W('m2', '2024') + .15, y: 800,
    counter: { to: 1.0, decimals: 2, suffix: '&nbsp;T tokens', label: 'Tokens seen, in crawl-date order', y: 140, at: m1 - .3 } });
  const spec = UI.card(PA, { x: M, y: 360, w: CW, pad: '20px 28px 12px', at: m1 + .2, html:
    `<div style="display:flex;align-items:baseline;justify-content:space-between"><span class="serif" style="font-size:52px;line-height:1;font-weight:600">PIT-4B</span><span style="font-size:${TYPE.label}px;color:var(--dim)">decoder-only transformer</span></div>` +
    [['parameters', '4.2B'], ['layers × width', '20 × 4,096'], ['context', '2,048 tokens'], ['training data', '1T tokens, 1 epoch'], ['compute', '≈ 28k GPU-hours']]
      .map(([k, v]) => `<div class="row tab" style="display:flex;justify-content:space-between;font-size:${TYPE.body}px;padding:6px 0;border-top:1px solid var(--grid);margin-top:4px"><span style="color:var(--dim)">${k}</span><span style="font-weight:500">${v}</span></div>`).join('') });
  const rows = $$('.row', spec.el);
  UI.kicker(PA, 'One chronological training run&nbsp;&nbsp;→', { y: 748, at: m1 + .1 });
  UI.kicker(PA, '12 yearly vintages, each sees only its past', { y: 1000, color: 'accent', at: W('m2', 'twelve') - .1 });

  UI.kicker(PB, 'LLM classifier · timeless or time-sensitive?', { at: m3 });
  UI.headline(PB, 'Leakage-free <em>instruction tuning</em>', { at: m3 - .2 });
  UI.filter(PB, { at: m3, y: 380, size: TYPE.label, label: 'Temporal filter', items: [
    { text: '“The 2024 Olympics were held in Paris”', keep: false }, { text: '“Solve: 2x + 3 = 7”', keep: true }, { text: '“Write a REST API using Flask”', keep: true }] });
  const td = W('m3', 'dropping') - .1;
  UI.counter(PB, { x: M, y: 890, from: 0, to: 89, decimals: 0, suffix: '%', size: 120, caption: 'of examples kept', at: td, t0: td, t1: td + 1.2 });
  const lora = UI.card(PB, { x: 470, y: 900, w: 530, h: 150, pad: '16px 26px', at: m3 + 1.4, html:
    `<div class="fx" style="font-size:${TYPE.lead}px"></div><div style="font-size:${TYPE.label}px;color:var(--dim);line-height:1.3;margin-top:8px">LoRA: frozen base, low-rank update</div>` });
  tex($('.fx', lora.el), 'W = W_0 + BA,\\; r = 16');
  return t => {
    rows.forEach((r, i) => A(r, rise(t, m1 + .45 + i * .2, .7, 8)));
    const pg = P(t, m3 - .4, .7, ease.inOutCubic);
    A(PA, { o: 1 - pg });
    PB.style.opacity = pg; PB.style.display = pg > 0 ? 'block' : 'none';
  };
}, { label: '04 — Training at scale', energy: .8 });

// =====================================================================  6. LANGUAGE BENCHMARKS
scene('nlp', S('r1') - .45, S('e1') - .25, el => {
  const r2 = S('r2'), r3 = S('r3'), tL = W('r2', 'LLaMA'), t44 = W('r2', '44');
  const A1 = layer(el), A2 = layer(el);
  UI.kinetic(el, 'r1', { x: M, top: 136, lines: [{ n: 5, size: 66, font: 'serif' }, { n: 6, size: 66, font: 'serif', top: 216 }], emph: [10] });
  const pct = v => `&nbsp;<span class="tab">${v}%</span>`;
  const ch = UI.lineChart(A1, { at: r2 - .8, x: 170, y: 400, w: 560, h: 520, yMin: 20, yMax: 82, yTicks: [30, 50, 70],
    xTicks: [[0, '’13'], [4, '’15'], [8, '’19'], [13, '’24']], xTitle: 'training cutoff',
    refs: [
      { value: 77, label: 'Gemma-3-4B' + pct(77), color: 'contrast', dash: '6 6', labelDy: -21, at: r2 - .4, highlight: [tL - .1, r3] },
      { value: 76, label: 'LLaMA-7B' + pct(76), color: 'contrast', dash: '6 6', labelDy: 21, at: r2 - .27, highlight: [tL - .1, r3] },
      { value: 53.2, label: 'DatedGPT' + pct(53.2), color: 'neutral', at: r2 - .14 },
      { value: 44, label: 'ChronoGPT' + pct(44), color: 'neutral', at: r2 - .01, highlight: [t44 - .1, tL - .2] },
      { value: 25, label: 'Random' + pct(25), color: 'faint', dash: '2 5', at: r2 + .12 }],
    series: [
      { name: 'PIT-1.5B', color: 'accentLight', width: 3, t0: r2 + .1, t1: r2 + 3.3, values: [27.06, 31.03, 43.42, 51.27, 54.37, 56.03, 58.03, 59.20, 60.46, 62.19, 62.21, 62.85, 63.83, 64.25],
        label: { i: 3, dy: 24, unit: '%', at: r2 + 1.9, html: 'PIT-1.5B&nbsp;&nbsp;{v}' } },
      { name: 'PIT-4B', color: 'accent', width: 4, t0: r2 + .3, t1: W('r2', '72%') + .1, values: [29.01, 38.80, 59.15, 66.17, 67.55, 69.21, 69.90, 71.07, 72.37, 72.05, 72.01, 72.19, 72.25, 72.24],
        label: { i: 5, dy: 22, unit: '%', at: r2 + 1.6, html: 'PIT-4B (ours)&nbsp;&nbsp;{v}' } }] });
  UI.text(A1, 'HellaSwag accuracy (%)', { x: M, y: 338, size: TYPE.label, color: 'dim', at: r2 - .7 });
  UI.bracket(ch.el, { x: 706, y0: ch.Y(72.24), y1: ch.Y(44), label: '+28 pts', labelW: 140, labelY: ch.Y(56) - 4, at: t44 - .05 });
  UI.bracket(ch.el, { x: 706, y0: ch.Y(76), y1: ch.Y(72.24), color: 'contrast', label: '≈4 pts', labelW: 140, labelY: ch.Y(77) - 50, at: tL });
  // r3: second page, 7-benchmark averages (Table 2)
  UI.hbars(A2, { at: r3 + .1, title: 'Average zero-shot accuracy, 7 benchmarks', y: 440, max: 80, labelW: 270, trackW: 530, rowH: 100, track: false, stagger: .12, rows: [
      { label: 'ChronoGPT', value: 48.9, color: 'neutral', labelColor: 'neutral' },
      { label: 'PIT-1.5B', value: 53.8, color: 'accentLight', labelColor: 'accent' },
      { label: 'PIT-4B', value: 58.1, color: 'accent', labelColor: 'accent', bold: true },
      { label: 'LLaMA-7B', value: 66.1, color: 'contrast', labelColor: 'contrast' },
      { label: 'Gemma-3-4B', value: 69.2, color: 'contrast', labelColor: 'contrast' }] });
  UI.text(A2, 'Largest remaining gaps: ARC-easy and BoolQ, the knowledge-heavy tasks', { x: M, y: 970, w: CW, size: TYPE.label, color: 'dim', style: 'line-height:1.35;', at: W('r3', 'knowledge') - .1 });
  return t => {
    const k = P(t, r3 - .55, .5, ease.inOutCubic);
    A1.style.opacity = 1 - k; A2.style.opacity = k; A2.style.display = k > 0 ? 'block' : 'none';
  };
}, { label: '05 — Benchmarks', energy: .75 });

// =====================================================================  7. ECONOMIC EVALUATION
scene('econ', S('e1') - .45, S('s1') - .25, el => {
  const K = layer(el), G2 = layer(el), G3 = layer(el), e2 = S('e2'), e3 = S('e3');
  UI.kinetic(K, 'e1', { top: 380, lines: [{ n: 3, size: 116 }, { n: 1, size: 116, top: 512 }, { n: 2, size: 116, top: 644 }], emph: [5] });
  UI.headline(el, 'Economic evaluation of <em>embeddings</em>', { at: e2 - .2 });
  // e2: the model of Dec t-1 embeds the news of year t (one row per year)
  UI.kicker(G2, 'Model · cutoff Dec t−1', { y: 330, at: e2 - .1 });
  UI.kicker(G2, 'embeds the news of year t', { x: 580, y: 330, at: e2 + .1 });
  const row = (txt, big) => `<div style="display:flex;align-items:center;height:68px;gap:12px;white-space:nowrap">${txt}${big}</div>`;
  const nodes = [], edges = [];
  for (let i = 0; i < 7; i++) {
    const y = 372 + i * 78, at = e2 + i * .2;
    nodes.push({ id: 'm' + i, x: M, y, w: 400, h: 68, pad: '0 22px', at,
      html: row(`<span style="font-size:${TYPE.label}px;font-weight:600;color:var(--accent-text)">PIT-4B</span>`, `<span class="tab" style="font-size:${TYPE.value}px;font-weight:500">Dec ${2013 + i}</span>`) });
    nodes.push({ id: 'y' + i, x: 580, y, w: 420, h: 68, pad: '0 22px', at: at + .25,
      html: row(`<span style="font-size:${TYPE.label}px;color:var(--dim)">news of</span>`, `<span class="serif tab" style="font-size:40px;font-weight:500">${2014 + i}</span>`) });
    edges.push({ from: 'm' + i, to: 'y' + i, at: at + .45, color: 'accent' });
  }
  UI.flow(G2, { nodes, edges, sound: false });
  UI.text(G2, 'Dow Jones Newswire, 2014 – May 2020, strictly out of sample', { y: 932, w: CW, size: TYPE.label, color: 'dim', at: e2 + 1.6 });
  UI.chip(G2, '✓&nbsp;&nbsp;No look-ahead, by construction', { y: 1000, color: 'good', dot: false, at: W('e2', 'leaks') - .1 });
  // e3: embed -> base portfolios -> max-Sharpe combination, stacked
  const tE = W('e3', 'embeddings'), tP = W('e3', 'portfolios'), tC = W('e3', 'combined'), tT = W('e3', 'tested');
  const step = (n, title, x, y, at) => UI.text(G3, `<span class="accent">${n}</span>&nbsp;&nbsp;${title}`, { x, y, size: TYPE.body, style: 'font-weight:600;', cls: 'nowrap', at: at - .3 });
  step(1, 'Embed', M, 330, tE);
  UI.heatmap(G3, { x: M, y: 384, cols: 12, rows: 6, at: tE - .3 });
  UI.equation(G3, { x: 450, y: 384, card: false, at: tE + .1, tex: String.raw`E_t \in \mathbb{R}^{N_t \times 4096}` });
  UI.text(G3, "each firm's news, embedded and averaged by month", { x: 450, y: 440, w: 550, size: TYPE.label, color: 'dim', style: 'line-height:1.3;', at: tE + .3 });
  step(2, 'Base portfolios', M, 590, tP);
  step(3, 'Max-Sharpe mix', 620, 590, tC);
  const wk = UI.walks(G3, { x: M, y: 720, w: 400, n: 26, at: tP - .2 });
  UI.converge(G3, { fromX: wk.endX, ys: wk.ends, toX: 600, toY: 720, at: tC - .1 });
  UI.curve(G3, { x: 600, y: 720, w: 400, steps: 40, drift: -2.6, at: tC + .5 });
  UI.text(G3, 'illustrative', { x: 860, y: 760, size: TYPE.label, color: 'faint', style: 'font-style:italic;', at: tC + 1.2 });
  UI.equation(G3, { x: M, y: 820, card: false, at: tP + .1, tex: String.raw`F_{t,i} = E_{t-1,i}^{\top} R_t` });
  UI.text(G3, 'one portfolio per embedding dimension', { x: 420, y: 826, size: TYPE.label, color: 'dim', cls: 'nowrap', at: tP + .3 });
  UI.equation(G3, { x: M, y: 900, card: false, size: 30, at: tC + .2, tex: String.raw`\hat{\lambda}=\arg\min_{\lambda}\tfrac{1}{T}\textstyle\sum_{u}\left(1-\lambda^{\top}F_u\right)^2+z\lVert\lambda\rVert^2` });
  UI.chip(G3, 'Out of sample, 2014 – 2020', { y: 1000, color: 'accent', at: tT - .1 });
  return t => {
    A(K, { o: 1 - P(t, e2 - .7, .5, ease.inOutCubic) });
    const k3 = P(t, e3 - .35, .7, ease.inOutCubic);
    A(G2, { o: P(t, e2 - .3, .5) * (1 - k3) });
    G3.style.opacity = k3; G3.style.display = k3 > 0 ? 'block' : 'none';
  };
}, { label: '06 — Economic test', energy: .8 });

// =====================================================================  8. SHARPE RATIOS (Fig. 3)
scene('sharpe', S('s1') - .4, S('o1') - .25, el => {
  const s1 = S('s1'), s2 = S('s2'), tP = W('s1', '1.0'), tM = W('s1', 'stock'), tE = W('s1', 'earlier'), tF = W('s2', 'full-sample'), tS = W('s2', 'seen');
  UI.kicker(el, 'Annualized · 2014 – 2020', { at: s1 - .1 });
  UI.headline(el, 'Out-of-sample <em>Sharpe ratios</em>', { at: s1 - .3 });
  // no per-bar labels on a phone: lighter bar = base model, darker = instruction-tuned (legend below)
  UI.vbars(el, { at: s1, x: 170, y: 290, w: 830, h: 420, max: 1.8, ticks: [0, .5, 1, 1.5], barW: 112, inner: 12, groupGap: 40,
    bars: [
      { value: .67, color: 'neutralLight', group: 0, at: tE - .15 }, { value: .27, color: 'neutral', group: 0, at: tE },
      { value: 1.02, color: 'accentLight', group: 1, at: tP - .15 }, { value: 1.53, color: 'accent', bold: true, group: 1, at: tP + .15 },
      { value: .82, color: 'contrastLight', hatch: true, group: 2, at: tF - .15 }, { value: 1.18, color: 'contrast', hatch: true, group: 2, at: tF }],
    groups: [{ label: 'ChronoGPT', sub: 'prior work', color: 'neutral', at: tE }, { label: 'PIT-4B (ours)', sub: 'point-in-time', color: 'accent', at: tP },
             { label: 'Full sample', sub: 'saw the future', color: 'contrast', at: tF }],
    band: { from: .4, to: .5, label: '', at: tM - .15 },
    refs: [{ value: 1.02, from: 2, to: 5, at: tS - .3 }, { value: 1.53, from: 2, to: 5, at: tS - .15 }] });
  UI.text(el, 'light: base model · dark: instruction-tuned · gray band: U.S. stock market, 0.4–0.5', { y: 868, w: CW, size: TYPE.label, color: 'dim', style: 'line-height:1.3;', at: tM + .2 });
  UI.card(el, { x: M, y: 960, w: 420, h: 150, pad: '14px 24px', at: tM + .4, html: `<div class="kicker"><b>PIT-4B-FT</b></div><div style="display:flex;align-items:baseline;gap:14px"><span class="tab" style="font-size:64px;font-weight:300;letter-spacing:-.03em;line-height:1.1">1.53</span><span style="font-size:${TYPE.label}px;color:var(--dim)">≈ 3× market</span></div>` });
  UI.card(el, { x: 520, y: 960, w: 480, h: 150, pad: '14px 24px', at: s2 + .2, html: `<div class="kicker"><b>Spanning tests</b></div><div style="font-size:${TYPE.label}px;line-height:1.3;margin-top:8px"><b class="accent">11–14%</b> annual alpha over every other model</div>` });
}, { label: '07 — Sharpe ratios', energy: .85 });

// =====================================================================  9. OPEN RELEASE + END CARD
scene('outro', S('o1') - .4, DUR + 1, el => {
  const K = layer(el), G = layer(el), EC = layer(el), o2 = S('o2'), o3 = S('o3');
  UI.kinetic(K, 'o1', { top: 440, lines: [{ n: 2, size: 116 }, { n: 6, size: 42, top: 600 }], emph: [0, 1] });
  UI.kicker(G, 'Pipeline · code · 36 checkpoints', { at: o2 - .05 });
  UI.headline(G, 'Everything is <em>open</em>', { at: o2 - .05 });
  UI.chipGrid(G, { at: o2, x: 300, y: 340, cellW: 54, gapX: 4, gapY: 22, size: TYPE.kicker, rows: ['PIT-1.5B', 'PIT-4B', 'PIT-4B-FT'], cols: YEARS.map(y => '’' + String(y).slice(2)) });
  [['Code', 'github.com/DjoFE2021/Point-In-Time-LLM'], ['Models &amp; data', 'huggingface.co/Diamegs']].forEach(([l, u], i) =>
    UI.card(G, { x: M, y: 640 + i * 150, w: CW, at: W('o2', 'checkpoints') + i * .2, html: `<div class="kicker">${l}</div><div class="mono" style="font-size:${TYPE.body}px;margin-top:10px">${u}</div>` }));
  UI.endCard(EC, { at: o3 - .3, taglineCue: 'o3' });
  return t => {
    A(K, { o: 1 - P(t, o2 - .5, .6, ease.inOutCubic) });
    const ke = P(t, o3 - .45, .8, ease.inOutCubic);
    A(G, { o: P(t, o2 - .1, .6, ease.inOutCubic) * (1 - ke) });
    EC.style.opacity = ke; EC.style.display = ke > 0 ? 'block' : 'none';
  };
}, { fo: .01, label: '08 — Open', energy: .55 });
