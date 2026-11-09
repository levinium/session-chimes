import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { ChimeEvent, Settings } from '../types'

const PANE = 'chimes'
const STORE_KEY = 'settings'

const SOUNDS = [
  { value: 'robot-statement', label: 'Robot: statement' },
  { value: 'robot-question', label: 'Robot: question' },
  { value: 'robot-grumble', label: 'Robot: grumble' },
  { value: 'chime', label: 'Chime' },
  { value: 'triple', label: 'Triple ping' },
  { value: 'bell', label: 'Bell' },
  { value: 'marimba', label: 'Marimba' },
  { value: 'ping', label: 'Two-tone ping' },
  { value: 'pop', label: 'Pop' },
  { value: 'descend', label: 'Descending' },
  { value: 'pad', label: 'Soft pad' },
] as const

const CHOICES = [...SOUNDS, { value: 'custom', label: 'Custom .wav…' }, { value: 'off', label: 'Off' }]

const EVENTS: readonly { id: ChimeEvent; label: string }[] = [
  { id: 'done', label: 'Finished' },
  { id: 'attention', label: 'Needs input' },
  { id: 'error', label: 'Error' },
]

const DEFAULTS: Settings = {
  sounds: { done: 'robot-statement', attention: 'robot-question', error: 'robot-grumble' },
  custom: { done: '', attention: '', error: '' },
  volume: 100,
  leadMs: 1000,
  isMuted: false,
}

const settings = atom({ plugin: 'session-chimes', key: 'settings' } as const, DEFAULTS, {
  shape: 'settings-1',
})

// Tools that always stop and wait for the person.
const ASKS_PERSON = /^(AskUserQuestion|ExitPlanMode)$/

// One prompt can reach both tool.check and tool.call; chime once.
const DEDUPE_MS = 1500
let lastAttention = 0

const isWindows = (root: string) => /^[A-Za-z]:[\\/]/.test(root)

// Fills in what an older or partial stored value leaves out.
function withDefaults(stored: unknown): Settings {
  const s = (stored ?? {}) as Partial<Settings>
  return {
    sounds: { ...DEFAULTS.sounds, ...s.sounds },
    custom: { ...DEFAULTS.custom, ...s.custom },
    volume: typeof s.volume === 'number' ? s.volume : DEFAULTS.volume,
    leadMs: typeof s.leadMs === 'number' ? s.leadMs : DEFAULTS.leadMs,
    isMuted: s.isMuted === true,
  }
}

async function save($: EngineInterface, change: (s: Settings) => Settings) {
  await update($, settings, s => change(withDefaults(s)))
  await $.store.set(STORE_KEY, await read($, settings))
}

// The file for an event's sound, or undefined when it plays nothing.
function fileFor($: EngineInterface, s: Settings, event: ChimeEvent): string | undefined {
  const choice = s.sounds[event]
  if (choice === 'off') return undefined
  if (choice === 'custom') return s.custom[event].trim().replace(/^"(.*)"$/, '$1') || undefined
  const sep = isWindows($.plugin.root) ? '\\' : '/'
  return `${$.plugin.root}${sep}sounds${sep}${choice}.wav`
}

async function play($: EngineInterface, s: Settings, event: ChimeEvent) {
  const file = fileFor($, s, event)
  if (file === undefined) return

  if (isWindows($.plugin.root)) {
    // $.audio.play has no player on Windows, so hand the file to PowerShell there.
    await $.process.run(
      [
        'powershell.exe',
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-WindowStyle',
        'Hidden',
        '-File',
        `${$.plugin.root}\\scripts\\play.ps1`,
        '-Path',
        file,
        '-Volume',
        String(s.volume),
        '-LeadMs',
        String(s.leadMs),
      ],
      { timeoutMs: 30_000 },
    )
    return
  }

  const gain = s.volume / 100
  if (s.sounds[event] !== 'custom') return $.audio.play({ asset: `sounds/${s.sounds[event]}.wav` }, { gain })
  const { base64 } = await $.fs.read(file, { as: 'bytes' })
  return $.audio.play({ base64, mime: 'audio/wav' }, { gain })
}

async function chime($: EngineInterface, event: ChimeEvent) {
  if (event !== 'done') {
    const now = Date.now()
    if (now - lastAttention < DEDUPE_MS) return
    lastAttention = now
  }
  const s = withDefaults(await read($, settings))
  if (s.isMuted) return
  await play($, s, event)
}

function preview($: EngineInterface, event: ChimeEvent) {
  read($, settings)
    .then(s => play($, withDefaults(s), event))
    .catch(err => $.ui.toast(`Could not play: ${err}`))
}

function quietly($: EngineInterface, event: ChimeEvent) {
  chime($, event).catch(err => $.ui.log(`${$.plugin.name}: could not play ${event}: ${err}`))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'chimes',
      description: 'Choose the sounds session-chimes plays',
    })
    const stored = await $.store.get(STORE_KEY)
    if (stored !== undefined) await update($, settings, () => withDefaults(stored))

    return next(e)
  })

  on('command.run', { command: 'chimes' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Session chimes', focus: true })

    return { text: 'Chime settings opened.' }
  })

  // Main loop finished: the done sound. Errors leave it stuck, so they ask for you.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined || e.reason === 'aborted') return result
    quietly($, e.reason === 'answer' ? 'done' : 'error')
    return result
  })

  // A permission prompt is about to be shown.
  on('tool.check', async ($, e, next) => {
    const verdict = await next(e)
    if (verdict.decision === 'ask' && e.tool_use_id !== undefined && e.approver !== undefined) {
      quietly($, 'attention')
    }
    return verdict
  }).catch(($, e, next) => next(e))

  // A question or plan approval waits on the person.
  on('tool.call', { tool: ASKS_PERSON }, ($, e, next) => {
    quietly($, 'attention')
    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const s = withDefaults(await read($, settings))

    if (e.surface === 'mobile') {
      const { Text } = $.ui.resolve(e)
      return <Text dimColor>Open /chimes on your computer to change the sounds.</Text>
    }

    const { Box, Text, Button, Select, Input } = $.ui.resolve(e)

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="row" gap={1} alignItems="center">
          <Text bold>{s.isMuted ? 'Sounds are muted' : 'Sounds are on'}</Text>
          <Button
            key="mute"
            variant={s.isMuted ? 'primary' : 'secondary'}
            onPress={() => void save($, x => ({ ...x, isMuted: !x.isMuted }))}
          >
            {s.isMuted ? 'Unmute' : 'Mute'}
          </Button>
        </Box>

        {EVENTS.map(ev => (
          // One card per event, stacked: beside the dropdown the button overlaps it in a
          // narrow pane, and across the pane it reads as belonging to nothing.
          <Box key={`row-${ev.id}`} flexDirection="column" gap={1} borderStyle="round" borderDimColor paddingX={1}>
            <Text bold wrap="truncate-end">
              {ev.label}
            </Text>
            <Select
              key={`sound-${ev.id}`}
              options={CHOICES}
              value={s.sounds[ev.id]}
              onSelect={value => void save($, x => ({ ...x, sounds: { ...x.sounds, [ev.id]: value } }))}
            />
            <Box flexDirection="row">
              <Button key={`play-${ev.id}`} label="▶ Preview" onPress={() => preview($, ev.id)} />
            </Box>
            {s.sounds[ev.id] === 'custom' && (
              <Input
                key={`path-${ev.id}`}
                label="File"
                placeholder="C:\path\to\sound.wav"
                value={s.custom[ev.id]}
                submitLabel="save"
                onSubmit={value => void save($, x => ({ ...x, custom: { ...x.custom, [ev.id]: value.trim() } }))}
              />
            )}
          </Box>
        ))}

        <Select
          key="volume"
          label="Volume"
          options={[25, 50, 75, 100].map(v => ({ value: String(v), label: `${v}%` }))}
          value={String(s.volume)}
          onSelect={value => void save($, x => ({ ...x, volume: Number(value) }))}
        />
        <Select
          key="lead"
          label="Lead-in"
          options={[
            { value: '0', label: 'None' },
            { value: '500', label: '0.5 s' },
            { value: '1000', label: '1 s (wireless headsets)' },
            { value: '1500', label: '1.5 s' },
          ]}
          value={String(s.leadMs)}
          onSelect={value => void save($, x => ({ ...x, leadMs: Number(value) }))}
        />
        <Text dimColor>Lead-in is silence before each sound, so a headset waking from idle doesn't clip it.</Text>

        <Box flexDirection="row">
          <Button key="reset" dimColor onPress={() => void save($, () => DEFAULTS)}>
            Reset to defaults
          </Button>
        </Box>
      </Box>
    )
  })
}
