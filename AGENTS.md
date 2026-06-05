# AGENTS.md

Rules for Codex and other coding agents before development work.

See `CLAUDE.md` for project summary, stack, rules, and definition of done. This file adds agent-specific guidance.

## Agent-Specific Rules

- Prefer reading `docs/` over guessing behavior.
- When unsure which phase to work on, check `docs/phases.md` current phase gate.
- Do not introduce new dependencies without updating both `pyproject.toml` and `package.json` as needed, and documenting the reason.
- If a file exceeds 200 lines during implementation, consider splitting per `docs/modules.md` boundaries.
- Commit messages should reference the phase (e.g., `phase-1: add config validation`).
