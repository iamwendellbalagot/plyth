# Status

## Current state

- Explicit Rook MVP development is complete. [plan.md](plan.md) now records actual phase progress; the frozen live end-to-end pilot is next.
- PLYTH remains a standalone package; Rook is its first host. Legacy prediction APIs/defaults are preserved. Automatic review, other-agent adapters, legacy removal and publishing are conditional/separate decisions.

## Completed

- Version-1 request/result contracts bind findings to host-captured scope, content revision, attribution and limitations.
- Rook captures task-start dirty paths, excludes pre-existing files by default, supports explicit mixed scope, and safely includes untracked contents/project guidance.
- Enforced two-call read/search and conservative 6000-UTF-8-byte context budgets, 1000-output-token stream cap per response, bounded report validation, usage and scope presentation, freshness checks and task/session invalidation.
- Unknown attribution or omitted/unverifiable context forces partial coverage. Symbol/line labels and task-window authorship are not semantically verified. Exact limits: [docs/rook.md](docs/rook.md).

## Validation

- 15 PLYTH tests/build; 65 focused Rook tests plus one inference-free pinned-SDK review test; typecheck/build and changed-file formatting/diff checks pass.
- No live provider calls or benchmarks were run for these development changes. Earlier synthetic workflow probes are historical, not final-revision validation or efficacy evidence.
- No demonstrated benefit: [prior bounded study](evals/phase3-final/report.md), [prior live comparison](evals/latest-features-live/report.md).

## Next

- Freeze live pilot cases, control/targeted prompts, resource limits, run order and independent scoring before inference. No additional MVP features are prerequisites.
