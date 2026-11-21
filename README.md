# PLYTH — lightweight change review for coding agents

PLYTH is a standalone, dependency-free TypeScript package for lightweight coding-
change review. Its current prototype helps an agent question whether added code,
abstractions, dependencies, tests, and scope are justified—without optimizing for
line count or recommending removal of necessary safeguards.

PLYTH does not run an agent, call a model, inspect repositories, edit code, execute
tests, or change permissions. A host adapter supplies task context and a bounded
change view, then invokes its existing model. Rook is the first and only adapter;
the explicit `/review simplicity` integration is experimental and has not been
shown to improve coding outcomes. Other-agent support is future work.

The package still contains the earlier prediction-feedback core used by Rook.
That behavior is retained for compatibility, remains default-off for advisory
feedback, and has no demonstrated effectiveness benefit. See the historical
reports linked below; they do not evaluate the new change-review prototype.

## Install PLYTH in Rook

After PLYTH is available from npm, install it in any Node workspace you use
with Rook:

```sh
npm install @wendell2215/rook
npx plyth install rook --project .
```

This adds PLYTH to the workspace and writes `.rook/plyth.json` with mode `off`.
Enable static guidance with `--mode prompt`, or explicitly opt into experimental
dynamic mode with `--mode integrated`. Dynamic mode has no demonstrated coding
benefit and remains off by default. Restart Rook to apply the setting.
Inspect or disable the integration with:

```sh
npx plyth status rook --project .
npx plyth uninstall rook --project .
```

Uninstall disables the integration and removes PLYTH from the workspace; Rook
continues to work without it. An explicit `ROOK_PLYTH_INTEGRATED` environment
setting overrides the project's `.rook/plyth.json` mode.

For local testing, pack PLYTH and use the tarball as the CLI source (replace the
path with its absolute path):

```sh
npm pack --pack-destination /path/to/artifacts
npm exec --yes --package=/path/to/artifacts/plyth-0.1.0.tgz -- plyth install rook --project /path/to/workspace --source /path/to/artifacts/plyth-0.1.0.tgz
```

The installer does not patch Rook source or alter its permissions. It checks a
local Rook install's declared `plythIntegration` capability when present. Other
coding-agent adapters are future work.

## Development

```sh
npm ci
npm test
npm run build
```

For local Rook development, clone `plyth` and `rook` beside one another. Rook
uses `file:../plyth` only as a development dependency; its package declares
PLYTH as an optional peer. The unscoped npm name `rook` belongs to an unrelated
existing package, so use a distinct name before distributing Rook through npm.

## Implemented Rook-first capabilities

- Experimental bounded prompt builder for read-only reviews of whether change
  complexity is justified, with task-context, diff-size, finding-schema, and
  output-size bounds, plus version-1 scoped request/result contracts. The Rook
  adapter adds task-window attribution, conservative text budgets, two-read
  limits, revision checking and lifecycle invalidation. Hosts retain model calls
  and permission enforcement; see [docs/rook.md](docs/rook.md) for exact limits.
- Versioned bounded event validation, deterministic outcome/evidence judgments,
  and fail-open normalization of unknown results.
- Coverage/verdict/duration counters and a capped, deduplicated session-feedback gate.
- An outcome-only identical-command history baseline, with revision/generation
  invalidation, bounded history and explicit unavailable comparisons.
- A strict minimal trace schema, with opt-in private bounded JSONL storage,
  export and deletion controls implemented by Rook.
- Independent off/observe/advisory modes and a separate persistence switch.
- Offline descriptive binary intervals and deterministic paired task bootstrap.

See [Rook setup, capabilities and privacy](docs/rook.md). Implementation completion
is not a claim of feedback benefit. The [earlier bounded evaluation](evals/phase3-final/report.md)
found insufficient benefit evidence and predates the history/trace completion.
It should not be represented as an evaluation of every completed v0.1 feature.

## Core API examples

```js
import {
  CommandHistoryBaseline,
  binaryInterval,
  pairedBootstrapDifference,
} from "plyth";

const history = new CommandHistoryBaseline();
const forecast = history.begin("normalized-command", "host-workspace-revision");
history.complete(forecast, "host-workspace-revision", "fail", "pass");
history.invalidate(); // observed edit or other possible mutation

binaryInterval(3, 3); // rate 1; descriptive 95% interval approximately [0.44, 1]
pairedBootstrapDifference(
  [
    [100, 110],
    [200, 190],
  ],
  42,
); // [baseline, treatment]
```

The baseline forecasts the last outcome of the same command under the same
host-declared workspace state; it is not a counterfactual or a semantic judge.
Both the baseline and model are compared on the same outcome-only denominator.
Unreliable snapshots, changes during execution, missing outcomes and missing
model predictions do not enter that denominator.

Statistics are offline reporting utilities, not runtime steering. Keep units
consistent, pair tasks rather than unrelated commands, exclude and document
censored observations, and retain the original per-task data. Empty samples return
null estimates; one-pair bootstrap intervals are unavailable. Correlated commands
and small authored task sets do not support population or causal claims.
