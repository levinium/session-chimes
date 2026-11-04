# session-chimes

A Claude Code mod that plays a sound when a session needs you, so you can tell from across the room which kind of attention it wants:

| When | Sound |
|---|---|
| A session finishes its task and stops | `sounds/done.wav`, a soft two-note rising chime |
| A permission prompt, a question from Claude (`AskUserQuestion`), or a plan waiting for approval | `sounds/attention.wav`, three brighter notes |
| A turn ends on an error | `sounds/attention.wav` |

Nothing plays when you interrupt a turn yourself, or when a subagent finishes. No system notification is shown.

To use your own sounds, replace the two `.wav` files with your own, keeping the names.

On Windows, each chime is played through a hidden `powershell.exe` (`System.Media.SoundPlayer`), since Claude Code has no audio player of its own there. On macOS it uses `afplay`.

## Install

At the prompt of a Claude Code session, add the marketplace, then install from it:

```
/plugin marketplace add levinium/session-chimes
```

```
/plugin install session-chimes@session-chimes
```

Pick the user scope so it loads in every session on this computer.

From a shell:

```bash
claude plugin marketplace add levinium/session-chimes
```

```bash
claude plugin install session-chimes@session-chimes
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `levinium/session-chimes`, then Add plugin.

## License

MIT
