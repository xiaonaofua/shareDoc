"use client";

import { useState } from "react";

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
      window.location.href = "/admin";
      return;
    }
    const body = await res.json().catch(() => ({}));
    setError(body.error ?? "登录失败");
    setBusy(false);
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor="id">ID</label>
      <input id="id" type="text" autoComplete="username" autoCapitalize="off" value={id} onChange={(e) => setId(e.target.value)} required />
      <label htmlFor="pw">密码</label>
      <input id="pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <button className="primary full" disabled={busy}>
        {busy ? "登录中…" : "登录"}
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
