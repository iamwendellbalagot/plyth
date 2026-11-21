#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import {
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
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
  const rookPackage = await readJson(join(project, "package.json"));
  assertSupportedRook(rookPackage, project);

  if (options.command === "status") {
    const config = await readPlythConfig(project);
    const installed = await installedPlyth(project);
    const effectiveMode = resolveEffectiveMode(config?.mode, process.env);
    process.stdout.write(
      `PLYTH for Rook (${project})\n` +
        `  package: ${installed?.version ?? "not installed"}\n` +
        `  project mode: ${config?.mode ?? "off (not configured)"}\n` +
        `  effective mode: ${effectiveMode}\n`,
    );
    return installed ? 0 : 1;
  }

  if (options.command === "uninstall") {
    await writePlythConfig(project, "off");
    process.stdout.write(
      "PLYTH integration disabled for this Rook project. The package remains installed because Rook uses the PLYTH core.\n",
    );
    return 0;
  }

  const oldConfig = await readPlythConfig(project);
  const mode = options.mode ?? oldConfig?.mode ?? "off";
  if (!isMode(mode)) throw new Error(`Unsupported PLYTH mode: ${mode}`);

  const installed = await installedPlyth(project);
  if (options.source || !isCompatiblePlyth(installed)) {
    const source = options.source ?? `plyth@${packageInfo.version}`;
    if (dependencies.installPackage) {
      await dependencies.installPackage(project, source);
    } else {
      execFileSync("npm", ["install", "--save-exact", source], {
        cwd: project,
        stdio: "inherit",
      });
    }
    const installedAfter = await installedPlyth(project);
    if (!isCompatiblePlyth(installedAfter))
      throw new Error(
        `PLYTH installation did not produce a compatible package in ${project}.`,
      );
  }

  await writePlythConfig(project, mode);
  process.stdout.write(
    `PLYTH ${mode} mode enabled for Rook at ${project}.\n` +
      (mode === "integrated"
        ? "Integrated feedback is experimental and has no demonstrated benefit; disable it with `npx plyth uninstall rook --project .` or set ROOK_PLYTH_INTEGRATED=off.\n"
        : "Dynamic feedback remains off unless you opt in with `--mode prompt` or `--mode integrated`.\n"),
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
      `${JSON.stringify({ schemaVersion: 1, mode }, null, 2)}\n`,
      "utf8",
    );
    await file.close();
    await rename(temporary, target);
  } catch (error) {
    await file.close().catch(() => {});
    throw error;
  }
}

async function installedPlyth(project) {
  try {
    return JSON.parse(
      await readFile(
        join(project, "node_modules", "plyth", "package.json"),
        "utf8",
      ),
    );
  } catch (error) {
    if (isMissing(error)) return undefined;
    throw error;
  }
}

function isCompatiblePlyth(pkg) {
  if (!pkg || pkg.name !== "plyth" || typeof pkg.version !== "string")
    return false;
  const [major, minor] = pkg.version.split(".").map(Number);
  return major === 0 && minor === 1;
}

function assertSupportedRook(pkg, project) {
  if (!pkg || pkg.name !== "rook")
    throw new Error(`No Rook package.json found at ${project}.`);
  const [major, minor] = String(pkg.version ?? "")
    .split(".")
    .map(Number);
  if (major !== 0 || minor !== 1)
    throw new Error(
      `PLYTH currently supports Rook 0.1.x; found ${pkg.version ?? "unknown"}.`,
    );
}

function resolveEffectiveMode(configMode, env) {
  if (env.ROOK_PLYTH_INTEGRATED !== undefined) {
    const value = env.ROOK_PLYTH_INTEGRATED;
    if (value === "1" || value === "integrated") return "integrated";
    if (value === "prompt") return "prompt";
    return "off";
  }
  return configMode ?? "off";
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

function printUsage() {
  process.stdout.write(
    "Usage:\n" +
      "  plyth install rook [--project PATH] [--mode integrated|prompt|off] [--source PACKAGE_SPEC]\n" +
      "  plyth status rook [--project PATH]\n" +
      "  plyth uninstall rook [--project PATH]\n\n" +
      "Install defaults to off. Use --mode prompt for static guidance or --mode integrated for experimental dynamic feedback.\n" +
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
