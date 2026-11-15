"use client";

import { useState } from "react";
import ProgressOverlay from "./Progress";
import { useT } from "./I18n";

/** 带加载进度提示的 iframe（Office 在线预览等）：加载完成前在屏幕中间显示进度条 */
export function LoadingFrame({ src, title }: { src: string; title: string }) {
  const t = useT();
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      {!loaded && <ProgressOverlay label={t("opening")} />}
      <iframe className="preview" src={src} title={title} onLoad={() => setLoaded(true)} />
    </>
  );
}

/** 带加载进度提示的图片（只能查看：禁止长按保存 / 右键另存） */
export function LoadingImage({ src, alt }: { src: string; alt: string }) {
  const t = useT();
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      {!loaded && <ProgressOverlay label={t("opening")} />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="image-view"
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        onContextMenu={(e) => e.preventDefault()}
      />
    </>
  );
}
