import { NextResponse } from "next/server";
import { bad, requireAdmin } from "@/lib/api";
import { BUCKET, FILE_TYPES, RETENTION_DAYS, extOf } from "@/lib/config";
import { ownSpaceId } from "@/lib/docs";
import type { DocumentRow } from "@/lib/format";
import { newToken } from "@/lib/security";
import { verifyUploaded } from "@/lib/storage-check";
import { adminDb } from "@/lib/supabase";

type Ctx = { params: Promise<{ id: string }> };

/** 只取当前管理员自己的文档；别人的文档一律当作不存在 */
async function ownDoc(id: string, ownerId: string) {
  const { data } = await adminDb()
    .from("sharedoc_documents")
    .select("*")
    .eq("id", id)
    .eq("owner_id", ownerId)
    .maybeSingle<DocumentRow>();
  return data;
}

/**
 * 编辑文档。action：
 *  - rename     { title }          修改标题
 *  - replace    { path, originalName }  替换文件（链接不变）
 *  - extend                         有效期重新计为 N 天
 *  - access     { requirePin }     切换是否需要密码
 *  - space      { spaceId|null }   放入空间 / 移出空间
 *  - regenerate                     生成新链接（旧链接立即失效）
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;
  const doc = await ownDoc(id, admin.id);
  if (!doc) return bad("notFound", 404);

  const body = await req.json().catch(() => ({}));
  const db = adminDb();
  const now = new Date().toISOString();
  let update: Partial<DocumentRow> = {};

  switch (body.action) {
    case "rename": {
      const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
      if (!title) return bad("nameRequired");
      update = { title };
      break;
    }
    case "replace": {
      const uploaded = await verifyUploaded(admin.id, body.path);
      if (!uploaded) return bad("uploadMissing");
      const name =
        typeof body.originalName === "string" && body.originalName.trim()
          ? body.originalName.trim().slice(0, 200)
          : body.path;
      update = {
        file_path: body.path,
        original_name: name,
        mime_type: FILE_TYPES[extOf(body.path)!].mime,
        size_bytes: uploaded.size,
      };
      break;
    }
    case "extend":
      update = { expires_at: new Date(Date.now() + RETENTION_DAYS * 86_400_000).toISOString() };
      break;
    case "access":
      if (typeof body.requirePin !== "boolean") return bad("badParams");
      update = { require_pin: body.requirePin };
      break;
    case "space": {
      const space = await ownSpaceId(admin.id, body.spaceId);
      if (space === undefined) return bad("folderMissing");
      update = { space_id: space };
      break;
    }
    case "regenerate":
      update = { token: newToken() };
      break;
    default:
      return bad("unknownAction");
  }

  const { error } = await db.from("sharedoc_documents").update({ ...update, updated_at: now }).eq("id", doc.id);
  if (error) return bad("saveFailed", 500);
  if (body.action === "replace" && doc.file_path !== update.file_path) {
    await db.storage.from(BUCKET).remove([doc.file_path]);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;
  const doc = await ownDoc(id, admin.id);
  if (!doc) return bad("notFound", 404);

  const db = adminDb();
  await db.storage.from(BUCKET).remove([doc.file_path]);
  const { error } = await db.from("sharedoc_documents").delete().eq("id", doc.id);
  if (error) return bad("deleteFailed", 500);
  return NextResponse.json({ ok: true });
}
