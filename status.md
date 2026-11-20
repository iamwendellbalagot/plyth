# Status

## Direction

- Pivot: lightweight change review that challenges unjustified complexity while preserving required behavior.
- Full design: [plan.md](plan.md). New review functionality is not yet implemented.
- Rook first; other coding-agent adapters are deferred.

## Existing implementation and evidence

- Current code is the legacy prediction-feedback core, consumed by Rook. Existing behavior remains unchanged and advisory feedback stays default-off.
- No demonstrated effectiveness benefit: [bounded study](evals/phase3-final/report.md) and [latest live comparison](evals/latest-features-live/report.md).
- Setup/API and privacy details: [README.md](README.md) and [Rook integration](docs/rook.md).

## Completed

- Added `plan.md`, removed obsolete `implementation.md`, and condensed this handoff.

## Active / next

- Audit existing Rook review and quality-guidance capabilities before building anything. Rook already has `/review`, a separate read-only review path, and simplicity guidance.
- Prototype the smallest differentiated review against a simple prompt baseline. No provider runs or inference budget have been approved.
- Preserve legacy PLYTH APIs and Rook integration until a replacement is explicitly validated and migrated.

## Validation

- Documentation changes only: run Markdown/reference inspection and `git diff --check`. Historical code-test results are not current verification.
