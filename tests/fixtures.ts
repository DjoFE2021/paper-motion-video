import type { Files, Run } from '../hooks/snapshot'

// A session in the middle of `pmv all`: landscape renders, after a review that found two issues in the portrait cut.

export const NOW = 1_800_000_000_000
export const PROJECT = '/home/me/Desktop/pit-video'
export const DIR = '/tmp/claude-pmv-progress/session-1'
export const CONFIG = {
  title: 'Scaling <em>Point-in-Time</em> Language Models',
  video: { targetSeconds: 120, formats: ['landscape', 'portrait'] },
}

const step = (name: string, format: string | null, done = 0, total: number | null = null) => ({
  name,
  format,
  preview: false,
  done,
  total,
  unit: total ? 'frames' : null,
  startedAt: NOW - 100_000,
})

export const RENDERING: Run = {
  command: 'all',
  args: ['all', PROJECT, '--skip-narrate'],
  project: PROJECT,
  state: 'running',
  startedAt: NOW - 200_000,
  updatedAt: NOW - 500,
  step: step('render', 'landscape', 2360, 3787),
  steps: [],
}

export const REVIEWED: Run = {
  command: 'review',
  args: ['review', PROJECT],
  project: PROJECT,
  state: 'done',
  startedAt: NOW - 400_000,
  updatedAt: NOW - 300_000,
  endedAt: NOW - 300_000,
  step: null,
  steps: [
    { ...step('review', 'landscape', 33, 33), ok: true, endedAt: NOW - 350_000 },
    { ...step('review', 'portrait', 33, 33), ok: true, endedAt: NOW - 300_000 },
  ],
}

export const at = (ago: number, content?: unknown, size = 100) => ({ mtimeMs: NOW - ago, size, content })

export const FILES: Files = {
  'config.json': at(900_000, undefined),
  'facts.md': at(850_000),
  'script.txt': at(820_000),
  'build/timeline.json': at(800_000, { duration: 126.2, cues: { h1: { words: [1, 2, 3] }, h2: { words: [4, 5] } } }),
  'scenes.js': at(700_000),
  'scenes.portrait.js': at(700_000),
  'build/review/audit.txt': at(350_000, 'no layout issues found'),
  'build/portrait/review/audit.txt': at(300_000, 't= 41.50 [r2]  text overlap\nt= 63.00 [s1]  texts touch'),
}
