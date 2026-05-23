import { useState, useEffect, useRef, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";

const PP_PORT = "56650";
const APP_PORT = "3000";
const ADMIN_PIN = "1234";

async function loadShellCommand() {
  try {
    const mod = await import("@tauri-apps/plugin-shell");
    return mod.Command;
  } catch {
    return null;
  }
}

export default function Dashboard() {
  const [serverRunning, setServerRunning] = useState(false);
  const [localIp, setLocalIp] = useState<string | null>(null);
  const [ppConnected, setPpConnected] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const childRef = useRef<unknown>(null);
  const startedRef = useRef(false);

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [...prev.slice(-50), msg]);
  }, []);

  // Auto-start sidecar on mount
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    (async () => {
      const Command = await loadShellCommand();
      if (!Command) {
        addLog("Not running in Tauri — use npm run dev instead");
        return;
      }
      try {
        const cmd = Command.sidecar("binaries/server", [
          "--port", APP_PORT,
          "--pp-host", "localhost",
          "--pp-port", PP_PORT,
          "--pin", ADMIN_PIN,
        ]);

        cmd.on("error", (err: string) => addLog(`Error: ${err}`));
        cmd.stdout.on("data", (line: string) => addLog(line));
        cmd.stderr.on("data", (line: string) => addLog(`stderr: ${line}`));

        const child = await cmd.spawn();
        childRef.current = child;
        addLog("Server started");
        setServerRunning(true);
      } catch (err) {
        addLog(`Failed to start: ${err}`);
      }
    })();

    return () => {
      if (childRef.current && typeof (childRef.current as { kill: () => void }).kill === "function") {
        (childRef.current as { kill: () => void }).kill();
      }
    };
  }, [addLog]);

  // Detect local IP via WebRTC
  useEffect(() => {
    try {
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel("");
      pc.createOffer().then((offer) => pc.setLocalDescription(offer));
      pc.onicecandidate = (e) => {
        if (!e.candidate) return;
        const match = e.candidate.candidate.match(
          /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/
        );
        if (match && match[1] !== "0.0.0.0") {
          setLocalIp(match[1]);
          pc.close();
        }
      };
      setTimeout(() => pc.close(), 3000);
    } catch {
      setLocalIp("localhost");
    }
  }, []);

  // Poll server status
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`http://localhost:${APP_PORT}/api/speaker/presentation`);
        if (res.ok) setServerRunning(true);
      } catch {
        // not ready yet
      }
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Check ProPresenter connection
  useEffect(() => {
    if (!serverRunning) return;
    const check = async () => {
      try {
        const res = await fetch(`http://localhost:${APP_PORT}/api/health`);
        const data = await res.json();
        setPpConnected(data.pp === true);
      } catch {
        setPpConnected(false);
      }
    };
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, [serverRunning]);

  async function handleStop() {
    if (childRef.current && typeof (childRef.current as { kill: () => void }).kill === "function") {
      await (childRef.current as { kill: () => Promise<void> }).kill();
      childRef.current = null;
      setServerRunning(false);
      startedRef.current = false;
      addLog("Server stopped");
    }
  }

  async function handleStart() {
    startedRef.current = false;
    const Command = await loadShellCommand();
    if (!Command) return;
    try {
      const cmd = Command.sidecar("binaries/server", [
        "--port", APP_PORT,
        "--pp-host", "localhost",
        "--pp-port", PP_PORT,
        "--pin", ADMIN_PIN,
      ]);
      cmd.on("error", (err: string) => addLog(`Error: ${err}`));
      cmd.stdout.on("data", (line: string) => addLog(line));
      cmd.stderr.on("data", (line: string) => addLog(`stderr: ${line}`));
      const child = await cmd.spawn();
      childRef.current = child;
      startedRef.current = true;
      addLog("Server started");
      setServerRunning(true);
    } catch (err) {
      addLog(`Failed to start: ${err}`);
    }
  }

  const speakerUrl = `http://${localIp || "..."}:${APP_PORT}`;
  const adminUrl = `http://${localIp || "..."}:${APP_PORT}/admin`;

  return (
    <div className="dashboard">
      <h1>ProPresenter Remote</h1>

      <div className="dashboard-status">
        <div className="status-row">
          <span className={`status-dot ${serverRunning ? "green" : "red"}`} />
          <span>Server: {serverRunning ? "Running" : "Stopped"}</span>
          {!serverRunning ? (
            <button className="btn-small" onClick={handleStart}>Start</button>
          ) : (
            <button className="btn-small" onClick={handleStop}>Stop</button>
          )}
        </div>
        <div className="status-row">
          <span className={`status-dot ${ppConnected ? "green" : "red"}`} />
          <span>ProPresenter: {ppConnected ? "Connected" : "Not connected"}</span>
        </div>
      </div>

      {serverRunning && localIp && (
        <div className="dashboard-connect">
          <h2>Scan to connect</h2>
          <div className="qr-container">
            <QRCodeSVG value={speakerUrl} size={200} bgColor="#1a1a2e" fgColor="#ffffff" />
          </div>
          <p className="url-display">{speakerUrl}</p>
          <p className="url-label">Speaker view (open on phone)</p>

          <p className="url-display admin-url">
            <a href={adminUrl} target="_blank" rel="noopener noreferrer">
              {adminUrl}
            </a>
          </p>
          <p className="url-label">Admin panel</p>
        </div>
      )}

      <div className="dashboard-logs">
        <h3>Logs</h3>
        <div className="log-output">
          {logs.map((log, i) => (
            <div key={i}>{log}</div>
          ))}
          {logs.length === 0 && <div className="muted">No logs yet</div>}
        </div>
      </div>
    </div>
  );
}
