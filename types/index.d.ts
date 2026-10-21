/** How far a stage is: `active` while pmv runs it or the agent is editing its file, `partial` when some formats are done. */
export type Mark = 'todo' | 'active' | 'partial' | 'done' | 'issues' | 'stale' | 'failed'

/** One line of the checklist: a stage, with a line per format under it when the project has several. */
export type ProgressRow = { mark: Mark; label: string; detail: string; rows: ProgressRow[] }

/** The pmv step running now; `total` is 0 for a step without a count. */
export type ProgressNow = { label: string; detail: string; done: number; total: number }

/** The video project this session works on, as the pane draws it. */
export type ProgressSnapshot = {
  title: string
  about: string
  path: string
  paper: string
  now: ProgressNow | null
  rows: ProgressRow[]
  last: string
  status: string
}

declare module 'claude-code' {
  interface PluginState {
    'paper-motion-video': { snapshot: ProgressSnapshot | null; isOpened: boolean }
  }
}
