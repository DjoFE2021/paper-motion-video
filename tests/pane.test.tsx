import { expect, mock, test } from 'claude-code/testing'

import { CONFIG, DIR, NOW, PROJECT, RENDERING } from './fixtures'

const PANE = {
  plugin: 'paper-motion-video',
  component: 'Pane',
  requestId: 'video-progress',
  props: {
    title: 'Video progress',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const SURFACES = ['terminal', 'desktop', 'vscode', 'mobile'] as const

test('before any pmv run the pane says what it is waiting for', async $ => {
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /No video project/ })).toBeDefined()
    await ui.unmount()
  }
})

test('the pane follows a pmv run, on every surface', async ($, on) => {
  // Nothing sits beneath the plugin: these hooks stand for the engine, the disk a session folder and a project.
  const clock = mock.clock(on, { now: NOW })
  mock.env(on, { TMPDIR: '/tmp' })
  const disk: Record<string, { text: string; mtimeMs: number }> = {
    [`${DIR}/${RENDERING.startedAt}-1.json`]: { text: JSON.stringify(RENDERING), mtimeMs: NOW - 500 },
    [`${PROJECT}/config.json`]: { text: JSON.stringify(CONFIG), mtimeMs: NOW - 900_000 },
    [`${PROJECT}/build/timeline.json`]: {
      text: JSON.stringify({ duration: 126.2, cues: { h1: { words: [1, 2] } } }),
      mtimeMs: NOW - 800_000,
    },
  }
  // the engine hands a hook the path as it resolved it (a drive and backslashes on Windows): compare without them
  const norm = (path: string) => path.replace(/\\/g, '/').replace(/^[A-Za-z]:/, '')
  const missing = (): never => {
    throw new Error('ENOENT')
  }
  const toasts: string[] = []
  const opened: string[] = []
  on('session.id', () => ({ value: 'session-1' }))
  on('env.set', () => ({ value: {} }))
  on('command.register', () => ({ value: { command: 'video-progress' } }))
  on('ui.open', (_, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('fs.exists', (_, e) => ({ value: Object.keys(disk).some(path => path.startsWith(`${norm(e.path)}/`)) }))
  on('fs.list', (_, e) => {
    const folder = `${norm(e.path)}/`
    return {
      value: Object.entries(disk)
        .filter(([path]) => path.startsWith(folder) && !path.slice(folder.length).includes('/'))
        .map(([path, file]) => ({
          name: path.slice(folder.length),
          kind: 'file' as const,
          size: file.text.length,
          mtimeMs: file.mtimeMs,
          isLink: false,
        })),
    }
  })
  on('fs.stat', (_, e) => {
    const file = disk[norm(e.path)] ?? missing()
    return { value: { kind: 'file' as const, size: file.text.length, mtimeMs: file.mtimeMs, isLink: false } }
  })
  on('fs.read', (_, e) => ({ value: (disk[norm(e.path)] ?? missing()).text }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await clock.settle()
  expect(opened).toEqual(['video-progress'])

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /Point-in-Time/ }))?.text).toBe('Scaling Point-in-Time Language Models')
    expect((await ui.find({ type: 'Text', text: /Rendering landscape/ }))?.text).toBe('● Rendering landscape')
    expect(await ui.find({ type: 'Text', text: /62%/ })).toBeDefined()
    await ui.unmount()
  }

  // the render ends: its record says so, and the next look turns it into a toast
  const done = { ...RENDERING, state: 'done', step: null, steps: [{ ...RENDERING.step, ok: true, endedAt: NOW + 1000 }] }
  disk[`${DIR}/${RENDERING.startedAt}-1.json`] = { text: JSON.stringify(done), mtimeMs: NOW + 1000 }
  disk[`${PROJECT}/build/video.mp4`] = { text: '', mtimeMs: NOW + 900 }
  await clock.advance(1000)
  expect(toasts).toEqual(['Render landscape: rendered in 1:41'])
})
