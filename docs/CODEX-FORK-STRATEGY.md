# Codex Fork Strategy

This repository is maintained as a soft fork of `Fredasterehub/kiln` with a Codex-native runtime overlay.

## Goals

1. Preserve compatibility with active Kiln upstream development.
2. Maintain a Codex-first operator experience in this fork.
3. Upstream only generally useful, runtime-agnostic improvements.

## Branching Model

1. `upstream/v2` is the source of truth for upstream behavior.
2. `feature/codex-native-overlay` carries fork-specific runtime/provider adaptations.
3. Keep overlay commits modular so we can cherry-pick safe improvements upstream.

## Sync Workflow

```bash
git fetch upstream
git checkout feature/codex-native-overlay
git rebase upstream/v2
```

After rebasing:

1. Run core tests.
2. Fix any integration conflicts in runtime-specific code paths.
3. Push the rebased branch to fork origin.

## Upstream Contribution Policy

Safe to contribute upstream:

1. Bug fixes unrelated to runtime selection.
2. Test robustness improvements.
3. Documentation clarifications that apply to all runtimes.

Keep fork-only:

1. `codex`/`hybrid` runtime behavior.
2. Provider abstraction overlays specific to this fork.
3. AGENTS.md-targeted protocol behavior that is not part of upstream roadmap.

## PR Routing Rule

Before opening a PR, classify changes:

1. If runtime-agnostic, open PR to `Fredasterehub/kiln`.
2. If Codex-overlay-specific, merge only within `sampurnamo/kiln`.
