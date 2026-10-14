import { execFile } from "node:child_process";
import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import esbuild from "esbuild";

const execFileAsync = promisify(execFile);
const watch = process.argv.includes("--watch");
const release = process.argv.includes("--release");
const outdir = release ? path.join("release", "upi-qr-monitor", "dist") : "dist";

const entries = [
  ["src/content/shadowHook.ts", "shadowHook.js"],
  ["src/content/index.ts", "content.js"],
  ["src/background/serviceWorker.ts", "serviceWorker.js"],
  ["src/popup/popup.ts", "popup.js"],
];

const common = {
  bundle: true,
  target: "chrome120",
  sourcemap: !release,
  minify: release,
  format: "iife",
  logLevel: "info",
};

if (release) {
  await rm("release", { recursive: true, force: true });
  await mkdir(outdir, { recursive: true });
}

const builds = entries.map(([entry, file]) => ({
  ...common,
  entryPoints: [entry],
  outfile: path.join(outdir, file),
}));

if (watch) {
  const contexts = await Promise.all(builds.map((options) => esbuild.context(options)));
  await Promise.all(contexts.map((context) => context.watch()));
} else {
  await Promise.all(builds.map((options) => esbuild.build(options)));
}

if (release) {
  const folder = path.resolve("release", "upi-qr-monitor");
  await cp("manifest.json", path.join(folder, "manifest.json"));
  await cp("popup.html", path.join(folder, "popup.html"));
  await cp("popup.css", path.join(folder, "popup.css"));
  const zip = path.resolve("release", "upi-qr-monitor.zip");
  await execFileAsync("powershell", [
    "-NoProfile",
    "-Command",
    `Compress-Archive -Path '${folder}\\*' -DestinationPath '${zip}' -Force`,
  ]);
}
