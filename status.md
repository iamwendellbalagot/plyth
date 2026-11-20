# Status

## Direction

- Pivot: lightweight change review that challenges unjustified complexity while preserving required behavior.
- Full design: [plan.md](plan.md). The minimal prompt/invocation prototype is in progress.
- Rook first; other coding-agent adapters are deferred.

## Existing implementation and evidence

- Current code is the legacy prediction-feedback core, consumed by Rook. Existing behavior remains unchanged and advisory feedback stays default-off.
- No demonstrated effectiveness benefit: [bounded study](evals/phase3-final/report.md) and [latest live comparison](evals/latest-features-live/report.md).
- Setup/API and privacy details: [README.md](README.md) and [Rook integration](docs/rook.md).

## Completed

- Added `plan.md`, removed obsolete `implementation.md`, and condensed this handoff.

## Active / next

- Rook audit found an existing explicit `/review` path; the PLYTH prompt builder and Rook `/review simplicity` prototype are implemented and focused checks pass.
- Freeze offline review cases next. No provider runs or inference budget have been approved.
- Preserve legacy PLYTH APIs and Rook integration until a replacement is explicitly validated and migrated.

## Validation

- PLYTH: `npm test` (13 tests), build, formatting and diff checks pass. Rook: focused review/TUI tests (44), typecheck, formatting and diff checks pass. No live review comparison was run.
