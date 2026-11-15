"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type Level = "L" | "M" | "Q" | "H";

const SIZES = [
  { label: "小 200", value: 200 },
  { label: "中 400", value: 400 },
  { label: "大 800", value: 800 },
];

const LEVELS: { label: string; value: Level }[] = [
  { label: "容错 7%", value: "L" },
  { label: "15%", value: "M" },
  { label: "25%", value: "Q" },
  { label: "30%", value: "H" },
];

/** 在浏览器本地生成二维码，链接不会发送到任何外部网站 */
export default function QrPanel({ link, title }: { link: string; title: string }) {
  const [size, setSize] = useState(400);
  const [level, setLevel] = useState<Level>("H");
  const [png, setPng] = useState("");
  const [svg, setSvg] = useState("");

  useEffect(() => {
    let alive = true;
    const opts = { errorCorrectionLevel: level, margin: 4, color: { dark: "#000000", light: "#ffffff" } };
    Promise.all([
      QRCode.toDataURL(link, { ...opts, width: size }),
      QRCode.toString(link, { ...opts, type: "svg" }),
    ]).then(([p, s]) => {
      if (!alive) return;
      setPng(p);
      setSvg(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(s)}`);
    });
    return () => {
      alive = false;
    };
  }, [link, size, level]);

  const fileBase = `${title.replace(/[\\/:*?"<>|]/g, "_").slice(0, 60) || "qrcode"}_QR`;

  return (
    <div className="qr-panel">
      {png && <img className="qr-img" src={png} alt={`${title} 的二维码`} style={{ width: size }} />}
      <div className="segmented" role="group" aria-label="尺寸">
        {SIZES.map((s) => (
          <button key={s.value} className={size === s.value ? "on" : ""} onClick={() => setSize(s.value)}>
            {s.label}
          </button>
        ))}
      </div>
      <div className="segmented" role="group" aria-label="纠错等级">
        {LEVELS.map((l) => (
          <button key={l.value} className={level === l.value ? "on" : ""} onClick={() => setLevel(l.value)}>
            {l.label}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, width: "100%" }}>
        <a className="btn filled" style={{ flex: 1 }} href={png} download={`${fileBase}.png`}>
          保存 PNG
        </a>
        <a className="btn" style={{ flex: 1 }} href={svg} download={`${fileBase}.svg`}>
          保存 SVG
        </a>
      </div>
    </div>
  );
}
