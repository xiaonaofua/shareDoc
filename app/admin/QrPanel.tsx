"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type Level = "L" | "M" | "Q" | "H";

const SIZES = [
  { label: "小（200px）", value: 200 },
  { label: "中（400px）", value: 400 },
  { label: "大（800px）", value: 800 },
];

const LEVELS: { label: string; value: Level }[] = [
  { label: "L（7%）", value: "L" },
  { label: "M（15%）", value: "M" },
  { label: "Q（25%）", value: "Q" },
  { label: "H（30%，最高）", value: "H" },
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
      <div className="qr-controls">
        <label>
          尺寸
          <select value={size} onChange={(e) => setSize(Number(e.target.value))}>
            {SIZES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>
        <label>
          纠错等级
          <select value={level} onChange={(e) => setLevel(e.target.value as Level)}>
            {LEVELS.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </label>
        <div className="row" style={{ marginTop: 10 }}>
          <a className="btn primary" href={png} download={`${fileBase}.png`}>下载 PNG</a>
          <a className="btn" href={svg} download={`${fileBase}.svg`}>下载 SVG</a>
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          下方按实际像素显示（{size}×{size}px），屏幕放不下时会自动缩小。手机上可以长按图片保存。
          纠错等级越高，二维码被遮挡或打印模糊时越容易扫出，但图案也越密。
        </p>
      </div>
      {png && (
        <img className="qr-img" src={png} alt={`${title} 的二维码`} style={{ width: size }} />
      )}
    </div>
  );
}
