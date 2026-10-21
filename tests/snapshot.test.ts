import { expect, test } from 'claude-code/testing'

import { buildSnapshot } from '../hooks/snapshot'
import { at, CONFIG, FILES, NOW, PROJECT, RENDERING, REVIEWED } from './fixtures'

test('mid-render: the step, its share and each stage', () => {
  const snap = buildSnapshot([RENDERING, REVIEWED], PROJECT, CONFIG, FILES, NOW)
  expect(snap.title).toBe('Scaling Point-in-Time Language Models')
  expect(snap.about).toBe('2:00 target · landscape + portrait · voice af_heart')
  expect(snap.now?.label).toBe('Rendering landscape')
  expect(snap.now?.detail).toBe('2360/3787 frames · about 1:00 left') // 1427 frames at 100 s per 2360
  expect(snap.status).toBe('video pit-video: rendering landscape 62%')
  const [facts, narration, scenes, review, render] = snap.rows
  expect(facts?.mark).toBe('done')
  expect(narration?.detail).toBe('2:06 · target 2:00 · 5 words')
  expect(scenes?.mark).toBe('done')
  expect(review?.mark).toBe('issues')
  expect(review?.rows.map(r => r.detail)).toEqual(['round 1 · clean', 'round 1 · 2 layout issues'])
  expect(render?.rows.map(r => r.mark)).toEqual(['active', 'todo'])
})

test('an edit after a step asks for that step again', () => {
  const files = { ...FILES, 'script.txt': at(10_000), 'scenes.portrait.js': at(200_000) }
  const snap = buildSnapshot([REVIEWED], PROJECT, CONFIG, files, NOW)
  expect(snap.now).toBeNull()
  expect(snap.rows[1]?.mark).toBe('stale')
  expect(snap.rows[3]?.rows[1]).toEqual({ mark: 'stale', label: 'portrait', detail: 'round 1 · scenes changed since', rows: [] })
  expect(snap.last).toBe('pmv review finished 5 min ago')
})

test('a run whose record went quiet was stopped, not running', () => {
  const quiet = { ...RENDERING, updatedAt: NOW - 600_000 }
  expect(buildSnapshot([REVIEWED, quiet], PROJECT, CONFIG, FILES, NOW).now).toBeNull()
})

test('a finished video', () => {
  const files = {
    ...FILES,
    'build/video.mp4': at(200_000),
    'build/portrait/video.mp4': at(150_000),
    'out/pit-video.mp4': at(100_000, undefined, 42e6),
    'out/pit-video_portrait.mp4': at(90_000, undefined, 12e6),
    'build/check/report.json': at(50_000, { problems: [], notes: ['file: 1920x1080 @ 60.0 fps'] }),
    'build/portrait/check/report.json': at(40_000, { problems: ['t= 3.00 ghost'], notes: ['file: 1080x1350 @ 30.0 fps'] }),
  }
  const done = { ...RENDERING, state: 'done' as const, step: null, updatedAt: NOW - 30_000, endedAt: NOW - 30_000 }
  const snap = buildSnapshot([done, REVIEWED], PROJECT, CONFIG, files, NOW)
  const [, , , , render, pack, check] = snap.rows
  expect(render?.mark).toBe('done')
  expect(pack?.rows[0]?.detail).toBe('pit-video.mp4 · 42.0 MB')
  expect(check?.rows.map(r => `${r.mark} ${r.detail}`)).toEqual(['done all passed', 'issues 1 problem'])
  expect(snap.status).toBe('video pit-video: final check needs a look')
})
