import type { Mark, ProgressNow, ProgressRow, ProgressSnapshot } from '../types'

// What the pane shows, worked out from plain data: the session's pmv runs and the project's files, which
// register.tsx reads. Nothing here touches the engine.

/** A step of a pmv run, as tools/common.py's Run records it. */
type Step = {
  name: string
  format: string | null
  preview: boolean
  done: number
  total: number | null
  unit: string | null
  startedAt: number
}

/** One pmv run: the file `<startedAt>-<pid>.json` in the session's PMV_PROGRESS_DIR. */
export type Run = {
  command: string
  args: string[]
  project: string | null
  state: 'running' | 'done' | 'failed'
  error?: string | null
  output?: string
  pages?: number
  startedAt: number
  updatedAt: number
  endedAt?: number
  step: Step | null
  steps: (Step & { ok: boolean; endedAt: number })[]
}

export type Config = {
  title?: string
  output?: string
  video?: { targetSeconds?: number; formats?: string[] }
  voice?: { name?: string }
}

/** A project file as found: its time and size, and what it parsed to when it is one the checklist reads. */
export type Found = { mtimeMs: number; size: number; content?: unknown }

/** The project's files by path relative to the project; a missing file is absent. */
export type Files = Record<string, Found | undefined>

type Timeline = { duration: number; cues: Record<string, { words: unknown[] }> }

type Report = { problems: string[]; notes: string[] }

const SIZES: Record<string, [number, number]> = {
  landscape: [1920, 1080],
  portrait: [1080, 1350],
  vertical: [1080, 1920],
  square: [1080, 1080],
}
const STEPS: Record<string, string> = {
  narrate: 'Narrating',
  review: 'Reviewing',
  stills: 'Rendering stills',
  music: 'Mixing the sound',
  render: 'Rendering',
  package: 'Packaging',
  check: 'Final check',
  preview: 'Writing the preview page',
}
const WORDS: Record<Mark, string> = {
  todo: 'to do',
  active: 'in progress',
  partial: 'in progress',
  done: 'done',
  issues: 'needs a look',
  stale: 'needs a re-run',
  failed: 'failed',
}
const QUIET_MS = 120_000 // a run whose record has not changed for this long was stopped
const EDITING_MS = 180_000 // a file the agent saved this recently is being worked on

export const clock = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const ago = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000))
  return s < 60 ? 'just now' : s < 3600 ? `${Math.round(s / 60)} min ago` : `${Math.round(s / 3600)} h ago`
}

const baseName = (path: string) => path.split(/[\\/]/).filter(Boolean).pop() ?? path

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** The words that fit a target length, as budget() in tools/common.py counts them. */
const budget = (seconds: number) => {
  const talk = Math.max(seconds - 6, 10)
  return `${5 * Math.round((2.05 * talk) / 5)}–${5 * Math.round((2.2 * talk) / 5)} words`
}

const formatsOf = (config: Config) => (config.video?.formats?.length ? config.video.formats : ['landscape'])
const buildOf = (f: string) => (f === 'landscape' ? 'build' : `build/${f}`)
const scenesOf = (f: string) => (f === 'landscape' ? 'scenes.js' : `scenes.${f}.js`)
const outOf = (config: Config, project: string, f: string) =>
  `${config.output ?? baseName(project)}${f === 'landscape' ? '' : `_${f}`}`

const row = (mark: Mark, label: string, detail = '', rows: ProgressRow[] = []): ProgressRow => ({
  mark,
  label,
  detail,
  rows,
})

/** A stage over its formats: with one format the stage is that format's line, with several they go under it. */
function stage(label: string, lines: ProgressRow[]): ProgressRow {
  const [first] = lines
  if (lines.length === 1 && first) return { ...first, label }
  const marks = lines.map(line => line.mark)
  const urgent = (['failed', 'active', 'issues', 'stale'] as const).find(mark => marks.includes(mark))
  const mark = urgent ?? (marks.every(m => m === 'done') ? 'done' : marks.includes('done') ? 'partial' : 'todo')
  return row(mark, label, '', lines)
}

/** The project the session's pmv runs touched last: runs come most recently updated first. */
export const projectOf = (runs: Run[]) => runs.find(run => run.project)?.project ?? undefined

/** The files the checklist looks at, relative to the project, and how to parse the ones it reads. */
export function projectFiles(config: Config, project: string): { path: string; parse?: 'text' | 'json' }[] {
  return [
    { path: 'facts.md' },
    { path: 'script.txt' },
    { path: 'build/timeline.json', parse: 'json' },
    ...formatsOf(config).flatMap(f => [
      { path: scenesOf(f) },
      { path: `${buildOf(f)}/review/audit.txt`, parse: 'text' as const },
      { path: `${buildOf(f)}/video.mp4` },
      { path: `${buildOf(f)}/preview.mp4` },
      { path: `out/${outOf(config, project, f)}.mp4` },
      { path: `out/${outOf(config, project, f)}_preview.mp4` },
      { path: `${buildOf(f)}/check/report.json`, parse: 'json' as const },
    ]),
  ]
}

/**
 * The checklist of `project`: what pmv runs now (with its count and the time left), each stage from the project's
 * own files, and what the last run came to. `runs` are the session's, most recently updated first.
 */
export function buildSnapshot(runs: Run[], project: string, config: Config, files: Files, now: number): ProgressSnapshot {
  const mine = runs.filter(run => run.project === project)
  const running = mine.find(run => run.state === 'running' && now - run.updatedAt < QUIET_MS)
  const finished = mine.find(run => run.state !== 'running')
  const created = mine.find(run => run.command === 'new')
  const formats = formatsOf(config)
  const target = config.video?.targetSeconds ?? 120
  const out = (f: string) => outOf(config, project, f)

  // the template's files count as written once the agent saved them after `pmv new` copied them
  const madeAt = created && !created.args.includes('--example') ? (created.endedAt ?? created.updatedAt) + 2000 : 0
  const isWritten = (s: Found | undefined) => s !== undefined && s.mtimeMs > madeAt
  const isEditing = (s: Found | undefined) => isWritten(s) && now - (s?.mtimeMs ?? 0) < EDITING_MS
  const stepOf = (name: string, f: string | null) =>
    running?.step?.name === name && running.step.format === f ? running.step : undefined
  const doneSteps = (name: string, f: string) =>
    mine.flatMap(run => run.steps).filter(s => s.name === name && s.format === f && s.ok && !s.preview)
  const percent = (s: Step) => (s.total ? `${Math.floor((100 * Math.min(s.done, s.total)) / s.total)}%` : 'running')

  const facts = files['facts.md']
  const factsRow =
    facts === undefined
      ? row('todo', 'Fact sheet')
      : row(isEditing(facts) ? 'active' : 'done', 'Fact sheet', `facts.md · ${ago(now - facts.mtimeMs)}`)

  const script = files['script.txt']
  const timelineFile = files['build/timeline.json']
  const timeline = timelineFile?.content as Timeline | undefined
  const narrating = stepOf('narrate', null)
  let narration: ProgressRow
  if (narrating) {
    narration = row('active', 'Narration', `${narrating.done}/${narrating.total ?? '?'} sentences`)
  } else if (timeline && timelineFile) {
    const said = Object.values(timeline.cues).reduce((n, cue) => n + cue.words.length, 0)
    narration =
      script && script.mtimeMs > timelineFile.mtimeMs + 1000
        ? row('stale', 'Narration', 'script.txt changed since: run pmv narrate')
        : row('done', 'Narration', `${clock(timeline.duration)} · target ${clock(target)} · ${said} words`)
  } else if (isEditing(script)) {
    narration = row('active', 'Narration', `writing script.txt · about ${budget(target)}`)
  } else {
    narration = row('todo', 'Narration', `target ${clock(target)} · about ${budget(target)}`)
  }

  const scenes = formats.map(f => {
    const scene = files[scenesOf(f)]
    if (scene === undefined) return row('todo', f, `${scenesOf(f)} missing`)
    if (isEditing(scene)) return row('active', f, `editing ${scenesOf(f)}`)
    return isWritten(scene) ? row('done', f, `${scenesOf(f)} · ${ago(now - scene.mtimeMs)}`) : row('todo', f, 'the template')
  })

  const review = formats.map(f => {
    const s = stepOf('review', f)
    if (s) return row('active', f, `${s.done}/${s.total ?? '?'} stills`)
    const audit = files[`${buildOf(f)}/review/audit.txt`]
    const text = audit?.content as string | undefined
    if (audit === undefined || text === undefined) return row('todo', f)
    const rounds = doneSteps('review', f).length
    const round = rounds ? `round ${rounds} · ` : ''
    const scene = files[scenesOf(f)]
    if (scene && scene.mtimeMs > audit.mtimeMs) return row('stale', f, `${round}scenes changed since`)
    const issues = text === 'no layout issues found' ? 0 : text.split('\n').length
    return issues ? row('issues', f, `${round}${plural(issues, 'layout issue')}`) : row('done', f, `${round}clean`)
  })

  const render = formats.map(f => {
    const s = stepOf('render', f)
    if (s) return row('active', f, `${s.preview ? 'preview ' : ''}${percent(s)}`)
    const video = files[`${buildOf(f)}/video.mp4`]
    if (video === undefined) return row('todo', f, files[`${buildOf(f)}/preview.mp4`] ? 'preview only' : '')
    const inputs = Math.max(
      timelineFile?.mtimeMs ?? 0,
      files[scenesOf(f)]?.mtimeMs ?? 0,
      files['config.json']?.mtimeMs ?? 0,
    )
    if (inputs > video.mtimeMs) return row('stale', f, 'scenes or narration changed since')
    const last = doneSteps('render', f)[0]
    return row('done', f, last ? `rendered in ${clock((last.endedAt - last.startedAt) / 1000)}` : 'rendered')
  })

  const pack = formats.map(f => {
    const s = stepOf('package', f)
    if (s) return row('active', f, s.preview ? 'preview' : 'muxing')
    const final = files[`out/${out(f)}.mp4`]
    if (final === undefined) return row('todo', f, files[`out/${out(f)}_preview.mp4`] ? 'preview only' : '')
    const video = files[`${buildOf(f)}/video.mp4`]
    if (video && video.mtimeMs > final.mtimeMs) return row('stale', f, 'older than the render')
    return row('done', f, `${out(f)}.mp4 · ${(final.size / 1e6).toFixed(1)} MB`)
  })

  const check = formats.map(f => {
    const s = stepOf('check', f)
    if (s) return row('active', f, s.preview ? 'preview' : 'checking the video')
    const report = files[`${buildOf(f)}/check/report.json`]
    const found = report?.content as Report | undefined
    if (report === undefined || found === undefined) return row('todo', f)
    const [w, h] = SIZES[f] ?? [0, 0]
    const isPreview = (found.notes[0] ?? '').includes(`${w / 2}x${h / 2}`)
    const checked = files[`out/${out(f)}${isPreview ? '_preview' : ''}.mp4`]
    if (checked && checked.mtimeMs > report.mtimeMs) return row('stale', f, 'video changed since: run pmv check')
    const n = found.problems.length
    if (isPreview) return row('todo', f, n ? `preview: ${plural(n, 'problem')}` : 'preview passed')
    return n ? row('issues', f, plural(n, 'problem')) : row('done', f, 'all passed')
  })

  const rows = [
    factsRow,
    narration,
    stage('Scenes', scenes),
    stage('Review', review),
    stage('Render', render),
    stage('Package', pack),
    stage('Final check', check),
  ]

  let current: ProgressNow | null = null
  const s = running?.step
  if (running && s) {
    const total = s.total ?? 0
    const spent = now - s.startedAt
    const left = total && s.done > total / 50 ? ` · about ${clock(((spent / s.done) * (total - s.done)) / 1000)} left` : ''
    current = {
      label: `${STEPS[s.name] ?? s.name}${s.format ? ` ${s.format}` : ''}${s.preview ? ' (preview)' : ''}`,
      detail: total ? `${s.done}/${total} ${s.unit ?? ''}${left}` : `${clock(spent / 1000)} so far`,
      done: s.done,
      total,
    }
  } else if (running) {
    current = { label: `pmv ${running.command}`, detail: 'starting', done: 0, total: 0 }
  }

  const ended = finished ? ago(now - (finished.endedAt ?? finished.updatedAt)) : ''
  const failure = (finished?.error ?? '').split('\n')[0]?.slice(0, 160) ?? ''
  const last = !finished
    ? ''
    : finished.state === 'failed'
      ? `pmv ${finished.command} failed ${ended}: ${failure}`
      : `pmv ${finished.command} finished ${ended}`

  const text = runs.find(run => run.command === 'text' && run.output)
  const reached = [...rows].reverse().find(r => r.mark !== 'todo')
  const name = baseName(project)
  const pct = s?.total ? ` ${percent(s)}` : ''
  return {
    title: (config.title ?? name).replace(/<[^>]*>/g, ''),
    about: `${clock(target)} target · ${formats.join(' + ')} · voice ${config.voice?.name ?? 'af_heart'}`,
    path: project,
    paper: text?.output ? `paper text: ${baseName(text.output)}${text.pages ? ` · ${text.pages} pages` : ''}` : '',
    now: current,
    rows,
    last,
    status: current
      ? `video ${name}: ${current.label.toLowerCase()}${pct}`
      : `video ${name}: ${reached ? `${reached.label.toLowerCase()} ${WORDS[reached.mark]}` : 'set up'}`,
  }
}
