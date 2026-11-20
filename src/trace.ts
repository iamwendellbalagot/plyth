import type {
  BaselineComparison,
  CommandClass,
  PredictionOutcome,
  Verdict,
} from "./index.js";

export interface TraceRecord {
  protocol: "plyth/trace/1";
  adapter: "rook-pi/1";
  sessionKey: string;
  minute: number;
  commandClass: CommandClass;
  verdict: Verdict;
  mode: "observe" | "feedback";
  feedbackAppended: boolean;
  predictionOutcome?: PredictionOutcome;
  observedOutcome?: PredictionOutcome;
  durationBucket?: "lt100ms" | "lt1s" | "lt10s" | "gte10s";
  baselineComparable: boolean;
  baselineOutcome?: PredictionOutcome;
  baselineCorrect?: boolean;
  agentCorrect?: boolean;
}

const outcomes = ["pass", "fail", "error"];
const classes = ["test", "build", "diagnostic", "other"];
const verdicts = ["hit", "miss", "vague", "none", "unscorable"];

/** Whitelist projection: never copies command strings, evidence, paths or host IDs. */
export function createTraceRecord(input: {
  sessionKey: string;
  nowMs: number;
  commandClass: CommandClass;
  verdict: Verdict;
  mode?: "observe" | "feedback";
  feedbackAppended?: boolean;
  predictionOutcome?: PredictionOutcome;
  observedOutcome?: PredictionOutcome;
  durationMs?: number;
  baseline?: BaselineComparison;
}): TraceRecord | undefined {
  if (
    typeof input.sessionKey !== "string" ||
    !/^[a-f0-9]{32}$/.test(input.sessionKey) ||
    !Number.isFinite(input.nowMs) ||
    !Number.isSafeInteger(Math.floor(input.nowMs / 60000)) ||
    input.nowMs < 0 ||
    !classes.includes(input.commandClass) ||
    !verdicts.includes(input.verdict)
  )
    return undefined;
  const duration = input.durationMs;
  const comparable =
    input.baseline?.comparable === true &&
    outcomes.includes(input.baseline.baselineOutcome ?? "") &&
    typeof input.baseline.baselineCorrect === "boolean" &&
    typeof input.baseline.agentCorrect === "boolean";
  return {
    protocol: "plyth/trace/1",
    adapter: "rook-pi/1",
    sessionKey: input.sessionKey,
    minute: Math.floor(input.nowMs / 60000),
    commandClass: input.commandClass,
    verdict: input.verdict,
    mode: input.mode === "feedback" ? "feedback" : "observe",
    feedbackAppended:
      input.mode === "feedback" &&
      input.verdict === "miss" &&
      input.feedbackAppended === true,
    ...(outcomes.includes(input.predictionOutcome ?? "")
      ? { predictionOutcome: input.predictionOutcome }
      : {}),
    ...(outcomes.includes(input.observedOutcome ?? "")
      ? { observedOutcome: input.observedOutcome }
      : {}),
    ...(typeof duration === "number" &&
    Number.isFinite(duration) &&
    duration >= 0 &&
    duration <= 86400000
      ? {
          durationBucket:
            duration < 100
              ? ("lt100ms" as const)
              : duration < 1000
                ? ("lt1s" as const)
                : duration < 10000
                  ? ("lt10s" as const)
                  : ("gte10s" as const),
        }
      : {}),
    baselineComparable: comparable,
    ...(comparable
      ? {
          baselineOutcome: input.baseline!.baselineOutcome,
          baselineCorrect: input.baseline!.baselineCorrect,
          agentCorrect: input.baseline!.agentCorrect,
        }
      : {}),
  };
}

/** Reject unknown or malformed disk fields rather than exporting untrusted raw JSONL. */
export function parseTraceRecord(value: unknown): TraceRecord | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return undefined;
  const record = { ...value } as Record<string, unknown>;
  const allowed = [
    "protocol",
    "adapter",
    "sessionKey",
    "minute",
    "commandClass",
    "verdict",
    "mode",
    "feedbackAppended",
    "predictionOutcome",
    "observedOutcome",
    "durationBucket",
    "baselineComparable",
    "baselineOutcome",
    "baselineCorrect",
    "agentCorrect",
  ];
  if (
    Object.keys(record).some((key) => !allowed.includes(key)) ||
    record.protocol !== "plyth/trace/1" ||
    record.adapter !== "rook-pi/1" ||
    typeof record.sessionKey !== "string" ||
    !/^[a-f0-9]{32}$/.test(record.sessionKey) ||
    !Number.isSafeInteger(record.minute) ||
    (record.minute as number) < 0 ||
    !classes.includes(record.commandClass as string) ||
    !verdicts.includes(record.verdict as string) ||
    !["observe", "feedback"].includes(record.mode as string) ||
    typeof record.feedbackAppended !== "boolean" ||
    (record.feedbackAppended &&
      (record.mode !== "feedback" || record.verdict !== "miss")) ||
    typeof record.baselineComparable !== "boolean"
  )
    return undefined;
  for (const key of ["predictionOutcome", "observedOutcome", "baselineOutcome"])
    if (record[key] !== undefined && !outcomes.includes(record[key] as string))
      return undefined;
  if (
    record.durationBucket !== undefined &&
    !["lt100ms", "lt1s", "lt10s", "gte10s"].includes(
      record.durationBucket as string,
    )
  )
    return undefined;
  if (record.baselineComparable) {
    if (
      !record.baselineOutcome ||
      typeof record.baselineCorrect !== "boolean" ||
      typeof record.agentCorrect !== "boolean"
    )
      return undefined;
  } else if (
    ["baselineOutcome", "baselineCorrect", "agentCorrect"].some(
      (key) => record[key] !== undefined,
    )
  )
    return undefined;
  return { ...record } as unknown as TraceRecord;
}
