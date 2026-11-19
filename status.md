# Work Handoff Status

## Current state

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

- Repeat the model-issued Rook pilot in an environment where Rook's Bubblewrap namespace probe succeeds; capture `/plyth` coverage, specificity, verdicts, and command duration with task outcomes.
- Record provider/token/cache usage before considering Phase 3 feedback. The completed test-only run is not comparative evidence; feedback remains disabled.
- Repeat core timing under the target adapter/runtime and confirm event ordering/session behavior at adapter integration.
- Preserve OpenCode results as a feasibility probe only; a product adapter and cross-host shared-fixture behavior remain Phase 4 work.
