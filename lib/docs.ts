import { adminDb } from "./supabase";
import type { DocumentRow } from "./format";

/** 按链接令牌取文档及其所属管理员的密码哈希；不存在或已过期返回 null */
export async function findSharedDoc(token: string) {
  if (!/^[A-Za-z0-9_-]{16}$/.test(token)) return null;
  const db = adminDb();
  const { data: doc } = await db.from("sharedoc_documents").select("*").eq("token", token).maybeSingle<DocumentRow>();
  if (!doc || new Date(doc.expires_at).getTime() <= Date.now()) return null;
  const { data: setting } = await db
    .from("sharedoc_admin_settings")
    .select("pin_hash")
    .eq("user_id", doc.owner_id)
    .maybeSingle<{ pin_hash: string | null }>();
  return { doc, pinHash: setting?.pin_hash ?? null };
}
