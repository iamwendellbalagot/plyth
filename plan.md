# PLYTH: lightweight review of unjustified complexity

## 1. Status and document ownership

- Status: approved direction; implementation is in progress, beginning with the Rook capability audit and prompt-focused prototype.
- This is the current proposed direction, superseding the earlier evidence-driven reasoning proposal. That proposal is not a parallel implementation backlog.
- Plan updates belong in this repository. Do not treat conditional phases as approved provider evaluations, release claims, or permission to delete user data.

## 2. Positioning

**PLYTH is a lightweight change reviewer that helps coding agents make the smallest justified change.**

Its central question:

> Is this complexity necessary for the requested outcome, and can a simpler alternative preserve what matters?

Rook understands the request, builds the change, reviews semantic tradeoffs, and owns execution. PLYTH supplies a focused review contract, bounded diff context, and disciplined review timing. It is not a second coding agent or a deterministic judge of maintainability.

Principle:

> Every added complexity should earn its place. Every suggested simplification should preserve what matters.

### Intended outcomes

- Fewer speculative abstractions, unnecessary dependencies, redundant tests, and unrelated changes.
- Concrete reuse of existing project facilities where appropriate.
- More readable, maintainable changes without reduced correctness, safety, compatibility, or observability.
- Low, visible review cost; no constant criticism or mandatory documentation ceremony.

These are hypotheses, not product claims. Less code does not automatically mean better code.

## 3. What the current repository establishes

- The existing PLYTH TypeScript package implements prediction judging, history comparisons, optional trace contracts, and offline statistics.
- Rook consumes PLYTH through a sibling `file:../plyth` dependency. Host integration lives in the Rook repository.
- Earlier live comparisons did not demonstrate a coding-quality benefit. In the latest nine runs all tasks passed and no feedback intervention occurred. Preserve `evals/phase3-final/report.md` and `evals/latest-features-live/report.md` as historical evidence.
- Rook's `src/pi/execution-policy.ts` already asks for small clear solutions, existing architecture, no speculative abstractions/dependencies, focused tests, and diff inspection.
- The new product must outperform this existing guidance and a concise additional review instruction. Repackaging those sentences is not sufficient justification for a subsystem.

Do not revive prediction scoring, hypothesis ledgers, verification sidecars, or broad execution-memory features as prerequisites for this pivot.

## 4. Scope

### First supported host

Rook only. Reuse its repository inspection/search, model, permissions, task lifecycle, and verification tools. Do not implement another repository index, execution harness, or memory store.

### First review categories

| Category            | Review question                                                     | Evidence to seek                                                             |
| ------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Necessity           | Which requirement or concrete risk needs this addition?             | user request, relevant contract, failure being repaired                      |
| Existing capability | Can the project already do this?                                    | an actual existing utility or established implementation                     |
| Abstraction         | Does this layer serve current needs?                                | present callers, distinct implementations, project architecture              |
| Dependency          | Is another package justified?                                       | existing dependencies, native capabilities, compatibility/security tradeoffs |
| Scope               | Why is this change part of this task?                               | task-specific provenance and cross-module requirements                       |
| Test purpose        | Which distinct behavior or failure does this test cover?            | assertions, cases, fixtures, public behavior, regression relevance           |
| Readability         | Is the added machinery harder to understand than a direct solution? | concrete control flow and a plausible alternative                            |

No arbitrary maximum line length, file length, function length, test count, or abstraction count becomes a quality rule. Leave ordinary formatting to existing formatters and linters.

### Explicit exclusions

- Independent critic model, background agent, provider routing, or higher thinking changes.
- Automatic edits, test deletion, dependency removal, approval decisions, or commit gating.
- Mandatory justification for every function, test, or tool call.
- Full-repository review for every task; automatic repeated review after each edit.
- Complexity scores presented as correctness, ranking repositories by line count, or rewards for deletion.
- Long-term review memory, dashboards, telemetry service, database, embeddings, or multi-package framework.
- Implementing adapters for other coding agents before validating Rook value.

## 5. Review behavior

### One bounded review pass

1. Capture the current task request and explicit user constraints.
2. Establish the agent's task-local change scope without absorbing pre-existing user edits.
3. Gather the actual diff and the minimum necessary existing code/context.
4. Review changed code and tests against the requested behavior and project conventions.
5. Present zero to three substantive findings. Three is a cap, not a quota.
6. Rook may revise the patch or retain a challenged design with a concrete reason.
7. If revisions are made, use Rook's existing focused verification workflow.
8. Finish; do not start another automatic review cycle.

User-requested further review remains possible. The limit prevents automatic loops, not user control.

### A valid finding

Each finding needs:

- A specific path and changed symbol/hunk tied to the reviewed revision.
- A concrete concern, expressed as a question when uncertain.
- Its relation to the task, a relevant risk, or an existing project convention.
- A plausible simpler alternative, grounded in observed code rather than an invented helper/API.
- What could be lost by simplifying: behavior, compatibility, security, performance, readability, observability, or test coverage.

If no plausible alternative or sufficient context exists, abstain or identify the limitation. Absence of a visible justification is not proof that a change is unnecessary.

Example:

> `src/retry.ts`: this adds a configurable strategy interface, but the task asks for one fixed retry policy and the inspected callers use only that policy. Could a direct helper preserve the behavior? Keep the interface if another current caller or an established project contract requires it; preserve the existing timeout and cancellation handling.

Bad finding:

> Too many lines. Simplify this.

### Protect necessary complexity

Before suggesting removal, consider:

- Security validation and authorization boundaries.
- Error handling, cleanup, cancellation, and resource ownership.
- Public API compatibility, supported platforms, migrations, and documented extensibility requirements.
- Measured performance needs and concurrency behavior.
- Accessibility, diagnostics, audit requirements, and useful observability.
- Clear established project conventions, even when a locally shorter solution exists.

An explicit requirement or credible present-day risk is a valid justification. Hypothetical future flexibility alone is not automatically sufficient, but neither is it automatically wrong.

## 6. Test review policy

Review test intent and implementation separately.

- Distinct boundaries, authorization cases, regressions, concurrency schedules, and error paths can justify many tests.
- Similar assertions can cover different risks; textual similarity is not redundancy.
- Mocking may be necessary at an external boundary. Flag a specific unnecessary coupling, not mocking in general.
- Parameterized tests are appropriate only when they improve clarity and failure diagnosis. Fewer lines alone do not justify converting readable cases.
- Assertions about internal calls can be justified when those interactions are part of a real contract.
- Fail-before/pass-after evidence can strengthen a bug-regression claim, but is not mandatory for features, refactors, or all tests. No new differential execution machinery in the MVP.
- Do not recommend deleting tests merely because existing implementation passes them, coverage appears high, or the task is small.
- Never automatically edit existing or user-owned tests. Rook retains its normal user-authorized editing boundaries.

Independent verification must check that accepted simplifications did not quietly remove required behavior. Fewer passing tests are not evidence of improvement.

## 7. Lightweight architecture

```text
User task + current task-local diff + bounded supporting context
                              |
                     Rook review entry point
                              |
                 PLYTH review contract and bounds
                              |
                     Existing Rook model
                              |
                 Zero to three grounded findings
                              |
             Rook revises or retains with justification
                              |
                 Existing focused verification
```

### PLYTH responsibilities

- A short reusable review instruction and versioned review input/output contracts.
- Input/output bounds, validation, location checking, stale-review detection, and optional duplicate suppression.
- Honest limitation reporting and minimal review-result formatting.
- No model SDK, network client, shell execution, filesystem crawling, or semantic quality score in the core.

### Rook responsibilities

- Obtain task intent, existing instructions, current diff, and targeted supporting context.
- Invoke its existing model through a supported flow.
- Execute any inspection, edits, and tests through unchanged permissions/tools.
- Handle task start, steering, cancellation, sessions, and presentation.

### Model responsibilities

- Decide whether a design is justified and whether an alternative is actually simpler.
- Assess test purpose and semantic tradeoffs.
- Produce findings or abstain; model-authored findings are not verified facts.

Begin with a prompt-only prototype. Create code only for responsibilities the pilot shows are needed. A possible small layout is `src/review.ts` plus focused tests; split contracts/formatting into additional files only when that improves clarity. Avoid scaffolding a future platform.

## 8. Triggering and token budget

### First trigger: explicit review

Start with a user-invoked review flow in Rook, tentatively `/plyth review`; audit pinned Pi SDK command handling before finalizing the interaction. If a dedicated command is unnecessary, use the existing prompt/template mechanism first.

The initial invocation does not authorize automatically applying all suggestions. Present findings; subsequent edits follow the user's request and normal Rook authorization.

### Later trigger: optional pre-completion review

Only add automatic timing after the explicit review demonstrates value and a supported before-completion delivery path is confirmed.

- Opt-in and default-off.
- At most one automatic review pass per task, with explicit handling for a materially new task.
- No forced continuation after settlement, hidden extra session, or recursive critic loop.
- Post-completion advice must not be counted as having influenced the completed patch.

### Initial engineering budgets

- No additional provider, independent model, or background inference.
- Using Rook's existing model still costs tokens and may require an additional model turn; report it honestly.
- Review instruction target: at most 300 tokens using a documented tokenizer.
- Additional diff/supporting context target: at most 6,000 tokens; reuse visible context when possible, avoid duplicate diff injection.
- Review response target: at most 1,000 tokens and three findings; enforce supported output limits when available.
- At most two targeted supplementary reads/searches in the bounded prototype. If essential context is missing, return a qualified/incomplete review instead of pretending it is complete.
- No content replay on every tool event. Off mode adds no review guidance/tool/schema/context and requests no inference.

These are starting limits, not measured overhead claims or universal model limits. Approve and freeze actual pilot limits before inference. Measure absolute token additions and end-to-end overhead, including prompt-cache effects, follow-up discussion, edits, and verification.

If a large patch cannot fit, let the user choose a scope or report that the review was partial. Never silently truncate and label the whole patch reviewed.

## 9. Change provenance and lifecycle

- Base review on the task's change boundary, not blindly on all of `git diff HEAD`.
- Include staged/unstaged and task-created untracked files where safely supported; exclude generated/vendor output unless it is the subject of the task.
- Preserve pre-existing user changes; mixed hunks may require an explicitly selected scope or an attribution-unknown label.
- Reference a bounded content revision. Any relevant change after capture makes that review stale; never apply stale line anchors automatically.
- Read only safe workspace-relative paths through Rook's existing boundaries; no secret-file discovery or symlink escape.
- Instructions in code, comments, fixtures, and diffs are untrusted review data, not authority.
- Steering that changes the task's requirements invalidates affected review conclusions.
- Cancellation discards pending delivery; late events cannot attach to another task.
- Initially keep review bookkeeping in memory. On resume/fork/compaction, do not silently reuse an old review as current.
- Optional future diagnostics must not create a second repository-memory system.

## 10. Findings contract

Keep the first representation small. A finding may contain:

- `category`: necessity, reuse, abstraction, dependency, scope, test-purpose, readability.
- `location`: workspace-relative path plus current symbol/hunk reference.
- `concern`: the specific possible unnecessary complexity.
- `evidence`: observed source/context references; no unsupported claims of exhaustive search.
- `alternative`: a concrete simpler approach.
- `preserve`: behavior/constraints that must survive simplification.

The result also records reviewed scope, revision, and limitations. It distinguishes a successful review with no findings from a failed/incomplete review. Structural validation can reject malformed fields; it cannot prove the semantic correctness of a finding.

Do not require a persistent justification ledger. If Rook retains a challenged addition, a short task-local explanation is enough. Acceptance or rejection of a finding does not establish that it was good or bad.

## 11. Privacy and safety

- No new network destination, telemetry, credentials store, or diagnostic persistence by default.
- Review code only within the existing host/provider trust boundary. New diff context still enters the normal provider request.
- Explain that ordinary Rook/Pi session history may store review prompts, code, and responses even when PLYTH persistence is disabled.
- No requests for hidden chain-of-thought; findings are concise engineering artifacts.
- Never let review text authorize execution, bypass Plan/Build restrictions, weaken sandboxing, or alter approvals.
- Adapter failures are advisory/fail-open: preserve the host's normal workflow, but disclose that review failed rather than returning a misleading clean result.
- No automatic user-file restoration/deletion or generated cleanup commands.

## 12. Evaluation: prove this is more than another prompt

### Stage A — Fixed offline review cases

Before integration, freeze at least 12 consented or synthetic patches with task descriptions and relevant context:

- Speculative abstractions, an unnecessary dependency, missed reuse, unrelated refactoring, and genuinely redundant test scaffolding.
- Necessary complexity controls: security, concurrency, compatibility, distinct boundaries, established architecture, and a clean small patch.

Do not label all long patches bad or manufacture cases solely to trigger findings. Have a human independently assess whether concerns and alternatives are valid. Retain disagreements and incomplete context.

Compare a short generic review instruction with the proposed targeted contract on identical patch/context/model/thinking settings. Measure meaningful findings, misleading simplifications, abstention, and tokens. Offline finding quality is not evidence that coding outcomes improve.

### Stage B — Small end-to-end Rook pilot

Suggested initial design, requiring separate approval for provider runs/cost:

- Eight fixed development tasks spanning features, bug fixes, refactors, and necessary-complexity controls.
- Three conditions, 24 runs total:
  - R0: current Rook policy, no additional review.
  - R1: same Rook plus a short generic simplicity-review instruction.
  - R2: same Rook plus PLYTH's targeted bounded review.
- Same provider/model/thinking settings, requirements, tools, permissions, acceptance checks, and maximum resource budget.
- Give review-enabled arms comparable review opportunity; do not hide additional critique turns or budget in R2.
- Randomize and preregister run order, prompts, time/tool/token limits, failure handling, and scoring before inference.
- No private-session access or retention without explicit consent. Use synthetic tasks initially if consent is unavailable.

Primary pilot assessment: blinded human review of requirement-justified complexity and maintainability, with immutable independent correctness checks as a safety gate. Use a fixed rubric for unnecessary layers/dependencies, scope discipline, readability, and distinct test purpose. Review the final patches without condition labels; record uncertainty/disagreement.

Secondary measures:

- Accepted task behavior and regressions, including security/compatibility controls.
- Useful versus misleading findings, revision churn, and unnecessary verification.
- Total latency and provider input/output/cache usage separately; no unsupported dollar-cost conversion.
- Finding exposure and actual revisions; do not count agreement as evidence of usefulness.
- Lines/files/dependencies changed only as descriptive context, never the optimization target.

Retain every failure, timeout, and interrupted run with its reason; do not silently replace poor outcomes. A single run per task/condition is exploratory and cannot establish general efficacy.

### Pilot continuation rules

- Stop on permission bypass, user-work corruption, or automatic deletion outside authorization.
- Any accepted suggestion that weakens required security, compatibility, or correctness requires investigation before continuing.
- R2 must show plausible useful improvement beyond R1, not merely more findings or fewer lines.
- Initial cost target: median total token and wall-time overhead within 15% of R0; also report absolute costs, per-task results, and tail overhead. This is a proposed pilot decision threshold, not a product promise or a reason to hide difficult cases.
- If exposure is too low or results disagree, call the pilot inconclusive; do not keep authoring cases until it wins.
- If R1 works as well, prefer the prompt/template and stop additional architecture work.

### Stage C — Confirmation if warranted

Only after a promising pilot, approve a preregistered study on untouched tasks. Choose the smallest worthwhile quality effect, acceptable correctness margin, operational cost ceilings, human rubric, clustering/multiplicity treatment, and sample size before running it. Get explicit provider-budget approval.

Measure a stronger model or higher thinking as a separate baseline when affordable; do not conflate model changes with PLYTH's effect. No effectiveness, savings, or portability claims beyond demonstrated results.

## 13. Phased delivery

### Phase 0 — Requested repository documentation cleanup

After switching to a build agent:

1. Inspect current Git changes and preserve unfamiliar/user-owned work.
2. Put this complete plan at root `plan.md` in PLYTH. If a plan already exists by then, inspect it before replacing anything.
3. Remove `implementation.md` as requested, after preserving essential current-state links in `status.md`; history remains available through Git. Do not delete evaluation reports or archive old source unnecessarily.
4. Replace the verbose `status.md` with the short handoff in section 14; remove its dangling `implementation.md` reference.
5. Review Markdown references and run `git diff --check`; no code tests/provider runs are necessary for this documentation-only change.
6. Commit only the completed requested documentation changes. Do not push, publish, delete legacy code, modify Rook, or implement this plan as part of this phase.

Exit: a single active repository plan, concise factual handoff, obsolete implementation document removed, and a clean reviewed documentation commit. This phase is complete when committed.

### Phase 1 — Prompt and opportunity audit

Current active implementation phase. Do not run provider-backed comparisons or incur inference cost without separately agreeing the fixed cases, settings, and budget.

- Review overlap with Rook's current quality guidance and supported review entry points.
- Freeze the offline cases and generic versus targeted review prompts.
- Confirm task-local diff attribution, token accounting, SDK delivery, cancellation, and existing-context reuse.
- Run only approved inference experiments; return findings and the smallest justified integration proposal.

Exit: actionable differentiated reviews exist at acceptable cost. Otherwise keep a prompt-only improvement or stop.

### Phase 2 — Minimal explicit Rook integration

- Implement only the bounded review contract and supported explicit invocation.
- Reuse existing repository inspection and provider handling.
- Add strict scope/revision validation, off behavior, limits, and clear incomplete-review reporting.
- Keep legacy prediction behavior separate and unchanged; do not combine both experiments during evaluation.
- Test the vertical slice using mock events before any provider run.

Exit: explicit review returns grounded, scoped findings or honest abstention without automatic mutation or extra hidden calls.

### Phase 3 — Frozen end-to-end pilot

- Approve/freeze the three-condition pilot and budget.
- Retain submitted patches, independent checks, blinded human assessments, usage, and failures.
- Write a go/narrow/stop report. A no-go is a valid completed result.

Exit: evidence justifies a confirmation study or a smaller prompt/template product. No automatic expansion.

### Phase 4 — Optional timing improvements and confirmation

- Only if explicit review is useful, test one opt-in before-completion trigger against explicit/prompt baselines.
- Confirm safe hook timing; no forced extra completion loop.
- Run an approved independent confirmation study before claiming effectiveness.

Exit: added orchestration earns its cost and does not harm necessary complexity or verification.

### Phase 5 — Minimal productization and future portability

- Document supported review categories, limits, cost, privacy, and disable controls.
- Update README positioning without pretending proposed capabilities already ship.
- Propose a versioned legacy API/flag deprecation only after a deliberate migration decision. Do not remove existing user data or behavior implicitly.
- Add a second agent only under separate authorization and after reviewing its real capabilities.
- Keep the portable contract limited to task intent, scoped patch/context, revision, findings, and limitations. Each host owns model invocation and permissions.

Exit: documented Rook support and an honest capability boundary; other-agent support is claimed only after implementation and validation.

## 14. Proposed concise repository status.md

Use this as the initial handoff after the documentation-only cleanup, adjusting statements to match what actually completed:

```markdown
# Status

## Direction

- Pivot: lightweight change review that challenges unjustified complexity while preserving required behavior.
- Full design: [plan.md](plan.md). Documentation only; new review functionality is not implemented.
- Rook first; other coding-agent adapters are deferred. Do not implement the plan without explicit authorization.

## Existing implementation and evidence

- Current code is the legacy prediction-feedback core; Rook consumes the sibling package. Existing behavior remains unchanged and advisory feedback stays default-off.
- No demonstrated effectiveness benefit: [bounded study](evals/phase3-final/report.md), [latest live comparison](evals/latest-features-live/report.md).
- Existing setup/API limitations: [README.md](README.md), [Rook integration](docs/rook.md).

## Completed

- Added the new plan, removed the obsolete implementation document, and condensed this handoff.

## Next

- If authorized, audit existing Rook quality guidance and test a bounded targeted review against a simple prompt baseline before building orchestration.
- No new provider runs, code migration, publication, or other-agent integration is authorized by the documentation cleanup.

## Validation

- Documentation-only checks: record the actual diff/reference checks performed. Historical runtime tests are not current verification.
```

Keep this handoff short, ideally under 40 lines. Add current blockers or essential environment notes when relevant; do not grow it into a transcript or duplicate benchmark tables. Detailed historical findings belong in their existing reports and Git history.

## 15. Focused implementation tests

When code is authorized, add only tests needed for changed behavior:

- Oversized/malformed review inputs and outputs; zero findings versus review failure.
- Finding cap, location validation, missing context, unsupported scope, and revision staleness.
- Staged/unstaged/untracked handling and preservation of pre-existing/mixed user work.
- Prompt-injection text remains data; workspace path/symlink boundaries remain intact.
- Off mode adds no model request or review context.
- Cancellation, task switching, resume/fork, and no late-result delivery to another task.
- At most one automatic pass if that feature is later added; no recursive review loop.
- No execution or mutation through the review contract; permissions and Plan/Build behavior stay unchanged.
- Structured host output is preserved; incomplete results are not reported as clean reviews.
- Request/token accounting exposes any additional model turn or context injection.

Use existing Node/TypeScript and Rook test infrastructure. Run focused tests, build/typecheck where appropriate, changed-file formatting, and diff checks. Do not add parsing frameworks, model dependencies, or a new testing stack without a demonstrated need.

## 16. Definition of success

PLYTH earns its place only if it helps produce more justified, maintainable patches than the same Rook with a concise review instruction, at acceptable total cost and without weaker behavior or tests.

It should be easy to disable, cheap to ignore when there is nothing useful to say, and willing to retain justified complexity.

**If a short prompt is equally effective, ship the short prompt.**
