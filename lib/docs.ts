import { adminDb } from "./supabase";
import type { DocumentRow, SpaceRow } from "./format";

const TOKEN_RE = /^[A-Za-z0-9_-]{16}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const alive = (doc: DocumentRow) => new Date(doc.expires_at).getTime() > Date.now();

/** 某个管理员设定的 4 位密码哈希 */
export async function ownerPinHash(ownerId: string): Promise<string | null> {
  const { data } = await adminDb()
    .from("sharedoc_admin_settings")
    .select("pin_hash")
    .eq("user_id", ownerId)
    .maybeSingle<{ pin_hash: string | null }>();
  return data?.pin_hash ?? null;
}

/** 按文档链接令牌取文档；不存在或已过期返回 null */
export async function findSharedDoc(token: string) {
  if (!TOKEN_RE.test(token)) return null;
  const { data: doc } = await adminDb()
    .from("sharedoc_documents")
    .select("*")
    .eq("token", token)
    .maybeSingle<DocumentRow>();
  if (!doc || !alive(doc)) return null;
  return { doc, pinHash: await ownerPinHash(doc.owner_id) };
}

/** 按空间链接令牌取空间及其中未过期的文档 */
export async function findSpace(token: string) {
  if (!TOKEN_RE.test(token)) return null;
  const db = adminDb();
  const { data: space } = await db.from("sharedoc_spaces").select("*").eq("token", token).maybeSingle<SpaceRow>();
  if (!space) return null;
  const { data: docs } = await db
    .from("sharedoc_documents")
    .select("*")
    .eq("space_id", space.id)
    .order("created_at", { ascending: true })
    .returns<DocumentRow[]>();
  return {
    space,
    docs: (docs ?? []).filter(alive),
    pinHash: await ownerPinHash(space.owner_id),
  };
}

/** 空间内的某个文档 */
export async function findSpaceDoc(spaceId: string, docId: string) {
  if (!UUID_RE.test(docId)) return null;
  const { data: doc } = await adminDb()
    .from("sharedoc_documents")
    .select("*")
    .eq("id", docId)
    .eq("space_id", spaceId)
    .maybeSingle<DocumentRow>();
  return doc && alive(doc) ? doc : null;
}

/**
 * 校验空间属于该管理员。
 * 返回 null = 不放入空间；undefined = 空间不存在或不是自己的。
 */
export async function ownSpaceId(ownerId: string, spaceId: unknown): Promise<string | null | undefined> {
  if (spaceId === null || spaceId === undefined || spaceId === "") return null;
  if (typeof spaceId !== "string" || !UUID_RE.test(spaceId)) return undefined;
  const { data } = await adminDb()
    .from("sharedoc_spaces")
    .select("id")
    .eq("id", spaceId)
    .eq("owner_id", ownerId)
    .maybeSingle<{ id: string }>();
  return data?.id ?? undefined;
}

