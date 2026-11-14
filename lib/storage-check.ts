import { BUCKET } from "./config";
import { EXTENSIONS } from "./filetypes";
import { adminDb } from "./supabase";

/** 确认上传路径属于该管理员，且文件确实已在存储桶里，返回实际大小 */
export async function verifyUploaded(ownerId: string, path: unknown): Promise<{ size: number } | null> {
  if (typeof path !== "string") return null;
  const m = new RegExp(`^${ownerId}/([0-9a-f-]{36}\\.(?:${EXTENSIONS.join("|")}))$`).exec(path);
  if (!m) return null;
  const { data } = await adminDb().storage.from(BUCKET).list(ownerId, { search: m[1], limit: 1 });
  const obj = data?.find((o) => o.name === m[1]);
  if (!obj) return null;
  const size = Number((obj.metadata as { size?: number } | null)?.size ?? 0);
  return { size };
}
