# Status

## Current state

- Explicit Rook MVP development is complete. The eight-task, 24-run R0/R1/R2 live pilot is preregistered and frozen in Rook `evals/phase4-pilot/` at commit `ead887e`; exact model `openai/gpt-6.1-sol`, high thinking, randomized order, synthetic fixtures, scoring, and stop/resource rules are fixed. The 24 inference runs have not started yet.
- PLYTH remains a standalone package; Rook is its first host. Legacy prediction APIs/defaults are preserved. Automatic review, other-agent adapters, legacy removal and publishing are conditional/separate decisions.

## Completed

- Version-1 request/result contracts bind findings to host-captured scope, content revision, attribution and limitations.
- Rook captures task-start dirty paths, excludes pre-existing files by default, supports explicit mixed scope, and safely includes untracked contents/project guidance.
- Enforced two-call read/search and conservative 6000-UTF-8-byte context budgets, 1000-output-token stream cap per response, bounded report validation, usage and scope presentation, freshness checks and task/session invalidation.
- Unknown attribution or omitted/unverifiable context forces partial coverage. Symbol/line labels and task-window authorship are not semantically verified. Exact limits: [docs/rook.md](docs/rook.md).

## Validation

- 15 PLYTH tests/build; 65 focused Rook tests plus one inference-free pinned-SDK review test; typecheck/build and changed-file formatting/diff checks pass.
- No live provider calls were made during MVP development or pilot preparation. A no-inference preflight confirmed the frozen model/configuration; immutable starter checks are recorded in Rook `evals/phase4-pilot/freeze.json`.
- No demonstrated benefit: [prior bounded study](evals/phase3-final/report.md), [prior live comparison](evals/latest-features-live/report.md).

## Next

- Run the frozen pilot in exact order; retain failures and interruptions. Independently score blinded patches before opening Rook `evals/phase4-pilot/scoring-key.jsonl`; then report all 24 cells and limitations. No additional MVP features are prerequisites.
