// Starter scenes, portrait 4:5 (1080x1350), the phone cut. Same cues and scene order as scenes.js,
// laid out in one column. Keep text >= TYPE.min and inside LAY.M..LAY.R, LAY.top..LAY.bottom.
// See examples/pit-llm/scenes.portrait.js for a complete phone layout of a two-minute video.

scene('hook', -1, E('q') + .5, el => {
  UI.kinetic(el, 'hook', { top: 400, lines: [{ n: 6, size: 40 }, { n: 4, size: 104, top: 470 }], emph: [8, 9], out: S('q') - .45 });
  UI.kinetic(el, 'q', { top: 420, lines: [{ n: 4, size: 44 }, { n: 3, size: 116, top: 490 }], emph: [5, 6] });
}, { fi: .01, label: '01 — Question', energy: .35 });

scene('title', E('q') + .25, S('res1') - .15, el => {
  UI.titleCard(el, { at: E('q') + .25 });
}, { fi: .35, label: '', energy: .5 });

scene('result', S('res1') - .4, S('res2') - .25, el => {
  UI.headline(el, 'Accuracy <em>improves</em>', { at: S('res1') - .2 });
  UI.hbars(el, { at: S('res1'), title: 'Accuracy on the main benchmark (%)', y: 420, max: 100, rows: [
    { label: 'Previous best', tag: 'baseline', value: 61, color: 'neutral', at: W('res1', '61%') - .2 },
    { label: 'Our method', tag: 'this work', value: 78, color: 'accent', bold: true, at: W('res1', '78%') - .2 }] });
}, { label: '02 — Results', energy: .7 });

scene('scaling', S('res2') - .4, S('tab') - .25, el => {
  UI.headline(el, 'The gain grows with <em>scale</em>', { at: S('res2') - .2 });
  UI.text(el, 'accuracy (%)', { y: 340, size: TYPE.label, color: 'dim', at: S('res2') });
  UI.lineChart(el, { at: S('res2'), y: 400, h: 520, yMin: 50, yMax: 90, yTicks: [50, 70, 90],
    xTicks: [[0, '100M'], [2, '1B'], [4, '10B']], xTitle: 'model size',
    refs: [{ value: 61, label: 'Previous best', color: 'neutral' }],
    series: [{ name: 'Ours', color: 'accent', width: 4, values: [58, 64, 70, 75, 78], t0: S('res2') + .3, t1: E('res2'),
      label: { i: 2, dy: 22, unit: '%', html: 'Ours&nbsp;&nbsp;{v}' } }] });
}, { energy: .75 });

scene('table', S('tab') - .4, S('end') - .25, el => {
  UI.headline(el, 'Every benchmark', { at: S('tab') - .2 });
  UI.table(el, { at: S('tab'), y: 380, cols: [{ label: 'Model', w: 380, align: 'left' }, { label: 'A', w: 180 }, { label: 'B', w: 180 }, { label: 'C', w: 180 }],
    rows: [{ cells: ['Previous best', '61.0', '44.2', '70.3'], dim: true }, { cells: ['Strong baseline', '66.4', '47.9', '72.0'] },
           { cells: ['Our method', '78.0', '55.1', '81.6'], highlight: true }], best: [[2, 1], [2, 2], [2, 3]] });
}, { energy: .7 });

scene('end', S('end') - .4, DUR + 1, el => {
  UI.endCard(el, { at: S('end') - .2, tagline: 'Code and data are open.' });
}, { fo: .01, label: '03 — Open', energy: .5 });
