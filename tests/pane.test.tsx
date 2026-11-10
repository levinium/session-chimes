import { expect, test } from 'claude-code/testing'

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
const settle = () => new Promise(resolve => setTimeout(resolve, 50))

// Counts chimes on either player: process.run on Windows, audio.play elsewhere.
function countPlays(on: Parameters<Parameters<typeof test>[1]>[1]) {
  const plays = { count: 0 }
  on('process.run', () => {
    plays.count++
    return { value: { exitCode: 0, stdout: '', stderr: '' } }
  })
  on('audio.play', () => {
    plays.count++
    return { value: {} }
  })
  return plays
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
