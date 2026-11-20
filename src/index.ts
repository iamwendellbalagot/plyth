export type PredictionOutcome = "pass" | "fail" | "error";
export type CommandClass = "test" | "build" | "diagnostic" | "other";
export type Verdict = "hit" | "miss" | "vague" | "none" | "unscorable";

export interface Prediction {
  outcome: PredictionOutcome;
  evidence?: string;
}

export interface CommandStarted {
  protocol: "plyth/event/1";
  sessionId: string;
  callId: string;
  adapter: string;
  commandClass: CommandClass;
  commandDigest?: string;
  prediction?: Prediction;
}

export interface CommandFinished {
  protocol: "plyth/event/1";
  sessionId: string;
  callId: string;
  outcome?: PredictionOutcome;
  durationMs?: number;
  evidenceLabels?: string[];
  evidenceUnavailable?: boolean;
  resultDigest?: string;
  unscorableReason?: string;
}

export interface Judgment {
  callId: string;
  verdict: Verdict;
  reasonCode: string;
  feedback?: string;
}

export type SessionCounts = Record<Verdict, number>;

export interface SessionPredictionStats {
  eligibleCommands: number;
  predictedCommands: number;
  invalidPredictions: number;
  specificPredictions: number;
  durationMs: number;
  durationSamples: number;
  verdicts: SessionCounts;
  baseline?: import("./baseline.js").HistoryBaselineStats;
}

export interface HostCommandResult {
  exitCode?: number;
  timedOut?: boolean;
  cancelled?: boolean;
  launchError?: boolean;
}

export type Validation<T> =
  { ok: true; value: T } | { ok: false; reason: string };

const MAX_EVENT_BYTES = 16 * 1024;
const MAX_STRING = 200;
const OUTCOMES = ["pass", "fail", "error"] as const;
const CLASSES = ["test", "build", "diagnostic", "other"] as const;

export function parseCommandStarted(
  input: unknown,
): Validation<CommandStarted> {
  if (!isBoundedRecord(input)) return invalid("invalid_event");
  if (
    !hasOnlyKeys(input, [
      "protocol",
      "sessionId",
      "callId",
      "adapter",
      "commandClass",
      "commandDigest",
      "prediction",
    ])
  )
    return invalid("invalid_event");
  if (
    input.protocol !== "plyth/event/1" ||
    !isId(input.sessionId, 128) ||
    !isId(input.callId, 128) ||
    !isId(input.adapter, 64) ||
    !isOneOf(input.commandClass, CLASSES)
  )
    return invalid("invalid_event");
  if (
    input.commandDigest !== undefined &&
    !isBoundedString(input.commandDigest, 128)
  )
    return invalid("invalid_event");
  let prediction: Prediction | undefined;
  if (input.prediction !== undefined) {
    if (
      !isRecord(input.prediction) ||
      !hasOnlyKeys(input.prediction, ["outcome", "evidence"]) ||
      !isOneOf(input.prediction.outcome, OUTCOMES)
    )
      return invalid("invalid_prediction");
    if (
      input.prediction.evidence !== undefined &&
      !isBoundedString(input.prediction.evidence, MAX_STRING)
    )
      return invalid("invalid_prediction");
    prediction = {
      outcome: input.prediction.outcome,
      ...(input.prediction.evidence === undefined
        ? {}
        : { evidence: input.prediction.evidence }),
    };
  }
  return valid({
    protocol: input.protocol,
    sessionId: input.sessionId,
    callId: input.callId,
    adapter: input.adapter,
    commandClass: input.commandClass,
    ...(input.commandDigest === undefined
      ? {}
      : { commandDigest: input.commandDigest }),
    ...(prediction === undefined ? {} : { prediction }),
  });
}

export function parseCommandFinished(
  input: unknown,
): Validation<CommandFinished> {
  if (!isBoundedRecord(input)) return invalid("invalid_event");
  if (
    !hasOnlyKeys(input, [
      "protocol",
      "sessionId",
      "callId",
      "outcome",
      "durationMs",
      "evidenceLabels",
      "evidenceUnavailable",
      "resultDigest",
      "unscorableReason",
    ])
  )
    return invalid("invalid_event");
  if (
    input.protocol !== "plyth/event/1" ||
    !isId(input.sessionId, 128) ||
    !isId(input.callId, 128)
  )
    return invalid("invalid_event");
  if (input.outcome !== undefined && !isOneOf(input.outcome, OUTCOMES))
    return invalid("invalid_event");
  if (
    input.durationMs !== undefined &&
    (typeof input.durationMs !== "number" ||
      !Number.isFinite(input.durationMs) ||
      input.durationMs < 0 ||
      input.durationMs > 86_400_000)
  )
    return invalid("invalid_event");
  if (
    input.evidenceLabels !== undefined &&
    (!Array.isArray(input.evidenceLabels) ||
      input.evidenceLabels.length > 50 ||
      input.evidenceLabels.some((label) => !isBoundedString(label, MAX_STRING)))
  )
    return invalid("invalid_event");
  if (
    input.evidenceUnavailable !== undefined &&
    typeof input.evidenceUnavailable !== "boolean"
  )
    return invalid("invalid_event");
  if (
    input.resultDigest !== undefined &&
    !isBoundedString(input.resultDigest, 128)
  )
    return invalid("invalid_event");
  if (
    input.unscorableReason !== undefined &&
    !isBoundedString(input.unscorableReason, 120)
  )
    return invalid("invalid_event");
  return valid({
    protocol: input.protocol,
    sessionId: input.sessionId,
    callId: input.callId,
    ...(input.outcome === undefined ? {} : { outcome: input.outcome }),
    ...(input.durationMs === undefined ? {} : { durationMs: input.durationMs }),
    ...(input.evidenceLabels === undefined
      ? {}
      : { evidenceLabels: [...input.evidenceLabels] }),
    ...(input.evidenceUnavailable === undefined
      ? {}
      : { evidenceUnavailable: input.evidenceUnavailable }),
    ...(input.resultDigest === undefined
      ? {}
      : { resultDigest: input.resultDigest }),
    ...(input.unscorableReason === undefined
      ? {}
      : { unscorableReason: input.unscorableReason }),
  });
}

export function normalizeOutcome(
  result: HostCommandResult,
): Validation<PredictionOutcome> {
  if (result.timedOut || result.cancelled || result.launchError)
    return valid("error");
  if (typeof result.exitCode !== "number" || !Number.isInteger(result.exitCode))
    return invalid("outcome_unavailable");
  return valid(result.exitCode === 0 ? "pass" : "fail");
}

export function judgeEvents(
  startInput: unknown,
  finishInput: unknown,
): Judgment {
  const callId =
    isRecord(startInput) && typeof startInput.callId === "string"
      ? startInput.callId.slice(0, 128)
      : "";
  const start = parseCommandStarted(startInput);
  if (!start.ok)
    return { callId, verdict: "unscorable", reasonCode: start.reason };
  const finish = parseCommandFinished(finishInput);
  if (!finish.ok)
    return {
      callId: start.value.callId,
      verdict: "unscorable",
      reasonCode: finish.reason,
    };
  if (start.value.protocol !== finish.value.protocol)
    return unscorable(start.value.callId, "protocol_mismatch");
  if (start.value.sessionId !== finish.value.sessionId)
    return unscorable(start.value.callId, "session_mismatch");
  if (start.value.callId !== finish.value.callId)
    return unscorable(start.value.callId, "call_mismatch");
  if (finish.value.unscorableReason || !finish.value.outcome)
    return unscorable(
      start.value.callId,
      finish.value.unscorableReason ? "host_unscorable" : "outcome_unavailable",
    );
  const prediction = start.value.prediction;
  if (!prediction)
    return {
      callId: start.value.callId,
      verdict: "none",
      reasonCode: "no_prediction",
    };
  if (prediction.outcome !== finish.value.outcome)
    return {
      callId: start.value.callId,
      verdict: "miss",
      reasonCode: "outcome_mismatch",
    };
  if (!prediction.evidence?.trim())
    return {
      callId: start.value.callId,
      verdict: "vague",
      reasonCode: "no_evidence",
    };
  if (finish.value.evidenceUnavailable)
    return {
      callId: start.value.callId,
      verdict: "vague",
      reasonCode: "evidence_unavailable",
    };
  if (!finish.value.evidenceLabels)
    return {
      callId: start.value.callId,
      verdict: "vague",
      reasonCode: "evidence_unavailable",
    };
  const expected = normalizeEvidence(prediction.evidence);
  const matched = finish.value.evidenceLabels.some((label) =>
    normalizeEvidence(label).includes(expected),
  );
  return matched
    ? {
        callId: start.value.callId,
        verdict: "hit",
        reasonCode: "outcome_and_evidence_match",
      }
    : {
        callId: start.value.callId,
        verdict: "miss",
        reasonCode: "evidence_mismatch",
      };
}

export function safeJudgeEvents(start: unknown, finish: unknown): Judgment {
  try {
    return judgeEvents(start, finish);
  } catch {
    return { callId: "", verdict: "unscorable", reasonCode: "invalid_event" };
  }
}

export function formatFeedback(
  start: CommandStarted,
  finish: CommandFinished,
): string | undefined {
  const prediction = start.prediction;
  if (!prediction || !finish.outcome) return undefined;
  const evidence = prediction.evidence
    ?.trim()
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/`/g, "\\`");
  if (prediction.outcome === finish.outcome && evidence) {
    return `Expected evidence \`${evidence}\`; observed outcome \`${finish.outcome}\` but no matching evidence label. Recheck the assumption before choosing the next step.`;
  }
  const expected = evidence ? ` (\"${evidence}\")` : "";
  return `Expected \`${prediction.outcome}\`${expected}; observed \`${finish.outcome}\`. Recheck the assumption before choosing the next step.`;
}

export class SessionCounter {
  private eligibleCommands = 0;
  private predictedCommands = 0;
  private invalidPredictions = 0;
  private specificPredictions = 0;
  private durationMs = 0;
  private durationSamples = 0;
  private readonly counts: SessionCounts = {
    hit: 0,
    miss: 0,
    vague: 0,
    none: 0,
    unscorable: 0,
  };

  record(judgment: Judgment): void {
    this.counts[judgment.verdict]++;
  }

  recordEligible(
    prediction?: Prediction,
    supplied = prediction !== undefined,
  ): void {
    this.eligibleCommands++;
    if (supplied) this.predictedCommands++;
    if (supplied && !prediction) this.invalidPredictions++;
    if (prediction?.evidence?.trim()) this.specificPredictions++;
  }

  reset(): void {
    this.eligibleCommands = 0;
    this.predictedCommands = 0;
    this.invalidPredictions = 0;
    this.specificPredictions = 0;
    this.durationMs = 0;
    this.durationSamples = 0;
    for (const verdict of Object.keys(this.counts) as Verdict[])
      this.counts[verdict] = 0;
  }

  recordDuration(durationMs: number): void {
    if (
      !Number.isFinite(durationMs) ||
      durationMs < 0 ||
      durationMs > 86_400_000
    )
      return;
    this.durationMs += durationMs;
    this.durationSamples++;
  }

  snapshot(): SessionCounts {
    return { ...this.counts };
  }

  predictionStats(): SessionPredictionStats {
    return {
      eligibleCommands: this.eligibleCommands,
      predictedCommands: this.predictedCommands,
      invalidPredictions: this.invalidPredictions,
      specificPredictions: this.specificPredictions,
      durationMs: this.durationMs,
      durationSamples: this.durationSamples,
      verdicts: this.snapshot(),
    };
  }
}

export class SessionFeedbackGate {
  private readonly seen = new Set<string>();
  private emitted = 0;
  private readonly limit: number;

  constructor(limit = 5) {
    if (!Number.isInteger(limit) || limit < 0 || limit > 5)
      throw new RangeError("Feedback limit must be between 0 and 5.");
    this.limit = limit;
  }

  offer(startInput: unknown, finishInput: unknown): string | undefined {
    const start = parseCommandStarted(startInput);
    if (!start.ok) return undefined;
    const finish = parseCommandFinished(finishInput);
    if (!finish.ok) return undefined;
    const judgment = judgeEvents(start.value, finish.value);
    if (
      judgment.verdict !== "miss" ||
      (judgment.reasonCode !== "outcome_mismatch" &&
        judgment.reasonCode !== "evidence_mismatch") ||
      this.emitted >= this.limit ||
      !finish.value.outcome ||
      !start.value.prediction?.evidence?.trim()
    )
      return undefined;
    const key = JSON.stringify([
      start.value.prediction.outcome,
      start.value.prediction.evidence ?? "",
      finish.value.outcome,
      finish.value.evidenceLabels ?? [],
      finish.value.resultDigest ?? "",
    ]);
    if (this.seen.has(key)) return undefined;
    this.seen.add(key);
    const feedback = formatFeedback(start.value, finish.value);
    if (feedback) this.emitted++;
    return feedback;
  }

  reset(): void {
    this.seen.clear();
    this.emitted = 0;
  }

  get count(): number {
    return this.emitted;
  }
}

function normalizeEvidence(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function unscorable(callId: string, reasonCode: string): Judgment {
  return { callId, verdict: "unscorable", reasonCode };
}

function isRecord(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isBoundedRecord(value: unknown): value is Record<string, any> {
  if (!isRecord(value)) return false;
  try {
    return BufferlessByteLength(JSON.stringify(value)) <= MAX_EVENT_BYTES;
  } catch {
    return false;
  }
}

function BufferlessByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function isId(value: unknown, max: number): value is string {
  return isBoundedString(value, max) && value.trim().length > 0;
}

function isBoundedString(value: unknown, max: number): value is string {
  return (
    typeof value === "string" &&
    value.length <= max &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
  );
}

function isOneOf<const T extends readonly string[]>(
  value: unknown,
  values: T,
): value is T[number] {
  return (
    typeof value === "string" && (values as readonly string[]).includes(value)
  );
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowed: string[],
): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function valid<T>(value: T): Validation<T> {
  return { ok: true, value };
}

function invalid(reason: string): Validation<never> {
  return { ok: false, reason };
}
export * from "./baseline.ts";
export * from "./trace.ts";
export * from "./statistics.ts";
