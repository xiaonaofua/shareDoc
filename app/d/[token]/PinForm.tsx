"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PinForm({ token }: { token: string }) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch(`/api/d/${token}/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      router.refresh();
    } else {
      setError(body.error ?? "出错了，请稍后再试");
      setPin("");
    }
  }

  return (
    <form onSubmit={submit}>
      <input
        className="pin-input"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        pattern="\d{4}"
        maxLength={4}
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
        aria-label="4 位数字密码"
        autoFocus
      />
      <button className="primary full" disabled={busy || pin.length !== 4}>
        {busy ? "验证中…" : "查看文档"}
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
