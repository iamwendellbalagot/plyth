# Latest Rook features: exploratory live check

**Run date:** 2026-11-20

**PLYTH:** `e648c3b`

**Rook:** `13af93f`

**Provider/model:** `openai/gpt-6.1-sol` (existing Pi login)

## Bottom line

**No improvement was demonstrated.** All nine task/arm runs passed the same
independent fixture checks, so observed task success was tied at 3/3 in B0, B1,
and B2. B1 and B2 each made six specific predictions, all hits. B2 appended
**zero** advisory messages; there was no feedback intervention whose effect could
be measured. The new history baseline had zero comparable observations because
the source edits changed the workspace revision between the initial and final
test calls. This run therefore validates live mode/trace wiring and successful
task execution, not baseline utility or feedback effectiveness.

This is an exploratory follow-up explicitly requested after the Rook-first
features were completed. It reuses the three Phase 3 fixture tasks and their
unchanged prompts; it is not an independently preregistered efficacy study. The
result is inconclusive about whether feedback could help on a task where a natural
specific miss occurs. Do not claim a benefit or use this sample to reverse the
earlier investment no-go.

## Setup and procedure

- Ran each of pagination, concurrent TTL cache, and pricing independently under
  all three conditions (nine provider runs total), in separate clean temporary
  workspaces. Run order was the fixed shuffled order from the retained fixture
  runner.
- All arms used the latest Rook build and same provider/model. B0 set
  `ROOK_PLYTH_MODE=off`; B1 set `observe`; B2 set `feedback`. Tracing was enabled
  only for B1/B2, with separate temporary `ROOK_HOME` directories per run.
- Each agent ran the exact combined Node test command on the unchanged starter,
  repaired source only, and reran that command. Only these exact test commands
  were approved once; the fixture explicitly opted out of the unavailable
  macOS shell sandbox, and approvals displayed Rook's host-execution warning.
- Independent post-run checks passed in every arm. Tests were unchanged, changes
  were limited to `src/`, and every run completed both test invocations.
- The original runner was adapted in a temporary directory outside both
  repositories to select the latest Rook and explicit modes. Per-run results,
  trace records and usage were retained in the temporary evaluation directory;
  no provider credentials or hidden reasoning were copied into this report.

## Results

| Task               |         B0 off |     B1 observe |    B2 feedback |
| ------------------ | -------------: | -------------: | -------------: |
| Pagination         | pass, 81.984 s | pass, 53.740 s | pass, 81.517 s |
| Cache              | pass, 73.108 s | pass, 52.863 s | pass, 51.565 s |
| Pricing            | pass, 53.857 s | pass, 51.497 s | pass, 53.893 s |
| **Mean wall time** |   **69.650 s** |   **52.700 s** |   **62.325 s** |

Each arm made six approved test calls across its three tasks. B0 made no PLYTH
predictions. B1 and B2 each recorded 6/6 specific hits. B2 recorded 0/6 advisory
messages. The B2-minus-B1 time differences were +27.777 s for pagination,
−1.298 s for cache, and +2.396 s for pricing. With three small, stochastic tasks
and no B2 messages, these timings do not show a causal benefit or overhead.

| Arm | Input tokens | Output tokens | Cache-read tokens |
| --- | -----------: | ------------: | ----------------: |
| B0  |       40,279 |         3,424 |           116,992 |
| B1  |       40,014 |         2,905 |            98,048 |
| B2  |       33,640 |         3,643 |           132,096 |

These are session usage fields, not dollar costs. Cache-read tokens are reported
separately and should not be treated as equivalent to ordinary input tokens.
The small sample does not isolate PLYTH overhead.

### History-baseline coverage

There were six eligible calls each in B1 and B2. All 12 predictions were correct
and evidence-specific. There were **zero comparable history-baseline outcomes**
in either arm. Although the test command was repeated, the agent edited source
between calls; the workspace revision therefore changed and the baseline
conservatively invalidated its forecast. No baseline accuracy comparison can be
made from these coding trajectories.

## Interpretation

- **Task correctness:** no observed difference; all nine trusted checks passed.
- **Feedback:** no intervention occurred; benefit remains untested.
- **History baseline:** live instrumentation ran, but this workload produced no
  comparable forecasts, so its utility remains untested.
- **Time/tokens:** descriptive only; run-to-run variation is large and not
  attributable to inactive feedback.

Conclusion: **no demonstrated improvement; efficacy remains inconclusive.** Keep
feedback default-off. A stronger future test would require naturally occurring,
actionable specific misses and baseline-comparable repetitions, not forced
incorrect predictions or more easy fixtures selected until one happens to miss.
