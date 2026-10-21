// paper-motion-video component library (UI.*), editorial style: flat color, hairlines, direct labels.
// Every constructor: UI.name(parent, options) -> { el, update(t), ...helpers }.
// Components created inside a scene() build function register themselves and are updated automatically.
// Positions are stage pixels (LAY.W x LAY.H: 1920x1080 landscape, 1080x1350 portrait); times are absolute seconds.
// Sizes come from TYPE (format-dependent type scale) and LAY (margins, content width, subtitle band).
// Colors accept semantic names: 'accent' (your method), 'contrast' (the problem / unconstrained baseline),
// 'neutral' (prior work), 'good', 'bad', 'ink', 'dim', 'faint' (+ 'accentLight', 'contrastLight',
// 'neutralLight', 'neutralDark' for fills), or any CSS color.

const UI = {};
const TEXT = { accent: 'var(--accent-text)', contrast: 'var(--contrast-text)', neutral: 'var(--neutral-text)', good: 'var(--good)', bad: 'var(--bad)',
  ink: 'var(--ink)', dim: 'var(--dim)', faint: 'var(--faint)' };
const FILL = { accent: 'var(--accent)', accentLight: 'var(--accent-mid)', contrast: 'var(--contrast)', contrastLight: 'var(--contrast-mid)',
  neutral: 'var(--neutral)', neutralLight: 'var(--neutral-mid)', neutralDark: 'var(--neutral-text)', good: 'var(--good)', bad: 'var(--bad)', ink: 'var(--ink)',
  dim: 'var(--dim)', faint: 'var(--faint)', rule: 'var(--rule)' };
const SOFT = { accent: 'var(--accent-soft)', contrast: 'var(--contrast-soft)', neutral: 'var(--neutral-soft)', good: 'var(--good-soft)', bad: 'var(--bad-soft)' };
const MID = { accent: 'var(--accent-mid)', contrast: 'var(--contrast-mid)', neutral: 'var(--neutral-mid)', good: 'var(--good)', bad: 'var(--bad)' };
const colorOf = c => TEXT[c] || c || 'var(--ink)';
const fillOf = c => FILL[c] || c || 'var(--accent)';
const base = c => String(c || 'accent').replace(/Light|Dark/, '');
const defAt = (o, k = .3) => o.at ?? (BUILDING ? BUILDING.a + k : 0);
const sceneEnd = () => (BUILDING ? BUILDING.b : DUR);
// names never break inside: 'Johannes Schwab' wraps as a unit
const join = arr => (arr || []).map(x => String(x).replace(/ /g, '&nbsp;')).join(' &nbsp;·&nbsp; ');
const emph = html => String(html).replace(/<em>/g, '<span class="em">').replace(/<\/em>/g, '</span>');
// shrink an element's font-size until it fits maxW (runs once, after fonts are loaded)
function fitOnce(el, maxW) {
  let done = false;
  return () => {
    if (done || document.fonts.status !== 'loaded') return;
    done = true;
    const sc = (el.closest('#stage')?.getBoundingClientRect().width || LAY.W) / LAY.W;
    const w = el.getBoundingClientRect().width / sc;
    if (w > maxW) el.style.fontSize = (parseFloat(getComputedStyle(el).fontSize) * maxW / w) + 'px';
  };
}
// title html: lines split by <br>, <em>..</em> becomes accent italic; returns word spans
function titleWords(el, html) {
  el.innerHTML = '';
  const spans = [];
  String(html).split(/<br\s*\/?>/i).forEach(line => {
    const ln = add(el, `<div class="nowrap"></div>`);
    const toks = [];
    line.split(/(<em>.*?<\/em>)/).forEach(seg => {
      const m = seg.match(/^<em>(.*)<\/em>$/);
      (m ? m[1] : seg).trim().split(/\s+/).filter(Boolean).forEach(tk => toks.push(m ? `<span class="em">${tk}</span>` : tk));
    });
    toks.forEach((tk, i) => { const s = document.createElement('span'); s.className = 'w'; s.innerHTML = tk + (i < toks.length - 1 ? ' ' : ''); ln.appendChild(s); spans.push(s); });
  });
  return spans;
}
// arrowhead marker for SVG lines
function arrowDefs(s, id, color) {
  const d = sv(s, 'defs');
  const m = sv(d, 'marker', { id, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
  sv(m, 'path', { d: 'M0,1 L9,5 L0,9', fill: 'none', stroke: color, 'stroke-width': 1.6 });
  return `url(#${id})`;
}
let _uid = 0;

// ================================================================ text
UI.text = (parent, html, o = {}) => {
  const at = defAt(o);
  const el = add(parent, `<div class="abs ${o.cls || ''}" style="left:${o.x ?? LAY.M}px;top:${o.y ?? 0}px;${o.w ? `width:${o.w}px;` : ''}font-size:${o.size ?? TYPE.body}px;${o.align ? `text-align:${o.align};` : ''}${o.color ? `color:${colorOf(o.color)};` : ''}${o.style || ''}">${emph(html)}</div>`);
  const fit = o.maxW ? fitOnce(el, o.maxW) : null;
  return comp({ el, update: t => { if (fit) fit(); A(el, out(rise(t, at, o.d ?? .8, o.dist ?? 14), t, o.out)); } });
};
// serif heading at the top-left of a scene. Wrap words in <em> for the accent italic. Keep it to ~7 words.
UI.headline = (parent, html, o = {}) => UI.text(parent, html, LAY.portrait
  ? { y: LAY.top + 46, size: TYPE.headline, w: LAY.CW, cls: 'serif', style: 'line-height:1.08;font-weight:500;', ...o }   // may wrap to 2 lines
  : { y: 128, size: TYPE.headline, cls: 'serif nowrap', style: 'line-height:1.1;font-weight:500;', maxW: LAY.CW, ...o });
// small uppercase label above a headline or a chart
// Greek letters keep their case (text-transform would turn ρ into Ρ)
const keepCase = html => String(html).replace(/[\u0370-\u03ff\u1f00-\u1fff]+/g, m => `<span style="text-transform:none">${m}</span>`);
UI.kicker = (parent, html, o = {}) => UI.text(parent, keepCase(html), { y: LAY.top - (LAY.portrait ? 0 : 4), size: TYPE.kicker, cls: 'kicker', ...o });

// Kinetic typography: the words of a narration cue appear exactly when spoken (hides that cue's subtitle).
// lines: [{n: words, size, font: 'serif'|'sans', color, weight, top}], emph: word indices or words set in accent italic.
UI.kinetic = (parent, cueId, o = {}) => {
  const disp = o.words || cue(cueId).words.map(w => w.d);
  if (disp.length !== cue(cueId).words.length) console.error(`kinetic(${cueId}): ${disp.length} words given, cue has ${cue(cueId).words.length}`);
  const lines = o.lines || [{ n: disp.length }];
  const em = new Set();
  (o.emph || []).forEach(e => { if (typeof e === 'number') em.add(e); else disp.forEach((w, i) => { if (w.toLowerCase().replace(/[^\w-]/g, '') === String(e).toLowerCase()) em.add(i); }); });
  let top = o.top ?? (LAY.portrait ? 420 : 380), k = 0;
  const spans = [], boxes = [];
  lines.forEach((L, li) => {
    const size = L.size ?? (li === lines.length - 1 ? TYPE.statement : TYPE.lead + 10);
    const serif = (L.font ?? (size >= 70 ? 'serif' : 'sans')) === 'serif';
    const pos = o.x !== undefined ? `left:${o.x}px;right:${LAY.M}px` : `left:${LAY.M}px;right:${LAY.M}px;text-align:center`;
    const e = add(parent, `<div class="abs ${serif ? 'serif' : ''}" style="${pos};top:${L.top ?? top}px;font-size:${size}px;line-height:1.08;color:${colorOf(L.color || (serif ? 'ink' : 'dim'))};font-weight:${L.weight ?? (serif ? 500 : 400)};white-space:nowrap"></div>`);
    const list = disp.slice(k, k + L.n).map((w, j) => em.has(k + j) ? `<span class="${o.emphClass || 'em'}">${w}</span>` : w);
    spans.push(...words(e, list)); boxes.push(e);
    k += L.n; top = (L.top ?? top) + size * 1.14 + (L.gap ?? 10);
  });
  if (k !== disp.length) console.error(`kinetic(${cueId}): lines cover ${k} of ${disp.length} words`);
  if (o.nosub !== false) nosub(cueId);
  // a line wider than the frame shrinks to fit (once, after fonts load)
  let fitted = false;
  const fitLines = () => {
    if (fitted || document.fonts.status !== 'loaded') return;
    fitted = true;
    boxes.forEach(b => { if (b.scrollWidth > b.clientWidth + 1) b.style.fontSize = (parseFloat(b.style.fontSize) * b.clientWidth / b.scrollWidth * .99) + 'px'; });
  };
  return comp({ el: boxes[0], boxes, spans, update: t => {
    fitLines();
    speak(spans, cueId, t, o.anim || {});
    if (o.out !== undefined) boxes.forEach(b => A(b, out({ o: 1, y: 0 }, t, o.out)));
  } });
};
// a line drawn under elements (emphasis), e.g. UI.underline(layerEl, $$('.em', layerEl), W('h2', 'future'))
UI.underline = (parent, targets, at, o = {}) => {
  targets = Array.isArray(targets) ? targets : [targets];
  const line = add(parent, `<div class="abs" style="height:${o.weight ?? 4}px;background:${fillOf(o.color || 'accent')};transform-origin:left center;border-radius:2px"></div>`);
  let placed = false;
  return comp({ el: line, update: t => {
    if (!placed && document.fonts.status === 'loaded' && targets.every(e => e.getBoundingClientRect().width > 0)) {
      placed = true;
      const sc = parent.closest('#stage').getBoundingClientRect().width / LAY.W;
      const rs = targets.map(e => e.getBoundingClientRect());
      const l = Math.min(...rs.map(r => r.left)), r = Math.max(...rs.map(r => r.right)), b = Math.max(...rs.map(r => r.bottom));
      const pr = parent.getBoundingClientRect();
      Object.assign(line.style, { left: ((l - pr.left) / sc) + 'px', top: ((b - pr.top) / sc + (o.dy ?? 2)) + 'px', width: ((r - l) / sc) + 'px' });
    }
    line.style.transform = `scaleX(${P(t, at, o.d ?? .6, ease.inOutCubic)})`;
  } });
};

// ================================================================ title & end card (read config.json)
UI.titleCard = (parent, o = {}) => {
  const at = defAt(o, .1), end = o.end ?? sceneEnd();
  const box = add(parent, `<div class="abs" style="left:${LAY.M}px;right:${LAY.M}px;top:${o.top ?? (LAY.portrait ? 330 : 300)}px;text-align:center"></div>`);
  const kick = add(box, `<div class="kicker">${CONFIG.venue || '&nbsp;'}</div>`);
  const title = add(box, `<div class="serif" style="display:inline-block;font-size:${o.size ?? (LAY.portrait ? 92 : 112)}px;line-height:1.04;margin-top:30px;font-weight:500"></div>`);
  const tw = titleWords(title, CONFIG.titleHtml || CONFIG.title || 'Untitled');
  const sub = add(box, `<div style="font-size:${TYPE.lead}px;font-weight:400;color:var(--dim);margin-top:26px">${CONFIG.subtitle || ''}</div>`);
  const rule = add(box, `<div style="margin:36px auto 0;height:2px;width:72px;background:var(--accent)"></div>`);
  const au = add(box, `<div style="font-size:${TYPE.body}px;margin-top:32px;font-weight:500;line-height:1.4">${join(CONFIG.authors)}</div>`);
  const af = add(box, `<div style="font-size:${TYPE.label}px;margin-top:10px;color:var(--dim);line-height:1.4">${join(CONFIG.affiliations)}</div>`);
  const fit = fitOnce(title, LAY.CW);
  EVENTS.title = at; sfx('impact', at + .02, { gain: .7 }); hudDim(at - .25, end);
  return comp({ el: box, update: t => {
    fit();
    A(kick, rise(t, at + .05, .9));
    tw.forEach((w, i) => A(w, rise(t, at + .15 + i * .09, 1.0, 18)));
    A(sub, rise(t, at + .7, .9));
    rule.style.transform = `scaleX(${P(t, at + .8, .9, ease.inOutCubic)})`;
    A(au, rise(t, at + 1.0, .9)); A(af, rise(t, at + 1.15, .9));
  } });
};

// End card: title, tagline, authors, QR codes for config.links. taglineCue makes the tagline appear word by word.
UI.endCard = (parent, o = {}) => {
  const at = defAt(o, .1);
  const links = (o.links || CONFIG.links || []).slice(0, LAY.portrait ? 2 : 3);
  const L = layer(parent), top = o.top ?? (LAY.portrait ? 150 : 318);
  // landscape: text column on the left, QR codes on the right; portrait: everything stacked, QR codes at the bottom
  const textW = LAY.portrait || !links.length ? LAY.CW : 1060;
  const ec = add(L, `<div class="abs" style="left:${LAY.M}px;top:${top}px;width:${textW}px"></div>`);
  const eK = add(ec, `<div class="kicker">${CONFIG.venue || '&nbsp;'}</div>`);
  const eT = add(ec, `<div class="serif" style="display:inline-block;font-size:${o.size ?? (LAY.portrait ? 80 : 88)}px;line-height:1.04;margin-top:22px;font-weight:500"></div>`);
  titleWords(eT, CONFIG.titleHtml || CONFIG.title || '');
  const eS = add(ec, `<div class="serif it" style="font-size:${TYPE.tagline}px;color:var(--dim);margin-top:22px;line-height:1.25"></div>`);
  let tag = null;
  if (o.taglineCue) { tag = words(eS, cue(o.taglineCue).words.map(w => w.d)); nosub(o.taglineCue); }
  else eS.innerHTML = o.tagline || CONFIG.tagline || '';
  const rule = add(ec, `<div style="margin-top:34px;height:2px;width:72px;background:var(--accent);transform-origin:left"></div>`);
  const eA = add(ec, `<div style="font-size:${TYPE.body}px;margin-top:26px;font-weight:500;line-height:1.4">${join(CONFIG.authors)}</div>`);
  const eF = add(ec, `<div style="font-size:${TYPE.label}px;margin-top:8px;color:var(--dim);line-height:1.4">${join(CONFIG.affiliations)}</div>`);
  const qs = LAY.portrait ? 230 : 200;
  const qrs = links.map((ln, i) => {
    const x = LAY.portrait ? LAY.M + i * (qs + 60) : LAY.R - qs - (links.length - 1 - i) * 240;
    const y = LAY.portrait ? (o.qrY ?? LAY.bottom - qs - 70) : top + 56;
    let svg = '';
    if (typeof qrcode === 'function') { const q = qrcode(0, 'M'); q.addData(ln.url); q.make(); svg = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); }
    const c = add(L, `<div class="abs" style="left:${x}px;top:${y}px;width:${qs}px;text-align:center">
      <div style="background:#fff;border:1px solid var(--rule);border-radius:12px;padding:14px;width:${qs}px;height:${qs}px">${svg}</div>
      <div style="font-size:${TYPE.label}px;font-weight:500;color:var(--dim);margin-top:14px;white-space:nowrap">${ln.label || ''}</div></div>`);
    const sv_ = $('svg', c); if (sv_) { sv_.setAttribute('width', String(qs - 30)); sv_.setAttribute('height', String(qs - 30)); }
    return c;
  });
  const fit = fitOnce(eT, textW);
  EVENTS.endcard = at; sfx('impact', at, { gain: .45 }); hudDim(at, DUR + 2, .8);
  return comp({ el: L, update: t => {
    fit();
    A(eK, rise(t, at)); A(eT, rise(t, at + .1, 1.0, 16));
    if (tag) speak(tag, o.taglineCue, t); else A(eS, rise(t, at + .4));
    rule.style.transform = `scaleX(${P(t, at + .6, .8, ease.inOutCubic)})`;
    A(eA, rise(t, at + .8)); A(eF, rise(t, at + .95));
    qrs.forEach((q, i) => A(q, rise(t, at + .7 + i * .2, .9)));
  } });
};

// ================================================================ boxes, numbers, equations
UI.card = (parent, o = {}) => {
  const at = defAt(o);
  const el = add(parent, `<div class="abs card ${o.cls || ''}" style="left:${o.x ?? LAY.M}px;top:${o.y ?? 300}px;${o.w ? `width:${o.w}px;` : ''}${o.h ? `height:${o.h}px;` : ''}padding:${o.pad ?? '20px 26px'};${o.border ? `border-color:${MID[o.border] || o.border};` : ''}${o.fill ? `background:${SOFT[o.fill] || o.fill};` : ''}${o.style || ''}">${emph(o.html || '')}</div>`);
  return comp({ el, update: t => A(el, out(rise(t, at, o.d ?? .9), t, o.out)) });
};
UI.chip = (parent, html, o = {}) => {
  const at = defAt(o), c = o.color;
  const el = add(parent, `<div class="abs chip" style="left:${o.x ?? LAY.M}px;top:${o.y ?? 300}px;${c ? `border-color:${MID[c] || c};background:${SOFT[c] || 'var(--paper)'};color:${colorOf(c)};` : ''}">${o.dot === false ? '' : `<span class="dot" style="background:${fillOf(c || 'accent')}"></span>`}${html}</div>`);
  if (o.sound) sfx('tick', at, { note: 81 });
  return comp({ el, update: t => A(el, out(rise(t, at, .7), t, o.out)) });
};
// KaTeX equation, optionally in a card with a caption
UI.equation = (parent, o = {}) => {
  const at = defAt(o), card = o.card !== false;
  const el = add(parent, `<div class="abs ${card ? 'card' : ''}" style="left:${o.x ?? LAY.M}px;top:${o.y ?? 300}px;${o.w ? `width:${o.w}px;` : ''}padding:${card ? '20px 26px' : 0}">
     <div class="fx" style="font-size:${o.size ?? TYPE.lead}px"></div>${o.caption ? `<div style="font-size:${TYPE.label}px;color:var(--dim);margin-top:12px;line-height:1.4">${o.caption}</div>` : ''}</div>`);
  tex($('.fx', el), o.tex || '');
  return comp({ el, update: t => A(el, out(rise(t, at, .9), t, o.out)) });
};
// big animated number. Counts from `from` to `to` between t0 and t1.
UI.counter = (parent, o = {}) => {
  const at = defAt(o), t0 = o.t0 ?? at, t1 = o.t1 ?? t0 + 1.6, size = o.size ?? (LAY.portrait ? 120 : 132);
  const el = add(parent, `<div class="abs nowrap" style="left:${o.x ?? LAY.M}px;top:${o.y ?? 300}px;${o.align === 'right' ? `width:${o.w ?? 400}px;text-align:right;` : ''}">
     ${o.label ? `<div class="kicker" style="margin-bottom:12px">${o.label}</div>` : ''}
     <div class="tab" style="font-size:${size}px;font-weight:300;letter-spacing:-.035em;line-height:1;color:${colorOf(o.color || 'ink')}">${o.prefix || ''}<span class="n"></span><span style="font-size:${size * .4}px;font-weight:400;color:var(--dim);letter-spacing:0">${o.suffix || ''}</span></div>
     ${o.caption ? `<div style="font-size:${TYPE.label}px;color:var(--dim);margin-top:10px">${o.caption}</div>` : ''}</div>`);
  const n = $('.n', el), e = o.ease || ease.inOutSine, dec = o.decimals ?? 1;
  const sep = o.thousands ?? Math.abs(o.to ?? 0) >= 1000;   // 1,000 instead of 1000
  const fmtN = v => sep ? v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : v.toFixed(dec);
  return comp({ el, update: t => { A(el, out(rise(t, at), t, o.out)); n.textContent = fmtN(lerp(o.from ?? 0, o.to ?? 1, e(clamp((t - t0) / (t1 - t0))))); } });
};

// ================================================================ charts
// Horizontal bars. rows: [{label, tag, value, color, bold, labelColor, at}]
UI.hbars = (parent, o = {}) => {
  const at = defAt(o), x = o.x ?? (LAY.portrait ? LAY.M : 360), y = o.y ?? 290, labelW = o.labelW ?? (LAY.portrait ? 300 : 400);
  const trackW = o.trackW ?? (LAY.portrait ? LAY.CW - labelW - 120 : 800);
  const rowH = o.rowH ?? (LAY.portrait ? 108 : 96), barH = o.barH ?? (LAY.portrait ? 38 : 32), max = o.max ?? 100, dec = o.decimals ?? 1, unit = o.unit ?? '';
  const X0 = x + labelW, sc = trackW / max, ls = o.labelSize ?? TYPE.value;
  const L = layer(parent);
  const kick = o.title ? add(L, `<div class="abs kicker" style="left:${x}px;top:${y - TYPE.kicker - 36}px">${o.title}</div>`) : null;
  const R = o.rows.map((r, i) => {
    const ry = y + i * rowH, ti = r.at ?? at + .2 + i * (o.stagger ?? .14);
    const lab = add(L, `<div class="abs nowrap" style="left:${x}px;top:${ry + 2}px"><div style="font-size:${ls}px;font-weight:${r.bold ? 600 : 500};color:${r.labelColor ? colorOf(r.labelColor) : 'var(--ink)'}">${r.label}</div>${r.tag ? `<div style="font-size:${TYPE.label}px;color:${colorOf(r.tagColor || 'dim')};margin-top:3px">${r.tag}</div>` : ''}</div>`);
    const track = o.track === false ? null : add(L, `<div class="abs" style="left:${X0}px;top:${ry + 8}px;width:${trackW}px;height:${barH}px;background:var(--grid)"></div>`);
    const bar = add(L, `<div class="abs solid" style="left:${X0}px;top:${ry + 8}px;width:${r.value * sc}px;height:${barH}px;transform-origin:left center;background:${fillOf(r.color)}"></div>`);
    const val = add(L, `<div class="abs tab nowrap" style="left:${X0 + r.value * sc + 14}px;top:${ry + 8 + barH / 2 - (o.valueSize ?? TYPE.value) * .64}px;font-size:${o.valueSize ?? TYPE.value}px;font-weight:${r.bold ? 600 : 500}"></div>`);
    if (o.sound !== false) sfx('blip', ti + .1, { f0: 420, f1: 840, gain: .5 });
    return { r, ti, lab, track, bar, val };
  });
  return comp({ el: L, xOf: v => X0 + v * sc, rowY: i => y + i * rowH, rowMid: i => y + i * rowH + 8 + barH / 2, update: t => {
    if (kick) A(kick, rise(t, at - .2));
    R.forEach(({ r, ti, lab, track, bar, val }) => {
      A(lab, rise(t, ti - .25)); if (track) A(track, rise(t, ti - .25, .8, 0));
      const k = P(t, ti, 1.1, ease.outQuart);
      bar.style.transform = `scaleX(${k})`; bar.style.opacity = P(t, ti, .12);
      A(val, { o: P(t, ti + .3, .5), x: -(1 - k) * r.value * sc });
      val.textContent = (r.value * k).toFixed(dec) + unit;
    });
  } });
};

// Vertical bars with groups, a reference band and value labels.
// bars: [{label, value, color, hatch, bold, group, at}], groups: [{label, sub, color, at}], band: {from, to, label, at},
// refs: [{value, from, to, at}] dashed lines across bars (indices)
UI.vbars = (parent, o = {}) => {
  const at = defAt(o), x = o.x ?? (LAY.portrait ? LAY.M + 80 : 300), y = o.y ?? 300, w = o.w ?? (LAY.portrait ? LAY.CW - 80 : 1020), h = o.h ?? 500, max = o.max, dec = o.decimals ?? 2;
  const barW = o.barW ?? 104, inner = o.inner ?? 18, gGap = o.groupGap ?? 130, By = y + h, Y = v => By - v / max * h;
  const L = layer(parent), s = svgLayer(L);
  const grid = (o.ticks || []).map(v => sv(s, 'line', { x1: x, x2: x, y1: Y(v), y2: Y(v), stroke: v === 0 ? 'var(--ink)' : 'var(--grid)', 'stroke-width': v === 0 ? 1.2 : 1 }));
  const yl = (o.tickLabels === false ? [] : (o.ticks || [])).map(v => add(L, `<div class="abs tab" style="left:${x - 80}px;width:64px;text-align:right;top:${Y(v) - TYPE.label * .64}px;font-size:${TYPE.label}px;color:var(--dim)">${v.toFixed(o.tickDecimals ?? 1)}</div>`));
  const groupsIdx = [...new Set(o.bars.map(b => b.group ?? 0))];
  const widths = groupsIdx.map(g => { const n = o.bars.filter(b => (b.group ?? 0) === g).length; return n * barW + (n - 1) * inner; });
  const total = widths.reduce((a, b) => a + b, 0) + (groupsIdx.length - 1) * gGap;
  let cur = x + (w - total) / 2; const gx = {}, gc = {};
  groupsIdx.forEach((g, i) => { gx[g] = cur; gc[g] = cur + widths[i] / 2; cur += widths[i] + gGap; });
  const band = o.band ? add(L, `<div class="abs" style="left:${x}px;top:${Y(o.band.to)}px;width:${w}px;height:${Y(o.band.from) - Y(o.band.to)}px;background:var(--grid);transform-origin:left"></div>`) : null;
  const bandL = o.band ? add(L, `<div class="abs nowrap" style="left:${x + w + 16}px;top:${Y((o.band.from + o.band.to) / 2) - TYPE.label * .64}px;font-size:${TYPE.label}px;color:var(--dim)">${o.band.label || ''}</div>`) : null;
  const used = {};
  const B = o.bars.map((b, i) => {
    const g = b.group ?? 0; used[g] = used[g] || 0;
    const cx = gx[g] + used[g] * (barW + inner) + barW / 2; used[g]++;
    const fc = fillOf(b.color);
    const fill = b.hatch ? `background:repeating-linear-gradient(-45deg,${fc} 0 2.5px,transparent 2.5px 8px);border:1.5px solid ${fc};border-bottom:0;` : `background:${fc};`;
    const bar = add(L, `<div class="abs solid" style="left:${cx - barW / 2}px;top:${Y(b.value)}px;width:${barW}px;height:${By - Y(b.value)}px;${fill}transform-origin:bottom"></div>`);
    const showV = o.values !== false && b.showValue !== false;   // values: false for illustrative bars
    const val = add(L, `<div class="abs tab" style="left:${cx - 70}px;width:140px;text-align:center;top:${Y(b.value) - TYPE.value - 14}px;font-size:${b.bold ? TYPE.value + 4 : TYPE.value}px;font-weight:${b.bold ? 650 : 500};${showV ? '' : 'display:none;'}"></div>`);
    const lb = add(L, `<div class="abs" style="left:${cx - barW / 2 - inner / 2}px;width:${barW + inner}px;text-align:center;top:${By + 12}px;font-size:${TYPE.label}px;color:var(--dim)">${b.label || ''}</div>`);
    const ti = b.at ?? at + .4 + i * .15;
    if (o.sound !== false) sfx('blip', ti, { f0: 420, f1: 840, gain: .5 });
    return { b, cx, bar, val, lb, ti };
  });
  const G = (o.groups || []).map((g, i) => {
    const el = add(L, `<div class="abs" style="left:${gc[i] - 170}px;width:340px;text-align:center;top:${By + TYPE.label + 30}px"><div style="font-size:${TYPE.body}px;font-weight:600;color:${colorOf(g.color)}">${g.label}</div>${g.sub ? `<div style="font-size:${TYPE.label}px;color:var(--dim);margin-top:3px">${g.sub}</div>` : ''}</div>`);
    const first = B.find(q => (q.b.group ?? 0) === i);
    return { el, ti: g.at ?? (first ? first.ti : at) };
  });
  const refs = (o.refs || []).map(r => ({ r, el: add(L, `<div class="abs" style="left:${B[r.from].cx + barW / 2}px;top:${Y(r.value)}px;width:${B[r.to].cx - B[r.from].cx}px;height:0;border-top:1.5px dashed ${fillOf(r.color || 'accent')};transform-origin:left"></div>`) }));
  return comp({ el: L, Y, barX: i => B[i].cx, update: t => {
    grid.forEach((g, i) => g.setAttribute('x2', x + w * P(t, at - .2 + i * .08, 1.0, ease.inOutCubic)));
    yl.forEach((e, i) => A(e, rise(t, at + i * .06, .6, 6)));
    B.forEach(({ b, bar, val, lb, ti }) => {
      const k = P(t, ti, 1.0, ease.outQuart);
      bar.style.transform = `scaleY(${k})`; bar.style.opacity = P(t, ti, .12);
      A(val, { o: P(t, ti + .2, .4), y: (1 - k) * (By - Y(b.value)) });
      val.textContent = (b.value * k).toFixed(dec);
      A(lb, rise(t, ti, .6, 6));
    });
    G.forEach(g => A(g.el, rise(t, g.ti)));
    if (band) { const ta = o.band.at ?? at + .2; band.style.transform = `scaleX(${P(t, ta, .9, ease.inOutCubic)})`; A(bandL, rise(t, ta + .4)); }
    refs.forEach(({ r, el }) => { el.style.transform = `scaleX(${P(t, r.at ?? at + 2, .8, ease.inOutCubic)})`; el.style.opacity = P(t, r.at ?? at + 2, .2); });
  } });
};

// Line chart drawn progressively. series: [{name, values, color, width, t0, t1, label: {i, dy, html with {v}, unit, at}}]
// refs: horizontal reference lines [{value, label, color, dash, labelDy, at, highlight: [t0, t1]}] labelled at the right
UI.lineChart = (parent, o = {}) => {
  const at = defAt(o), x = o.x ?? (LAY.portrait ? LAY.M + 90 : 260), y = o.y ?? 300, w = o.w ?? (LAY.portrait ? LAY.CW - 90 - 200 : 1120), h = o.h ?? 520, By = y + h;
  const n = o.series[0].values.length, yMin = o.yMin, yMax = o.yMax, lg = !!o.yLog, l10 = Math.log10;
  // x positions: by index (default), or by numeric xValues (linear or xLog); xTicks are then [[value, label]]
  const xv = o.xValues, xa = xv ? Math.min(...xv) : 0, xb = xv ? Math.max(...xv) : n - 1;
  const XV = v => x + (o.xLog ? (l10(v) - l10(xa)) / (l10(xb) - l10(xa)) : (v - xa) / (xb - xa)) * w;
  const X = i => xv ? XV(xv[i]) : x + i * w / (n - 1);
  const XT = v => xv ? XV(v) : X(v);
  const Y = v => By - (lg ? (l10(v) - l10(yMin)) / (l10(yMax) - l10(yMin)) : (v - yMin) / (yMax - yMin)) * h;   // yLog: log10 axis
  const yFmt = o.yFormat || (lg ? (v => v >= 1 && v < 1e5 ? v.toLocaleString('en-US') : `10<sup>${Math.round(l10(v))}</sup>`) : (v => v));
  const C = layer(parent); C.style.transformOrigin = `${x - 90}px ${y}px`;
  const s = svgLayer(C);
  const grid = (o.yTicks || []).map(v => sv(s, 'line', { x1: x, x2: x, y1: Y(v), y2: Y(v), stroke: 'var(--grid)' }));
  const ylab = (o.yTicks || []).map(v => add(C, `<div class="abs tab" style="left:${x - 86}px;width:68px;text-align:right;top:${Y(v) - TYPE.label * .64}px;font-size:${TYPE.label}px;color:var(--dim)">${yFmt(v)}</div>`));
  const ax = sv(s, 'line', { x1: x, x2: x, y1: By, y2: By, stroke: 'var(--ink)', 'stroke-width': 1.2 });
  const xl = (o.xTicks || []).map(([i, l]) => add(C, `<div class="abs nowrap tab" style="left:${XT(i) - 60}px;width:120px;text-align:center;top:${By + 14}px;font-size:${TYPE.label}px;color:var(--dim)">${o.xFormat ? o.xFormat(l) : l}</div>`));
  const xt = o.xTitle ? add(C, `<div class="abs" style="left:${x}px;width:${w}px;text-align:center;top:${By + TYPE.label + 26}px;font-size:${TYPE.label}px;color:var(--dim)">${o.xTitle}</div>`) : null;
  // y title: rotated, centered on yTitleX (default: just left of the tick labels)
  const ytx = o.yTitleX ?? x - 104 - TYPE.label * .5;
  const yt = o.yTitle ? add(C, `<div class="abs nowrap" style="left:${ytx - 250}px;top:${(y + By) / 2 - TYPE.label * .64}px;width:500px;text-align:center;font-size:${TYPE.label}px;color:var(--dim)">${o.yTitle}</div>`) : null;
  const R = (o.refs || []).map((r, i) => {
    const c = r.color || 'neutral', col = fillOf(c);
    const ln = sv(s, 'line', { x1: x, x2: x, y1: Y(r.value), y2: Y(r.value), stroke: col, 'stroke-width': 1.5, 'stroke-dasharray': r.dash ?? '5 5' });
    const lb = add(C, `<div class="abs nowrap" style="left:${x + w + 18}px;top:${Y(r.value) - TYPE.label2 * .64 + (r.labelDy || 0)}px;font-size:${TYPE.label2}px;color:${colorOf(c)};transform-origin:left center">${r.label || ''}</div>`);
    return { r, ln, lb, ti: r.at ?? at + .6 + i * .13 };
  });
  const S_ = o.series.map((se, si) => {
    const d = se.values.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
    const col = fillOf(se.color || 'accent'), wd = se.width ?? 3;
    const p = sv(s, 'path', { d, pathLength: 1, fill: 'none', stroke: col, 'stroke-width': wd, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
    const m = se.markers === false ? [] : se.values.map((v, i) => sv(s, 'circle', { cx: X(i), cy: Y(v), r: wd + 1.2, fill: col, stroke: 'var(--bg)', 'stroke-width': 2 }));
    // cumulative path length at each point, so markers and the value label follow the drawn line exactly
    const cum = [0];
    for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(X(i) - X(i - 1), Y(se.values[i]) - Y(se.values[i - 1])));
    const idxAt = k => { const L = k * cum[n - 1]; let i = 0; while (i < n - 2 && cum[i + 1] < L) i++; return i + clamp((L - cum[i]) / ((cum[i + 1] - cum[i]) || 1)); };
    const t0 = se.t0 ?? at + .5 + si * .3, t1 = se.t1 ?? t0 + 3;
    let lab = null, vEl = null;
    if (se.label) {
      const [pre, post] = (se.label.html || se.name || '').split('{v}');
      lab = add(C, `<div class="abs nowrap" style="left:${X(se.label.i) - 30}px;top:${Y(se.values[se.label.i]) + (se.label.dy ?? 18)}px;font-size:${se.label.size ?? TYPE.body}px;font-weight:600;color:${colorOf(base(se.color))}">${pre}${post !== undefined ? `<span class="tab v" style="color:var(--ink)"></span>${post}` : ''}</div>`);
      vEl = $('.v', lab);
    }
    if (o.sound !== false) sfx('blip', t0, { f0: 300, f1: 1100, dur: Math.min(1.6, t1 - t0), gain: .3 });
    return { se, p, m, t0, t1, lab, vEl, cum, idxAt };
  });
  return comp({ el: C, X, XV, Y, update: t => {
    ax.setAttribute('x2', x + w * P(t, at, 1.1, ease.inOutCubic));
    grid.forEach((g, i) => g.setAttribute('x2', x + w * P(t, at + .1 + i * .06, 1.1, ease.inOutCubic)));
    ylab.forEach((e, i) => A(e, rise(t, at + .2 + i * .05, .6, 6)));
    xl.forEach((e, i) => A(e, rise(t, at + .4 + i * .05, .6, 6)));
    if (xt) A(xt, rise(t, at + .7)); if (yt) A(yt, { o: P(t, at + .7, .6), r: -90 });
    R.forEach(({ r, ln, lb, ti }) => {
      ln.setAttribute('x2', x + w * P(t, ti, 1.0, ease.inOutCubic));
      const hl = r.highlight ? win(t, r.highlight[0], r.highlight[1], .25, .5) : 0;
      ln.setAttribute('stroke-width', 1.5 + 1.5 * hl);
      lb.style.fontWeight = hl > .5 ? 600 : 400;
      A(lb, rise(t, ti + .2, .8, 0));
    });
    S_.forEach(({ se, p, m, t0, t1, lab, vEl, cum, idxAt }) => {
      const k = P(t, t0, t1 - t0, ease.inOutSine), drawn = k * cum[n - 1];
      draw(p, k);
      m.forEach((c, i) => { c.style.opacity = t >= t0 && cum[i] <= drawn + .5 ? 1 : 0; });
      if (lab) {
        A(lab, rise(t, se.label.at ?? t0 + 1.2));
        if (vEl) { const f = idxAt(k), i = Math.min(n - 2, Math.floor(f)); vEl.textContent = lerp(se.values[i], se.values[i + 1], f - i).toFixed(se.label.decimals ?? 1) + (se.label.unit ?? ''); }
      }
    });
  } });
};

// ================================================================ time axes and lanes
// Horizontal time axis. Returns X(value). marks: [{value, label}] small markers above the axis (e.g. "today").
UI.timeline = (parent, o = {}) => {
  const at = defAt(o), x0 = o.x0 ?? LAY.M, x1 = o.x1 ?? LAY.R, y = o.y ?? LAY.bottom - 80, from = o.from, to = o.to, step = o.step ?? 1;
  const X = v => x0 + (v - from) / (to - from) * (x1 - x0);
  const L = layer(parent), s = svgLayer(L);
  const axis = sv(s, 'line', { x1: x0, y1: y, x2: x0, y2: y, stroke: 'var(--ink)', 'stroke-width': 1.2 });
  const ticks = [], labs = {};
  for (let v = Math.ceil(from); v <= to + 1e-9; v += step) {
    ticks.push(sv(s, 'line', { x1: X(v), y1: y, x2: X(v), y2: y + 7, stroke: 'var(--ink)', 'stroke-width': 1 }));
    if (Math.round((v - Math.ceil(from)) / step) % (o.labelEvery ?? 1) === 0)
      labs[v] = add(L, `<div class="abs tab" style="left:${X(v) - 40}px;top:${y + 14}px;width:80px;text-align:center;font-size:${TYPE.label}px;color:var(--dim)">${o.format ? o.format(v) : v}</div>`);
  }
  const marks = (o.marks || []).map(m => add(L, `<div class="abs" style="left:${X(m.value) - 80}px;top:${y - TYPE.label - 26}px;width:160px;text-align:center;font-size:${TYPE.label}px;font-weight:600;color:var(--ink)">${m.label}<div style="margin:3px auto 0;width:1.5px;height:12px;background:var(--ink)"></div></div>`));
  return comp({ el: L, X, labels: labs, update: t => {
    axis.setAttribute('x2', x0 + (x1 - x0) * P(t, at, o.d ?? 1.1, ease.inOutCubic));
    ticks.forEach((e, i) => { e.style.opacity = P(t, at + .05 + i * .03, .4); });
    Object.values(labs).forEach((e, i) => { e.style.opacity = P(t, at + .1 + i * .03, .5); });
    (o.highlight || []).forEach(hh => { const e = labs[hh.value]; if (!e) return; const k = win(t, hh.t0, hh.t1 ?? 1e9, .3, .4); e.style.color = k > .5 ? colorOf(hh.color || 'ink') : 'var(--dim)'; e.style.fontWeight = k > .5 ? 650 : 400; });
    marks.forEach(m => A(m, rise(t, at + .6)));
  } });
};
// A band on a timeline (e.g. "the period a method can be evaluated on"). text inside, or textSide: 'left' to put it before the band.
// ticks: {from, to, step} adds markers under the band (model vintages, releases...).
UI.lane = (parent, o = {}) => {
  const at = defAt(o), X = o.X, x0 = X(o.from), x1 = X(o.to), y = o.y, hh = o.h ?? TYPE.body + 32, c = o.color || 'accent';
  const L = layer(parent);
  const bid = 'lane' + (++_uid);
  const bar = add(L, `<div class="abs" id="${bid}" style="left:${x0}px;top:${y}px;width:${x1 - x0}px;height:${hh}px;border-radius:6px;background:${SOFT[c] || c};border:1.5px solid ${MID[c] || c};padding:0 12px;transform-origin:left center"></div>`);
  const lab = o.label ? (o.labelAlign === 'right'
    ? add(L, `<div class="abs nowrap" style="left:${(o.labelX ?? x1) - 600}px;width:600px;text-align:right;top:${y - TYPE.label2 - 12}px;font-size:${TYPE.label2}px;font-weight:600;color:${colorOf(c)}">${o.label}</div>`)
    : add(L, `<div class="abs nowrap" style="left:${x0}px;top:${y - TYPE.label2 - 12}px;font-size:${TYPE.label2}px;font-weight:600;color:${colorOf(c)}">${o.label}</div>`)) : null;
  const txt = o.text ? (o.textSide === 'left'
    ? add(L, `<div class="abs nowrap" style="left:${x0 - 1020}px;width:1000px;top:${y + hh / 2 - TYPE.body * .64}px;text-align:right;font-size:${TYPE.body}px">${o.text}</div>`)
    : add(L, `<div class="abs nowrap" data-within="${bid}" style="left:${x0}px;width:${x1 - x0}px;top:${y + hh / 2 - TYPE.body * .64}px;text-align:center;font-size:${TYPE.body}px">${o.text}</div>`)) : null;
  const tk = [];
  if (o.ticks) for (let v = o.ticks.from; v <= o.ticks.to + 1e-9; v += (o.ticks.step ?? 1))
    tk.push(add(L, `<div class="abs" style="left:${X(v) - 1}px;top:${y + hh + 6}px;width:1.5px;height:16px;background:${fillOf(c)};transform-origin:top"><div style="position:absolute;left:-3.5px;top:16px;width:8.5px;height:8.5px;border-radius:50%;background:${fillOf(c)}"></div></div>`));
  if (tk.length && o.sound !== false) tk.forEach((_, i) => sfx('tick', at + .3 + i * .07, { note: 81 + [0, 2, 4, 7, 9][i % 5] + 12 * Math.floor(i / 10), gain: .4, pan: -.8 + 1.6 * i / tk.length }));
  return comp({ el: L, update: t => {
    bar.style.transform = `scaleX(${P(t, at, o.d ?? 1.0, ease.inOutCubic)})`; bar.style.opacity = P(t, at, .3);
    if (lab) A(lab, rise(t, at + .05)); if (txt) A(txt, rise(t, at + (o.textDelay ?? .5)));
    tk.forEach((v, i) => { const kk = P(t, at + .3 + i * .07, .4); A(v, { o: kk, sy: kk }); });
    let dim = 1; for (const [td, lv] of (o.dim || [])) dim = lerp(dim, lv, P(t, td, .8, ease.inOutCubic));
    L.style.opacity = dim;
  } });
};
// vertical marker line (cutoff, event date...). dashed by default, label at the top
UI.marker = (parent, o = {}) => {
  const at = defAt(o), y0 = o.y0 ?? 350, y1 = o.y1 ?? 800, c = fillOf(o.color || 'bad');
  const line = add(parent, `<div class="abs" style="left:${o.x - 1}px;top:${y0}px;width:0;height:${y1 - y0}px;border-left:${o.dashed === false ? `2px solid ${c}` : `1.5px dashed ${c}`};transform-origin:${o.grow === 'up' ? 'bottom' : 'top'}"></div>`);
  const lab = o.label ? add(parent, `<div class="abs nowrap" style="${o.labelAlign === 'center' ? `left:${o.x - 200}px;width:400px;text-align:center;` : o.labelAlign === 'left' ? `left:${o.x + 10}px;` : `left:${o.x - 410}px;width:400px;text-align:right;`}top:${y0 - TYPE.label - 12}px;font-size:${TYPE.label}px;font-weight:600;color:${colorOf(o.color || 'bad')}">${o.label}</div>`) : null;
  return comp({ el: line, update: t => {
    line.style.transform = `scaleY(${P(t, at - .2, .8, ease.inOutCubic)})`; line.style.opacity = P(t, at - .2, .2) * (o.out ? 1 - P(t, o.out, .4) : 1);
    if (lab) A(lab, out(rise(t, at), t, o.out));
  } });
};

// ================================================================ diagrams
// Boxes connected by arrows. nodes: [{id, x, y, w, h, html, kind: 'card'|'key'|'chip', at}]
// ('key' = emphasized box with an accent border). edges: [{from, to, at}] right edge -> left edge, or {path: 'M..', at}
UI.flow = (parent, o = {}) => {
  const at = defAt(o), L = layer(parent), s = svgLayer(L), N = {};
  const mk = arrowDefs(s, 'ar' + (++_uid), 'var(--faint)');
  (o.nodes || []).forEach((n, i) => {
    const ti = n.at ?? at + i * .2, kind = n.kind === 'core' ? 'key' : (n.kind || 'card');
    let el;
    if (kind === 'chip') {
      el = add(L, `<div class="abs chip" style="left:${n.x}px;top:${n.y}px">${n.dot === false ? '' : '<span class="dot"></span>'}${n.html}</div>`);
      if (o.sound !== false) sfx('tick', ti, { note: 74 + (i % 4) * 3, gain: .6, pan: .5 });
    } else {
      el = add(L, `<div class="abs card" style="left:${n.x}px;top:${n.y}px;width:${n.w}px;${n.h ? `height:${n.h}px;` : ''}padding:${n.pad ?? '18px 24px'};${kind === 'key' ? 'border:2px solid var(--accent);background:var(--accent-soft);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;' : ''}">${n.html}</div>`);
    }
    N[n.id] = { n: { h: kind === 'chip' ? (LAY.portrait ? 54 : 46) : n.h, w: n.w ?? 0, ...n }, el, ti, kind };
  });
  const E_ = (o.edges || []).map(e => {
    let d = e.path;
    if (!d) {
      const a = N[e.from].n, b = N[e.to].n;
      const ax = a.x + (a.w || 0) + 6, ay = a.y + (a.h || 0) / 2, bx = b.x - 8, by = b.y + (b.h || 0) / 2, mx = (ax + bx) / 2;
      d = Math.abs(ay - by) < 2 ? `M${ax},${ay} L${bx},${by}` : `M${ax},${ay} C${mx},${ay} ${mx},${by} ${bx},${by}`;
    }
    const p = sv(s, 'path', { d, pathLength: 1, fill: 'none', stroke: e.color ? fillOf(e.color) : 'var(--faint)', 'stroke-width': 1.6, 'marker-end': e.arrow === false ? '' : mk });
    return { p, ti: e.at ?? (N[e.to] ? N[e.to].ti - .2 : at) };
  });
  return comp({ el: L, nodes: N, update: t => {
    Object.values(N).forEach(({ el, ti, kind }) => { const k = P(t, ti, .8); A(el, { o: k, x: (1 - k) * (kind === 'chip' ? 16 : -16) }); });
    E_.forEach(({ p, ti }) => { const k = P(t, ti, .8, ease.inOutCubic); draw(p, k); p.style.opacity = k > 0 ? 1 : 0; });
  } });
};

// Numbered step panels laid out left to right with arrows between them. Returns boxes [{x, y, w}] for visuals.
UI.steps = (parent, o = {}) => {
  const at = defAt(o), x = o.x ?? LAY.M, y = o.y ?? 262, w = o.w ?? LAY.CW, gap = o.gap ?? 90, n = o.steps.length;
  const pw = o.widths || Array(n).fill((w - gap * (n - 1)) / n);
  const L = layer(parent); let cx = x;
  const boxes = [], K = [], CH = [];
  o.steps.forEach((st, i) => {
    boxes.push({ x: cx, y: y + 38, w: pw[i] });
    K.push({ el: add(L, `<div class="abs nowrap" style="left:${cx}px;top:${y - 4}px;font-size:${TYPE.body}px;font-weight:600"><span style="color:var(--accent-text)">${i + 1}</span>&nbsp;&nbsp;${st.title}</div>`), ti: st.at ?? at + i * .8 });
    if (i < n - 1 && o.chevrons !== false && !(Array.isArray(o.chevrons) && !o.chevrons[i]))
      CH.push({ el: add(L, `<div class="abs" style="left:${cx + pw[i] + gap / 2 - 14}px;top:${y + (o.chevY ?? 145)}px;font-size:30px;color:var(--faint)">→</div>`), ti: (o.steps[i + 1].at ?? at + (i + 1) * .8) - .3 });
    cx += pw[i] + gap;
  });
  return comp({ el: L, boxes, update: t => { K.forEach(k => A(k.el, rise(t, k.ti - .3))); CH.forEach(c => A(c.el, rise(t, c.ti, .6, 0))); } });
};
// matrix of values (embeddings, attention, features) in a diverging accent/contrast colormap; sweeps in column by column
UI.heatmap = (parent, o = {}) => {
  const at = defAt(o), cols = o.cols ?? 16, rows = o.rows ?? 11, cw = o.cell ?? 24, ch = o.cellH ?? 20, g = o.gap ?? 3;
  const L = add(parent, `<div class="abs" style="left:${o.x ?? LAY.M}px;top:${o.y ?? 300}px"></div>`);
  const r = rng(o.seed ?? 5), cells = [];
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const v = o.values ? o.values[i][j] : Math.sin(j * .9 + i * .37) * .45 + (r() - .5) * 1.1;
    const a = clamp(Math.abs(v)) * .85 + .08;
    const c = v > 0 ? `rgba(var(--accent-rgb),${a})` : `rgba(var(--contrast-rgb),${a * .85})`;
    cells.push([j, add(L, `<div class="abs" style="left:${j * (cw + g)}px;top:${i * (ch + g)}px;width:${cw}px;height:${ch}px;border-radius:2px;background:${c}"></div>`)]);
  }
  return comp({ el: L, update: t => cells.forEach(([j, e]) => { e.style.opacity = P(t, at + j * (o.sweep ?? .04), .45); }) });
};
// bundle of random walks (illustrative "many strategies / runs / samples"); returns end y values
UI.walks = (parent, o = {}) => {
  const at = defAt(o), x = o.x ?? 700, y = o.y ?? 431, w = o.w ?? 500, n = o.n ?? 34, steps = o.steps ?? 60;
  const s = svgLayer(parent), r = rng(o.seed ?? 21), paths = [], ends = [];
  for (let k = 0; k < n; k++) {
    let yy = 0, d = `M${x},${y}`; const sd = 4 + r() * 6;
    for (let i = 1; i <= steps; i++) { yy += (r() - .5) * sd * 1.6; d += ` L${(x + i * w / steps).toFixed(1)},${(y + yy).toFixed(1)}`; }
    ends.push(y + yy);
    paths.push(sv(s, 'path', { d, pathLength: 1, fill: 'none', stroke: o.color || 'var(--neutral-mid)', 'stroke-width': 1.1, opacity: .55 + r() * .35 }));
  }
  return comp({ el: s, ends, endX: x + w, update: t => paths.forEach((p, k) => draw(p, P(t, at + k * .012, o.d ?? 1.4, ease.inOutCubic))) });
};
// lines converging from (fromX, ys[i]) to one point (toX, toY)
UI.converge = (parent, o = {}) => {
  const at = defAt(o), s = svgLayer(parent);
  const P_ = o.ys.map(y => sv(s, 'path', { d: `M${o.fromX},${y.toFixed(1)} C${o.fromX + 84},${y.toFixed(1)} ${o.toX - 80},${o.toY} ${o.toX},${o.toY}`, pathLength: 1, fill: 'none', stroke: o.color || 'var(--neutral-mid)', 'stroke-width': 1.1, opacity: .7 }));
  return comp({ el: s, update: t => P_.forEach((p, k) => draw(p, P(t, at + k * .008, o.d ?? .9, ease.inOutCubic))) });
};
// one rising curve (illustrative performance / cumulative return)
UI.curve = (parent, o = {}) => {
  const at = defAt(o), x = o.x ?? 1380, y = o.y ?? 450, steps = o.steps ?? 46, dx = (o.w ?? 368) / steps;
  const s = svgLayer(parent), r = rng(o.seed ?? 3);
  let yy = 0, d = `M${x},${y}`;
  for (let i = 1; i <= steps; i++) { yy += (o.drift ?? -2.3) + (r() - .5) * (o.noise ?? 8); d += ` L${(x + i * dx).toFixed(1)},${(y + yy).toFixed(1)}`; }
  const p = sv(s, 'path', { d, pathLength: 1, fill: 'none', stroke: fillOf(o.color || 'accent'), 'stroke-width': o.width ?? 3, 'stroke-linejoin': 'round' });
  return comp({ el: s, update: t => draw(p, P(t, at, o.d ?? 1.8, ease.inOutCubic)) });
};

// ================================================================ collections
// Grid of chips that light up in a diagonal wave (checkpoints, datasets, languages...).
UI.chipGrid = (parent, o = {}) => {
  const at = defAt(o), x = o.x ?? (LAY.portrait ? LAY.M : 340), y = o.y ?? 300, cw = o.cellW ?? 108, ch = o.cellH ?? TYPE.label + 36, gx = o.gapX ?? 10, gy = o.gapY ?? 24;
  const L = layer(parent), rows = o.rows || [''], cols = o.cols || [];
  const RL = rows.map((n, r) => add(L, `<div class="abs" style="left:${o.labelX ?? LAY.M}px;top:${y + r * (ch + gy) + ch / 2 - TYPE.body * .64}px;font-size:${TYPE.body}px;font-weight:600;color:var(--accent-text)">${n}</div>`));
  const cells = [];
  rows.forEach((_, r) => cols.forEach((c, j) => {
    const t0 = at + .1 + (j + r * (o.rowLag ?? 1.6)) * (o.wave ?? .07);
    cells.push({ t0, el: add(L, `<div class="abs tab box" style="left:${x + j * (cw + gx)}px;top:${y + r * (ch + gy)}px;width:${cw}px;height:${ch}px;border-radius:8px;border:1px solid var(--rule);background:var(--paper);display:flex;align-items:center;justify-content:center;font-size:${o.size ?? TYPE.label}px;font-weight:500">${o.text ? o.text(r, j) : c}</div>`) });
    if (o.sound !== false && j % 2 === 0) sfx('tick', t0, { note: 86 + [0, 2, 4, 7, 9, 12][(j / 2) % 6] - 5 * r, gain: .3, pan: -.7 + j * .12 });
  }));
  return comp({ el: L, update: t => {
    RL.forEach((e, i) => A(e, rise(t, at + i * .1, .6, 6)));
    cells.forEach(({ t0, el }) => {
      A(el, { o: P(t, t0, .45) });
      const lit = P(t, t0 + .1, .5);
      el.style.borderColor = lit > .5 ? 'var(--accent-mid)' : 'var(--rule)';
      el.style.background = lit > .5 ? 'var(--accent-soft)' : 'var(--paper)';
    });
  } });
};
// Items pass a gate and are kept (slide through) or dropped (fade away). items: [{text, keep}]
UI.filter = (parent, o = {}) => {
  const P_ = LAY.portrait, at = defAt(o), x = o.x ?? LAY.M, y = o.y ?? 338, w = o.w ?? (P_ ? 430 : 560), hh = o.h ?? (P_ ? 124 : 92);
  const rg = o.rowGap ?? hh + 40, gateX = o.gateX ?? (P_ ? LAY.M + 460 : 1000), keepX = o.keepX ?? (P_ ? LAY.M + 490 : 1080);
  const L = layer(parent);
  const gate = add(L, `<div class="abs" style="left:${gateX}px;top:${y - 16}px;width:2px;height:${(o.items.length - 1) * rg + hh + 32}px;background:var(--ink);transform-origin:top"></div>`);
  const gl = add(L, `<div class="abs" style="left:${gateX - 200}px;width:400px;top:${y - TYPE.label2 - 30}px;text-align:center;font-size:${TYPE.label2}px;font-weight:600">${o.label ?? 'Filter'}</div>`);
  const gc = o.caption ? add(L, `<div class="abs" style="left:${gateX - 300}px;width:600px;top:${y + (o.items.length - 1) * rg + hh + 30}px;text-align:center;font-size:${TYPE.label}px;color:var(--dim)">${o.caption}</div>`) : null;
  const I = o.items.map((it, i) => {
    const c = add(L, `<div class="abs card" style="left:${x}px;top:${y + i * rg}px;width:${w}px;height:${hh}px;padding:0 24px;display:flex;align-items:center;justify-content:space-between;gap:14px;font-size:${o.size ?? TYPE.body}px">
       <span style="line-height:1.22">${it.text}</span><span class="badge" style="flex:none;font-size:${TYPE.kicker}px;font-weight:700;letter-spacing:.08em;padding:5px 10px;border-radius:5px;color:${it.keep ? 'var(--good)' : 'var(--bad)'};background:${it.keep ? 'var(--good-soft)' : 'var(--bad-soft)'}">${it.keep ? (o.keepLabel ?? 'KEEP') : (o.dropLabel ?? 'DROP')}</span></div>`);
    const tm = at + .45 + i * (o.spacing ?? .5), tv = tm + .75;
    if (o.sound !== false) sfx('blip', tv, it.keep ? { f0: 660, f1: 990, dur: .22, gain: .8 } : { f0: 400, f1: 200, dur: .3, gain: .8 });
    return { it, c, badge: $('.badge', c), ti: at - .15 + i * .2, tm, tv };
  });
  return comp({ el: L, update: t => {
    gate.style.transform = `scaleY(${P(t, at - .1, .8, ease.inOutCubic)})`;
    A(gl, rise(t, at + .1)); if (gc) A(gc, rise(t, at + .3));
    I.forEach(({ it, c, badge, ti, tm, tv }) => {
      const ki = P(t, ti, .7), km = P(t, tm, .8, ease.inOutCubic), kv = P(t, tv, .3), kf = P(t, tv + .2, .9, ease.inOutCubic);
      let dx = (1 - ki) * -30 + km * (gateX - 12 - x - w), op = ki;
      if (it.keep) dx += kf * (keepX - (gateX - 12 - w)); else op = ki * (1 - .7 * kf);
      A(c, { o: op, x: dx });
      badge.style.opacity = kv;
      c.style.borderColor = kv > .5 ? (it.keep ? 'var(--good)' : 'var(--bad)') : 'var(--rule)';
      c.style.textDecoration = !it.keep && kf > .5 ? 'line-through' : 'none';
    });
  } });
};
// A run sweeping through ordered cells (years, epochs, stages) with a playhead,
// optional chips appearing under each cell and a synced counter: {x, y, to, decimals, suffix, label, size}
UI.progress = (parent, o = {}) => {
  const t0 = o.t0 ?? defAt(o), t1 = o.t1 ?? t0 + 8, x0 = o.x ?? LAY.M, w = o.w ?? LAY.CW, y = o.y ?? 560, gap = o.gap ?? 6, n = o.cells.length;
  const cw = (w - (n - 1) * gap) / n, cx = i => x0 + i * (cw + gap), ch = o.cellH ?? TYPE.body + 44;
  const cfs = o.cellSize ?? TYPE.body, chs = o.chipSize ?? TYPE.label, chH = chs + 20;
  const L = layer(parent);
  const cells = o.cells.map((c, i) => add(L, `<div class="abs tab box" style="left:${cx(i)}px;top:${y}px;width:${cw}px;height:${ch}px;border-radius:6px;border:1px solid var(--rule);background:var(--paper);display:flex;align-items:center;justify-content:center;font-size:${cfs}px;font-weight:500;overflow:hidden">
      <div class="fill" style="position:absolute;left:0;top:0;bottom:0;width:100%;background:var(--accent-soft);transform-origin:left;transform:scaleX(0)"></div><span style="position:relative">${c}</span></div>`));
  const fills = cells.map(c => $('.fill', c));
  const chips = (o.chips || []).map((c, i) => add(L, `<div class="abs box" style="left:${cx(i)}px;top:${y + ch + 40}px;width:${cw}px;height:${chH}px;border-radius:999px;border:1px solid var(--accent-mid);background:var(--paper);display:flex;align-items:center;justify-content:center;font-size:${chs}px;font-weight:500;color:var(--accent-text)">${c}</div>`));
  const stems = (o.chips || []).map((_, i) => add(L, `<div class="abs" style="left:${cx(i) + cw / 2}px;top:${y + ch + 1}px;width:1.5px;height:38px;background:var(--accent-mid);transform-origin:top"></div>`));
  const head = add(L, `<div class="abs" style="left:0;top:${y - 26}px;width:2px;height:${ch + 52}px;background:var(--ink)"></div>`);
  const cnt = o.counter ? UI.counter(L, { at: (o.counter.at ?? t0 - .7), t0, t1, from: 0, to: o.counter.to, decimals: o.counter.decimals ?? 2, suffix: o.counter.suffix, label: o.counter.label, x: o.counter.x ?? LAY.M - 4, y: o.counter.y ?? 150, size: o.counter.size ?? (LAY.portrait ? 120 : 132), ease: ease.inOutSine }) : null;
  if (o.sound !== false) (o.chips || []).forEach((_, i) => {  // chip sounds: invert the playhead law
    const u = (i * (cw + gap) + cw / 2) / w, v = Math.acos(1 - 2 * u) / Math.PI;
    sfx('tick', t0 + v * (t1 - t0) + .08, { note: [74, 76, 78, 81, 83, 86][i % 6] + 12 * Math.floor(i / 6), gain: .8, pan: -.8 + 1.6 * i / n });
  });
  const prog = t => ease.inOutSine(clamp((t - t0) / (t1 - t0)));
  return comp({ el: L, prog, counter: cnt, update: t => {
    const px = x0 + w * prog(t);
    cells.forEach((c, i) => { A(c, rise(t, t0 - .5 + i * .05, .6, 8)); fills[i].style.transform = `scaleX(${clamp((px - cx(i)) / cw)})`; });
    chips.forEach((c, i) => { const k = clamp((px - cx(i) - cw * .5) / 60); A(c, { o: k, y: (1 - k) * -6 }); stems[i].style.transform = `scaleY(${ease.outCubic(k)})`; });
    A(head, { o: P(t, t0 - .3, .4) * (1 - P(t, t1 + .3, .5)), x: px - 1 });
  } });
};
// Table with staggered rows. cols: [{label, w, align}], rows: [{cells: [...], highlight, dim}], best: [[r, c], ...]
UI.table = (parent, o = {}) => {
  const at = defAt(o), x = o.x ?? LAY.M, y = o.y ?? 300, size = o.size ?? TYPE.body, rh = o.rowH ?? Math.round(size * 2.2);
  const L = layer(parent), best = new Set((o.best || []).map(([r, c]) => `${r},${c}`));
  const W_ = o.cols.reduce((a, c) => a + c.w, 0);
  const row = (cells, style) => `<div class="abs" style="left:${x}px;width:${W_}px;display:flex;${style}">${cells}</div>`;
  const head = add(L, row(o.cols.map(c => `<div style="width:${c.w}px;text-align:${c.align ?? 'right'};padding:0 14px">${c.label}</div>`).join(''), `top:${y}px;font-size:${TYPE.label}px;font-weight:600;color:var(--dim)`));
  const rule = add(L, `<div class="abs" style="left:${x}px;top:${y + TYPE.label + 14}px;width:${W_}px;height:1.5px;background:var(--ink);transform-origin:left"></div>`);
  const R = o.rows.map((r, i) => {
    const cells = r.cells.map((v, j) => `<div class="tab box" style="width:${o.cols[j].w}px;text-align:${o.cols[j].align ?? 'right'};padding:0 14px;${best.has(`${i},${j}`) ? 'color:var(--accent-text);font-weight:700;' : ''}">${v}</div>`).join('');
    const el = add(L, row(cells, `top:${y + TYPE.label + 24 + i * rh}px;height:${rh - 6}px;align-items:center;font-size:${size}px;border-bottom:1px solid var(--grid);${r.highlight ? 'background:var(--accent-soft);font-weight:600;' : ''}${r.dim ? 'color:var(--dim);' : ''}`));
    return { el, ti: r.at ?? at + .3 + i * (o.stagger ?? .12) };
  });
  return comp({ el: L, update: t => {
    A(head, rise(t, at)); rule.style.transform = `scaleX(${P(t, at + .1, .9, ease.inOutCubic)})`;
    R.forEach(({ el, ti }) => A(el, rise(t, ti, .6, 8)));
  } });
};
// A figure image (PNG from the paper; see `pmv figures`). kb: [scale0, scale1] slow zoom over the scene.
UI.figure = (parent, o = {}) => {
  const at = defAt(o), end = sceneEnd();
  const el = add(parent, `<div class="abs ${o.card === false ? '' : 'card'}" style="left:${o.x ?? (LAY.portrait ? LAY.M : 360)}px;top:${o.y ?? 230}px;width:${o.w ?? (LAY.portrait ? LAY.CW : 1200)}px;padding:${o.card === false ? 0 : (o.pad ?? 24)}px;overflow:hidden">
      <img src="${o.src}" style="display:block;width:100%;height:auto;transform-origin:${o.origin || '50% 50%'}">${o.caption ? `<div style="font-size:${TYPE.label}px;color:var(--dim);margin-top:12px">${o.caption}</div>` : ''}</div>`);
  const img = $('img', el), kb = o.kb || [1, 1.03];
  return comp({ el, update: t => { A(el, out(rise(t, at, .9), t, o.out)); img.style.transform = `scale(${lerp(kb[0], kb[1], P(t, at, end - at, ease.lin))})`; } });
};

// ================================================================ annotations
UI.stamp = (parent, o = {}) => {
  const at = defAt(o), c = colorOf(o.color || 'bad');
  const el = add(parent, `<div class="abs nowrap" style="left:${o.x}px;top:${o.y}px;padding:6px 12px;border:2px solid ${c};border-radius:6px;color:${c};font-size:${o.size ?? TYPE.label}px;font-weight:700;letter-spacing:.08em;transform-origin:center">${o.text}</div>`);
  sfx('thud', at + .1);
  return comp({ el, update: t => { const k = P(t, at + .1, .4, ease.outBack); A(el, { o: clamp(k * 1.5), s: 1.2 - .2 * k, r: o.rot ?? -3 }); } });
};
UI.strike = (parent, o = {}) => {
  const at = defAt(o);
  const el = add(parent, `<div class="abs" style="left:${o.x}px;top:${o.y}px;width:${o.w}px;height:2.5px;background:${fillOf(o.color || 'bad')};transform-origin:left center"></div>`);
  return comp({ el, update: t => { el.style.transform = `scaleX(${P(t, at, .35)})`; el.style.opacity = P(t, at, .08); } });
};
// vertical bracket with a label, e.g. the gap between two values ("+28 pts")
UI.bracket = (parent, o = {}) => {
  const at = defAt(o), c = fillOf(o.color || 'accent'), left = o.side === 'left';
  const el = add(parent, `<div class="abs" style="left:${o.x}px;top:${Math.min(o.y0, o.y1)}px;width:9px;height:${Math.abs(o.y1 - o.y0)}px;border:1.5px solid ${c};${left ? 'border-right:0' : 'border-left:0'};transform-origin:top"></div>`);
  const lab = o.label ? add(parent, `<div class="abs nowrap tab" style="${left ? `left:${o.x + 18}px;` : `left:${o.x - 6 - (o.labelW ?? 170)}px;width:${o.labelW ?? 170}px;text-align:right;`}top:${o.labelY ?? (o.y0 + o.y1) / 2 - (o.size ?? TYPE.label2) * .64}px;font-size:${o.size ?? TYPE.label2}px;font-weight:650;color:${colorOf(base(o.color || 'accent'))}">${o.label}</div>`) : null;
  return comp({ el, update: t => { el.style.transform = `scaleY(${P(t, at, .6, ease.inOutCubic)})`; el.style.opacity = P(t, at, .2); if (lab) A(lab, rise(t, at + .3, .6)); } });
};
// columns of top -> bottom pairs joined by arrows (e.g. "model of year t-1 reads the news of year t")
UI.pairs = (parent, o = {}) => {
  const at = defAt(o), cols = o.cols, w = o.colW ?? 190, x0 = o.x ?? 290, dx = o.dx ?? 223, yT = o.yTop ?? 330, yB = o.yBot ?? 510;
  const hT = o.topH ?? 76, cx = i => x0 + i * dx, st = o.stagger ?? .2;
  const L = layer(parent), s = svgLayer(L), mk = arrowDefs(s, 'ar' + (++_uid), 'var(--accent)');
  const T = cols.map((c, i) => add(L, `<div class="abs card" style="left:${cx(i) - w / 2}px;top:${yT}px;width:${w}px;height:${hT}px;padding:11px 0;text-align:center;border-color:var(--accent-mid);background:var(--accent-soft)">${c.top}</div>`));
  const B = cols.map((c, i) => add(L, `<div class="abs card" style="left:${cx(i) - w / 2}px;top:${yB}px;width:${w}px;height:${o.botH ?? 100}px;padding:14px 0;text-align:center">${c.bottom}</div>`));
  const ar = cols.map((_, i) => sv(s, 'path', { d: `M${cx(i)},${yT + hT + 6} L${cx(i)},${yB - 9}`, pathLength: 1, stroke: 'var(--accent)', 'stroke-width': 1.6, fill: 'none', 'marker-end': mk }));
  return comp({ el: L, update: t => {
    T.forEach((c, i) => A(c, rise(t, at + i * st, .7))); B.forEach((c, i) => A(c, rise(t, at + .25 + i * st, .7)));
    ar.forEach((a, i) => { const k = P(t, at + .45 + i * st, .6, ease.inOutCubic); draw(a, k); a.style.opacity = k > 0 ? 1 : 0; });
  } });
};
// move/scale any component container over time (e.g. shrink a chart to make room): identity -> {x, y, s}
UI.move = (el, o = {}) => comp({ update: t => {
  const k = P(t, o.at, o.d ?? 1.0, ease.inOutCubic);
  if (o.origin) el.style.transformOrigin = o.origin;
  el.style.transform = `translate(${(o.x ?? 0) * k}px,${(o.y ?? 0) * k}px) scale(${1 + ((o.s ?? 1) - 1) * k})`;
} });

// An arrow along any path, drawn on at `at`: {path: 'M x y C ...'} or {from: [x, y], to: [x, y], bend: -1..1}; d = draw duration
UI.arrow = (parent, o = {}) => {
  const at = defAt(o), s_ = svgLayer(parent), col = fillOf(o.color || 'faint');
  let d = o.path;
  if (!d) {
    const [x1, y1] = o.from, [x2, y2] = o.to, b = o.bend ?? 0, mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    d = b ? `M${x1},${y1} Q${mx - (y2 - y1) * b},${my + (x2 - x1) * b} ${x2},${y2}` : `M${x1},${y1} L${x2},${y2}`;
  }
  const mk = o.head === false ? '' : arrowDefs(s_, 'ar' + (++_uid), col);
  const p = sv(s_, 'path', { d, pathLength: 1, fill: 'none', stroke: col, 'stroke-width': o.width ?? 1.8, 'marker-end': mk, 'stroke-dasharray': o.dashed ? '6 5' : '' });
  return comp({ el: s_, update: t => { const k = P(t, at, o.d ?? .7, ease.inOutCubic); if (!o.dashed) draw(p, k); else p.style.clipPath = `inset(0 ${(1 - k) * 100}% 0 0)`; p.style.opacity = k > 0 ? 1 : 0; } });
};
