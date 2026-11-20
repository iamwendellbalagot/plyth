# Phase 3 decision: NO-GO for advisory-product expansion

## Plain-language answer

**The reminder works, but we have not shown that it helps.** In this final test,
the agent saw the failing tests, repaired the problems, and passed verification
without needing PLYTH feedback. Adding a reminder that never fires cannot explain
better recovery. Prediction accuracy is not evidence of product value.

Stop investing in more adapters/packaging **on the assumption that the feedback
improves coding**. Leave the experimental code available but off by default. Keep
the deterministic core and the evidence-status fix; do not remove user-facing
functionality as part of this evaluation. Another research trial or a narrower
observe-only product needs a separate decision, not another automatic loop.

This is a **no-go under insufficient benefit evidence**, not proof that feedback
can never help. The bounded Phase 3 evaluation is complete; its positive exit
gates were **not passed**. Phase 4 is not authorized by these results.

## What was actually tested

Nine provider-backed Rook runs: three newly authored multi-file tasks × three
conditions. Each task involved interacting defects, visible unit/integration
tests, and a six-command budget permitting additional repair cycles. No false
prediction, guessed error label, or mandated forecast was planted. In practice,
the agents fixed everything in one edit batch between two suite runs, so this
workload still did not exercise repeated recovery. These are miniature application
fixtures, not a representative production-repository benchmark.

- **Pagination:** cursor normalization, empty-page traversal, first-seen item merging.
- **Cache:** exact expiry boundary, pending-request coalescing, rejection cleanup.
- **Pricing:** quantity multiplication, aggregate monetary rounding, shipping threshold.

B0/B1/B2 used the same frozen Rook revision, model (`openai/gpt-6.1-sol`), prompts,
budgets and isolated initial code. Unlike earlier trials using an older B0 host,
this B0 removes only prediction schema/description and adapter registration;
`baseline.patch` records that difference. B1 observes; B2 enables the existing
bounded result-path advisory. The model/provider configuration was not changed
between runs. Order was shuffled once with the preregistered seed.

## Results

| Task       | Arm | Independent final tests | Agent test commands approved | Prompt-to-end seconds | Input / output / cache-read tokens | Session outcome                 |
| ---------- | --- | ----------------------- | ---------------------------- | --------------------- | ---------------------------------- | ------------------------------- |
| Pagination | B0  | 7/7                     | 2                            | 73.561                | 24,672 / 1,397 / 45,696            | Completed                       |
| Pagination | B1  | 7/7                     | 2                            | 56.854                | 17,683 / 1,089 / 32,640            | Completed                       |
| Pagination | B2  | 7/7                     | 2                            | 58.815                | 13,248 / 1,217 / 37,504            | Completed                       |
| Cache      | B0  | 6/6                     | 2                            | 55.281                | 6,657 / 1,152 / 35,840             | Completed                       |
| Cache      | B1  | 6/6                     | 1                            | 70.247†               | 15,543 / 1,364 / 38,400†           | Approval automation interrupted |
| Cache      | B2  | 6/6                     | 2                            | 51.844                | 12,931 / 1,057 / 30,336            | Completed                       |
| Pricing    | B0  | 6/6                     | 2                            | 53.750                | 6,937 / 886 / 41,216               | Completed                       |
| Pricing    | B1  | 6/6                     | 2                            | 55.665                | 19,529 / 916 / 30,208              | Completed                       |
| Pricing    | B2  | 6/6                     | 2                            | 58.744                | 10,539 / 933 / 47,616              | Completed                       |

† The B1 cache run had repaired its source, but the evaluator could not confirm
the once-approval selection for its final test and stopped without approving it.
The independent post-run check passed. **Do not count this as a completed agent
verification or a B1 capability failure, or use its censored time/tokens in a
completed-task efficiency comparison.** It is retained; no replacement was run.

All nine runs tested the unchanged starter before editing. Tests and non-source
files remained unchanged. Initial suites had four failures each; pagination had
three passing starter tests and the other tasks two. All nine submitted source
repairs passed the independent original tests (19 checks per arm), with allowed
source edits only. Eight agent sessions completed their own final verification;
one was interrupted as described above. Test-based acceptance is not a claim of
correctness outside the fixture contract; no human rubric or LLM judge is used.

### Did feedback help?

- B0 supplied no predictions and completed all three tasks with two test runs each.
- B1 supplied specific predictions for all five completed commands; B2 for all six.
  All eleven reconstructed judgments were **hits**, with **zero misses**.
  B1 also issued a predicted final call that was not approved and has no result.
- B2 sent **zero advisory messages**, so there are no treated recovery episodes
  from which to estimate an intervention effect or miss-to-recovery association.
- On both fully completed three-arm task comparisons, B2 was slower than B1
  (pagination +3.45%, pricing +5.53%) and used more total reported tokens
  (input + output + cache-read: +1.08%, +16.65%). This tiny noisy comparison is
  **not evidence that feedback causes slowdown**: no message was delivered.
- Against B0, B2 timings and token totals varied in direction. Do not call those
  fluctuations savings or attribute them to inactive feedback.

### Gate assessment

| Original gate                                                   | Finding                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| At least 70% prediction coverage                                | Met on observed completed B1/B2 calls: 11/11, all specific.                                                                                                                                                                                                        |
| Misses identify costly recovery opportunities                   | Not established: no natural miss in this final set.                                                                                                                                                                                                                |
| B2 improves quality-adjusted efficiency over B0 and B1          | Not established: equal accepted repairs; no intervention, no consistent efficiency advantage.                                                                                                                                                                      |
| Prediction/instruction/feedback overhead below 2%               | Not established. End-to-end token counts are captured, but stochastic trajectories and cache changes do not isolate protocol overhead.                                                                                                                             |
| Permissions and command semantics preserved; acceptable latency | Only the three exact test commands were eligible for once approval; 17 invocations approved, no unexpected command executed. One automation interruption; isolated adapter p50/p95 overhead was not measured here. macOS host execution is not sandbox validation. |

## Uncertainty and interpretation

Only three tasks and one run per task/condition were measured. For perspective,
3/3 accepted source repairs has a descriptive 95% Wilson interval of about
44%–100% if those tasks were independent Bernoulli samples; they are authored
fixtures, not a random deployment sample, so this is **not a population success
estimate**. Likewise, zero B2 messages in six commands does not prove real-world
miss frequency is zero; commands within tasks are correlated. A causal recovery
effect is unidentifiable here because no natural intervention occurred.

The earlier controlled false-prior run proved timely message delivery but also
showed no observed recovery difference. It is not pooled with these natural runs
as efficacy evidence. The original tiny tasks and exact-label guidance helped
debug the integration, but their ceiling effects should have been recognized
sooner. Continuing to author more easy tasks until a miss appears would not be a
credible way to establish value.

**Investment decision:** the burden of proof for adding product complexity was
benefit, not merely absence of a known regression. That burden was not met.
Conclude no-go for current advisory expansion and stop this evaluation cycle.

## Reproduction, validation and retention

- `protocol.md`, committed before runs in `3740735`, defines the stopping rule.
- `manifest.json` retains exact prompts, command allowlist and trusted-test hashes.
- `fixtures/` retains starters; `.fixture` suffix prevents deliberately failing
  task tests from being discovered by Plyth's normal unit-test command.
- `run.py` prepares clean tasks and drives native interactive approvals using the
  existing Pi login. Frozen worktrees must be created as described below.
- `results.jsonl` retains synthetic tool calls, source diffs, predictions, test
  results, final answers and usage. It does not retain login credentials, hidden
  model reasoning or host system prompts. Temporary paths are redacted. This is
  an explicitly retained evaluation artifact, not a change to default ledger privacy.
- `replay.mjs` replays completed test outputs through the frozen adapter and checks
  that reconstructed feedback equals captured feedback; `summary.json` records
  judgments. Replay durations are unavailable (zero samples), not measured zero.
- `verify.py --temp-root <approved-directory>` verifies every buggy starter fails
  and a known repaired control passes, without a model call.
- Plyth's six core tests/build and Rook's seven focused adapter tests passed before
  inference. Offline repaired controls and adapter replay also passed afterward.

For another researcher to reproduce (not an instruction to restart this cycle):
create two detached Rook worktrees `b0-host` and `b1-host` under an approved base
directory at the pinned revision in `protocol.md`, provide their installed
dependencies, apply `baseline.patch` only to B0, and build both. Run `run.py
--rook <frozen-rook-repository> --base <directory> --prepare`, then `--run` with
the same arguments. The runner exclusively creates `results.jsonl` and refuses
to overwrite an existing report. Run `replay.mjs <base>/b1-host` before disposing
the temporary worktrees. Native timings/provider responses are not deterministic.
