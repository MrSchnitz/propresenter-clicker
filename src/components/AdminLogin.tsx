import { useState, FormEvent } from "react";
import { adminAuth } from "../api";

interface Props {
  onAuth: (pin: string) => void;
}

export default function AdminLogin({ onAuth }: Props) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await adminAuth(pin);
      onAuth(pin);
    } catch {
      setError("Invalid PIN");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-container">
      <h1>Admin Login</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="Enter PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          autoFocus
        />
        <button type="submit" disabled={loading || !pin}>
          {loading ? "Checking..." : "Login"}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
}
