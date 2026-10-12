import esbuild from "esbuild";

const watch = process.argv.includes("--watch");
const common = {
  bundle: true,
  target: "chrome120",
  sourcemap: true,
  format: "iife",
  logLevel: "info",
};

const builds = [
  esbuild.context({ ...common, entryPoints: ["src/content/shadowHook.ts"], outfile: "dist/shadowHook.js" }),
  esbuild.context({ ...common, entryPoints: ["src/content/index.ts"], outfile: "dist/content.js" }),
  esbuild.context({ ...common, entryPoints: ["src/background/serviceWorker.ts"], outfile: "dist/serviceWorker.js" }),
  esbuild.context({ ...common, entryPoints: ["src/popup/popup.ts"], outfile: "dist/popup.js" }),
];

const contexts = await Promise.all(builds);
if (watch) {
  await Promise.all(contexts.map((context) => context.watch()));
} else {
  await Promise.all(contexts.map((context) => context.rebuild()));
  await Promise.all(contexts.map((context) => context.dispose()));
}
