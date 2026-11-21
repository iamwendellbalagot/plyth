# Status

## Current state

- Explicit Rook MVP development is complete. The eight-task, 24-run R0/R1/R2 pilot was frozen in Rook commit `ead887e` with `openai/gpt-6.1-sol`/high thinking, but was halted after one noncompliant cell: an unauthorized file was created and the coding request cap was exceeded. No remaining cell ran; do not resume without a new user decision and preregistration. See Rook `evals/phase4-pilot/STOP_REPORT.md`.
- PLYTH remains a standalone package; Rook is its first host. Legacy prediction APIs/defaults are preserved. Automatic review, other-agent adapters, legacy removal and publishing are conditional/separate decisions.

## Completed

- Version-1 request/result contracts bind findings to host-captured scope, content revision, attribution and limitations.
- Rook captures task-start dirty paths, excludes pre-existing files by default, supports explicit mixed scope, and safely includes untracked contents/project guidance.
- Enforced two-call read/search and conservative 6000-UTF-8-byte context budgets, 1000-output-token stream cap per response, bounded report validation, usage and scope presentation, freshness checks and task/session invalidation.
- Unknown attribution or omitted/unverifiable context forces partial coverage. Symbol/line labels and task-window authorship are not semantically verified. Exact limits: [docs/rook.md](docs/rook.md).

## Validation

- 15 PLYTH tests/build; 65 focused Rook tests plus one inference-free pinned-SDK review test; typecheck/build and changed-file formatting/diff checks pass.
- No live provider calls were made during MVP development or pilot preparation. The one pilot inference and its full limitations are recorded in Rook `evals/phase4-pilot/`.
- No demonstrated benefit: [prior bounded study](evals/phase3-final/report.md), [prior live comparison](evals/latest-features-live/report.md).

## Next

- No further inference is authorized by the current freeze after its stop rule fired. Any continuation requires a new user decision, corrected/enforced limits, and a new preregistered protocol. No effectiveness result is available.
