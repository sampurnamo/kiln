# Codex Runtime Operations

## Runtime Modes

- `claude`: installs into `~/.claude` layout, protocol in `CLAUDE.md`
- `codex`: installs into `~/.codex/kilntwo` layout, protocol in `AGENTS.md`
- `hybrid`: installs both runtime targets

## Safe Smoke Test Pattern

Use a sandbox `--home` and a disposable project directory.

```powershell
kilntwo install --runtime hybrid --home C:\temp\kiln-home --json
kilntwo doctor --runtime hybrid --home C:\temp\kiln-home --json
kilntwo update --runtime hybrid --home C:\temp\kiln-home --json
kilntwo uninstall --runtime hybrid --home C:\temp\kiln-home --json
```

## Real-Project Safety Pattern

When testing against a real project:

1. Capture before hashes of `CLAUDE.md` and `AGENTS.md`.
2. Run lifecycle with sandbox `--home`.
3. Capture after hashes.
4. Confirm exact equality.

This is mandatory for confidence that protocol insertion/removal is non-destructive.

## Current Verified Behavior

- `claude`: install/update/doctor/uninstall verified
- `codex`: install/update/doctor/uninstall verified
- `hybrid`: install/update/doctor/uninstall verified
- Marker round-trip preserves line endings and surrounding file bytes

## Troubleshooting

### Doctor warnings in `claude` mode

`teams-enabled` warning is non-fatal when `~/.claude/settings.json` lacks teams config.

### CLI command not found

- Claude CLI: `npm i -g @anthropic-ai/claude-code`
- Codex CLI: `npm i -g @openai/codex`

### Runtime mismatch

Use explicit runtime everywhere in automation:

- `install --runtime ...`
- `doctor --runtime ...`
- `update --runtime ...`
- `uninstall --runtime ...`

Do not rely on defaults in multi-runtime environments.
