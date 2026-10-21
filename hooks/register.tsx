import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { Mark, ProgressRow, ProgressSnapshot } from '../types'
import { buildSnapshot, type Config, type Files, projectFiles, projectOf, type Run } from './snapshot'

// pmv (tools/common.py) writes one record per run into PMV_PROGRESS_DIR, which this module sets for its session;
// the pane draws those records together with the project's own files, polled every second while pmv runs.
const PANE = 'video-progress'
const TITLE = 'Video progress'
const snapshot = atom({ plugin: 'paper-motion-video', key: 'snapshot' } as const, null)
const isOpened = atom({ plugin: 'paper-motion-video', key: 'isOpened' } as const, false)

const ICON: Record<Mark, string> = { todo: '○', active: '●', partial: '○', done: '✓', issues: '!', stale: '○', failed: '✗' }
const COLOR: Partial<Record<Mark, string>> = {
  active: 'claude',
  partial: 'success',
  done: 'success',
  issues: 'warning',
  stale: 'warning',
  failed: 'error',
}
const LABEL = 12 // the label column, in cells
const SHELLS = ['Bash', 'PowerShell']
const EDITS = ['Write', 'Edit', 'MultiEdit', 'NotebookEdit']

let dir: string | undefined // this session's PMV_PROGRESS_DIR
let timer: Timer | undefined // the next look: one at a time
let isPolling = false
let isLooking = false // a look is under way
let isDue = false // something changed during that look: the next one comes sooner
/** What each file parsed to at the modification time it was read at, so an unchanged file is not read again. */
const cache = new Map<string, { mtimeMs: number; value: unknown }>()

function stat($: EngineInterface, path: string) {
  return $.fs.stat(path).catch(() => undefined)
}

/** The file parsed, read again only once its modification time changed; undefined while it cannot be read. */
async function load($: EngineInterface, path: string, mtimeMs: number, parse: 'text' | 'json') {
  const hit = cache.get(path)
  if (hit?.mtimeMs === mtimeMs) return hit.value
  try {
    const text = await $.fs.read(path)
    const value: unknown = parse === 'json' ? JSON.parse(text) : text.trim()
    cache.set(path, { mtimeMs, value })
    return value
  } catch {
    return undefined
  }
}

/** The session's runs and the files of the project they touched last, worked into the pane's snapshot. */
async function look($: EngineInterface, folder: string) {
  const entries = await $.fs.list(folder).catch(() => [])
  const records = await Promise.all(
    entries
      .filter(entry => entry.kind === 'file' && entry.name.endsWith('.json'))
      .map(entry => load($, `${folder}/${entry.name}`, entry.mtimeMs, 'json')),
  )
  const runs = (records.filter(Boolean) as Run[]).sort((a, b) => b.updatedAt - a.updatedAt)
  const project = projectOf(runs)
  if (project === undefined) return null
  const configAt = await stat($, `${project}/config.json`)
  const config = ((configAt && (await load($, `${project}/config.json`, configAt.mtimeMs, 'json'))) ?? {}) as Config
  const files: Files = { 'config.json': configAt }
  await Promise.all(
    projectFiles(config, project).map(async ({ path, parse }) => {
      const at = await stat($, `${project}/${path}`)
      const content = at && parse ? await load($, `${project}/${path}`, at.mtimeMs, parse) : undefined
      files[path] = at && { mtimeMs: at.mtimeMs, size: at.size, content }
    }),
  )
  return buildSnapshot(runs, project, config, files, await $.clock.now())
}

/** Every line of the checklist, keyed by stage and format. */
const lines = (snap: ProgressSnapshot) =>
  snap.rows.flatMap(r => (r.rows.length ? r.rows.map(sub => ({ ...sub, key: `${r.label} ${sub.label}` })) : [{ ...r, key: r.label }]))

/** Toasts for what came to an end since the last look: the narration, a render, a final check, a failed run. */
function announce($: EngineInterface, before: ProgressSnapshot | null, after: ProgressSnapshot | null) {
  if (before === null || after === null) return
  const was = new Map(lines(before).map(line => [line.key, line.mark]))
  for (const { key, mark, detail } of lines(after)) {
    const isMilestone = /^(Narration|Render|Final check)/.test(key) && (mark === 'done' || mark === 'issues')
    if (isMilestone && was.get(key) !== mark) $.ui.toast(`${key}: ${detail}`)
  }
  if (after.last !== before.last && after.last.includes(' failed ')) $.ui.toast(after.last)
}

async function poll($: EngineInterface, folder: string) {
  let isBusy = false
  isLooking = true
  isDue = false
  try {
    const after = await look($, folder)
    const before = await read($, snapshot)
    isBusy = after?.now != null
    if (JSON.stringify(after) !== JSON.stringify(before)) {
      await update($, snapshot, () => after)
      $.ui.status(after?.status)
      announce($, before, after)
      if (after && !before && !(await read($, isOpened))) {
        await update($, isOpened, () => true)
        void $.ui.open({ id: PANE, title: TITLE })
      }
    }
  } catch {
    // a record or file that changed while it was read: the next look sees it whole
  }
  isLooking = false
  timer = $.clock.after(isDue ? 300 : isBusy ? 1000 : 4000, () => void poll($, folder))
}

function start($: EngineInterface) {
  if (!isPolling && dir) {
    const folder = dir
    isPolling = true
    timer = $.clock.after(0, () => void poll($, folder))
  }
}

/** Looks for the session's records soon after a pmv command ran, until the first one is there. */
function watch($: EngineInterface, folder: string) {
  for (const ms of [300, 3000, 10_000]) {
    $.clock.after(ms, () => {
      void $.fs
        .exists(folder)
        .then(isThere => {
          if (isThere) start($)
        })
        .catch(() => {})
    })
  }
}

/** After a shell command or an edit: look again soon, or watch for the records of a first pmv run. */
function nudge($: EngineInterface, isPmv: boolean) {
  if (!dir) return
  const folder = dir
  if (isLooking) {
    isDue = true
  } else if (isPolling) {
    timer?.cancel()
    timer = $.clock.after(300, () => void poll($, folder))
  } else if (isPmv) {
    watch($, folder)
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const tmp = (await $.env.get('TMPDIR')) ?? (await $.env.get('TEMP')) ?? '/tmp'
    dir = `${tmp.replace(/[\\/]+$/, '')}/claude-pmv-progress/${await $.session.id()}`
    await $.env.set('PMV_PROGRESS_DIR', dir)
    await $.command.register({
      name: 'video-progress',
      description: 'Show the paper-motion-video pane: what the agent has done and what runs now',
    })
    if (await $.fs.exists(dir)) start($)
    return next(e)
  })

  on('command.run', { command: 'video-progress' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })
    if (dir && (await $.fs.exists(dir))) start($)
    return { text: 'Opened the video progress pane.' }
  })

  // it only watches: a failure here hands the call back as it ran (or lets it run), never a second time
  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    const tool = String(e.tool)
    if (SHELLS.includes(tool)) nudge($, 'command' in e && /\bpmv\b/.test(String(e.command)))
    else if (EDITS.includes(tool)) nudge($, false)
    return ran
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const snap = await read($, snapshot)
    if (snap === null) {
      return (
        <Box flexDirection="column">
          <Text dimColor>No video project in this session yet.</Text>
          <Text dimColor>The checklist appears once the agent runs pmv.</Text>
        </Box>
      )
    }
    const line = (r: ProgressRow, indent: string) => {
      const color = COLOR[r.mark]
      return (
        <Box>
          <Text {...(color ? { color } : { dimColor: true })}>{`${indent}${ICON[r.mark]} `}</Text>
          <Text dimColor={r.mark === 'todo'}>{r.label.padEnd(LABEL - indent.length)}</Text>
          <Text dimColor wrap="truncate-end">
            {r.detail}
          </Text>
        </Box>
      )
    }
    const now = snap.now
    const size = Math.max(10, Math.min(36, e.props.bodyColumns - 6))
    const share = now && now.total ? Math.min(now.done, now.total) / now.total : 0
    const filled = Math.round(share * size)
    return (
      <Box flexDirection="column">
        <Text bold wrap="truncate-end">
          {snap.title}
        </Text>
        <Text dimColor wrap="truncate-end">
          {snap.about}
        </Text>
        <Text dimColor wrap="truncate-start">
          {snap.path}
        </Text>
        {snap.paper ? (
          <Text dimColor wrap="truncate-end">
            {snap.paper}
          </Text>
        ) : null}
        {now ? (
          <Box flexDirection="column" marginTop={1}>
            <Text color="claude" wrap="truncate-end">{`● ${now.label}`}</Text>
            {now.total ? (
              <Text>
                <Text color="claude">{'━'.repeat(filled)}</Text>
                <Text dimColor>{'─'.repeat(size - filled)}</Text>
                {` ${Math.floor(share * 100)}%`}
              </Text>
            ) : null}
            <Text dimColor wrap="truncate-end">
              {now.detail}
            </Text>
          </Box>
        ) : null}
        <Box flexDirection="column" marginTop={1}>
          {snap.rows.flatMap(r => [line(r, ''), ...r.rows.map(sub => line(sub, '  '))])}
        </Box>
        {snap.last ? (
          <Box marginTop={1}>
            <Text dimColor wrap="truncate-end">
              {snap.last}
            </Text>
          </Box>
        ) : null}
      </Box>
    )
  })
}
