import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { main, parseArguments } from "../bin/plyth.mjs";

async function projectDirectory(withPackageJson = true) {
  const root = await mkdtemp(join(tmpdir(), "plyth-cli-"));
  if (withPackageJson)
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({ name: "sample-project", version: "1.0.0" }),
    );
  return root;
}

async function installStub(project) {
  const packageDirectory = join(project, "node_modules", "plyth-core");
  await mkdir(packageDirectory, { recursive: true });
  await writeFile(
    join(packageDirectory, "package.json"),
    JSON.stringify({ name: "plyth-core", version: "0.1.0" }),
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

test("supports local source overrides, status, and workspace disable", async () => {
  const root = await projectDirectory();
  try {
    const installedSources = [];
    const dependencies = {
      getGlobalNodeModulesRoot: async () => undefined,
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
      { schemaVersion: 1, integrationVersion: 1, mode: "integrated" },
    );

    await main(["install", "rook", "--project", root, "--mode", "integrated"]);
    assert.deepEqual(installedSources, ["./plyth.tgz"]);
    assert.deepEqual(
      JSON.parse(await readFile(join(root, ".rook", "plyth.json"), "utf8")),
      { schemaVersion: 1, integrationVersion: 1, mode: "integrated" },
    );

    assert.equal(await main(["status", "rook", "--project", root]), 0);
    assert.equal(
      await main(["uninstall", "rook", "--project", root], dependencies),
      0,
    );
    assert.deepEqual(
      JSON.parse(await readFile(join(root, ".rook", "plyth.json"), "utf8")),
      { schemaVersion: 1, integrationVersion: 1, mode: "off" },
    );
    assert.equal(
      JSON.parse(
        await readFile(
          join(root, "node_modules", "plyth-core", "package.json"),
          "utf8",
        ),
      ).name,
      "plyth-core",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects a local Rook install without the declared PLYTH capability", async () => {
  const root = await projectDirectory();
  try {
    await mkdir(join(root, "node_modules", "rook"), { recursive: true });
    await writeFile(
      join(root, "node_modules", "rook", "package.json"),
      JSON.stringify({ name: "rook", version: "1.0.0" }),
    );
    let attemptedInstall = false;
    await assert.rejects(
      main(["install", "rook", "--project", root], {
        installPackage: async () => {
          attemptedInstall = true;
        },
      }),
      /does not declare PLYTH integration capability 1/,
    );
    assert.equal(attemptedInstall, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("accepts a compatible rook-agent package", async () => {
  const root = await projectDirectory();
  const globalRoot = join(root, "global");
  try {
    const rookPackage = join(root, "node_modules", "rook-agent");
    const globalPlyth = join(globalRoot, "plyth-core");
    await mkdir(rookPackage, { recursive: true });
    await mkdir(globalPlyth, { recursive: true });
    await writeFile(
      join(rookPackage, "package.json"),
      JSON.stringify({
        name: "rook-agent",
        version: "0.1.0",
        rookCapabilities: { plythIntegration: 1 },
      }),
    );
    await writeFile(
      join(globalPlyth, "package.json"),
      JSON.stringify({ name: "plyth-core", version: "0.1.1" }),
    );
    assert.equal(
      await main(["install", "rook", "--project", root], {
        getGlobalNodeModulesRoot: async () => globalRoot,
      }),
      0,
    );
    assert.deepEqual(
      JSON.parse(await readFile(join(root, ".rook", "plyth.json"), "utf8")),
      { schemaVersion: 1, integrationVersion: 1, mode: "integrated" },
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("configures integrated PLYTH in a non-Node workspace from global packages", async () => {
  const root = await projectDirectory(false);
  const globalRoot = join(root, "global");
  try {
    const globalRook = join(globalRoot, "rook-agent");
    const globalPlyth = join(globalRoot, "plyth-core");
    await mkdir(globalRook, { recursive: true });
    await mkdir(globalPlyth, { recursive: true });
    await writeFile(
      join(globalRook, "package.json"),
      JSON.stringify({
        name: "rook-agent",
        version: "0.1.0",
        rookCapabilities: { plythIntegration: 1 },
      }),
    );
    await writeFile(
      join(globalPlyth, "package.json"),
      JSON.stringify({ name: "plyth-core", version: "0.1.1" }),
    );
    assert.equal(
      await main(["install", "rook", "--project", root], {
        getGlobalNodeModulesRoot: async () => globalRoot,
      }),
      0,
    );
    assert.equal(
      await readFile(join(root, "package.json"), "utf8").catch(() => undefined),
      undefined,
    );
    assert.deepEqual(
      JSON.parse(await readFile(join(root, ".rook", "plyth.json"), "utf8")),
      { schemaVersion: 1, integrationVersion: 1, mode: "integrated" },
    );
    await assert.rejects(
      readFile(join(root, "node_modules", "rook-agent", "package.json")),
    );
    await assert.rejects(
      readFile(join(root, "node_modules", "plyth-core", "package.json")),
    );

    assert.equal(
      await main(["status", "rook", "--project", root], {
        getGlobalNodeModulesRoot: async () => globalRoot,
      }),
      0,
    );
    assert.equal(await main(["uninstall", "rook", "--project", root]), 0);
    assert.deepEqual(
      JSON.parse(await readFile(join(root, ".rook", "plyth.json"), "utf8")),
      { schemaVersion: 1, integrationVersion: 1, mode: "off" },
    );
    assert.equal(
      JSON.parse(await readFile(join(globalPlyth, "package.json"), "utf8"))
        .name,
      "plyth-core",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects a globally installed Rook without PLYTH capability", async () => {
  const root = await projectDirectory();
  const globalRoot = join(root, "global");
  try {
    const globalRook = join(globalRoot, "rook-agent");
    await mkdir(globalRook, { recursive: true });
    await writeFile(
      join(globalRook, "package.json"),
      JSON.stringify({ name: "rook-agent", version: "0.1.0" }),
    );
    let attemptedInstall = false;
    await assert.rejects(
      main(["install", "rook", "--project", root], {
        getGlobalNodeModulesRoot: async () => globalRoot,
        installPackage: async () => {
          attemptedInstall = true;
        },
      }),
      /Globally installed Rook 0.1.0 does not declare PLYTH integration capability 1/,
    );
    assert.equal(attemptedInstall, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
