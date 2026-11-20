/** Descriptive 95% Wilson interval. Correlated commands are not independent trials. */
export function binaryInterval(
  correct: number,
  total: number,
): {
  total: number;
  correct: number;
  rate: number | null;
  lower: number | null;
  upper: number | null;
} {
  if (
    !Number.isSafeInteger(total) ||
    !Number.isSafeInteger(correct) ||
    total < 0 ||
    correct < 0 ||
    correct > total
  )
    throw new RangeError("Invalid binary counts.");
  if (total === 0)
    return { total, correct, rate: null, lower: null, upper: null };
  const rate = correct / total;
  const z2 = 1.96 ** 2;
  const center = (rate + z2 / (2 * total)) / (1 + z2 / total);
  const half =
    (1.96 * Math.sqrt((rate * (1 - rate)) / total + z2 / (4 * total ** 2))) /
    (1 + z2 / total);
  return {
    total,
    correct,
    rate,
    lower: Math.max(0, center - half),
    upper: Math.min(1, center + half),
  };
}

/** Offline paired task-level bootstrap of treatment-minus-baseline means.
 * Keep units consistent. Exclude censored pairs explicitly; no causal claim is inferred.
 */
export function pairedBootstrapDifference(
  pairs: readonly (readonly [number, number])[],
  seed = 1,
  samples = 2000,
): {
  pairs: number;
  meanDifference: number | null;
  lower: number | null;
  upper: number | null;
} {
  if (
    pairs.length > 10000 ||
    pairs.some(
      (pair) =>
        pair.length !== 2 ||
        pair.some(
          (value) =>
            !Number.isFinite(value) ||
            value < 0 ||
            value > Number.MAX_SAFE_INTEGER,
        ),
    ) ||
    !Number.isInteger(seed) ||
    !Number.isInteger(samples) ||
    samples < 100 ||
    samples > 10000
  )
    throw new RangeError("Invalid paired evaluation data.");
  const differences = pairs.map(
    ([baseline, treatment]) => treatment - baseline,
  );
  if (!differences.length)
    return { pairs: 0, meanDifference: null, lower: null, upper: null };
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const means: number[] = [];
  for (let iteration = 0; iteration < samples; iteration++) {
    let sum = 0;
    for (let index = 0; index < differences.length; index++)
      sum += differences[Math.floor(random() * differences.length)];
    means.push(sum / differences.length);
  }
  means.sort((a, b) => a - b);
  return {
    pairs: differences.length,
    meanDifference:
      differences.reduce((sum, value) => sum + value, 0) / differences.length,
    lower: differences.length < 2 ? null : means[Math.floor(samples * 0.025)],
    upper:
      differences.length < 2
        ? null
        : means[Math.min(samples - 1, Math.floor(samples * 0.975))],
  };
}
