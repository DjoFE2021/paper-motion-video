// paper-motion-video engine.
// Everything on screen is a pure function of time t (seconds): render(t) can draw any frame in any order,
// which is what lets the renderer split the video across parallel headless-Chrome workers.
//
// Globals for scenes.js: TL, CONFIG, DUR, FORMAT, LAY, TYPE, S, E, W, scene, section, nosub, sfx,
// math (clamp, lerp, ease, P, win, rng), DOM (h, add, A, rise, out, draw, tex, words, speak, layer, svgLayer, sv, $, $$)
// and the UI component library (components.js).

const CONFIG = window.CONFIG || {};
// per-format overrides, e.g. "portrait": {"titleHtml": "…", "affiliations": […]} in config.json
if (window.FORMAT && CONFIG[window.FORMAT.name] && typeof CONFIG[window.FORMAT.name] === 'object') Object.assign(CONFIG, CONFIG[window.FORMAT.name]);
const TL = window.TL;
const DUR = TL.duration;
// ---------------------------------------------------------------- stage, layout, type scale
// FORMAT is injected by the renderer: landscape 1920x1080 (16:9), portrait 1080x1350 (4:5),
// vertical 1080x1920 (9:16), square 1080x1080. Sizes below are chosen so text stays readable on a phone.
const FORMAT = window.FORMAT || { name: 'landscape', w: 1920, h: 1080 };
const PORTRAIT = FORMAT.w < 1400;   // all phone-first formats are 1080 px wide
const LAY = (() => {
  const W = FORMAT.w, H = FORMAT.h, M = PORTRAIT ? 80 : 170;
  const subSize = PORTRAIT ? 44 : 40, subBottom = PORTRAIT ? 64 : 72, subLines = PORTRAIT ? 2 : 1;
  const subTop = H - subBottom - Math.round(subLines * subSize * 1.3) - 6;   // top of the subtitle band
  return { W, H, M, R: W - M, CW: W - 2 * M, CX: W / 2, portrait: PORTRAIT, top: PORTRAIT ? 112 : 104,
           subSize, subBottom, subTop, bottom: subTop - 30 };   // keep content above LAY.bottom
})();
const TYPE = PORTRAIT
  ? { kicker: 24, label: 28, label2: 30, body: 32, value: 34, lead: 36, tagline: 42, headline: 68, statement: 96, min: 24 }
  : { kicker: 20, label: 22, label2: 24, body: 26, value: 28, lead: 32, tagline: 40, headline: 64, statement: 120, min: 20 };
(function stageVars() {
  const r = document.documentElement.style;
  r.setProperty('--W', LAY.W + 'px'); r.setProperty('--H', LAY.H + 'px');
  r.setProperty('--sub-size', LAY.subSize + 'px'); r.setProperty('--sub-bottom', LAY.subBottom + 'px');
  r.setProperty('--sub-max', (PORTRAIT ? LAY.CW + 40 : 1600) + 'px'); r.setProperty('--kicker', TYPE.kicker + 'px');
  document.documentElement.dataset.format = FORMAT.name;
})();
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// ---------------------------------------------------------------- math
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = {
  lin: k => k,
  outCubic: k => 1 - Math.pow(1 - k, 3),
  outQuart: k => 1 - Math.pow(1 - k, 4),
  inCubic: k => k * k * k,
  inOutCubic: k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2,
  inOutSine: k => -(Math.cos(Math.PI * k) - 1) / 2,
  outExpo: k => k >= 1 ? 1 : 1 - Math.pow(2, -10 * k),
  inOutExpo: k => k <= 0 ? 0 : k >= 1 ? 1 : k < .5 ? Math.pow(2, 20 * k - 10) / 2 : (2 - Math.pow(2, -20 * k + 10)) / 2,
  outBack: k => { const c1 = 1.2, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); },
};
// progress of an animation that starts at t0 and lasts d seconds, eased (0..1)
const P = (t, t0, d, e = ease.outCubic) => e(clamp((t - t0) / Math.max(d, 1e-6)));
// visibility window: fades in at a, fades out to b
const win = (t, a, b, fi = .5, fo = .5) => Math.min(P(t, a, fi, ease.inOutCubic), 1 - P(t, b - fo, fo, ease.inOutCubic));
// deterministic PRNG (never use Math.random: frames are rendered out of order)
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------------------------------------------------------------- narration timeline
// S(id) start of cue, E(id) end of cue, W(id, 'word', n) onset of the n-th word containing 'word'
const S = id => cue(id).start;
const E = id => cue(id).end;
function cue(id) {
  const c = TL.cues[id];
  if (!c) { console.error(`unknown cue "${id}"`); return { start: 0, end: 0, words: [] }; }
  return c;
}
// Matching ignores case and punctuation and prefers, in order: an exact word, a word starting with q, a word containing q.
// So W('c', 'to') finds the word "to", not "into"; use n for the n-th occurrence.
function W(id, q, n = 0) {
  const nz = x => String(x).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ''), qq = nz(q), ws = cue(id).words;
  for (const test of [w => w === qq, w => w.startsWith(qq), w => w.includes(qq)]) {
    const hits = ws.filter(w => test(nz(w.d)) || test(nz(w.s)));
    if (hits.length > n) return hits[n].t0;
  }
  console.error(`W miss: cue "${id}" has no word "${q}"${n ? ` (occurrence ${n})` : ''}`); return cue(id).start;
}

// ---------------------------------------------------------------- DOM helpers
function h(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; }
const add = (parent, html) => { const e = h(html); parent.appendChild(e); return e; };
// set opacity / transform / blur in one call
function A(el, { o = 1, x = 0, y = 0, s = 1, sx, sy, r = 0, b = 0 } = {}) {
  if (!el) return;
  el.style.opacity = o;
  const scale = (sx !== undefined || sy !== undefined) ? `scale(${sx ?? 1},${sy ?? 1})` : `scale(${s})`;
  el.style.transform = `translate(${x}px,${y}px) ${scale} rotate(${r}deg)`;
  el.style.filter = b > 0.05 ? `blur(${b}px)` : 'none';
}
// standard entrance (fade + short rise) and exit. Combine: A(el, out(rise(t, t0), t, t1))
function rise(t, t0, d = .8, dist = 14) { const k = P(t, t0, d); return { o: k, y: (1 - k) * dist }; }
function out(st, t, t1, d = .45) { if (t1 === undefined || t1 === null) return st; const k = P(t, t1, d, ease.inOutCubic); return { ...st, o: st.o * (1 - k) }; }   // exits fade in place
// SVG path draw-on (path needs pathLength="1")
function draw(el, k) { el.style.strokeDasharray = '1 1'; el.style.strokeDashoffset = String(1 - clamp(k)); }
function tex(el, s, display = false) { katex.render(s, el, { throwOnError: false, displayMode: display }); return el; }
function words(el, list) {
  el.innerHTML = '';
  return list.map((w, i) => { const s = document.createElement('span'); s.className = 'w'; s.innerHTML = w + (i < list.length - 1 ? ' ' : ''); el.appendChild(s); return s; });
}
// kinetic type: span i appears when word i of cue `id` is spoken
function speak(spans, id, t, opt = {}) {
  const ws = cue(id).words;
  spans.forEach((sp, i) => {
    const w = ws[Math.min(i, ws.length - 1)];
    const k = P(t, w.t0 - (opt.lead ?? .05), opt.d ?? .5);
    A(sp, { o: k, y: (1 - k) * (opt.dist ?? 10) });
  });
}
const NS = 'http://www.w3.org/2000/svg';
const layer = (parent, z = 0) => add(parent, `<div class="layer" style="z-index:${z}"></div>`);
const svgLayer = parent => add(parent, `<svg class="abs" width="${LAY.W}" height="${LAY.H}" viewBox="0 0 ${LAY.W} ${LAY.H}" style="left:0;top:0"></svg>`);
function sv(parent, tag, attrs = {}) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.appendChild(e); return e; }

// ---------------------------------------------------------------- theme
(function theme() {
  const th = CONFIG.theme || {};
  const dark = th.mode === 'dark';
  if (dark) document.documentElement.dataset.mode = 'dark';
  const hex = c => { c = c.replace('#', ''); if (c.length === 3) c = [...c].map(x => x + x).join(''); return [0, 2, 4].map(i => parseInt(c.slice(i, i + 2), 16)); };
  const mix = (c, w, k) => '#' + hex(c).map((v, i) => Math.round(lerp(v, w[i], k)).toString(16).padStart(2, '0')).join('');
  const bg = hex(th.bg || (dark ? '#101318' : '#faf9f6'));
  const root = document.documentElement.style;
  const set = (name, c) => {
    if (!c) return;
    root.setProperty(`--${name}`, c);
    root.setProperty(`--${name}-text`, dark ? mix(c, [255, 255, 255], .25) : mix(c, [0, 0, 0], .15));
    root.setProperty(`--${name}-mid`, mix(c, bg, .45));
    root.setProperty(`--${name}-soft`, mix(c, bg, dark ? .8 : .86));
    root.setProperty(`--${name}-rgb`, hex(c).join(','));
  };
  set('accent', th.accent); set('contrast', th.contrast); set('neutral', th.neutral);
  for (const k of ['good', 'bad', 'bg', 'ink', 'dim', 'paper']) if (th[k]) root.setProperty(`--${k}`, th[k]);
  if (th.serif) root.setProperty('--serif', th.serif);
  if (th.sans) root.setProperty('--sans', th.sans);
})();

// ---------------------------------------------------------------- scenes
const world = $('#world');
const SCENES = [], GLOBAL = [], SECTIONS = [], HUD_DIM = [];
const NOSUB = new Set();
const EVENTS = { sfx: [], title: null, endcard: null };
let BUILDING = null;
// sound events for the score (tools/score.py): whoosh, impact, tick, blip, thud
function sfx(type, t, o = {}) { if (Number.isFinite(t)) EVENTS.sfx.push({ type, t: +t.toFixed(3), ...o }); }
function section(t, label) { SECTIONS.push({ t, label }); SECTIONS.sort((a, b) => a.t - b.t); }
function nosub(id) { NOSUB.add(id); }   // hide the subtitle of a cue whose words are already on screen
function hudDim(a, b, k = 1) { HUD_DIM.push([a, b, k]); }
// register a component so its update(t) runs every frame while its scene is visible
function comp(c) { (BUILDING ? BUILDING.comps : GLOBAL).push(c); return c; }
function scene(id, a, b, build, opt = {}) {
  const el = add(world, `<div class="layer scene" id="sc-${id}"></div>`);
  const sc = { id, a, b, el, comps: [], fi: opt.fi ?? .5, fo: opt.fo ?? .5, push: opt.push ?? 0, energy: opt.energy ?? .6 };
  BUILDING = sc;
  const upd = build(el, sc);
  BUILDING = null;
  sc.update = (t, o) => { for (const c of sc.comps) c.update(t, o); if (typeof upd === 'function') upd(t, o); };
  SCENES.push(sc);
  if (opt.label !== undefined) section(Math.max(0, a + .05), opt.label);
  if (opt.whoosh !== false && a > .3) sfx('whoosh', a, { gain: opt.whooshGain ?? 1 });
  return sc;
}

// ---------------------------------------------------------------- running head + progress
const HUD = (() => {
  const hud = $('#hud');
  if (CONFIG.hud === false) { hud.style.display = 'none'; return null; }
  // running head: short title (acronym) + long title on the left, current section on the right
  const short = CONFIG.shortTitle || '', long = PORTRAIT ? '' : (CONFIG.hudTitle || '');
  const hx = PORTRAIT ? 60 : 96, hy = PORTRAIT ? 44 : 50;
  add(hud, `<div class="hudtxt" style="left:${hx}px;top:${hy}px"><b>${short}</b>${short && long ? '&nbsp;&nbsp;·&nbsp;&nbsp;' : ''}${long}</div>`);
  const sec = add(hud, `<div class="hudtxt" style="right:${hx}px;top:${hy}px;text-align:right"></div>`);
  const pr = add(hud, `<div id="progress"></div>`);
  if (CONFIG.progress === false) pr.style.display = 'none';
  return { hud, sec, pr };
})();
function hud(t) {
  if (!HUD) return;
  let dim = 0;
  for (const [a, b, k] of HUD_DIM) dim = Math.max(dim, win(t, a, b, .4, .4) * k);
  HUD.hud.style.opacity = P(t, .3, 1.2, ease.inOutCubic) * (1 - dim);
  let cur = null;
  for (const s of SECTIONS) if (t >= s.t) cur = s;
  if (cur) {
    if (HUD.sec.dataset.l !== cur.label) { HUD.sec.dataset.l = cur.label; HUD.sec.innerHTML = cur.label; }
    HUD.sec.style.opacity = P(t, cur.t, .6);
  }
  HUD.pr.style.width = (LAY.W * clamp(t / DUR)) + 'px';
}

// ---------------------------------------------------------------- subtitles
const SUBS = TL.subs.map(s => {
  const el = add($('#subs'), `<div class="sub${CONFIG.subtitles === 'boxed' ? ' boxed' : ''}"></div>`);
  return { ...s, el, spans: words(el, s.words.map(w => w.d)) };
});
function subs(t) {
  for (const s of SUBS) {
    const o = (CONFIG.subtitles === false || NOSUB.has(s.cue)) ? 0
      : Math.min(P(t, s.t0, .16, ease.inOutCubic), 1 - P(t, s.t1 - .16, .16, ease.inOutCubic));
    if (o <= 0) { s.el.style.display = 'none'; continue; }
    s.el.style.display = 'block'; s.el.style.opacity = o;
    s.el.style.transform = `translateX(-50%) translateY(${(1 - o) * 6}px)`;
    // spoken words in full ink, upcoming words lighter
    s.words.forEach((w, i) => { s.spans[i].style.opacity = lerp(.38, 1, P(t, w.t0 - .05, .2, ease.outCubic)); });
  }
}

// ---------------------------------------------------------------- frame
function render(t, f = Math.round(t * 30)) {
  for (const c of GLOBAL) c.update(t, 1);
  for (const sc of SCENES) {
    const o = win(t, sc.a, sc.b, sc.fi, sc.fo);
    if (o <= 0) { sc.el.style.display = 'none'; continue; }
    sc.el.style.display = 'block'; sc.el.style.opacity = o;
    sc.el.style.transform = sc.push ? `scale(${1 + sc.push * clamp((t - sc.a) / (sc.b - sc.a))})` : 'none';
    sc.update(t, o);
  }
  hud(t); subs(t);
  $('#fade').style.opacity = Math.max(1 - P(t, 0, .9, ease.inOutCubic), P(t, DUR - 1.1, 1.0, ease.inOutCubic));
}
window.render = render;
window.EVENTS = EVENTS;
window.SCENES_INFO = () => SCENES.map(s => ({ id: s.id, a: s.a, b: s.b, energy: s.energy }));

// ---------------------------------------------------------------- startup
window.addEventListener('load', async () => {
  const faces = ['400 40px "Source Serif 4"', 'italic 400 40px "Source Serif 4"', '500 40px "Source Serif 4"', '600 40px "Source Serif 4"', 'italic 500 40px "Source Serif 4"',
    '300 40px Inter', '400 40px Inter', '500 40px Inter', '600 40px Inter', '700 40px Inter', '400 20px "IBM Plex Mono"', '500 20px "IBM Plex Mono"'];
  try { await Promise.all(faces.map(f => document.fonts.load(f))); } catch (e) { console.warn('font load', e); }
  await document.fonts.ready;
  render(0);
  window.READY = true;
  if (!window.RENDER_MODE) devPreview();
});

// Interactive preview when build/index.html is opened in a normal browser: play / scrub with the narration.
function devPreview() {
  document.documentElement.style.cssText += ';width:100vw;height:100vh;overflow:hidden';
  document.body.style.cssText += ';width:100vw;height:100vh;background:#000';
  const stage = $('#stage');
  const fit = () => { const s = Math.min(innerWidth / LAY.W, (innerHeight - 54) / LAY.H); stage.style.transform = `scale(${s})`; };
  addEventListener('resize', fit); fit();
  const bar = add(document.body, `<div id="dev"><button>play</button><input type="range" min="0" max="${DUR}" step="0.01" value="0"><span class="tc">0.00</span></div>`);
  const btn = $('button', bar), slider = $('input', bar), tc = $('.tc', bar);
  const audio = new Audio(window.PREVIEW_AUDIO || 'build/mix.wav');
  let playing = false, t0 = 0, w0 = 0;
  const show = t => { render(t); slider.value = t; tc.textContent = t.toFixed(2) + ' s'; };
  const loop = () => { if (!playing) return; const t = audio.readyState > 1 ? audio.currentTime : w0 + (performance.now() - t0) / 1000; show(t); if (t < DUR) requestAnimationFrame(loop); else playing = false; };
  btn.onclick = () => {
    playing = !playing; btn.textContent = playing ? 'pause' : 'play';
    if (playing) { w0 = +slider.value; t0 = performance.now(); audio.currentTime = w0; audio.play().catch(() => {}); loop(); } else audio.pause();
  };
  slider.oninput = () => { show(+slider.value); if (playing) { audio.currentTime = +slider.value; w0 = +slider.value; t0 = performance.now(); } };
}
