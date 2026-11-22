#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import {
  lstat,
  mkdir,
  open,
  readdir,
  readFile,
  realpath,
  rename,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PLYTH_PACKAGE_NAME = "plyth-core";
const packageInfo = JSON.parse(
  await readFile(join(packageRoot, "package.json"), "utf8"),
);
const CONFIG_RELATIVE_PATH = join(".rook", "plyth.json");

export async function main(args = process.argv.slice(2), dependencies = {}) {
  if (args.includes("--help") || args.includes("-h")) {
    printUsage();
    return 0;
  }

  const options = parseArguments(args);
  const project = await realpath(options.project);
  const workspacePackage = await readOptionalJson(
    join(project, "package.json"),
  );
  const getGlobalNodeModulesRoot =
    dependencies.getGlobalNodeModulesRoot ?? defaultGlobalNodeModulesRoot;
  const globalNodeModulesRoot = await getGlobalNodeModulesRoot();
  await assertCompatibleRookIfInstalled(
    workspacePackage,
    project,
    async () => globalNodeModulesRoot,
  );

  if (options.command === "status") {
    const config = await readPlythConfig(project);
    const installed = await installedPlyth(project, globalNodeModulesRoot);
    const effectiveMode = installed
      ? resolveEffectiveMode(config?.mode, process.env)
      : "off";
    process.stdout.write(
      `PLYTH for Rook (${project})\n` +
        `  package: ${installed?.manifest.version ?? "not installed"}${installed ? ` (${installed.source})` : ""}\n` +
        `  project mode: ${config?.mode ?? "integrated (default)"}\n` +
        `  effective mode: ${effectiveMode}\n`,
    );
    return installed ? 0 : 1;
  }

  if (options.command === "uninstall") {
    await writePlythConfig(project, "off");
    process.stdout.write(
      "PLYTH disabled for this workspace. The installed package remains available; restart Rook to apply changes.\n",
    );
    return 0;
  }

  const oldConfig = await readPlythConfig(project);
  const mode = options.mode ?? oldConfig?.mode ?? "integrated";
  if (!isMode(mode)) throw new Error(`Unsupported PLYTH mode: ${mode}`);

  let installed = await installedPlyth(project, globalNodeModulesRoot);
  if (options.source) {
    const source = options.source;
    if (dependencies.installPackage) {
      await dependencies.installPackage(project, source);
    } else {
      execFileSync(
        "npm",
        [
          "install",
          "--no-save",
          "--no-package-lock",
          "--prefix",
          project,
          source,
        ],
        {
          cwd: project,
          stdio: "inherit",
        },
      );
    }
    installed = await installedPlyth(project, globalNodeModulesRoot);
  }
  if (!isCompatiblePlyth(installed?.manifest)) {
    throw new Error(
      `PLYTH is not installed globally. Run \`npm install --global ${PLYTH_PACKAGE_NAME}@${packageInfo.version}\` first.`,
    );
  }

  await writePlythConfig(project, mode);
  process.stdout.write(
    `PLYTH ${mode} mode configured for Rook in ${project}.\n` +
      `Rook loads the ${installed.source} PLYTH package. Restart Rook to apply changes.\n`,
  );
  return 0;
}

export function parseArguments(args) {
  const [command, target, ...rest] = args;
  if (!new Set(["install", "status", "uninstall"]).has(command))
    throw new Error("Expected a command: install, status, or uninstall.");
  if (target !== "rook")
    throw new Error("The only supported host today is `rook`.");

  const options = {
    command,
    project: process.cwd(),
    mode: undefined,
    source: undefined,
  };
  for (let index = 0; index < rest.length; index++) {
    const flag = rest[index];
    const value = rest[index + 1];
    if (!value || value.startsWith("--"))
      throw new Error(`${flag} requires a value.`);
    if (flag === "--project") options.project = resolve(value);
    else if (flag === "--mode") options.mode = value;
    else if (flag === "--source") options.source = value;
    else throw new Error(`Unknown option: ${flag}`);
    index++;
  }
  if (options.mode !== undefined && !isMode(options.mode))
    throw new Error("--mode must be off, prompt, or integrated.");
  if (command !== "install" && (options.mode || options.source))
    throw new Error(`--mode and --source are only valid with install.`);
  return options;
}

async function readPlythConfig(project) {
  try {
    const config = JSON.parse(
      await readFile(join(project, CONFIG_RELATIVE_PATH), "utf8"),
    );
    if (
      !config ||
      typeof config !== "object" ||
      Array.isArray(config) ||
      config.schemaVersion !== 1 ||
      config.integrationVersion !== 1 ||
      !isMode(config.mode)
    )
      throw new Error(".rook/plyth.json has an unsupported or invalid format.");
    return config;
  } catch (error) {
    if (isMissing(error)) return undefined;
    throw error;
  }
}

async function writePlythConfig(project, mode) {
  const rookDirectory = join(project, ".rook");
  try {
    const directory = await lstat(rookDirectory);
    if (!directory.isDirectory() || directory.isSymbolicLink())
      throw new Error("Refusing to write through a non-directory .rook path.");
  } catch (error) {
    if (!isMissing(error)) throw error;
    await mkdir(rookDirectory, { mode: 0o700 });
  }

  const target = join(project, CONFIG_RELATIVE_PATH);
  const temporary = join(rookDirectory, `.plyth-${randomUUID()}.tmp`);
  const file = await open(temporary, "wx", 0o600);
  try {
    await file.writeFile(
      `${JSON.stringify({ schemaVersion: 1, integrationVersion: 1, mode }, null, 2)}\n`,
      "utf8",
    );
    await file.close();
    await rename(temporary, target);
  } catch (error) {
    await file.close().catch(() => {});
    throw error;
  }
}

async function installedPlyth(project, globalNodeModulesRoot) {
  const local = await readOptionalJson(
    join(
      project,
      "node_modules",
      ...PLYTH_PACKAGE_NAME.split("/"),
      "package.json",
    ),
  );
  if (local) return { manifest: local, source: "workspace" };
  if (!globalNodeModulesRoot) return undefined;
  const global = await readOptionalJson(
    join(globalNodeModulesRoot, PLYTH_PACKAGE_NAME, "package.json"),
  );
  return global ? { manifest: global, source: "global" } : undefined;
}

function isCompatiblePlyth(pkg) {
  if (
    !pkg ||
    pkg.name !== PLYTH_PACKAGE_NAME ||
    typeof pkg.version !== "string"
  )
    return false;
  const [major, minor] = pkg.version.split(".").map(Number);
  return major === 0 && minor === 1;
}

async function assertCompatibleRookIfInstalled(
  workspacePackage,
  project,
  getGlobalNodeModulesRoot = defaultGlobalNodeModulesRoot,
) {
  if (isRookPackage(workspacePackage)) {
    assertPlythCapability(workspacePackage, `Rook at ${project}`);
    return;
  }

  const nodeModules = join(project, "node_modules");
  const candidates = [
    join(nodeModules, "rook-agent", "package.json"),
    join(nodeModules, "rook", "package.json"),
  ];
  try {
    const entries = await readdir(nodeModules, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith("@"))
        for (const packageName of ["rook-agent", "rook"])
          candidates.push(
            join(nodeModules, entry.name, packageName, "package.json"),
          );
    }
  } catch (error) {
    if (!isMissing(error)) throw error;
  }
  for (const path of candidates) {
    const localRook = await readOptionalJson(path);
    if (!isRookPackage(localRook)) continue;
    assertPlythCapability(
      localRook,
      `Installed Rook ${localRook.version ?? "unknown"}`,
    );
    return;
  }

  const globalRoot = await getGlobalNodeModulesRoot();
  if (!globalRoot) return;
  const globalRook = await readOptionalJson(
    join(globalRoot, "rook-agent", "package.json"),
  );
  if (isRookPackage(globalRook)) {
    assertPlythCapability(
      globalRook,
      `Globally installed Rook ${globalRook.version ?? "unknown"}`,
    );
  }
}

function isRookPackage(pkg) {
  return (
    pkg &&
    typeof pkg.name === "string" &&
    (pkg.name === "rook-agent" ||
      pkg.name === "rook" ||
      pkg.name.endsWith("/rook-agent") ||
      pkg.name.endsWith("/rook"))
  );
}

function assertPlythCapability(pkg, description) {
  if (pkg.rookCapabilities?.plythIntegration !== 1)
    throw new Error(
      `${description} does not declare PLYTH integration capability 1.`,
    );
}

async function defaultGlobalNodeModulesRoot() {
  try {
    const root = execFileSync("npm", ["root", "-g"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return root || undefined;
  } catch {
    return undefined;
  }
}

function resolveEffectiveMode(configMode, env) {
  if (env.ROOK_PLYTH_INTEGRATED !== undefined) {
    const value = env.ROOK_PLYTH_INTEGRATED;
    if (value === "1" || value === "integrated") return "integrated";
    if (value === "prompt") return "prompt";
    return "off";
  }
  return configMode ?? "integrated";
}

function isMode(value) {
  return value === "off" || value === "prompt" || value === "integrated";
}

function isMissing(error) {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "ENOENT",
  );
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function readOptionalJson(path) {
  try {
    return await readJson(path);
  } catch (error) {
    if (isMissing(error)) return undefined;
    throw error;
  }
}

function printUsage() {
  process.stdout.write(
    "Usage:\n" +
      "  plyth-core install rook [--project PATH] [--mode integrated|prompt|off] [--source PACKAGE_SPEC]\n" +
      "  plyth-core status rook [--project PATH]\n" +
      "  plyth-core uninstall rook [--project PATH]\n\n" +
      "Install defaults to integrated. Use --mode prompt for static guidance or --mode off to disable PLYTH for this workspace.\n" +
      "--source accepts an npm package spec or local tarball path for unpublished testing.\n",
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(realpathSync(resolve(process.argv[1]))).href
) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      process.stderr.write(
        `plyth: ${error instanceof Error ? error.message : String(error)}\n`,
      );
      process.exitCode = 1;
    });
}
