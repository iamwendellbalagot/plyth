# PLYTH — Implementation Plan

**Version:** 0.3 draft
**Date:** 2026-11-19
**Working name for the core interaction:** Called Moves
**Primary pilot:** Rook
**Initial implementation:** TypeScript library and thin agent adapters

**Current scope (2026-11-20):** complete the Rook-first implementation. All other coding-agent adapters (including OpenCode, Claude Code and Codex) are explicitly deferred. Feature completeness and feedback effectiveness are separate decisions; earlier Phase 3 no-go findings apply to the evaluated prediction/feedback pilot, not an assertion that all planned core features were already implemented. See `README.md` and `docs/rook.md` for the implemented contracts and limits.

---

## 1. Summary

PLYTH is a small prediction-feedback layer for coding agents. Before a test, build, or diagnostic command runs, the agent predicts its observable result. PLYTH compares that prediction with the actual result. Correct predictions are recorded silently; a meaningful miss gives the agent one concise piece of external feedback to reconsider the assumption behind its next action.

The prediction comes from the host agent's ordinary model response. PLYTH makes no model calls and never executes commands, grants permissions, edits files, or decides whether work is complete. It observes host events, judges predictions deterministically, and may return advisory context through the host's supported extension interface.

The premise is not that a prediction is inherently intelligent. Its value is that a falsified, specific expectation can reveal a mistaken mental model at the point where the agent can still act on the evidence. This premise must be tested. If misses do not identify situations where targeted feedback helps, the feature should be removed.

### Product promise

> Make an agent's expectations testable, then use real outcomes—not self-reported confidence—to decide when to pause and reconsider.

### Non-negotiable principles

1. **No extra inference calls.** Prediction is optional metadata generated as part of an existing agent response.
2. **Evidence over confidence.** Compare predictions with observable outcomes; do not treat model confidence as calibrated probability.
3. **Host retains authority.** Permissions, execution, and safety enforcement remain with the agent host.
4. **Quiet by default.** Hits do not generate messages. Interventions are bounded and deduplicated.
5. **Do not overstate counterfactuals.** A miss does not prove that an action was wasteful or that a different action would have worked.
6. **Small, portable core.** Shared event contracts and pure functions; host-specific behavior stays in adapters.
7. **Local and minimal data.** No raw prompts, repository contents, command output, or secrets in the default ledger.
8. **Measure before controlling.** Start with observation and advisory feedback. Any active steering must beat strong baselines.

## 2. Problem and hypothesis

Coding agents repeatedly form expectations about a repository: a test should fail before a fix, a build should pass after a change, or a command should expose a particular error. Normally those expectations remain implicit. When reality differs, the agent sees a tool result, but may fail to connect that result to its underlying assumption and can continue down the wrong path.

PLYTH makes selected expectations explicit and checks them against the environment.

### Primary hypothesis

For a defined set of coding tasks, **a specific pre-action prediction that is compared with the real result, followed by concise feedback on a meaningful miss, improves task success or cost per correct task** versus the same agent without PLYTH.

### Supporting hypotheses

- Agents will provide sufficiently specific predictions for a useful share of test/build/diagnostic commands.
- A prediction miss will identify a useful checkpoint more often than a prediction hit.
- The extra prediction tokens and occasional feedback will cost less than the repeated work or failures they prevent.
- A compact event contract can support several agent frameworks without putting host-specific permissions or execution in PLYTH.

These are hypotheses, not established results. A result showing no benefit is a valid outcome.

## 3. Scope

### v0.1 in scope

- A compact prediction format for observable command outcomes.
- Deterministic comparison of predictions with exit status and optional, bounded output evidence.
- Event records and per-session hit/miss/vague/none counts.
- A simple history baseline for detecting trivial predictions.
- A short, capped, advisory response on qualifying misses.
- Rook reference adapter. Other-host integrations are deferred; historical feasibility probes do not imply product support.
- Offline fixtures and paired evaluation against unchanged host behavior.
- Opt-in local JSONL trace storage with minimal metadata.

### Out of scope for v0.1

- Running commands or changing host permissions.
- Automatically deciding that a task is correct or safe to finish.
- Additional model calls, LLM judges, second agents, or generated candidate lists.
- Training or fine-tuning neural networks.
- Bayesian EVSI over open-ended coding hypotheses, POMDPs, reinforcement learning, or online exploration.
- A second repository knowledge store. Rook remains the owner of project memory.
- Hard blocking, mandatory prediction for every command, or automatic model/provider switching.
- Claims that a hit proves the agent's understanding is correct or that a miss caused a failure.

## 4. Interaction model

### 4.1 Prediction

For a test, build, or diagnostic command, the model emits an expectation alongside the command. The exact representation is adapter-specific:

```json
{
  "command": "node --test test/retry.test.mjs",
  "expect": {
    "outcome": "fail",
    "evidence": "stops at max"
  }
}
```

`outcome` is required when a prediction is present and is one of `pass`, `fail`, or `error`. `evidence` is optional short text that makes the prediction discriminating, such as a test name or stable error fragment. It is not a place for chain-of-thought or a detailed explanation.

No prediction is required for file reads, edits, or commands where the result is not meaningfully predictable. The model may omit it. Adapter-specific transport must not change the command's effective execution semantics.

### 4.2 Judging

The host reports a result, normally including an exit code, timeout/cancel status, and optionally a bounded output digest or selected diagnostic labels.

- `pass`: successful process exit (normally exit code 0).
- `fail`: non-zero exit that represents a completed command failure.
- `error`: launch error, timeout, cancellation, or other non-completion; adapters preserve the distinction where the host exposes it.
- `hit`: predicted outcome matches the observed outcome and, when checked, the declared evidence matches.
- `miss`: predicted outcome or declared evidence does not match.
- `vague`: outcome matches but no discriminating evidence was provided, or available host data is insufficient to score evidence.
- `none`: no prediction was supplied.
- `unscorable`: outcome cannot safely be normalized from the host event.

The exact status mapping is adapter-specific and must be declared in adapter capability metadata. PLYTH must not interpret absent result information as a successful command.

### 4.3 Feedback

On a qualifying miss, return a short neutral observation, not a verdict about the whole task:

> Expected `fail` ("stops at max"); observed `pass`. Recheck the assumption before choosing the next step.

Feedback is attached to the existing tool-result/next-turn path when supported. It must not cause an additional agent turn by itself. If a host requires an explicit continuation to deliver feedback, that adapter is disabled by default until its added latency and cost are measured.

Initial safeguards:

- At most one feedback item per miss.
- At most five feedback items per session, configurable downward.
- Deduplicate identical prediction/result pairs within a session.
- No feedback for `hit`, `vague`, `none`, or `unscorable`.
- Never block or retry a tool call based on the prediction.
- No forced reasoning-level change in v0.1.

## 5. Anti-gaming and baseline skill

An agent can appear accurate by making easy or uninformative predictions—for example, predicting failure for every test run before a fix. Raw hit rate is therefore descriptive only.

v0.1 includes a small baseline, not a learned model:

- Track recent outcomes for an identical normalized command within the session.
- Invalidate that history when the adapter reports relevant workspace changes, or mark it unavailable if reliable invalidation is not possible.
- Report agent prediction accuracy beside baseline accuracy where predictions are comparable.
- Do not award extra credit for predicting only the majority outcome.

**Implemented:** `CommandHistoryBaseline` compares model and last-outcome forecasts on the same outcome-only denominator, bounds history, rejects changed/unavailable revisions, and invalidates pending forecasts across mutations. Rook supplies a bounded workspace-file snapshot and invalidates on edits and unknown tool mutations. Large, linked, sensitive or unobservable inputs yield unavailable comparisons. This is not an environment/network/dependency-state oracle; exact capabilities are documented in `docs/rook.md`.

The baseline cannot establish a counterfactual. It says only what a simple rule would have predicted from prior observations. For commands whose inputs, environment, or relevant files changed, the old result is not a valid forecast.

Evidence text should be checked conservatively. Exact normalized substrings or host-provided test labels are acceptable; semantic equivalence is not inferred by a second model. If output is truncated or redacted, score only the observable outcome and mark evidence `unscorable` rather than a miss.

## 6. Architecture

### 6.1 Components

```text
Host agent (Rook, Claude Code, Codex, OpenCode, ...)
   │  prediction + pre/post tool events
   ▼
Host adapter ──► PLYTH core ──► verdict + optional short feedback
                      │
                      └──► optional local JSONL ledger
```

The core is a TypeScript package with no runtime model, network, or database dependency. Adapters map host lifecycle events into the shared contract and map feedback back into host-supported context. A CLI is useful for offline replay and reporting, but should not be placed in a hot path unless startup cost is acceptable.

### 6.2 Proposed repository layout

```text
plyth/
├── packages/
│   ├── core/                 # Types, validation, judge, baseline, feedback
│   └── cli/                  # Offline replay and report commands
├── adapters/
│   ├── rook/                 # Reference integration prototype
│   ├── claude-code/          # Plugin hooks; capability-gated
│   ├── codex/                # Lifecycle hooks; capability-gated
│   └── opencode/             # Plugin hooks; capability-gated
├── fixtures/                 # Versioned host event inputs and outputs
├── evals/                    # Trap cases and paired-run tooling
└── docs/                     # Protocol, adapter, evaluation, privacy docs
```

Keep the first release in one package if splitting packages delays the pilot; these are logical boundaries, not a requirement to create multiple packages on day one. Rust is deferred unless measured TypeScript startup or distribution costs justify it.

### 6.3 Shared event contract

Version the wire contract from the beginning. A minimal normalized event can be represented as:

```typescript
type PredictionOutcome = "pass" | "fail" | "error";
type Verdict = "hit" | "miss" | "vague" | "none" | "unscorable";

interface Prediction {
  outcome: PredictionOutcome;
  evidence?: string; // bounded, optional; do not persist raw by default
}

interface CommandStarted {
  protocol: "plyth/event/1";
  sessionId: string;
  callId: string;
  adapter: string;
  commandClass: "test" | "build" | "diagnostic" | "other";
  commandDigest?: string;
  prediction?: Prediction;
}

interface CommandFinished {
  protocol: "plyth/event/1";
  sessionId: string;
  callId: string;
  outcome?: PredictionOutcome;
  durationMs?: number;
  evidenceLabels?: string[]; // e.g. parsed test names, when safely available
  resultDigest?: string;
  unscorableReason?: string;
}

interface Judgment {
  callId: string;
  verdict: Verdict;
  feedback?: string;
  reasonCode: string;
}
```

Validate request size, string lengths, enum values, and event ordering at the adapter boundary. Do not pass arbitrary output buffers into core logic. For command-line hook transports, use bounded JSON on stdin/stdout and never log raw input on parse failure.

### 6.4 Storage and privacy

Default behavior is in-memory session counts only. Optional local JSONL stores minimal fields: protocol version, adapter version, pseudonymous session/repository key, command class, prediction outcome, verdict, duration bucket, and timestamps at coarse precision. Avoid raw command text, output, evidence strings, prompts, file contents, absolute paths, credentials, and user identifiers.

**Implemented Rook profile:** core `createTraceRecord`/`parseTraceRecord` whitelist the wire record. Rook owns private bounded JSONL I/O and `/plyth trace status|on|off|export|clear`. The record uses a random session pseudonym and no repository identifier or command digest; it additionally stores observed outcome and baseline comparability/correctness flags. Persistence is independent of advisory feedback and off by default. See `docs/rook.md` for fields, the 64 KiB cap, fail-open storage and deletion/retention semantics.

If a command digest is enabled, use a documented normalization and a per-installation salt so hashes are not trivially reversible through a global dictionary. Provide a disable switch and a deletion/export path. No telemetry leaves the machine without explicit configuration.

### 6.5 Failure behavior

PLYTH is advisory and fail-open: malformed prediction, missing event, storage failure, adapter timeout, or version mismatch must not prevent the host from executing a call or continuing its normal workflow. Permission enforcement is never delegated to PLYTH. Adapter contracts must explicitly define timeouts, output limits, concurrency, cancellation, and whether feedback can be appended without a new turn.

## 7. Agent integration strategy

There is no single integration mechanism common to all coding agents. The portable part is the event contract and judge; prediction transport and feedback delivery are per-host adapters. Ship adapters incrementally and label capabilities instead of claiming universal compatibility.

| Host         | Prediction transport                                                                                                                             | Result/feedback path                                                                                                  | Initial status                                                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Rook / Pi    | Add optional `expect` metadata to Rook's custom bash tool; do not alter the command string.                                                      | Pi `tool_execution_end`; attach feedback to the tool result or next request using a supported extension path.         | Best pilot: Rook owns its tool and Pi exposes lifecycle events. Verify tool output behavior in a small spike.                                 |
| Claude Code  | Built-in Bash has no separate metadata field; shell-comment carriage remains experimental. A plugin/custom tool may provide structured metadata. | `PostToolUse` and `PostToolUseFailure` support short `additionalContext`; `PostToolUse` can also replace tool output. | Official hook contract documents both success and failure feedback. Prediction carriage, approval effects, and live delivery remain untested. |
| Codex        | Built-in Bash has no separate metadata field; shell-comment carriage remains experimental. A plugin/custom tool may provide structured metadata. | `PostToolUse` accepts `additionalContext` and can replace the result before continuing.                               | Official hook contract documents result and command input. Prediction carriage, hook trust setup, and live delivery remain untested.          |
| OpenCode     | Plugin tools can define structured input; shell-command annotation for the built-in tool remains experimental.                                   | Plugin `tool.execute.after` hook can inspect completed/error results and mutate the result.                           | Official plugin contract documents input/output hooks. Prediction carriage and live delivery remain untested.                                 |
| Other agents | Implement the shared API directly, wrap the command tool, or provide lifecycle hooks.                                                            | Host-specific feedback adapter.                                                                                       | Supported only where both prediction and actual result are observable.                                                                        |

#### Generic shell annotation

A trailing comment such as `# plyth: expect=fail; evidence="test name"` is a possible compatibility bridge, not the canonical protocol. Shells, command parsers, permission systems, multiline commands, quoting, and platform differences make this unsafe to assume. Adapters must test that annotation is parsed identically on supported platforms and that stripping/retaining it cannot change the effective command. If this cannot be guaranteed, require a custom structured tool or mark the host observe-only with no model prediction support.

#### Rook pilot notes

Rook already owns a custom bash tool (`rook/src/pi/bash-tool.ts`) and subscribes to Pi execution events (`rook/src/pi/pi-agent-gateway.ts`). This makes Rook the lowest-friction place to test structured metadata. The existing routine-command classifier uses anchored command patterns (`rook/src/policy/tool-policy.ts`); therefore adding a shell comment could change approval classification. The Rook adapter should use a separate metadata field and leave the command string untouched.

The Rook codebase already has local memory and execution-policy guidance. PLYTH must demonstrate benefit beyond those features and must not become a competing project-facts store.

## 8. Lightweight mathematical components

Mathematics should summarize observed prediction quality and support honest evaluation. It should not create false precision or drive policy until evidence justifies it.

### Included in v0.1

1. **Hit/miss counters:** counts by adapter, model label if the host safely supplies one, repository pseudonym if enabled, and command class. Keep denominators for all verdict categories.
2. **Simple baseline comparison:** compare only on examples where baseline and agent predictions can be scored against the same observed outcome.
3. **Offline uncertainty estimates:** report confidence intervals for paired success, overhead, and miss-associated failure rates. Use paired bootstrap for task-level cost/time and suitable exact or interval estimates for small binary samples. Always show sample sizes and per-task outcomes.

**Implemented utilities:** `binaryInterval` returns descriptive Wilson intervals with explicit empty denominators; `pairedBootstrapDifference` provides seeded task-paired treatment-minus-baseline intervals with input bounds and no interval for a single pair. These offline functions do not steer runtime behavior or manufacture estimates for unavailable evaluation data. Small correlated samples still cannot establish effectiveness or isolated overhead.

Beta-binomial rates may be added for descriptive dashboards when useful, but v0.1 must not use a prior-smoothed hit rate to trigger interventions. With a small pilot, counts plus uncertainty are clearer and less likely to imply unjustified calibration.

### Deferred models and entry conditions

| Candidate                                             | Add only if...                                                                                                                                                                   |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Surprise threshold / Beta-binomial intervention score | Specific misses produce noisy feedback and enough outcome data exists to tune a threshold on held-out tasks.                                                                     |
| CUSUM or changepoint detector                         | Trace evidence shows clusters of misses precede a distinct recoverable failure mode, and a simple consecutive-miss rule is inadequate.                                           |
| Hierarchical pooling                                  | Multiple agents/models/repositories have sufficient data and cold-start estimates are a demonstrated issue.                                                                      |
| Per-memory trust score                                | A memory-citation protocol exists and repeated, validated evidence links misses to stale memories.                                                                               |
| Bayesian EVSI / budget allocation                     | A domain provides explicit action outcomes, likelihoods or empirical estimates, utilities, and controlled evidence that a more complex policy beats simple rules after overhead. |
| Learned model or contextual bandit                    | There are enough controlled, representative trials, safe exploration constraints, and a demonstrated advantage over deterministic baselines.                                     |

No statistical model can recover the outcome of an unchosen command. Do not treat replay or observed success after the agent ignored advice as counterfactual evidence.

## 9. Evaluation

### 9.1 Baselines

- **B0 — Host unchanged:** same model/provider, prompt, permissions, tools, fixtures and task state; PLYTH disabled.
- **B1 — Prediction logging only:** collect expectations and verdicts, but send no feedback.
- **B2 — PLYTH feedback:** send bounded feedback on qualifying misses.
- **B3 — Simple baseline predictor:** optional comparison using identical recent command history where valid.

The main comparison is B2 versus B0. B1 isolates the effect of the nudge from the prediction/instrumentation overhead. Do not compare only against an intentionally wasteful policy.

### 9.2 Workloads

- Deterministic synthetic command fixtures covering pass, fail, timeout, cancellation, output truncation and malformed events.
- Trap coding tasks: test already passes, test fails for an unexpected reason, stale assumption after an edit, repeated identical failure, and a hidden second failure.
- Paired Rook coding tasks on clean identical snapshots, randomized run order, same model/provider version and equivalent budgets.
- Later, run equivalent fixture tasks through each supported adapter to detect host-specific behavior.

Keep failed, timed-out, and unscorable tasks in reports. Score code with trusted checks and human review where needed; do not use another LLM judge as ground truth without separately validating it.

### 9.3 Metrics

- Task success and regression rate.
- Cost per correctly completed task; input/output and cached tokens where available.
- Total wall time and adapter/hook latency (p50/p95).
- Prediction coverage, specificity, hit/miss/vague/none/unscorable counts.
- Rate of relevant failure or wasted work after a miss versus after a hit, with uncertainty intervals.
- Feedback count per task; feedback precision (whether it led to useful evidence or recovery) and false-positive rate.
- Host permission/approval behavior and adapter failures.
- Privacy audit: stored fields and retention behavior.

Do not use a “waste saved” metric unless the counterfactual action and its expected result were actually tested. A miss is a signal, not proof of waste.

### 9.4 Proposed pilot gates

These are provisional thresholds to preregister before a pilot, not evidence-backed promises:

- Prediction coverage is high enough to assess the mechanism (initial target: at least 70% of eligible test/build/diagnostic commands in the Rook fixture workload).
- Misses are associated with materially higher subsequent task failure or recovery cost than hits, with uncertainty reported; inconclusive data means continue in observe-only mode, not claim a win.
- B2 improves quality-adjusted efficiency over B0 and B1 on held-out paired tasks, with no unacceptable task-success regression.
- Token overhead includes predictions, protocol instructions, and feedback. Initial target: below 2% of total tokens, reported with absolute counts.
- No permission bypasses or changed command semantics; no unacceptable adapter latency.

If missed predictions do not predict a useful opportunity, or feedback does not improve outcomes relative to logging-only, remove the nudge mechanism. If overhead outweighs savings, keep at most an opt-in offline review tool.

## 10. Implementation phases

### Phase 0 — Feasibility spikes

- Confirm Rook can add structured prediction metadata to its custom bash tool without changing the command or permission decision.
- Confirm how to attach feedback to the next model-visible tool result without forcing another turn.
- Determine which command outcomes, durations and model usage the host actually exposes.
- Prototype shell-comment carriage separately for Claude Code, Codex and OpenCode; test parsing, shell behavior, approvals, output feedback and failure events.
- Measure per-event adapter overhead, including process startup if a CLI hook is used.
- Review prior art for prediction-error feedback in tool-using/coding agents before making novelty claims.

**Exit:** Rook has a working end-to-end spike and at least one other host has a demonstrated, safe prediction and feedback path. Otherwise, narrow the interoperability claim and continue Rook-only.

#### Feasibility spike results (2026-11-19)

- **Rook/Pi structured field:** implemented locally as optional `expect: { outcome, evidence? }` metadata on Rook's Bash tool. The shell receives the original `command`; the Rook policy test verifies a command with the extra field still follows the same routine-command approval path.
- **Pi result feedback:** implemented as an opt-in (`PLYTH_SPIKE_FEEDBACK=1`) `tool_result` extension. Pi's pinned `@earendil-works/pi-coding-agent` 1.5.2 contract allows this hook to patch content before the tool result is delivered. The spike compares exit-code-derived `pass`/`fail` to the expectation and appends one short observation only on an outcome miss. It preserves structured output, makes no model call, and does not start another turn.
- **Result limitations:** Pi's Bash structured output exposes `exit_code`, bounded output, truncation, and wall time for completed shell processes. Thrown/cancelled/timed-out calls arrive without that structured exit code; `isError` alone does not distinguish those cases from other errors, so this spike leaves them unscored rather than guessing `error`, `pass`, or `fail`. Blocked/pre-validation calls do not reach `tool_result` and are outside this spike.
- **OpenCode model-issued probe:** OpenCode 1.19.4 loaded a temporary local plugin in an isolated directory. The model called a structured `plyth_probe` tool with `expect.outcome: "fail"`; the synthetic tool made no command call and returned `pass`. `tool.execute.after` appended the miss observation to the existing result, preserved the original output and metadata, and the model acknowledged the feedback in the next step. No extra continuation or shell execution was triggered by the plugin.
- **Rook live CLI attempt:** the existing focused Rook/Pi integration tests pass (12 tests across the spike and Bash tool), but a one-shot CLI probe remained in plan mode and exposed no Bash tool. Therefore actual model-issued Rook prediction/feedback remains unverified; the tested Rook hook/tool path and the live OpenCode probe meet the feasibility-spike exit gate, while Rook pilot measurements remain Phase 2 work.
- **Second-host contracts:** current official Claude Code and Codex hook references document command input/result visibility and model-visible post-tool context. This verifies documented feedback mechanisms, not end-to-end prediction transport. No Claude Code or Codex executable is installed in the development container.
- **Not yet verified:** shell-comment prediction parsing/permission behavior in any host, whether models reliably emit a prediction, delivered feedback in a live model turn, prompt-cache behavior, provider/token overhead, and cross-platform behavior.

**Phase 0 status:** complete. Rook/Pi has structured prediction transport and tested in-result feedback; OpenCode has demonstrated structured prediction carriage and model-visible feedback in an executable model-issued tool call. Keep the Rook live model trial, prediction coverage, latency, prompt-cache behavior, token overhead and cross-platform checks as pilot measurements, not prerequisites for core protocol work.

### Phase 1 — Core protocol and judge

- Implement versioned types, schema validation, outcome normalization interface and pure judge functions.
- Add fixtures for all verdicts, evidence matching, missing output, truncation, timeout, cancellation and malformed data.
- Add per-session caps and deduplication.
- Keep all errors fail-open.

**Exit:** deterministic fixture replay; no raw event logging; core evaluation under 1 ms for bounded events in the target runtime (adapter startup measured separately).

#### Phase 1 implementation (2026-11-19)

- Added a dependency-free TypeScript package with protocol types, strict bounded event parsers, host exit-result normalization, correlated deterministic judging, evidence-label matching, advisory feedback formatting, in-memory verdict counters, and a miss-only session gate capped at five with deduplication.
- Added deterministic fixture replay for hit, miss, vague, none and unscorable outcomes, including malformed and mismatched events. Tests cover bounds, fail-open behavior, normalization, feedback deduplication/caps, and counter snapshots.
- Validation: `npm test` (6 tests), `npm run build`, Prettier check, and `git diff --check` pass. A local 10,000-iteration warm microbenchmark measured judge latency at p50 1.17 μs, p95 6.01 μs, and p99 11.27 μs; this is an indicative container measurement, not a cross-runtime performance claim. The implementation is in-process and has no command execution or persistence path.

**Phase 1 status:** complete for the stated protocol/judge exit criteria. The warm microbenchmark is below 1 ms for bounded events; repeat under the target adapter/runtime during integration. Session event-order integration remains future adapter work; no persistence or raw event logging is included.

#### Phase 2 implementation (2026-11-19)

- Added package exports/build metadata so the TypeScript core can be consumed by Rook; its development dependency is a sibling checkout (`file:../plyth`), and Rook CI checks out both repositories side-by-side and builds Plyth before Rook.
- Extended the in-memory counter with eligible/predicted/invalid/specific coverage, verdict counts, and aggregate host command durations. Added `evidenceUnavailable` so an observed outcome can still be scored while unavailable/truncated evidence is marked vague.
- Rook's inline observe-only Pi extension classifies eligible Bash commands, carries structured predictions without modifying the command, correlates bounded lifecycle events, normalizes completed exit codes, extracts at most 16 bounded output labels, treats missing results as unscorable, and reports counters through `/plyth`. No result feedback or persistent event ledger is enabled.
- Rook verification: `npm run lint`, `npm run typecheck`, 60 focused Pi/Bash/gateway/PTY tests, `npm run build`, mock smoke, and `npm pack --dry-run` pass. Plyth's six tests, build, package dry-run, Prettier check, and `git diff --check` pass.
- Local commits: Plyth `a482366`; Rook `17ebe17`.
- No model-issued Rook pilot was run in this phase. Fixture expectations are not a substitute for agent predictions; prediction coverage, specificity, token/cache overhead, and latency require controlled live trials.

**Phase 2 status:** observe-only implementation is complete. The 2026-11-20 matched-task feasibility runs are documented in `status.md`: both B0 and B1 solved the focused tasks, but B1 evidence matching missed in all four isolated runs and B0 emitted no predictions. This is not enough to claim effectiveness or overhead, and the Phase 2 evidence is weak. Keep feedback default-off; any B2 run is an explicitly experimental, opt-in comparison, not a passed pilot gate.

### Phase 2 — Rook observe-only pilot

- Add an optional `expect` field to Rook's custom bash tool schema and a stable, concise instruction at session start.
- Record verdicts and counters, with feedback disabled.
- Run the coding evaluation and trap fixtures; inspect prediction specificity and host costs.

**Exit:** enough predictions and sufficiently interpretable outcomes to decide whether the hypothesis warrants feedback. Do not infer benefit from hit rate alone.

### Phase 3 — Rook advisory feedback

**Rook-first completion update (2026-11-20):** the prior bounded study is retained as historical evidence of insufficient benefit. A subsequent source audit identified the missing planned history baseline and opt-in trace ledger. The user authorized completing those features and deferring other-host integrations. The baseline, trace schema/Rook storage and controls, explicit off/observe/feedback modes, offline uncertainty helpers and setup/privacy/capability documentation are now implemented. This completes the Rook-first functional scope, not the effectiveness gates below. Do not reinterpret the old study as testing these newly completed features or enable feedback by default.

**Decision (2026-11-20): bounded evaluation complete — NO-GO for advisory-product expansion.** Positive exit gates were not passed. The final same-revision B0/B1/B2 evaluation across three multi-file tasks accepted all 9 submitted repairs, but one B1 session was interrupted by approval automation before final agent verification. All 11 completed B1/B2 predictions were specific hits; B2 delivered zero messages. There is no natural intervention effect or demonstrated quality-adjusted efficiency improvement. Stop this evaluation loop; preserve experimental code default-off and do not advance to Phase 4 on an unsupported effectiveness claim. See `evals/phase3-final/report.md` for the preregistered protocol, retained data, uncertainty, and an explicit distinction between an investment no-go and proof of universal ineffectiveness. Earlier progress notes below are historical, not an instruction to keep running trials.

- Enable bounded feedback on specific, scorable misses behind a feature flag.
- Run B0/B1/B2 paired tests and publish per-task outcomes, cost and uncertainty.
- Keep mandatory host verification and permissions unchanged.

**Implementation progress (2026-11-20):** Rook has an experimental opt-in arm controlled by `ROOK_PLYTH_FEEDBACK=1`; unset preserves B1 observe-only behavior. It uses the core session gate (specific scorable misses only, deduplication, at most five messages per session), appends to the existing tool result, preserves structured output, and resets per session. Core and adapter tests cover the feedback path. A native-macOS B0/B1/B2 exploratory comparison ran two coding tasks in separate clean workspaces per condition. All six runs solved the tasks and passed all focused tests. B1 and B2 each produced two evidence misses; B2 appended the expected feedback to the existing test result on both. A staged retry task requiring a test before and after editing initially elicited no prediction on the first test, so feedback again arrived only after final verification. Rook guidance was then tightened to favor exact known test/error labels over prose summaries, and staged retry plus normalize-labels triplets were repeated: all six condition-runs passed all 3 tests; B1/B2 predicted all 3 outcomes per task, each with 2 specific evidence hits and 1 vague initial-failure prediction, and neither condition emitted feedback. Two green-starter mutation probes followed. In the natural-prediction triplet, B1/B2 both predicted the existing tests would pass, matched output, and fixed the uncovered mutation in all conditions. In a separate explicitly controlled false-prior triplet, all conditions again made the same fix and passed; B1/B2 predicted `fail` with exact evidence, and B2 delivered one bounded message on the initial unexpected pass before edits. The controlled run verifies timely delivery, but B0/B1/B2 recovery and outcomes were indistinguishable in this one task; it does not establish usefulness, quality-adjusted efficiency, natural miss frequency, or overhead. A further held-out natural-prediction set covered read-only tool policy, expiration boundaries, and retry-delay clamping (three tasks × B0/B1/B2, isolated). All nine runs made the same correct changes and passed their final 3-test suites. B1/B2 predicted all commands, but on each task their initial fail prediction had no evidence (vague), while their final pass prediction matched a specific test label (hit); no specific misses occurred and B2 delivered no feedback. A test-aware prompt comparison then used port-boundary and duplicate-membership tasks under current versus “read focused test names first” prompts (B0/B1/B2, isolated). In the current-prompt arms, all 6 runs respected test-before-edit sequencing; B1/B2 initial fail predictions again omitted evidence. In the test-aware arms, 5/6 runs edited before the required starter-test run and are not comparable; the sole compliant run predicted `fail` with evidence naming a test that actually passed while other tests failed. The judge counted this as a hit because the adapter treats any printed test-name line as evidence, without preserving whether Node marked it `✔` or `✖`; no feedback fired. This prompt variant did not establish an actionable early-miss improvement and exposed an evidence-label specificity limitation to address before further effectiveness trials. Phase 3 exit criteria remain pending; do not enable by default or claim benefit.

**Evidence-label correction (2026-11-20):** Rook now preserves status for Node's spec-reporter test names during evidence extraction: `pass` results expose only `✔` names and `fail` results only `✖` names. Output from other test reporters and build/diagnostic commands retains the prior bounded-line fallback. Focused adapter regression tests verify that a passing Node test name cannot validate a failed-test prediction, and that matching failed/passing labels still score as hits. Adapter tests, typecheck, build, formatting, and diff checks pass. Run a new natural paired B0/B1/B2 trial before claiming that the corrected evidence mechanism improves recovery; keep feedback default-off.

**Post-correction live check (2026-11-20):** On one isolated port-boundary B0/B1/B2 triplet, all conditions fixed the same issue and passed all 5 tests. B1/B2 both made a specific initial `fail` prediction whose evidence named a failed test and a specific final `pass` prediction whose evidence named a passed test; each scored two hits and zero misses. B2 emitted no feedback. This validates status-aware live scoring but supplies no intervention-effect evidence; Phase 3 remains open and feedback default-off.

**Post-fix natural holdout (2026-11-20):** Added three varied tasks (seat reservation idempotence, same-origin redirect validation, page-count rounding), each in isolated B0/B1/B2 workspaces. All 9 runs made the same correct repairs and passed their final suites; B1/B2 each scored all 6 eligible predictions as specific hits, with no misses or feedback. Approximate task timings ranged 31.8–70.5 seconds; provider token/cache counts varied substantially by arm and task, so no efficiency claim is supported. The corrected status-aware evidence path now scores these ordinary Node test outcomes as expected, but no natural B2 intervention has yet been observed. Phase 3 effectiveness and cost gates remain open; keep feedback opt-in.

**Exit:** pilot gates in section 9.4 pass. Otherwise revise or stop.

### Phase 4 — Rook-first packaging; other adapters deferred

- Publish Rook setup, capability limits, modes and privacy/export/deletion instructions.
- Validate local package consumption and the Rook-specific contracts. No second-host adapter is required for the current scope.
- Add offline `plyth review` only if trace data shows it helps users diagnose real failures.

**Implementation status:** Rook-first documentation and package metadata are present; other-host implementations and cross-host parity checks are deferred. Package readiness does not grant an effectiveness claim or turn feedback on by default.

**Exit for Rook-first implementation:** shared core fixtures and focused Rook integration checks pass, and setup/capability/privacy limitations are documented. Cross-host fixture parity becomes a requirement only if a second adapter is explicitly authorized.

### Phase 5 — Conditional research extensions

- Test adaptive effort after misses only where a host supports it safely and within a run.
- Test memory citations only with explicit provenance and Rook-owned memory APIs.
- Add advanced statistical models one at a time, each against the simple rules and B0/B1/B2 baselines.

Do not start this phase just to add sophistication.

## 11. Security and reliability

- Treat predictions, command strings, output, repository state and model-generated annotations as untrusted input.
- Bound JSON size, field lengths, evidence labels, event count and session retention.
- Never execute or rewrite a command as part of judging its expectation.
- Preserve the host's original permission/approval pipeline. PLYTH cannot authorize, deny, or escalate commands.
- Do not put raw command output, code, prompts, secrets, or absolute paths in the default ledger.
- Parse external hook input defensively; malformed input returns no recommendation and does not block host behavior.
- Ensure feedback is advisory, non-reentrant, capped and does not trigger unbounded continuation loops.
- Handle parallel tool calls by correlating on host call IDs and judging each independently; do not assume sibling results are available at a tool preflight boundary.
- Document data deletion and disablement for every adapter.

## 12. Risks and mitigations

| Risk                                                    | Mitigation                                                                                                         |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Agent emits no prediction or vague predictions          | Keep prediction optional; measure coverage and specificity before enabling feedback.                               |
| Agent makes trivial predictions to appear accurate      | Compare with a history baseline; report specificity and outcome distributions, not raw accuracy alone.             |
| Misses are not actionable                               | Test miss-to-recovery relationship; disable feedback if it does not beat logging-only.                             |
| Feedback distracts or causes overthinking               | Keep messages short, neutral, capped and only for specific scorable misses.                                        |
| Extra output tokens exceed savings                      | Include prediction and feedback tokens in paired end-to-end metrics.                                               |
| Hook subprocess adds latency                            | Prefer in-process plugins or persistent adapters; measure startup, do not assume it is negligible.                 |
| Shell annotation alters permissions or command behavior | Prefer structured tool metadata; treat comment syntax as experimental and host-specific.                           |
| Different hosts expose different result semantics       | Capability declarations and adapter-specific normalizers; use `unscorable` rather than guessing.                   |
| Prompt caching is disrupted                             | Keep adapter instructions and tool schema stable; no per-turn system prompt rewrite; verify behavior per provider. |
| Outcome hit is mistaken for correct reasoning           | State explicitly that it is one prediction outcome, not proof of the agent's mental model or task correctness.     |
| Novelty is overstated                                   | Complete prior-art search; describe the contribution as a practical integration unless evidence supports more.     |
| Duplicate/stale project knowledge                       | Rook owns factual memory; do not write a separate procedure/memory system in v0.1.                                 |

## 13. Research basis

These sources motivate hypotheses and design constraints. Their reported results are benchmark-specific and do not establish that PLYTH will help Rook.

- Huang et al., _Large Language Models Cannot Self-Correct Reasoning Yet_, ICLR 2024: intrinsic self-correction without external feedback is unreliable. https://arxiv.org/abs/2310.01798
- Kamoi et al., _When Can LLMs Actually Correct Their Own Mistakes?_, TACL 2024: external, reliable feedback is an important condition for correction. https://arxiv.org/abs/2406.01297
- Cuadron et al., _The Danger of Overthinking: Examining the Reasoning-Action Dilemma in Agentic Tasks_, 2025: analyzes overthinking patterns in software-agent trajectories; results motivate measuring action/analysis balance. https://arxiv.org/abs/2502.08235
- Chen et al., _Do NOT Think That Much for 2+3?_, 2025: studies overthinking and adaptive inference effort. https://arxiv.org/abs/2412.21187
- Snell et al., _Scaling LLM Test-Time Compute Optimally_, 2024: compute allocation effectiveness varies with prompt difficulty. https://arxiv.org/abs/2408.03314
- Xia et al., _Agentless: Demystifying LLM-based Software Engineering Agents_, 2024: a simple localization/repair/validation workflow is a useful baseline against complex agent loops. https://arxiv.org/abs/2407.01489
- Yang et al., _SWE-agent: Agent-Computer Interfaces Enable Automated Software Engineering_, 2024: tool-interface design affects coding-agent performance. https://arxiv.org/abs/2405.15793
- Anthropic, _The “think” tool_, 2025: reports benefits in particular sequential/tool-heavy settings and limits elsewhere. https://www.anthropic.com/engineering/claude-think-tool
- Manus, _Context Engineering for AI Agents_, 2025: practitioner guidance on stable prefixes, tool interfaces, persistent state, and preserving error feedback. https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus

### Prior art status

The idea of predictions followed by prediction-error feedback is not claimed as novel in general; predictive coding, forecasting, model-based agents and world models are established areas. The possible contribution is a small, agent-neutral, coding-task integration that collects explicit pre-command expectations and tests whether mismatches are useful intervention points. This needs a focused prior-art search before any uniqueness claim.

## 14. Definition of done: v0.1

1. A versioned TypeScript core validates and scores supported predictions deterministically.
2. Malformed, missing, truncated, cancelled and host-specific results are handled without unsafe guessing or blocking the host.
3. Rook's reference adapter preserves the exact command and existing permission behavior.
4. Ship explicitly as Rook-first without claiming broad agent support. Other coding-agent adapters and cross-host fixture parity are deferred by scope decision.
5. The default ledger stores only documented minimal metadata and is local, optional and deletable.
6. Observe-only, logging-only and feedback modes can be compared independently.
7. Reproducible paired evaluations report task success, cost, tokens, latency, prediction coverage and uncertainty.
8. Feedback is capped, deduplicated, advisory and does not force extra model calls or turns.
9. No benchmark result, novelty claim, or savings estimate is presented without workload description and supporting data.
10. A negative result can stop or narrow the project rather than trigger complexity added to rescue the thesis.

## 15. First milestone

Build one vertical slice: Rook supplies structured prediction metadata for a test command; the command runs unchanged; a Pi event supplies the actual outcome; PLYTH returns a deterministic verdict; the adapter records counts and, only in a separate advisory mode, appends a capped miss observation.

Use a small fixed set of trap fixtures plus the current Rook coding evaluation. First measure whether the model predicts and whether misses are informative. Do not build a Rust engine, database, learned policy, budget allocator, generalized workflow memory, or multi-agent controller before this result exists.

## 16. Decisions and defaults

| Decision                         | Initial default                                               | Revisit when                                                     |
| -------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------- |
| Core language                    | TypeScript                                                    | Measured startup/distribution cost requires a different runtime. |
| First host                       | Rook                                                          | The vertical slice is validated.                                 |
| Second host                      | Choose by feasibility spike; Claude Code is a candidate       | Actual prediction carrier and feedback semantics are tested.     |
| Rook adapter ownership           | Adapter code in the Rook repo; shared contract/core in Plyth  | Packaging and release experience show a better boundary.         |
| Feedback mode                    | Observe-only first, then opt-in advisory                      | Paired evaluation passes.                                        |
| Statistics                       | Counts and offline uncertainty; no runtime statistical policy | Data identifies a failure simple rules cannot address.           |
| Cross-agent prediction transport | Structured metadata preferred; shell comments experimental    | Host adapters prove semantics and permissions are preserved.     |

## References for host integration (verify pinned versions)

- Pi extensions: https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/docs
- Claude Code hooks: https://code.claude.com/docs/en/hooks
- Codex hooks: https://developers.openai.com/codex/hooks
- OpenCode plugins: https://opencode.ai/docs/build/plugins

**Status:** the Rook-first functional implementation now includes validation/judging, counters, bounded feedback, revision-invalidated history comparison, opt-in minimal traces with local export/deletion controls, independent modes, and offline uncertainty utilities. Setup/privacy/capability documentation is included. Other coding-agent integrations are deferred. The earlier bounded evaluation remains insufficient benefit evidence and predates the newly completed baseline/trace features; no effectiveness, isolated-overhead, savings or novelty benefit is claimed. Feedback stays default-off; conditional Phase 5 research remains outside this completion scope.
