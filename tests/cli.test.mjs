import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { main, parseArguments } from "../bin/plyth.mjs";

async function rookProject() {
  const root = await mkdtemp(join(tmpdir(), "plyth-cli-"));
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({ name: "rook", version: "0.1.0" }),
  );
  return root;
}

async function installStub(project) {
  const packageDirectory = join(project, "node_modules", "plyth");
  await mkdir(packageDirectory, { recursive: true });
  await writeFile(
    join(packageDirectory, "package.json"),
    JSON.stringify({ name: "plyth", version: "0.1.0" }),
  );
}

test("parses supported commands, modes, and local package sources", () => {
  assert.deepEqual(
    parseArguments([
      "install",
      "rook",
      "--project",
      "/tmp/rook",
      "--mode",
      "prompt",
      "--source",
      "./plyth.tgz",
    ]),
    {
      command: "install",
      project: "/tmp/rook",
      mode: "prompt",
      source: "./plyth.tgz",
    },
  );
  assert.throws(
    () => parseArguments(["install", "codex"]),
    /only supported host/,
  );
  assert.throws(
    () => parseArguments(["install", "rook", "--mode", "enabled"]),
    /--mode must be/,
  );
});

test("installs default-off, supports opt-in modes, reports status, and disables without removing core", async () => {
  const root = await rookProject();
  try {
    const installedSources = [];
    const dependencies = {
      installPackage: async (project, source) => {
        installedSources.push(source);
        await installStub(project);
      },
    };

    assert.equal(
      await main(
        ["install", "rook", "--project", root, "--source", "./plyth.tgz"],
        dependencies,
      ),
      0,
    );
    assert.deepEqual(installedSources, ["./plyth.tgz"]);
    assert.deepEqual(
      JSON.parse(await readFile(join(root, ".rook", "plyth.json"), "utf8")),
      { schemaVersion: 1, mode: "off" },
    );

    await main(["install", "rook", "--project", root, "--mode", "integrated"]);
    assert.deepEqual(installedSources, ["./plyth.tgz"]);
    assert.deepEqual(
      JSON.parse(await readFile(join(root, ".rook", "plyth.json"), "utf8")),
      { schemaVersion: 1, mode: "integrated" },
    );

    assert.equal(await main(["status", "rook", "--project", root]), 0);
    assert.equal(await main(["uninstall", "rook", "--project", root]), 0);
    assert.deepEqual(
      JSON.parse(await readFile(join(root, ".rook", "plyth.json"), "utf8")),
      { schemaVersion: 1, mode: "off" },
    );
    assert.equal(
      JSON.parse(
        await readFile(
          join(root, "node_modules", "plyth", "package.json"),
          "utf8",
        ),
      ).name,
      "plyth",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects unsupported Rook versions before installing", async () => {
  const root = await rookProject();
  try {
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({ name: "rook", version: "1.0.0" }),
    );
    let attemptedInstall = false;
    await assert.rejects(
      main(["install", "rook", "--project", root], {
        installPackage: async () => {
          attemptedInstall = true;
        },
      }),
      /supports Rook 0.1.x/,
    );
    assert.equal(attemptedInstall, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
