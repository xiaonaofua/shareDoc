import { KIND_STYLE, extOf, kindOf } from "@/lib/filetypes";

/** 拟物化的纸张图标：右上角折角，下方彩色标签写着格式名 */
export function FileIcon({ name, size = 64 }: { name: string; size?: number }) {
  const kind = kindOf(name);
  const color = KIND_STYLE[kind].color;
  const ext = (extOf(name) ?? "FILE").toUpperCase().slice(0, 4);
  const h = size;
  const w = Math.round(size * 0.78);
  return (
    <svg width={w} height={h} viewBox="0 0 50 64" aria-hidden>
      <path d="M4 0h30l16 16v44a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4V4a4 4 0 0 1 4-4z" fill="#fff" />
      <path d="M4 .5h29.8L49.5 16.2V60A3.5 3.5 0 0 1 46 63.5H4A3.5 3.5 0 0 1 .5 60V4A3.5 3.5 0 0 1 4 .5z" fill="none" stroke="rgba(0,0,0,.12)" />
      <path d="M34 0v12a4 4 0 0 0 4 4h12z" fill="rgba(0,0,0,.08)" />
      {/* 纸上的“文字行” */}
      <g fill="rgba(0,0,0,.09)">
        <rect x="8" y="20" width="26" height="2.4" rx="1.2" />
        <rect x="8" y="26" width="34" height="2.4" rx="1.2" />
        <rect x="8" y="32" width="30" height="2.4" rx="1.2" />
      </g>
      <rect x="6" y="42" width="38" height="14" rx="3.5" fill={color} />
      <text
        x="25"
        y="52.2"
        textAnchor="middle"
        fontSize={ext.length > 3 ? 8 : 9}
        fontWeight="700"
        fill="#fff"
        fontFamily="-apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif"
        letterSpacing=".3"
      >
        {ext}
      </text>
    </svg>
  );
}

/** 拟物化的蓝色文件夹 */
export function FolderIcon({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 0.8)} viewBox="0 0 80 64" aria-hidden>
      <defs>
        <linearGradient id="fb" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6cc4ff" />
          <stop offset="1" stopColor="#2f9bf0" />
        </linearGradient>
      </defs>
      <path d="M6 4h22l7 7h39a6 6 0 0 1 6 6v3H0V10a6 6 0 0 1 6-6z" fill="#1d86dc" />
      <path d="M0 18a6 6 0 0 1 6-6h68a6 6 0 0 1 6 6v40a6 6 0 0 1-6 6H6a6 6 0 0 1-6-6z" fill="url(#fb)" />
      <path d="M0 18a6 6 0 0 1 6-6h68a6 6 0 0 1 6 6v1H0z" fill="rgba(255,255,255,.35)" />
    </svg>
  );
}

export function LockGlyph({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-label="需要密码">
      <path
        fill="currentColor"
        d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7H4a1.5 1.5 0 0 0-1.5 1.5v5A1.5 1.5 0 0 0 4 15h8a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 12 7h-.5V4.5A3.5 3.5 0 0 0 8 1zm2 6H6V4.5a2 2 0 1 1 4 0z"
      />
    </svg>
  );
}

export const LockBadge = () => (
  <span className="lock-badge">
    <LockGlyph />
  </span>
);

/* ---- 线条图标（SF Symbols 风格） ---- */
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const ChevronLeft = () => (
  <svg width="13" height="21" viewBox="0 0 13 21" aria-hidden>
    <path d="M11 2 2.5 10.5 11 19" {...stroke} strokeWidth={2.6} />
  </svg>
);
export const ChevronRight = () => (
  <svg className="chev" width="8" height="14" viewBox="0 0 8 14" aria-hidden>
    <path d="m1 1 6 6-6 6" {...stroke} />
  </svg>
);
export const PlusIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
    <path d="M11 3v16M3 11h16" {...stroke} strokeWidth={2.2} />
  </svg>
);
export const GearIcon = () => (
  <svg width="23" height="23" viewBox="0 0 24 24" aria-hidden>
    <circle cx="12" cy="12" r="3.2" {...stroke} />
    <path
      {...stroke}
      d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
    />
  </svg>
);
export const ShareIcon = () => (
  <svg width="20" height="24" viewBox="0 0 20 24" aria-hidden>
    <path d="M10 15V2M5.5 6.5 10 2l4.5 4.5" {...stroke} />
    <path d="M6 10H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-2" {...stroke} />
  </svg>
);
export const TrayIcon = ({ size = 56 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path d="M3 13h5l1.5 2.5h5L16 13h5" {...stroke} strokeWidth={1.4} />
    <path d="M5.5 5h13L21 13v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z" {...stroke} strokeWidth={1.4} />
  </svg>
);
