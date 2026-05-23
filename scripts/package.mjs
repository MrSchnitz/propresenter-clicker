import { cpSync, mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { execSync } from "child_process";
import { join } from "path";

const outDir = "propresenter-remote";

// Clean previous build
if (existsSync(outDir)) rmSync(outDir, { recursive: true });
mkdirSync(outDir);

// Copy built frontend
cpSync("dist", join(outDir, "dist"), { recursive: true });

// Copy server source
cpSync("server", join(outDir, "server"), { recursive: true });

// Copy package.json (production only)
cpSync("package.json", join(outDir, "package.json"));
cpSync("package-lock.json", join(outDir, "package-lock.json"));

// Create default .env
writeFileSync(
  join(outDir, ".env"),
  `PROPRESENTER_HOST=localhost
PROPRESENTER_PORT=50001
ADMIN_PIN=1234
APP_PORT=3000
`
);

// Install production deps only
execSync("npm ci --omit=dev", { cwd: outDir, stdio: "inherit" });

// Create launcher scripts
writeFileSync(
  join(outDir, "start.command"),
  `#!/bin/bash
cd "$(dirname "$0")"
NODE_ENV=production npx tsx server/index.ts
`
);
execSync(`chmod +x "${join(outDir, "start.command")}"`);

writeFileSync(
  join(outDir, "start.bat"),
  `@echo off
cd /d "%~dp0"
set NODE_ENV=production
npx tsx server/index.ts
`
);

console.log(`\nPackaged into ./${outDir}/`);
console.log("To run: double-click start.command (Mac) or start.bat (Windows)");
console.log("Requires Node.js installed on the target machine.");
