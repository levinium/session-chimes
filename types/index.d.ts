export type ChimeEvent = 'done' | 'attention' | 'error'

export type Settings = {
  /** Per event: a built-in sound's id, 'custom', or 'off'. */
  sounds: Record<ChimeEvent, string>
  /** Per event: the .wav path used when its sound is 'custom'. */
  custom: Record<ChimeEvent, string>
  /** 0 to 100. */
  volume: number
  /** Silence before each sound, so a waking wireless headset doesn't clip it. */
  leadMs: number
  isMuted: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'session-chimes': { settings: Shaped<Settings> }
  }
}
