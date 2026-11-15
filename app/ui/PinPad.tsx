"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LockGlyph } from "./icons";

/** iOS 锁屏风格的 4 位密码键盘；输满 4 位自动提交，也支持实体键盘输入 */
export default function PinPad({ action, title }: { action: string; title: string }) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = useCallback(
    async (value: string) => {
      setBusy(true);
      const res = await fetch(action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: value }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        router.refresh();
        return;
      }
      setBusy(false);
      setError(body.error ?? "出错了，请稍后再试");
      setShake(true);
      setTimeout(() => {
        setShake(false);
        setPin("");
      }, 400);
    },
    [action, router],
  );

  const press = useCallback(
    (d: string) => {
      if (busy) return;
      setError("");
      setPin((p) => {
        if (p.length >= 4) return p;
        const next = p + d;
        if (next.length === 4) void submit(next);
        return next;
      });
    },
    [busy, submit],
  );
  const back = useCallback(() => !busy && setPin((p) => p.slice(0, -1)), [busy]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press, back]);

  return (
    <div className="center-screen">
      <LockGlyph size={26} />
      <h1>{title}</h1>
      <div className="muted">{error || "输入密码"}</div>
      <div className={shake ? "pin-dots shake" : "pin-dots"} aria-live="polite">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={i < pin.length ? "on" : ""} />
        ))}
      </div>
      <div className="keypad">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} className="key" onClick={() => press(d)} disabled={busy}>
            {d}
          </button>
        ))}
        <span />
        <button className="key" onClick={() => press("0")} disabled={busy}>
          0
        </button>
        <button className="key plain" onClick={back} disabled={busy || !pin} aria-label="删除">
          ⌫
        </button>
      </div>
    </div>
  );
}
