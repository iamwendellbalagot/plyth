# Rook adapter: setup, capabilities and privacy

## Modes and controls

| Setting                             | Behavior                                                                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Default / `ROOK_PLYTH_MODE=observe` | Prediction schema/guidance, judging, in-memory counters and history comparison. No advisory messages.                           |
| `ROOK_PLYTH_MODE=feedback`          | Same observations plus bounded advisory feedback on specific, scorable misses. Experimental.                                    |
| `ROOK_PLYTH_MODE=off`               | No PLYTH extension, prediction schema, prediction guidance, baseline snapshots or trace recording. Suitable for a same-host B0. |
| `ROOK_PLYTH_TRACE=1`                | Opt into local minimal traces in observe or feedback mode; does not enable feedback.                                            |
| `ROOK_PLYTH_FEEDBACK=1`             | Compatibility alias for feedback mode, used only when `ROOK_PLYTH_MODE` is unset.                                               |

An explicit mode overrides the compatibility flag; an unrecognized mode falls
back to observation, never feedback. Mode changes require a restart. In-memory
session counters/history and the feedback gate reset when Pi binds a new session,
including new/resumed/forked sessions. They are not restored from saved history.

In the Rook TUI:

```text
/plyth                         coverage, verdicts, command duration and baseline comparison
/plyth trace                   persistence status and local file path
/plyth trace on                opt in for this process
/plyth trace off               stop future writes; keep existing records
/plyth trace export            display validated minimal JSONL locally
/plyth trace clear             delete the local ledger and disable tracing in this process
```

These commands do not send prompts to a model. Clear affects the shared ledger;
other independently running Rook processes must also be disabled to prevent new
records. `trace on` is rejected while PLYTH mode is off. Export and clear remain
available for previously saved records even in off mode.

## History-baseline semantics

The model's outcome forecast is compared with the most recent result of the
identical whitespace-normalized simple command. Rook checks a local-file digest
before and after each eligible command; only unchanged available revisions qualify.
Edit/write requests and tools outside the adapter's read-only allowlist invalidate
history conservatively, even if the mutation later fails. Unclassified Bash also
invalidates history. Older parallel completions cannot replace newer observations.

The digest is in-memory only. It walks at most 256 regular files / 2 MiB, with
bounded directory depth/width and a best-effort 50 ms budget. Linked, unreadable,
sensitive, unknown hidden, or oversize inputs make the baseline unavailable rather
than silently treating a partial scan as complete. `.git`, `.rook` and
`node_modules` are excluded; source files and lockfiles are included. Large or
hidden-configuration-heavy repositories may therefore show no comparisons.

This is explicitly a **workspace-file history heuristic**, not a guarantee about
unchanged network state, clocks, dependencies, databases or external processes.
It does not establish a counterfactual. The baseline never changes command
execution, permissions, feedback eligibility or host completion decisions.

`/plyth` reports agent/history outcome-correct counts over the **same comparable
observations**, plus unavailable and invalidation counts. This is distinct from
the evidence-aware hit rate. No extra credit is awarded merely for predicting the
majority outcome. History holds at most 256 command keys and is session-local.

## Trace privacy, retention and failure behavior

Default: **no trace directory or ledger is created**. Explicit opt-in writes
`$ROOK_HOME/plyth/trace.jsonl`, defaulting to `~/.rook/plyth/trace.jsonl`.
The directory is private (0700) and file private (0600) on POSIX. Unsafe links,
hard links, ownership/permission mismatches and unavailable safe file operations
disable that storage operation rather than blocking the agent. Write errors are
counted and shown in status without raw filesystem errors or record contents.

Each record contains only:

- `plyth/trace/1`, adapter version `rook-pi/1`;
- a fresh random 128-bit session pseudonym (not the host session ID);
- minute-rounded timestamp, command class, prediction/observed outcome when known;
- verdict and a coarse duration bucket, when duration is available;
- observe/feedback mode and whether this adapter appended advisory text (not a
  claim that the model read it or changed its next action);
- baseline comparability and, only when comparable, the baseline outcome and
  outcome-correct booleans for baseline and agent.

No raw command, output, evidence, path, repository contents, credential, prompt,
host identifier or repository identifier is stored. Command digests are not
persisted or enabled, so no installation salt is needed. The random session key
resets with session state and cannot directly identify a saved Pi session.

The ledger is capped at 64 KiB; further writes are dropped and counted until the
user clears it. No automatic uploads, rotation or hidden backups. A private
exclusive `append.lock` prevents concurrent writers exceeding the cap; contention
fails open. A crash can leave a stale lock: after stopping other Rook processes,
the user may remove `$ROOK_HOME/plyth/append.lock` to restore writes. Export rejects
malformed or unknown fields rather than returning untrusted raw file contents.
Deleting the ledger does not delete user-created copies or original Pi session logs.

## Result and feedback capabilities

- Eligible commands use the adapter's deliberately bounded classifier. Unsupported
  shell syntax is not reinterpreted and the command is never rewritten.
- Completed Bash `exit_code=0` maps to pass, nonzero to fail. A missing exit code,
  cancellation, timeout or launch failure that Pi cannot distinguish safely is
  **unscorable**, not guessed as pass/error. The pure core can normalize an explicit
  host error status, but this Pi result transport does not always provide it.
- Truncated output makes evidence unavailable/vague, not an evidence miss. Node
  spec-reporter labels are filtered by passed/failed status. Other reporters use
  bounded normalized-line matching; no semantic equivalence is inferred.
- Calls correlate by session/call ID, with bounded pending state and session reset.
  A missing result at execution end is unscorable; duplicate results are ignored.
- Advisory text is appended only to the existing result; structured content is
  retained. Hits, vague/absent/unscorable forecasts do not trigger feedback. Specific
  misses are deduplicated and limited to five messages per session. No extra
  model requests, agent turns, automatic retries or permission changes are introduced.

The core latency target is distinct from the host snapshot/storage overhead.
Development checks validate deterministic behavior, not coding-quality benefit or
the original pilot's 2% token-overhead threshold. Other coding-agent integrations
and cross-host fixture parity are explicitly deferred.
