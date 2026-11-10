import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

const PANE = {
  plugin: 'session-chimes',
  component: 'Pane',
  requestId: 'chimes',
  props: {
    title: 'Session chimes',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

test('the panel shows the defaults on the desktop', async $ => {
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect((await ui.find({ type: 'Text', text: /Sounds are/ }))?.text).toBe('Sounds are on')
  expect(await ui.find({ type: 'Button', text: /Mute/ })).toBeTruthy()
  expect(await ui.find({ type: 'Button', text: /Reset/ })).toBeTruthy()
  await ui.unmount()
})

test('a stored partial value is filled in from the defaults', async ($, on) => {
  on('state.get', () => ({
    value: { value: { shape: 'settings-1', value: { isMuted: true } }, version: 1 },
  }))

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

  expect((await ui.find({ type: 'Text', text: /Sounds are/ }))?.text).toBe('Sounds are muted')
  await ui.unmount()
})

test('the phone shows a pointer instead of the controls', async $ => {
  const ui = await $.ui.mount({ ...PANE, surface: 'mobile' })

  expect((await ui.find({ type: 'Text' }))?.text).toMatch(/on your computer/)
  await ui.unmount()
})

// The chime is fired without awaiting; let it reach the player.
declare const setTimeout: (fn: () => void, ms: number) => unknown
const settle = () => new Promise<void>(resolve => setTimeout(resolve, 50))

// Counts chimes on either player (process.run on Windows, audio.play elsewhere),
// on a clock the test moves.
function countPlays(on: Parameters<TestBody>[1]) {
  const plays = { count: 0, clock: mock.clock(on, { now: 1_000_000 }) }
  on('process.run', () => {
    plays.count++
    return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('audio.play', () => {
    plays.count++
    return { value: undefined }
  })
  return plays
}

const DEPLOY = {
  id: 'b1',
  type: 'shell',
  status: 'running',
  description: 'Deploy to production',
  command: 'sf project deploy start',
}

test('a shown permission prompt chimes', async ($, on) => {
  const plays = countPlays(on)
  on('classic.PermissionRequest', () => ({}))
  await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: 'ls' } })
  await settle()
  expect(plays.count).toBe(1)
})

test('a question put to the person chimes', async ($, on) => {
  const plays = countPlays(on)
  on('tool.call', { tool: 'AskUserQuestion' }, () => ({ result: { answers: {} } }))
  await $.tool.call({ tool: 'AskUserQuestion', questions: [] })
  await settle()
  expect(plays.count).toBe(1)
})

test('a turn that ends with nothing pending chimes done', async ($, on) => {
  const plays = countPlays(on)
  on('classic.Stop', () => ({}))
  await $.classic.Stop({ stop_hook_active: false, background_tasks: [], session_crons: [] })
  await settle()
  expect(plays.count).toBe(1)
})

test('a turn that ends waiting on background work stays quiet', async ($, on) => {
  const plays = countPlays(on)
  on('classic.Stop', () => ({}))
  await $.classic.Stop({ stop_hook_active: false, background_tasks: [DEPLOY], session_crons: [] })
  await settle()
  expect(plays.count).toBe(0)
})

test('a scheduled wake-up counts as waiting', async ($, on) => {
  const plays = countPlays(on)
  on('classic.Stop', () => ({}))
  await $.classic.Stop({
    stop_hook_active: false,
    background_tasks: [],
    session_crons: [{ id: 'c1', schedule: '*/5 * * * *', recurring: true, prompt: 'check the deploy' }],
  })
  await settle()
  expect(plays.count).toBe(0)
})

test('the turn the work wakes chimes once nothing is left', async ($, on) => {
  const plays = countPlays(on)
  on('classic.Stop', () => ({}))
  await $.classic.Stop({ stop_hook_active: false, background_tasks: [DEPLOY], session_crons: [] })
  await $.classic.Stop({ stop_hook_active: false, background_tasks: [], session_crons: [] })
  await settle()
  expect(plays.count).toBe(1)
})

test('a stop another hook blocks is not the end', async ($, on) => {
  const plays = countPlays(on)
  on('classic.Stop', () => ({ block: 'keep going' }))
  await $.classic.Stop({ stop_hook_active: false, background_tasks: [], session_crons: [] })
  await settle()
  expect(plays.count).toBe(0)
})
