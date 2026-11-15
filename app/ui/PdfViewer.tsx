"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "./I18n";

/**
 * 用 pdf.js 把 PDF 逐页画成图片显示。
 * 不用浏览器自带的 PDF 阅读器：那个会带下载按钮，安卓上还会直接变成下载。
 */
export default function PdfViewer({ url }: { url: string }) {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [progress, setProgress] = useState("");

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | undefined;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        const task = pdfjs.getDocument({ url });
        destroy = () => void task.destroy();
        const pdf = await task.promise;
        const container = box.current;
        if (!container || cancelled) return;
        container.replaceChildren();
        const cssWidth = Math.min(container.clientWidth || 800, 900);
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        setState("ok");
        for (let i = 1; i <= pdf.numPages && !cancelled; i++) {
          setProgress(pdf.numPages > 1 ? `${i} / ${pdf.numPages}` : "");
          const page = await pdf.getPage(i);
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (cssWidth / base.width) * ratio });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = `${Math.floor(viewport.width / ratio)}px`;
          canvas.oncontextmenu = (e) => e.preventDefault();
          container.appendChild(canvas);
          await page.render({ canvas, viewport }).promise;
        }
        setProgress("");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [url]);

  return (
    <>
      {state === "loading" && <p className="muted" style={{ textAlign: "center", marginTop: 40 }}>{t("pdfLoading")}</p>}
      {state === "error" && <p className="muted" style={{ textAlign: "center", marginTop: 40 }}>{t("pdfError")}</p>}
      <div ref={box} className="pdf-pages" />
      {progress && <p className="muted" style={{ textAlign: "center" }}>{progress}</p>}
    </>
  );
}
