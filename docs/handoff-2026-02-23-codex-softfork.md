# Handoff — Kiln-Codex Soft-Fork (2026-02-23)

## Session Outcome

Kiln-Codex overlay is implemented and pushed to:

- Repo: `https://github.com/sampurnamo/kiln`
- Branch: `feature/codex-native-overlay`

This branch is intentionally maintained as a soft fork overlay, not an upstream replacement PR.

## Commit Stack (Current)

1. `fb3e93e` — `[upstream-candidate] Relax data-file count assertion in install E2E`
2. `1fa7af0` — `[fork-only] Add Codex-native runtime overlay and soft-fork policy`
3. `e7cb76f` — `[upstream-candidate] Preserve line endings for protocol insert/remove round-trips`

## What Was Added

- Runtime mode support: `--runtime claude|codex|hybrid`
- Runtime-aware install/update/uninstall/doctor behavior
- Runtime-specific protocol targets:
  - `claude` -> `<project>/CLAUDE.md`
  - `codex` -> `<project>/AGENTS.md`
  - `hybrid` -> both
- Codex protocol asset: `assets/protocol-codex.md`
- Provider/runtime profile scaffold:
  - `assets/data/default-config.json` (runtime + executor/providers blocks)
  - `assets/data/runtime-profiles.json`
- Soft-fork policy doc: `docs/CODEX-FORK-STRATEGY.md`

## Critical Fix Applied

`src/markers.js` now preserves original line endings and exact surrounding content during protocol insert/remove.

Why: uninstall round-trip previously altered `CLAUDE.md` formatting/newline bytes even when logical content was restored.

## Validation Completed

Focused tests passing:

- `node --test test/paths.test.js test/doctor.test.js test/install.e2e.test.js`
- `node --test test/markers.test.js`

Real project hybrid smoke test completed against:

- `C:/Users/shiva/Documents/NinjaTrader 8/bin/Custom/Strategies/QuantuumLeap`
- using sandbox `--home` temp directory
- sequence: install -> doctor -> update -> uninstall
- result: successful and byte-identical restoration verified for `CLAUDE.md` and `AGENTS.md` presence/hash state.

## Known State / Caveats

- Full upstream test suite still has pre-existing asset/contract failures unrelated to this overlay (brownfield/contract checks).
- Upstream remote fetch from this shell may fail with Windows credential transport error (`SEC_E_NO_CREDENTIALS`) depending on terminal context.

## Resume Checklist

1. `git checkout feature/codex-native-overlay`
2. `git pull`
3. Re-run focused verification:
   - `node --test test/paths.test.js test/doctor.test.js test/install.e2e.test.js test/markers.test.js`
4. Optional smoke run:
   - see `docs/CODEX-RUNTIME-OPERATIONS.md`
5. For upstream contributions, cherry-pick only commits tagged `[upstream-candidate]`.

## Suggested Next Work

1. Add a first-class `--project-path` CLI flag so install does not depend on current working directory.
2. Add automated smoke script for runtime matrix and byte-restore verification.
3. Split runtime docs by operator profile (Claude-only, Codex-only, hybrid).
