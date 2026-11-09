# session-chimes

A Claude Code mod that plays a sound when a session needs you, so you can tell from across the room which kind of attention it wants:

| When | Default sound |
|---|---|
| A session finishes its task and stops | **Robot: statement**, a calm note that settles lower |
| A permission prompt, a question from Claude (`AskUserQuestion`), or a plan waiting for approval | **Robot: question**, a note and then a rise, like a question |
| A turn ends on an error | **Robot: grumble**, a low droop |

Nothing plays when you interrupt a turn yourself, or when a subagent finishes. No system notification is shown.

## Choosing sounds

Type `/chimes` to open the settings panel beside the chat. For each event, pick one of the built-in sounds (three robot sounds, plus Chime, Triple ping, Bell, Marimba, Two-tone ping, Pop, Descending and Soft pad), a custom `.wav` file, or Off, and press ▶ Preview to hear it. The panel also sets the volume, a lead-in, and mute. Choices are saved on each computer and apply to every session there.

**Lead-in** is silence played before each sound. Wireless headsets drop the first fraction of a second while they wake from idle; the default of 1 s lets the whole sound through. Set it to None for wired speakers.

The scripts in `tools/` generate the built-in sounds, for designing new ones.

On Windows, sounds play through a hidden `powershell.exe` (`scripts/play.ps1`, which adds the lead-in and volume), since Claude Code has no audio player of its own there. On macOS it uses `afplay`.

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
