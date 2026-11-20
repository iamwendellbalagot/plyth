import assert from "node:assert/strict";
import test from "node:test";
import { binaryInterval, pairedBootstrapDifference } from "../src/index.ts";

test("offline binary intervals retain sample size and do not fabricate zero-denominator accuracy", () => {
  assert.deepEqual(binaryInterval(0, 0), {
    correct: 0,
    total: 0,
    rate: null,
    lower: null,
    upper: null,
  });
  const small = binaryInterval(3, 3);
  assert.ok(small.lower > 0.43 && small.lower < 0.45);
  assert.equal(small.rate, 1);
  assert.ok(small.upper <= 1);
  assert.throws(() => binaryInterval(2, 1), RangeError);
  assert.throws(() => binaryInterval(1, NaN), RangeError);
});

test("paired bootstrap is reproducible, pair-preserving and reports sparse samples honestly", () => {
  assert.deepEqual(pairedBootstrapDifference([]), {
    pairs: 0,
    meanDifference: null,
    lower: null,
    upper: null,
  });
  assert.deepEqual(pairedBootstrapDifference([[10, 12]]), {
    pairs: 1,
    meanDifference: 2,
    lower: null,
    upper: null,
  });
  const pairs = [
    [100, 101],
    [1, 2],
    [3, 4],
  ];
  const result = pairedBootstrapDifference(pairs, 42);
  assert.deepEqual(result, { pairs: 3, meanDifference: 1, lower: 1, upper: 1 });
  assert.deepEqual(
    pairedBootstrapDifference(
      [
        [2, 1],
        [2, 4],
      ],
      42,
    ),
    pairedBootstrapDifference(
      [
        [2, 1],
        [2, 4],
      ],
      42,
    ),
  );
  assert.throws(() => pairedBootstrapDifference([[1, Infinity]]), RangeError);
  assert.throws(
    () => pairedBootstrapDifference([[1, 2]], 1, 100000),
    RangeError,
  );
});
