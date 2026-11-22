import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { main, parseArguments } from "../bin/plyth.mjs";

async function projectDirectory() {
  const root = await mkdtemp(join(tmpdir(), "plyth-cli-"));
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

test("installs in a workspace, reports status, and removes the dependency on uninstall", async () => {
  const root = await projectDirectory();
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
      { schemaVersion: 1, integrationVersion: 1, mode: "off" },
    );

    await main(["install", "rook", "--project", root, "--mode", "integrated"]);
    assert.deepEqual(installedSources, ["./plyth.tgz"]);
    assert.deepEqual(
      JSON.parse(await readFile(join(root, ".rook", "plyth.json"), "utf8")),
      { schemaVersion: 1, integrationVersion: 1, mode: "integrated" },
    );

    assert.equal(await main(["status", "rook", "--project", root]), 0);
    let uninstallCalls = 0;
    assert.equal(
      await main(["uninstall", "rook", "--project", root], {
        uninstallPackage: async (project) => {
          uninstallCalls++;
          await rm(join(project, "node_modules", "plyth-core"), {
            recursive: true,
            force: true,
          });
        },
      }),
      0,
    );
    assert.equal(uninstallCalls, 1);
    assert.deepEqual(
      JSON.parse(await readFile(join(root, ".rook", "plyth.json"), "utf8")),
      { schemaVersion: 1, integrationVersion: 1, mode: "off" },
    );
    await assert.rejects(
      readFile(join(root, "node_modules", "plyth-core", "package.json")),
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
  try {
    const rookPackage = join(root, "node_modules", "rook-agent");
    await mkdir(rookPackage, { recursive: true });
    await writeFile(
      join(rookPackage, "package.json"),
      JSON.stringify({
        name: "rook-agent",
        version: "0.1.0",
        rookCapabilities: { plythIntegration: 1 },
      }),
    );
    let attemptedInstall = false;
    assert.equal(
      await main(["install", "rook", "--project", root], {
        installPackage: async () => {
          attemptedInstall = true;
          await installStub(root);
        },
      }),
      0,
    );
    assert.equal(attemptedInstall, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("uses globally installed rook-agent without adding it to the workspace", async () => {
  const root = await projectDirectory();
  const globalRoot = join(root, "global");
  try {
    const globalRook = join(globalRoot, "rook-agent");
    await mkdir(globalRook, { recursive: true });
    await writeFile(
      join(globalRook, "package.json"),
      JSON.stringify({
        name: "rook-agent",
        version: "0.1.0",
        rookCapabilities: { plythIntegration: 1 },
      }),
    );
    let attemptedInstall = false;
    assert.equal(
      await main(["install", "rook", "--project", root], {
        getGlobalRookPackageRoot: async () => globalRoot,
        installPackage: async (project) => {
          attemptedInstall = true;
          await installStub(project);
        },
      }),
      0,
    );
    assert.equal(attemptedInstall, true);
    assert.deepEqual(
      JSON.parse(await readFile(join(root, "package.json"), "utf8")),
      { name: "sample-project", version: "1.0.0" },
    );
    await assert.rejects(
      readFile(join(root, "node_modules", "rook-agent", "package.json")),
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
        getGlobalRookPackageRoot: async () => globalRoot,
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
