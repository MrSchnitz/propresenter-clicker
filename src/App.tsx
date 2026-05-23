import { Routes, Route } from "react-router-dom";
import { useState } from "react";
import AdminLogin from "./components/AdminLogin";
import AdminPanel from "./components/AdminPanel";
import SpeakerView from "./components/SpeakerView";
import Dashboard from "./components/Dashboard";

function AdminPage() {
  const [pin, setPin] = useState<string | null>(null);

  if (!pin) {
    return <AdminLogin onAuth={setPin} />;
  }

  return <AdminPanel pin={pin} onLogout={() => setPin(null)} />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<SpeakerView />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/dashboard" element={<Dashboard />} />
    </Routes>
  );
}
