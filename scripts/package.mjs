import { cpSync, mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { execSync } from "child_process";
import { join } from "path";

const outDir = "propresenter-clicker";
const appName = "ProPresenter Clicker";
const isMac = process.platform === "darwin";

// The whole payload (server, frontend, node_modules, .env) lives inside the
// .app bundle, so on macOS the bundle is fully self-contained and can be moved
// anywhere — /Applications included. A .app is just a folder, so the Windows
// launchers simply cd into it.
const payloadRel = isMac
  ? `${appName}.app/Contents/Resources/app`
  : "app";
const payload = join(outDir, ...payloadRel.split("/"));

// Clean previous build
if (existsSync(outDir)) rmSync(outDir, { recursive: true });
mkdirSync(payload, { recursive: true });

// Copy built frontend + server
cpSync("dist", join(payload, "dist"), { recursive: true });
cpSync("server", join(payload, "server"), { recursive: true });

// Copy package manifests
cpSync("package.json", join(payload, "package.json"));
cpSync("package-lock.json", join(payload, "package-lock.json"));

// Create default .env — first-run defaults only; everything except APP_PORT is
// editable at runtime in the admin panel and then persisted via settings.json.
writeFileSync(
  join(payload, ".env"),
  `# Required (changing it needs a restart)
APP_PORT=3000

# First-run defaults — after settings are saved in the admin panel (/admin),
# the saved settings take precedence over these.
PROPRESENTER_HOST=localhost
PROPRESENTER_PORT=50001
PROPRESENTER_PROTOCOL=ws
PROPRESENTER_PASSWORD=
ADMIN_PIN=1234
`
);

// Install production deps only
execSync("npm ci --omit=dev", { cwd: payload, stdio: "inherit" });

// The real start script, inside the payload. On macOS, settings are stored in
// Application Support so they survive replacing the .app with a new version.
writeFileSync(
  join(payload, "run.command"),
  `#!/bin/bash
cd "$(dirname "$0")"
export SETTINGS_FILE="$HOME/Library/Application Support/${appName}/settings.json"
PORT=$(grep -E '^APP_PORT=' .env | cut -d= -f2)
PORT=\${PORT:-3000}
(sleep 2 && open "http://localhost:$PORT") &
NODE_ENV=production npx tsx server/index.ts
`
);
execSync(`chmod +x "${join(payload, "run.command")}"`);

// Top-level convenience launchers next to the bundle.
writeFileSync(
  join(outDir, "start.command"),
  `#!/bin/bash
exec "$(dirname "$0")/${payloadRel}/run.command"
`
);
execSync(`chmod +x "${join(outDir, "start.command")}"`);

const payloadWin = payloadRel.replaceAll("/", "\\");
writeFileSync(
  join(outDir, "start.bat"),
  `@echo off
cd /d "%~dp0${payloadWin}"
set NODE_ENV=production
set PORT=3000
for /f "tokens=2 delims==" %%a in ('findstr /b APP_PORT= .env') do set PORT=%%a
start "" /min cmd /c "timeout /t 3 >nul & start "" http://localhost:%PORT%"
npx tsx server/index.ts
`
);

// Windows: double-click this once to put a launcher shortcut on the Desktop.
writeFileSync(
  join(outDir, "create-desktop-shortcut.bat"),
  `@echo off
powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $lnk = $ws.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\\\\${appName}.lnk'); $lnk.TargetPath = '%~dp0start.bat'; $lnk.WorkingDirectory = '%~dp0'; $lnk.Save()"
echo Shortcut '${appName}' created on the Desktop.
pause
`
);

// macOS bundle metadata + launcher. Double-clicking the .app opens the server
// in a Terminal window (visible logs, Ctrl+C to stop) and then the browser.
if (isMac) {
  const contents = join(outDir, `${appName}.app`, "Contents");
  mkdirSync(join(contents, "MacOS"), { recursive: true });

  writeFileSync(
    join(contents, "Info.plist"),
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>${appName}</string>
  <key>CFBundleIdentifier</key><string>online.festivalunited.propresenter-clicker</string>
  <key>CFBundleVersion</key><string>1.0.0</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>launcher</string>
  <key>CFBundleIconFile</key><string>icon</string>
</dict>
</plist>
`
  );

  writeFileSync(
    join(contents, "MacOS", "launcher"),
    `#!/bin/bash
DIR="$(cd "$(dirname "$0")/../Resources/app" && pwd)"
open -a Terminal "$DIR/run.command"
`
  );
  execSync(`chmod +x "${join(contents, "MacOS", "launcher")}"`);

  // Render the PWA icon into an .icns via macOS built-ins (qlmanage rasterizes
  // the SVG, sips scales, iconutil assembles). Best effort — without it the
  // bundle just shows the generic app icon.
  try {
    execSync("qlmanage -t -s 1024 -o . public/icon.svg", { stdio: "ignore" });
    mkdirSync("icon.iconset", { recursive: true });
    for (const s of [16, 32, 128, 256, 512]) {
      execSync(
        `sips -z ${s} ${s} icon.svg.png --out icon.iconset/icon_${s}x${s}.png`,
        { stdio: "ignore" }
      );
      execSync(
        `sips -z ${s * 2} ${s * 2} icon.svg.png --out icon.iconset/icon_${s}x${s}@2x.png`,
        { stdio: "ignore" }
      );
    }
    execSync(
      `iconutil -c icns icon.iconset -o "${join(contents, "Resources", "icon.icns")}"`,
      { stdio: "ignore" }
    );
  } catch {
    /* no icon — bundle still works */
  } finally {
    rmSync("icon.iconset", { recursive: true, force: true });
    rmSync("icon.svg.png", { force: true });
  }
}

console.log(`\nPackaged into ./${outDir}/`);
if (isMac) {
  console.log(
    `Mac: "${appName}.app" is self-contained — move it anywhere (e.g. /Applications) and double-click.`
  );
}
console.log(
  "Windows: double-click start.bat (or create-desktop-shortcut.bat once for a Desktop icon)."
);
console.log("Requires Node.js installed on the target machine.");
