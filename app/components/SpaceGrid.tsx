import { extOf, kindOf, KIND_STYLE } from "@/lib/filetypes";
import type { DocumentRow } from "@/lib/format";

/** 空间里的文件以图标平铺显示；图片显示缩略图 */
export default function SpaceGrid({
  token,
  docs,
  thumbs,
}: {
  token: string;
  docs: DocumentRow[];
  thumbs: Map<string, string>;
}) {
  if (docs.length === 0) return <p className="muted">这个空间里还没有文件。</p>;
  return (
    <div className="tile-grid">
      {docs.map((d) => {
        const kind = kindOf(d.file_path);
        const thumb = thumbs.get(d.file_path);
        return (
          <a key={d.id} className="tile" href={`/s/${token}/${d.id}`} title={d.original_name}>
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="tile-thumb" src={thumb} alt="" loading="lazy" />
            ) : (
              <div className="file-icon" style={{ background: KIND_STYLE[kind].color }}>
                {(extOf(d.file_path) ?? "?").toUpperCase()}
              </div>
            )}
            <div className="tile-name">{d.title}</div>
          </a>
        );
      })}
    </div>
  );
}
