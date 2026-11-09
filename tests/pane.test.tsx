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
