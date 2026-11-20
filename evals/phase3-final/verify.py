"""Offline fixture controls: all buggy starters fail; known repairs pass.

python3 evals/phase3-final/verify.py --temp-root /approved/temp/directory
"""
import argparse
from pathlib import Path
import subprocess
import tempfile

from run import HERE, COMMANDS

REPAIRS = {
    "pagination": {
        "page.mjs": "export function readPage(response) { return { items: response.items ?? [], next: response.next ?? undefined }; }",
        "merge.mjs": """export function mergeItems(current, incoming) {
          const result = [...current]; const seen = new Set(current.map(item => item.id));
          for (const item of incoming) if (!seen.has(item.id)) { seen.add(item.id); result.push(item); }
          return result;
        }""",
        "collect.mjs": """import { mergeItems } from './merge.mjs';
        import { readPage } from './page.mjs';
        export async function collectItems(fetchPage) {
          let cursor; let items = [];
          do { const page = readPage(await fetchPage(cursor)); items = mergeItems(items, page.items); cursor = page.next; }
          while (cursor !== undefined && cursor !== null);
          return items;
        }""",
    },
    "cache": {
        "entry.mjs": "export function isFresh(entry, now) { return Boolean(entry) && entry.expiresAt > now; }",
        "cache.mjs": """import { isFresh } from './entry.mjs';
        export function createCache(load, { ttlMs, now }) {
          const entries = new Map(); const pending = new Map();
          return { async get(key) {
            if (pending.has(key)) return pending.get(key);
            if (isFresh(entries.get(key), now())) return entries.get(key).value;
            const promise = Promise.resolve(load(key)).then(value => {
              entries.set(key, { value, expiresAt: now() + ttlMs }); return value;
            }).finally(() => pending.delete(key));
            pending.set(key, promise); return promise;
          } };
        }""",
    },
    "pricing": {
        "lines.mjs": "export function lineTotals(lines, catalog) { return lines.map(({ sku, quantity }) => ({ sku, cents: catalog[sku] * quantity })); }",
        "discount.mjs": "export function discountCents(subtotal, basisPoints) { return Math.round(subtotal * basisPoints / 10000); }",
        "quote.mjs": """import { lineTotals } from './lines.mjs';
        import { discountCents } from './discount.mjs';
        export function quote(lines, catalog, { basisPoints, freeShippingAt, shippingCents }) {
          const subtotal = lineTotals(lines, catalog).reduce((sum, line) => sum + line.cents, 0);
          const discount = discountCents(subtotal, basisPoints);
          const shipping = subtotal - discount >= freeShippingAt ? 0 : shippingCents;
          return { subtotal, discount, shipping, total: subtotal - discount + shipping };
        }""",
    },
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--temp-root", type=Path, required=True)
    args = parser.parse_args()
    for task, repairs in REPAIRS.items():
        with tempfile.TemporaryDirectory(prefix="plyth-fixture-control-", dir=args.temp_root) as directory:
            workspace = Path(directory)
            for source in (HERE / "fixtures" / task).rglob("*"):
                if source.is_file():
                    target = workspace / str(source.relative_to(HERE / "fixtures" / task)).removesuffix(".fixture")
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(source.read_bytes())
            for repaired in (False, True):
                if repaired:
                    for filename, code in repairs.items():
                        (workspace / "src" / filename).write_text(code)
                check = subprocess.run(COMMANDS[0].split(), cwd=workspace, capture_output=True, text=True, timeout=30)
                expected = 0 if repaired else 1
                if check.returncode != expected:
                    raise AssertionError(f"{task}, repaired={repaired}: {check.stdout} {check.stderr}")
                print(task, "repair passes" if repaired else "starter fails", flush=True)


if __name__ == "__main__":
    main()
