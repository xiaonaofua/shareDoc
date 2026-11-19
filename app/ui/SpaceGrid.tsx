import Link from "next/link";
import { needsPin, type DocumentRow } from "@/lib/format";
import { FileIcon, LockBadge, TrayIcon } from "./icons";
import { getT } from "@/lib/i18n-server";
import { isNoteName } from "@/lib/filetypes";

/** 访问者看到的文件夹：文件平铺，每个文件显示自己的“需要密码 / 可下载”状态 */
export default async function SpaceGrid({
  token,
  docs,
  thumbs,
}: {
  token: string;
  docs: DocumentRow[];
  thumbs: Map<string, string>;
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
          <Link key={d.id} className="item" href={`/s/${token}/${d.id}`}>
            <div className="item-art">
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="thumb-img" src={thumb} alt="" loading="lazy" />
              ) : (
                <FileIcon name={d.file_path} note={isNoteName(d.original_name)} size={70} />
              )}
              {needsPin(d) && <LockBadge />}
            </div>
            <div className="item-name">{d.title}</div>
            <span className={d.allow_download ? "state-tag dl" : "state-tag view"}>
              {d.allow_download ? t("badgeDownload") : t("badgeViewOnly")}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
