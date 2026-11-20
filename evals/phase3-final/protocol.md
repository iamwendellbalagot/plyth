# Final bounded Phase 3 decision

Registered before provider runs. Implementation/guidance remains frozen at Rook
`b93b5d396f7d65ee44193b297e511237854f0019` and Plyth
`15b2bcedc4a6cb16fc983b7fe83431f277fca443`.

## Design

- Three newly authored multi-file tasks: pagination, concurrent TTL cache, order pricing.
- One run per task and condition (9 total), shuffled with seed 20261120.
- Same native macOS runtime, existing OpenAI Pi login and selected model; no Docker.
- B0 is the same Rook revision with only PLYTH extension registration, bash
  prediction schema and prediction description removed in an isolated worktree.
  The remaining tools, permissions and execution behavior are unchanged.
- B1 uses the frozen observe-only host; B2 changes only `ROOK_PLYTH_FEEDBACK=1`.
- Each run starts from a separate clean repository. Agent may edit only `src/`.
  Visible tests are immutable; their hashes and changed paths are independently checked.
- Identical task prompts require an unchanged full-suite test first, then permit
  autonomous diagnosis, edits and at most five more approved test commands.
  No forecast, evidence label or deliberately incorrect assumption is supplied.
- Only exact unit, integration and combined Node test commands are approved once
  per invocation. No other shell commands, session grants, or permission bypasses.
- Per-run limit: 360 seconds after prompt submission, at most six test commands.
  Keep unsuccessful, noncompliant and timed-out attempts; no replacement runs.
- Trusted post-run checks rerun the unmodified fixture tests against submitted
  source. Those checks are evaluation-only and excluded from agent command counts.

## Measurements

Record task success (trusted checks plus allowed edits), first-test ordering,
tool/test counts, predictions, independently replayed verdicts, feedback delivery
and whether meaningful edits/tests remain after feedback. Record provider
input/output/cache-read tokens separately, prompt-to-settlement wall time and
approval wait. ChatGPT subscription cost is not a provider-billed dollar estimate.
Do not use an LLM rubric as ground truth or infer causal savings from one trajectory.

## Decision rule and limits

A go requires a natural, specific, timely B2 intervention with observable useful
recovery, a task-success or quality-adjusted efficiency improvement over **both**
B0 and B1, and no success regression. The original pilot's 70% prediction-coverage,
2% token-overhead, latency and permission gates remain in force; these small runs
cannot establish population-level effects or precise isolated token overhead.
Report absolute data and uncertainty; descriptive success intervals do not make
three tasks independent representative samples.

If no qualifying interventions occur, or improvement cannot be established,
recommend **no-go for expanding the advisory product/Phase 4 on a benefit claim**.
Close this bounded evaluation as negative/inconclusive, keep feedback off by
default, and stop the repeated synthetic-trial loop. This is a product investment
decision under insufficient evidence, not proof of universal ineffectiveness.
Do not delete the experimental implementation or start another evaluation without
a new user decision.
