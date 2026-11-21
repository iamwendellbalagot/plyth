# Status

## Current state

- **Controlled Rook comparison frozen; no comparative inference has started.** Six untouched synthetic cases and the off/prompt/integrated protocol/runner are frozen in sibling Rook with source hashes/commits. Freeze verification and fixture preflight pass; no provider calls or outcome records exist. Next: run the 18 preregistered cells once, retain failures, and stop on guard/timeout rules. This is not an effectiveness conclusion.
- **Rook integrated inference-loop prototype implemented; one live vertical slice completed (2026-11-21).** Added exported `IntegratedPlythFlow` with task-local change checkpoints, repeated-failure signals, and stale-verification notices under UTF-8/task budgets. Provider-free validation: PLYTH build and 19 tests; Rook typecheck/build and 40 focused extension/lifecycle/scripted-Pi tests. One fresh synthetic task in Rook integrated mode delivered a task checkpoint to the next model-bound context after an edit; its independent 3-test check passed without modifying tests. This is delivery evidence only; no off/prompt-only comparison or effectiveness claim. Full attempt record: sibling Rook `evals/plyth-integrated-live/2026-11-21-vertical-slice.md`.

- **Rook-hosted simplicity review finish evaluation: NO-GO for expansion (2026-11-21).** Eight paired synthetic cases on `openai/gpt-6.1-sol`: PLYTH 3/4 useful simplification catches and two invalid/empty reports; generic review 4/4 catches and 8/8 usable reports. Neither condition made a harmful recommendation, but PLYTH used 22 requests versus 8 and higher observed tokens/time. Frozen go threshold failed. Keep only as an explicit experimental Rook feature if desired; no adapters, automation, efficacy claim, or further tuning round. Full results and caveats in Rook `evals/simplicity-finish/REPORT.md`; exact attempts are retained in `runs/RESULTS.jsonl`. Stopped phase4 pilot artifacts were not touched.
- Explicit Rook MVP development is complete. The eight-task, 24-run R0/R1/R2 pilot was frozen in Rook commit `ead887e` with `openai/gpt-6.1-sol`/high thinking, but was halted after one noncompliant cell: an unauthorized file was created and the coding request cap was exceeded. No remaining cell ran; do not resume without a new user decision and preregistration. See Rook `evals/phase4-pilot/STOP_REPORT.md`.
- PLYTH remains a standalone package; Rook is its first host. Legacy prediction APIs/defaults are preserved. Automatic review, other-agent adapters, legacy removal and publishing are conditional/separate decisions.

## Completed

- Version-1 request/result contracts bind findings to host-captured scope, content revision, attribution and limitations.
- Rook captures task-start dirty paths, excludes pre-existing files by default, supports explicit mixed scope, and safely includes untracked contents/project guidance.
- Review limits are now 32,000 conservative UTF-8 byte units, four read/search calls, four provider requests, and 8,000 output tokens per response. Report validation remains fail-closed; explicit metrics callbacks can capture bounded execution diagnostics without enabling default persistence.
- Unknown attribution or omitted/unverifiable context forces partial coverage. Symbol/line labels and task-window authorship are not semantically verified. Exact limits: [docs/rook.md](docs/rook.md).

## Validation

- 15 PLYTH tests/build; 65 focused Rook tests plus one inference-free pinned-SDK review test; typecheck/build and changed-file formatting/diff checks pass.
- No live provider calls were made during MVP development or pilot preparation. The one pilot inference and its full limitations are recorded in Rook `evals/phase4-pilot/`.
- No demonstrated benefit: [prior bounded study](evals/phase3-final/report.md), [prior live comparison](evals/latest-features-live/report.md).

## Next

- Any off/prompt/integrated comparison requires a separate frozen protocol with untouched tasks and independent checks. Preserve the stopped pilot artifacts and all existing user-owned untracked Rook files.
