"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { Key } from "@/lib/i18n";
import { useT } from "./I18n";

type Level = "L" | "M" | "Q" | "H";

const SIZES: { label: Key; value: number }[] = [
  { label: "qrSmall", value: 200 },
  { label: "qrMedium", value: 400 },
  { label: "qrLarge", value: 800 },
];

const LEVELS: { label: string; value: Level }[] = [
  { label: "7%", value: "L" },
  { label: "15%", value: "M" },
  { label: "25%", value: "Q" },
  { label: "30%", value: "H" },
];

/** 在浏览器本地生成二维码，链接不会发送到任何外部网站 */
export default function QrPanel({ link, title }: { link: string; title: string }) {
  const t = useT();
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
      {png && <img className="qr-img" src={png} alt={`QR: ${title}`} style={{ width: size }} />}
      <div className="segmented" role="group" aria-label="Size">
        {SIZES.map((s) => (
          <button key={s.value} className={size === s.value ? "on" : ""} onClick={() => setSize(s.value)}>
            {t(s.label)}
          </button>
        ))}
      </div>
      <div className="segmented" role="group" aria-label={t("qrEcc")}>
        <span className="seg-label">{t("qrEcc")}</span>
        {LEVELS.map((l) => (
          <button key={l.value} className={level === l.value ? "on" : ""} onClick={() => setLevel(l.value)}>
            {l.label}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, width: "100%" }}>
        <a className="btn filled" style={{ flex: 1 }} href={png} download={`${fileBase}.png`}>
          {t("savePng")}
        </a>
        <a className="btn" style={{ flex: 1 }} href={svg} download={`${fileBase}.svg`}>
          {t("saveSvg")}
        </a>
      </div>
    </div>
  );
}
