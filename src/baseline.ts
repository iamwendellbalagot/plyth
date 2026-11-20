import type { PredictionOutcome } from "./index.js";

export interface HistoryBaselineStats {
  comparisons: number;
  baselineCorrect: number;
  agentCorrect: number;
  unavailable: number;
  invalidations: number;
}

export interface HistoryForecast {
  readonly key: string;
  readonly revision?: string;
  readonly generation: number;
  readonly sequence: number;
  readonly outcome?: PredictionOutcome;
}

export interface BaselineComparison {
  comparable: boolean;
  baselineOutcome?: PredictionOutcome;
  baselineCorrect?: boolean;
  agentCorrect?: boolean;
}

/** Last outcome of the identical command in the same host-declared workspace state.
 * This compares outcomes only, not evidence or understanding. Never steers the host.
 */
export class CommandHistoryBaseline {
  private readonly history = new Map<
    string,
    { revision: string; outcome: PredictionOutcome; sequence: number }
  >();
  private generation = 0;
  private sequence = 0;
  private stats: HistoryBaselineStats = this.emptyStats();

  begin(key: string, revision?: string): HistoryForecast {
    if (revision && revision.length > 200) revision = undefined;
    const boundedKey = key.length <= 8192 ? key : "";
    const previous = this.history.get(boundedKey);
    return {
      key: boundedKey,
      ...(revision ? { revision } : {}),
      generation: this.generation,
      sequence: ++this.sequence,
      ...(boundedKey && revision && previous?.revision === revision
        ? { outcome: previous.outcome }
        : {}),
    };
  }

  complete(
    forecast: HistoryForecast,
    finishedRevision: string | undefined,
    observed?: PredictionOutcome,
    agent?: PredictionOutcome,
  ): BaselineComparison {
    const validState =
      forecast.generation === this.generation &&
      Boolean(
        forecast.key &&
        forecast.revision &&
        forecast.revision === finishedRevision,
      );
    if (!validState || !observed) {
      this.stats.unavailable++;
      if (forecast.generation === this.generation) this.invalidate();
      return { comparable: false };
    }
    const previous = this.history.get(forecast.key);
    if (!previous || previous.sequence < forecast.sequence) {
      this.history.delete(forecast.key);
      this.history.set(forecast.key, {
        revision: forecast.revision!,
        outcome: observed,
        sequence: forecast.sequence,
      });
      if (this.history.size > 256)
        this.history.delete(this.history.keys().next().value!);
    }
    if (!forecast.outcome || !agent) {
      this.stats.unavailable++;
      return { comparable: false };
    }
    const comparison = {
      comparable: true,
      baselineOutcome: forecast.outcome,
      baselineCorrect: forecast.outcome === observed,
      agentCorrect: agent === observed,
    };
    this.stats.comparisons++;
    if (comparison.baselineCorrect) this.stats.baselineCorrect++;
    if (comparison.agentCorrect) this.stats.agentCorrect++;
    return comparison;
  }

  invalidate(): void {
    this.history.clear();
    this.generation++;
    this.stats.invalidations++;
  }

  reset(): void {
    this.invalidate();
    this.stats = this.emptyStats();
  }

  snapshot(): HistoryBaselineStats {
    return { ...this.stats };
  }

  private emptyStats(): HistoryBaselineStats {
    return {
      comparisons: 0,
      baselineCorrect: 0,
      agentCorrect: 0,
      unavailable: 0,
      invalidations: 0,
    };
  }
}
