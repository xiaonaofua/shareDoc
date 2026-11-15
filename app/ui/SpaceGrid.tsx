import type { DocumentRow } from "@/lib/format";
import { FileIcon, TrayIcon } from "./icons";
import { getT } from "@/lib/i18n-server";
import { isNoteName } from "@/lib/filetypes";

/** 访问者看到的空间：文件像桌面图标一样平铺，图片显示缩略图 */
export default async function SpaceGrid({
  token,
  docs,
  thumbs,
  downloadable,
}: {
  token: string;
  docs: DocumentRow[];
  thumbs: Map<string, string>;
  downloadable: boolean;
}) {
  const { t } = await getT();
  if (docs.length === 0) {
    return (
      <div className="empty">
        <TrayIcon />
        <div>{t("emptyFolder")}</div>
      </div>
    );
  }
  return (
    <div className="grid">
      {docs.map((d) => {
        const thumb = thumbs.get(d.file_path);
        return (
          <a key={d.id} className="item" href={`/s/${token}/${d.id}`}>
            <div className="item-art">
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="thumb-img" src={thumb} alt="" loading="lazy" />
              ) : (
                <FileIcon name={d.file_path} note={isNoteName(d.original_name)} size={70} />
              )}
            </div>
            <div className="item-name">{d.title}</div>
            <span className={downloadable ? "state-tag dl" : "state-tag view"}>
              {downloadable ? t("badgeDownload") : t("badgeViewOnly")}
            </span>
          </a>
        );
      })}
    </div>
  );
}
