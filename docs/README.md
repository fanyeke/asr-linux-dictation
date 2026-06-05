# Project Engineering Notes

This project does not require a heavyweight spec process. Development should still follow a stable engineering loop so desktop, API, audio, and text-injection bugs are easy to reproduce.

Required process for each non-trivial feature:

1. Define the behavior in a small task note or issue.
2. Add or update tests first.
3. Implement the feature.
4. Add structured logs for start, success, failure, and duration.
5. Run the relevant automated tests.
6. Record any manual smoke test that cannot be automated yet.

Core requirements:

- [Module Boundaries](./modules.md)
- [Development Phases](./phases.md)
- [TDD Requirements](./tdd.md)
- [Logging And Diagnostics Requirements](./logging.md)
- [Phase 6 Experience Notes](./phase-6-experience-notes.md)

Root agent entry files:

- [Claude Code Instructions](../CLAUDE.md)
- [Codex/Agent Instructions](../AGENTS.md)

For this project, "done" means the feature works, has appropriate tests, and can be diagnosed from logs when it fails.
