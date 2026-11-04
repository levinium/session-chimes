import type { EngineInterface, Register } from 'claude-code'

type Chime = 'done' | 'attention'

// Tools that always stop and wait for the person.
const ASKS_PERSON = /^(AskUserQuestion|ExitPlanMode)$/

// One prompt can reach both tool.check and tool.call; chime once.
const DEDUPE_MS = 1500
let lastAttention = 0

const isWindows = (root: string) => /^[A-Za-z]:[\\/]/.test(root)

// $.audio.play has no player on Windows, so hand the file to PowerShell there.
async function play($: EngineInterface, chime: Chime) {
  const asset = `sounds/${chime}.wav`
  if (!isWindows($.plugin.root)) return $.audio.play({ asset })

  const file = `${$.plugin.root}\\sounds\\${chime}.wav`.replace(/'/g, "''")
  await $.process.run(
    [
      'powershell.exe',
      '-NoProfile',
      '-NonInteractive',
      '-WindowStyle',
      'Hidden',
      '-Command',
      `(New-Object System.Media.SoundPlayer '${file}').PlaySync()`,
    ],
    { timeoutMs: 10_000 },
  )
}

function chime($: EngineInterface, which: Chime) {
  if (which === 'attention') {
    const now = Date.now()
    if (now - lastAttention < DEDUPE_MS) return
    lastAttention = now
  }
  play($, which).catch(err => $.ui.log(`${$.plugin.name}: could not play ${which}: ${err}`))
}

export const register: Register = on => {
  // Main loop finished: a soft chime. Errors leave it stuck, so they ask for you.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined || e.reason === 'aborted') return result
    chime($, e.reason === 'answer' ? 'done' : 'attention')
    return result
  })

  // A permission prompt is about to be shown.
  on('tool.check', async ($, e, next) => {
    const verdict = await next(e)
    if (verdict.decision === 'ask' && e.tool_use_id !== undefined && e.approver !== undefined) {
      chime($, 'attention')
    }
    return verdict
  }).catch(($, e, next) => next(e))

  // A question or plan approval waits on the person.
  on('tool.call', { tool: ASKS_PERSON }, ($, e, next) => {
    chime($, 'attention')
    return next(e)
  }).catch(($, e, next) => next(e))
}
