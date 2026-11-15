import type { DocumentRow } from "@/lib/format";
import { FileIcon, TrayIcon } from "./icons";

/** 访问者看到的空间：文件像桌面图标一样平铺，图片显示缩略图 */
export default function SpaceGrid({
  token,
  docs,
  thumbs,
}: {
  token: string;
  docs: DocumentRow[];
  thumbs: Map<string, string>;
}) {
  if (docs.length === 0) {
    return (
      <div className="empty">
        <TrayIcon />
        <div>空文件夹</div>
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
                <FileIcon name={d.file_path} size={70} />
              )}
            </div>
            <div className="item-name">{d.title}</div>
          </a>
        );
      })}
    </div>
  );
}
