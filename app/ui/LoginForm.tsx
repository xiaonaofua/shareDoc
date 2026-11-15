"use client";

import { useState } from "react";
import { FolderIcon } from "./icons";

export default function LoginForm() {
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, password }),
    });
    if (res.ok) {
      window.location.reload();
      return;
    }
    const body = await res.json().catch(() => ({}));
    setError(body.error ?? "登录失败");
    setBusy(false);
  }

  return (
    <div className="center-screen">
      <FolderIcon size={88} />
      <h1>Doc Share</h1>
      <form className="login-box" onSubmit={submit}>
        <div className="group" style={{ margin: 0 }}>
          <input
            className="field"
            type="text"
            placeholder="ID"
            autoComplete="username"
            autoCapitalize="off"
            value={id}
            onChange={(e) => setId(e.target.value)}
            required
          />
          <div style={{ borderTop: "0.5px solid var(--separator)", marginLeft: 16 }} />
          <input
            className="field"
            type="password"
            placeholder="密码"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button className="btn filled block" disabled={busy || !id || !password}>
          {busy ? "登录中…" : "登录"}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
}
