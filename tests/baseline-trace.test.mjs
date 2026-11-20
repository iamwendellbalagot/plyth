import assert from "node:assert/strict";
import test from "node:test";
import {
  CommandHistoryBaseline,
  createTraceRecord,
  parseTraceRecord,
} from "../src/index.ts";

test("history compares only identical commands and unchanged workspace revisions", () => {
  const baseline = new CommandHistoryBaseline();
  const first = baseline.begin("node --test", "revision-a");
  assert.equal(first.outcome, undefined);
  assert.deepEqual(baseline.complete(first, "revision-a", "fail", "fail"), {
    comparable: false,
  });
  const second = baseline.begin("node --test", "revision-a");
  assert.equal(second.outcome, "fail");
  assert.deepEqual(baseline.complete(second, "revision-a", "fail", "pass"), {
    comparable: true,
    baselineOutcome: "fail",
    baselineCorrect: true,
    agentCorrect: false,
  });
  assert.equal(baseline.begin("npm test", "revision-a").outcome, undefined);
  assert.equal(baseline.begin("node --test", "revision-b").outcome, undefined);
  assert.equal(baseline.begin("node --test").outcome, undefined);
  assert.deepEqual(baseline.snapshot(), {
    comparisons: 1,
    baselineCorrect: 1,
    agentCorrect: 0,
    unavailable: 1,
    invalidations: 0,
  });
});

test("edits and unobservable changes invalidate history including pending forecasts", () => {
  const baseline = new CommandHistoryBaseline();
  baseline.complete(baseline.begin("test", "a"), "a", "pass", "pass");
  const pending = baseline.begin("test", "a");
  baseline.invalidate();
  assert.equal(
    baseline.complete(pending, "a", "pass", "pass").comparable,
    false,
  );
  assert.equal(baseline.begin("test", "a").outcome, undefined);
  baseline.complete(baseline.begin("test", "a"), "a", "pass");
  assert.equal(
    baseline.complete(baseline.begin("test", "a"), "b", "fail", "fail")
      .comparable,
    false,
  );
  assert.equal(baseline.begin("test", "a").outcome, undefined);
  baseline.complete(baseline.begin("test", "b"), undefined, "pass", "pass");
  baseline.reset();
  assert.deepEqual(baseline.snapshot(), {
    comparisons: 0,
    baselineCorrect: 0,
    agentCorrect: 0,
    unavailable: 0,
    invalidations: 0,
  });
});

test("history does not let an older parallel completion replace a newer observation", () => {
  const baseline = new CommandHistoryBaseline();
  const older = baseline.begin("test", "a");
  const newer = baseline.begin("test", "a");
  baseline.complete(newer, "a", "pass");
  baseline.complete(older, "a", "fail");
  assert.equal(baseline.begin("test", "a").outcome, "pass");
  for (let i = 0; i < 256; i++)
    baseline.complete(baseline.begin(`test-${i}`, "a"), "a", "pass");
  assert.equal(baseline.begin("test", "a").outcome, undefined);
});

test("minimal trace projection cannot copy raw commands, evidence or host identifiers", () => {
  const record = createTraceRecord({
    sessionKey: "a".repeat(32),
    nowMs: 123456,
    commandClass: "test",
    verdict: "miss",
    predictionOutcome: "pass",
    observedOutcome: "fail",
    durationMs: 1234,
    baseline: {
      comparable: true,
      baselineOutcome: "fail",
      baselineCorrect: true,
      agentCorrect: false,
    },
    command: "secret",
    evidence: "secret",
    sessionId: "/Users/secret",
    output: "secret",
  });
  assert.equal(JSON.stringify(record).includes("secret"), false);
  assert.equal(record.minute, 2);
  assert.equal(record.durationBucket, "lt10s");
  assert.deepEqual(
    parseTraceRecord(JSON.parse(JSON.stringify(record))),
    record,
  );
  assert.equal(parseTraceRecord({ ...record, command: "secret" }), undefined);
  assert.equal(
    parseTraceRecord({ ...record, baselineComparable: false }),
    undefined,
  );
  assert.equal(
    parseTraceRecord({ ...record, observedOutcome: "maybe" }),
    undefined,
  );
  assert.equal(
    createTraceRecord({
      sessionKey: "/private/raw-id",
      nowMs: 0,
      commandClass: "test",
      verdict: "hit",
    }),
    undefined,
  );
  assert.equal(
    createTraceRecord({
      sessionKey: "a".repeat(32),
      nowMs: -1,
      commandClass: "test",
      verdict: "hit",
    }),
    undefined,
  );
});
