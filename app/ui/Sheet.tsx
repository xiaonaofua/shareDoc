"use client";

import { useEffect } from "react";

/** iOS 风格的底部弹出面板（电脑上居中显示） */
export default function Sheet({
  title,
  onClose,
  left,
  right,
  tall,
  children,
}: {
  title?: string;
  onClose: () => void;
  left?: React.ReactNode;
  right?: React.ReactNode;
  tall?: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={tall ? "sheet tall" : "sheet"} role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-grabber" />
        <div className="sheet-head">
          <div style={{ minWidth: 64 }}>{left}</div>
          <h3>{title}</h3>
          <div style={{ minWidth: 64, textAlign: "right" }}>
            {right ?? (
              <button className="icon-btn" onClick={onClose} style={{ fontWeight: 600 }}>
                完成
              </button>
            )}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <span className="switch">
      <input
        type="checkbox"
        role="switch"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="track" />
      <span className="thumb" />
    </span>
  );
}
