# Kiln Protocol (Codex Runtime)

Use Kiln through Codex-native orchestration assets installed under `~/.codex/kilntwo`.

## Runtime Contract

- Runtime: `codex`
- Orchestration assets: `~/.codex/kilntwo/agents`, `~/.codex/kilntwo/commands/kiln`
- Project state: `.kiln/` in the current repository
- Canonical config: `.kiln/config.json`

## Executor Routing

Read `.kiln/config.json` and resolve:

1. `executor.provider` (`codex`, `kimi`, or `claude`)
2. Provider entry under `providers.<name>`
3. `executor.fallback_provider` if the primary provider is unavailable

Default recommendation:

- planner/reviewer: `codex` with high reasoning
- implementer: `codex` or `kimi` (operator preference)
- fallback: `codex`

## Upstream-Layering Rule

Keep the Kiln upstream protocol semantics intact, but route model execution through provider adapters defined in config.
Do not fork workflow semantics unless explicitly required by operator direction.
