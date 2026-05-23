import { execSync } from "child_process";
import { mkdirSync, existsSync, renameSync } from "fs";
import { join } from "path";

const SIDECAR_NAME = "server";
const BINARIES_DIR = "src-tauri/binaries";

// Get target triple
const triple = execSync("rustc --print host-tuple", { encoding: "utf-8" }).trim();
console.log(`Target: ${triple}`);

// Step 1: Bundle TypeScript server into single CJS file with esbuild
console.log("Bundling server with esbuild...");
execSync(
  `npx esbuild server/index.ts --bundle --platform=node --target=node20 --format=cjs --outfile=dist-server/server.cjs`,
  { stdio: "inherit" }
);

// Step 2: Compile to standalone binary with pkg
console.log("Compiling to standalone binary with pkg...");
mkdirSync(BINARIES_DIR, { recursive: true });

// Determine pkg target based on platform
const arch = triple.startsWith("aarch64") ? "arm64" : "x64";
const os = triple.includes("apple") ? "macos" : triple.includes("windows") ? "win" : "linux";
const pkgTarget = `node20-${os}-${arch}`;

execSync(
  `npx pkg dist-server/server.cjs --target ${pkgTarget} --output ${BINARIES_DIR}/${SIDECAR_NAME} --compress GZip`,
  { stdio: "inherit" }
);

// Step 3: Rename to include target triple (Tauri convention)
const ext = os === "win" ? ".exe" : "";
const src = join(BINARIES_DIR, `${SIDECAR_NAME}${ext}`);
const dest = join(BINARIES_DIR, `${SIDECAR_NAME}-${triple}${ext}`);
if (existsSync(dest)) {
  execSync(`rm "${dest}"`);
}
renameSync(src, dest);

console.log(`Sidecar built: ${dest}`);
