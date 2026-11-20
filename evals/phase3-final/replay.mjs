// Offline replay of the frozen adapter against captured completed test results.
// No provider calls. Run before disposing the frozen b1-host worktree:
// node evals/phase3-final/replay.mjs /path/to/b1-host
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { SessionCounter } from "../../dist/index.js";

const { createPlythObserveExtension } = await import(
  pathToFileURL(resolve(process.argv[2], "dist/pi/plyth-observe.js")).href
);
const rows = readFileSync(new URL("./results.jsonl", import.meta.url), "utf8")
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line));

const summary = rows.map((row) => {
  const counter = new SessionCounter();
  const handlers = new Map();
  const extension = createPlythObserveExtension(counter, {
    feedback: row.condition === "b2",
  });
  extension.factory({ on: (name, callback) => handlers.set(name, callback) });
  const ctx = { sessionManager: { getSessionId: () => "offline-replay" } };
  const results = new Map(row.tests.map((test) => [test.call_id, test.text]));
  const judgments = [];
  for (const call of row.calls.filter((call) => call.name === "bash")) {
    const output = results.get(call.id);
    if (output === undefined) continue;
    const counts = /ℹ pass (\d+)\s*\nℹ fail (\d+)/u.exec(output);
    assert.ok(
      counts,
      "Only completed, nontruncated Node test output is replayed",
    );
    const actualFeedback = output
      .split("\n")
      .filter((line) => line.startsWith("PLYTH:"));
    const verdictsBefore = counter.snapshot();
    if (row.condition !== "b0") {
      handlers.get("tool_call")(
        { toolName: "bash", toolCallId: call.id, input: call.arguments },
        ctx,
      );
      const patch = handlers.get("tool_result")(
        {
          toolName: "bash",
          toolCallId: call.id,
          input: call.arguments,
          content: [{ type: "text", text: output }],
          structuredContent: {
            exit_code: Number(counts[2]) === 0 ? 0 : 1,
            output: output.split("\nPLYTH:")[0],
            truncated: false,
          },
        },
        ctx,
      );
      const expectedFeedback =
        patch?.content.slice(1).map((part) => part.text) ?? [];
      assert.deepEqual(actualFeedback, expectedFeedback);
    }
    const verdict =
      row.condition === "b0"
        ? "none"
        : Object.keys(counter.snapshot()).find(
            (key) => counter.snapshot()[key] > verdictsBefore[key],
          );
    judgments.push({
      command: call.arguments.command,
      prediction: call.arguments.expect ?? null,
      pass: Number(counts[1]),
      fail: Number(counts[2]),
      verdict,
      feedback: actualFeedback,
    });
  }
  const firstBash = row.calls.findIndex((call) => call.name === "bash");
  const firstEdit = row.calls.findIndex((call) =>
    ["edit", "write"].includes(call.name),
  );
  const tokenTotal = Object.values(row.usage).reduce(
    (sum, count) => sum + count,
    0,
  );
  return {
    task: row.task,
    condition: row.condition,
    error: row.error,
    settled: row.settled === true,
    code_check_passed: row.success,
    tests_unchanged: row.tests_unchanged,
    scope_ok: row.scope_ok,
    test_before_edit:
      firstBash >= 0 && firstEdit > firstBash && judgments[0]?.fail > 0,
    wall_seconds: row.wall_seconds,
    approval_wait_seconds: row.approval_wait_seconds,
    usage: row.usage,
    total_reported_tokens: tokenTotal,
    tool_calls: row.calls.length,
    approved_tests: row.approved_commands.length,
    issued_tests: row.calls.filter((call) => call.name === "bash").length,
    scored_tests: judgments.length,
    prediction_stats: row.condition === "b0" ? null : counter.predictionStats(),
    judgments,
  };
});
writeFileSync(
  new URL("./summary.json", import.meta.url),
  JSON.stringify(summary, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    summary.map(({ judgments, ...row }) => row),
    null,
    2,
  ),
);
