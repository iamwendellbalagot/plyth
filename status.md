# Work Handoff Status

## Current state

- 2026-11-20 native macOS Rook observe-only pilot: used the existing OpenAI ChatGPT Plus Pi login with `openai/gpt-6.1-sol`. A temporary ignored `.rook/policy.json` explicitly disabled the unsupported macOS shell sandbox; it was removed after the run. The exact `npm test` command was approved once, with no other command or file edits. Prediction: `pass`, specific evidence; observed `fail`. `/plyth`: eligible 1, predicted 1, invalid 0, specific 1; hit 0, miss 1; command duration 4,979 ms across one command. Feedback and persistent logging remained disabled.
- Native test result: 38/39 files passed; 272/273 tests passed in 4.45 s. The only failure is `tests/pi/bash-tool.test.ts` expecting a `mkdtemp(tmpdir())` workspace to be sandbox-mountable; on macOS the path is under `/var/folders`, which the Linux Bubblewrap policy correctly rejects. This is a macOS test-fixture portability issue, not evidence that the approved `npm test` command or PLYTH hook changed behavior. Pi recorded 3,879 input, 169 output, and 2,944 cached tokens; its estimated cost is not an actual ChatGPT Plus charge, and provider-billed cost is unavailable.
- Rook local dependency setup required `npm install` to materialize the sibling `plyth` link; the corresponding lockfile fix is committed in Rook as `b5ad3f3` (`fix: lock sibling plyth dependency`). The user-owned Rook dashboard PNG and `tui_references/` remain untouched. Colima was started during an incorrect environment attempt and then stopped; do not use Docker for this macOS pilot.
- Local Git release prepared on 2026-11-19: tag `v0.1.0`, ZIP `/tmp/opencode/releases/plyth-v0.1.0.zip`. The ZIP contains the committed source snapshot and `.git` directory. Local-only; not pushed or published.
- Phase 0 feasibility gate is complete. Rook/Pi has structured `expect` metadata and opt-in result feedback; its focused spike and Bash-tool tests pass (12 tests). A Rook model-issued command was attempted but the non-interactive CLI remained in plan mode, so prediction coverage and feedback delivery in a live Rook turn remain unmeasured.
- OpenCode 1.19.4 demonstrated structured prediction carriage and model-visible miss feedback in a real model-issued call to a temporary synthetic plugin tool. The probe executed no shell command, preserved the original result, and triggered no additional turn from the plugin.
- Phase 1 TypeScript core is implemented in `src/index.ts`; deterministic fixtures and focused tests are under `tests/`. No persistent ledger is included.
- Phase 2 core support adds package exports, eligible/predicted/invalid/specific coverage counters, aggregate observed duration, and an `evidenceUnavailable` distinction for truncation.
- Rook observe-only integration is implemented on branch `improve-permission-preferences` in the separate Rook repository. It adds bounded command classification, structured-event correlation/judging, output-label evidence, truncation handling, coverage/invalid-prediction/verdict/duration counters, and `/plyth`. It remains a local sibling `file:../plyth` dependency; Rook CI checks out both sibling repos and builds Plyth before Rook.
- **Phase 2 implementation is complete; evaluation remains open.** A model-issued Rook test-only pilot using `RONE_Models/gpt-6-luna` ran `npm test` and reported 39 files / 273 tests passing. It required the documented unsandboxed opt-out because the container kernel blocks Bubblewrap namespaces; Rook showed the host-execution warning and approval dialog, and only `npm test` was approved. TUI automation stalled before `/plyth` counters were captured, so prediction coverage/specificity and host costs remain unknown. No feedback or persistent event ledger is enabled.
- `implementation.md` records Phase 0/1 completion and Phase 2 implementation/evaluation status.

## Verification

- `npm test` — 6 tests passed.
- `npm run build` — passed.
- `npx --yes prettier --check src/index.ts tests/core.test.mjs tests/fixtures/judgments.json package.json tsconfig.json` — passed.
- `git diff --check` — passed.
- Warm bounded-judge microbenchmark (10,000 iterations): p50 1.17 μs, p95 6.01 μs, p99 11.27 μs in this container.
- Phase 2 core tests include truncated-output behavior and coverage/duration counter assertions.
- Rook: lint, typecheck, 60 focused tests, build, mock smoke, package dry-run, and formatting pass.
- Plyth: six tests, build, package dry-run, Prettier, and diff check pass.
- Local commits: Plyth `a482366` (`feat(core): add observe-only pilot metrics`); Rook `17ebe17` (`feat(plyth): add observe-only Rook pilot`).

## Pending

- The native test-only run establishes prediction carriage and a scorable miss, not effectiveness. For any benefit claim, run controlled paired B0/B1/B2 coding tasks with the same OpenAI subscription model and report task outcomes, token counts, latency, and uncertainty. Feedback remains disabled. The Bubblewrap sandbox is Linux-only; do not treat the macOS host-shell opt-out as sandbox validation.
- Token/cache counts are now captured for the native test-only run, but no comparative efficiency evidence exists; feedback remains disabled pending paired evaluation.
- Repeat core timing under the target adapter/runtime and confirm event ordering/session behavior at adapter integration.
- Preserve OpenCode results as a feasibility probe only; a product adapter and cross-host shared-fixture behavior remain Phase 4 work.
