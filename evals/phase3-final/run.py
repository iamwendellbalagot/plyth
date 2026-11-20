"""Native Rook paired evaluation. Provider runs are opt-in; --prepare is offline.

Usage: python3 evals/phase3-final/run.py --rook /path/to/rook --base /approved/temp/path --prepare
       python3 evals/phase3-final/run.py --rook /path/to/rook --base /approved/temp/path --run

Create b0-host/b1-host worktrees at the protocol revision before --run. The
baseline-only patch is persisted as baseline.patch in the result directory.
"""

import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import pty
import random
import re
import signal
import struct
import subprocess
import termios
import time

HERE = Path(__file__).resolve().parent
COMMANDS = [
    "node --test tests/unit.test.mjs tests/integration.test.mjs",
    "node --test tests/unit.test.mjs",
    "node --test tests/integration.test.mjs",
]
GOALS = {
    "pagination": "Repair collectItems across the page reader and item merger: follow every non-null/undefined cursor (including 0), continue through empty intermediate pages, deduplicate IDs keeping the first-seen object and ordering, and propagate fetch errors without retrying. Do not mutate fetched items.",
    "cache": "Repair createCache and its freshness helper: values expire exactly at their deadline; coalesce all concurrent requests for a key even if loading lasts longer than the TTL; begin the value TTL when loading resolves; evict rejected loads so later calls can retry. Preserve falsy values and per-key isolation. Use the injected clock, not wall-clock sleeps.",
    "pricing": "Repair the quote pipeline: multiply unit prices in integer cents by quantity, round the aggregate basis-point discount to nearest cent once, and use discounted merchandise amount for the inclusive free-shipping threshold. Preserve the output shape, input arrays/objects, and zero/full discount behavior. Inputs are valid nonnegative integers and known SKUs.",
}


def prompt(task):
    return (
        GOALS[task]
        + " Inspect README.md, src/ and the focused tests before editing. Run exactly `"
        + COMMANDS[0]
        + "` on the unchanged starter before any edits. Then diagnose and repair all issues. "
        + "You may run these exact commands as needed (six test commands total maximum): "
        + "; ".join(f"`{c}`" for c in COMMANDS)
        + ". End with the combined suite. Edit only src/; do not edit tests, configuration or unrelated files. "
        + "Do not execute any other shell command. Preserve the public APIs. Report verified results honestly."
    )


def git(path, *args):
    return subprocess.run(["git", "-C", str(path), *args], check=True, capture_output=True, text=True).stdout


def fixture_hashes(path):
    return {str(p.relative_to(path)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted((path / "tests").rglob("*")) if p.is_file()}


def prepare(base):
    for name in GOALS:
        for condition in ("b0", "b1", "b2"):
            path = base / f"{name}-{condition}"
            path.mkdir()
            for source in (HERE / "fixtures" / name).rglob("*"):
                if source.is_file():
                    relative = str(source.relative_to(HERE / "fixtures" / name)).removesuffix(".fixture")
                    target = path / relative
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(source.read_bytes())
            (path / "README.md").write_text("# Task contract\n\n" + GOALS[name] + "\n\nThe unit and integration suites together define the required repair.\n")
            (path / "package.json").write_text('{"type":"module"}\n')
            (path / ".gitignore").write_text(".rook/\n")
            (path / ".rook").mkdir()
            (path / ".rook/policy.json").write_text('{"execution":{"sandbox_shell":false}}\n')
            git(path, "init", "-q")
            git(path, "add", ".")
            git(path, "-c", "user.name=PLYTH Eval", "-c", "user.email=plyth-eval@localhost", "commit", "-qm", "Add frozen task")
            check = subprocess.run(COMMANDS[0].split(), cwd=path, capture_output=True, text=True, timeout=30)
            if check.returncode != 1:
                raise RuntimeError(f"Starter must fail normally: {name}: {check.stdout} {check.stderr}")
            print(name, condition, "starter verified failing", flush=True)
    manifest = {"seed": 20261120, "commands": COMMANDS, "prompts": {n: prompt(n) for n in GOALS},
                "tests": {n: fixture_hashes(base / f"{n}-b0") for n in GOALS}}
    (base / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


def text(message):
    content = message.get("content", "")
    return content if isinstance(content, str) else "\n".join(
        part.get("text", "") for part in content if isinstance(part, dict) and part.get("type") == "text")


def session_state(directory, user_prompt):
    for path in sorted(directory.glob("*.jsonl"), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            entries = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
        except (OSError, ValueError):
            continue
        for index, event in enumerate(entries):
            message = event.get("message", {})
            if message.get("role") == "user" and text(message) == user_prompt:
                return entries, index
    return None


def run_one(base, name, condition, expected_tests):
    workspace = base / f"{name}-{condition}"
    host = base / ("b0-host" if condition == "b0" else "b1-host")
    directory = Path.home() / ".pi/agent/sessions" / ("--" + str(workspace).lstrip("/").replace("/", "-") + "--")
    env = {**os.environ, "TERM": "xterm-256color"}
    env.pop("ROOK_PLYTH_FEEDBACK", None)
    if condition == "b2":
        env["ROOK_PLYTH_FEEDBACK"] = "1"
    master, slave = pty.openpty()
    fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", 55, 180, 0, 0))
    proc = subprocess.Popen(["node", "bin/rook.mjs", "--cwd", str(workspace)], cwd=host,
                            stdin=slave, stdout=slave, stderr=slave, env=env, start_new_session=True)
    os.close(slave)
    os.set_blocking(master, False)
    raw = bytearray()

    def drain():
        while True:
            try:
                chunk = os.read(master, 65536)
                if not chunk:
                    break
                raw.extend(chunk)
            except (OSError, BlockingIOError):
                break

    def screen():
        decoded = raw.decode("utf8", "replace")
        decoded = re.sub(r"\x1b\[[0-?]*[ -/]*[@-~]", "", decoded)
        return re.sub(r"\x1b\][^\x07]*(?:\x07|\x1b\\)", "", decoded)

    result = {"task": name, "condition": condition, "approved_commands": [], "error": None}
    submitted = None
    approval_wait = 0
    pending_panel = None
    try:
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline and proc.poll() is None:
            drain()
            if "rook >" in screen().lower():
                break
            time.sleep(.1)
        else:
            raise RuntimeError("startup timeout")
        os.write(master, b"/build\r")
        time.sleep(.35)
        drain()
        user_prompt = prompt(name)
        submitted = time.monotonic()
        os.write(master, user_prompt.encode() + b"\r")
        deadline = submitted + 360
        while time.monotonic() < deadline and proc.poll() is None:
            drain()
            state = session_state(directory, user_prompt)
            if state:
                entries, index = state
                assistants = [e.get("message", {}) for e in entries[index + 1:]
                              if e.get("message", {}).get("role") == "assistant"]
                if assistants and assistants[-1].get("stopReason") == "stop":
                    result["settled"] = True
                    break
            panel = screen()
            if "Run terminal command" in panel and "Allow once" in panel and "Command:" in panel:
                if pending_panel is None:
                    pending_panel = time.monotonic()
                panel = panel[panel.rfind("Run terminal command"):]
                matches = re.findall(r'Command: "([^"\r\n]*)"', panel)
                if not matches:
                    time.sleep(.1)
                    continue
                command = matches[-1]
                if command not in COMMANDS or len(result["approved_commands"]) >= 6:
                    os.write(master, b"\x1b")
                    raise RuntimeError("denied unexpected/over-budget command: " + command)
                if "NOT sandboxed" not in panel:
                    raise RuntimeError("approval host-execution warning missing")
                os.write(master, b"\x1b[B")
                time.sleep(.2)
                drain()
                if "[Allow once]" not in screen():
                    raise RuntimeError("once approval selection not verified")
                os.write(master, b"\r")
                result["approved_commands"].append(command)
                approval_wait += time.monotonic() - pending_panel
                pending_panel = None
                raw.clear()
            time.sleep(.1)
        if not result.get("settled"):
            raise RuntimeError("provider run did not settle within 360 seconds")
    except Exception as error:
        result["error"] = str(error)
    finally:
        result["wall_seconds"] = round(time.monotonic() - submitted, 3) if submitted else None
        result["approval_wait_seconds"] = round(approval_wait, 3)
        try:
            os.killpg(proc.pid, signal.SIGTERM)
            proc.wait(timeout=4)
        except subprocess.TimeoutExpired:
            os.killpg(proc.pid, signal.SIGKILL)
            proc.wait(timeout=4)
        except ProcessLookupError:
            pass
        os.close(master)

    state = session_state(directory, prompt(name))
    result.update({"usage": {k: 0 for k in ("input", "output", "cacheRead", "cacheWrite")},
                   "calls": [], "tests": [], "answer": "", "models": []})
    if state:
        entries, index = state
        result["models"] = [{"provider": e.get("provider"), "model": e.get("modelId")}
                            for e in entries[:index] if e.get("type") == "model_change"]
        for event in entries[index + 1:]:
            message = event.get("message", {})
            if message.get("role") == "assistant":
                for key in result["usage"]:
                    result["usage"][key] += int((message.get("usage") or {}).get(key, 0) or 0)
                result["answer"] = text(message) or result["answer"]
                for part in message.get("content", []):
                    if isinstance(part, dict) and part.get("type") == "toolCall":
                        result["calls"].append({"id": part.get("id"), "name": part.get("name"),
                                                "arguments": part.get("arguments", {})})
            elif message.get("role") == "toolResult" and message.get("toolName") == "bash":
                result["tests"].append({"call_id": message.get("toolCallId"), "text": text(message)})

    result["tests_unchanged"] = fixture_hashes(workspace) == expected_tests and not any(p.is_symlink() for p in (workspace / "tests").rglob("*"))
    changed = git(workspace, "diff", "--name-only").splitlines() + git(workspace, "ls-files", "--others", "--exclude-standard").splitlines()
    result["changed_files"] = changed
    result["scope_ok"] = all(p.startswith("src/") for p in changed)
    result["source_diff"] = git(workspace, "diff", "--", "src")
    sources_safe = not any(p.is_symlink() for p in (workspace / "src").rglob("*"))
    if result["tests_unchanged"] and result["scope_ok"] and sources_safe:
        try:
            check = subprocess.run(COMMANDS[0].split(), cwd=workspace, capture_output=True, text=True, timeout=30)
            result["trusted_check"] = {"exit_code": check.returncode, "output": check.stdout + check.stderr}
        except subprocess.TimeoutExpired:
            result["trusted_check"] = {"exit_code": None, "output": "evaluation check timed out"}
    result["success"] = result.get("trusted_check", {}).get("exit_code") == 0 and result["scope_ok"] and result["tests_unchanged"]
    # Evaluation artifacts retain synthetic fixtures only, not machine-local paths.
    return json.loads(json.dumps(result, ensure_ascii=False).replace(str(workspace), "<workspace>").replace(str(base), "<evaluation-root>"))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", type=Path, required=True)
    parser.add_argument("--rook", type=Path, required=True)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--prepare", action="store_true")
    mode.add_argument("--run", action="store_true")
    args = parser.parse_args()
    base = args.base.resolve()
    if args.prepare:
        base.mkdir(parents=True, exist_ok=True)
        prepare(base)
    else:
        expected_revision = "b93b5d396f7d65ee44193b297e511237854f0019"
        for host in (args.rook, base / "b0-host", base / "b1-host"):
            if git(host, "rev-parse", "HEAD").strip() != expected_revision:
                raise RuntimeError(f"Host revision does not match the frozen protocol: {host}")
        manifest = json.loads((base / "manifest.json").read_text())
        order = [(n, c) for n in GOALS for c in ("b0", "b1", "b2")]
        random.Random(20261120).shuffle(order)
        output = HERE / "results.jsonl"
        with output.open("x") as stream:
            print("ORDER", order, flush=True)
            for name, condition in order:
                result = run_one(base, name, condition, manifest["tests"][name])
                stream.write(json.dumps(result, ensure_ascii=False) + "\n")
                stream.flush()
                print(json.dumps({k: result[k] for k in ("task", "condition", "error", "success", "wall_seconds", "usage", "approved_commands")}), flush=True)


if __name__ == "__main__":
    main()
