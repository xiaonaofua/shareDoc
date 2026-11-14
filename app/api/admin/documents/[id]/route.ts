import { NextResponse } from "next/server";
import { bad, requireAdmin } from "@/lib/api";
import { ALLOWED_TYPES, BUCKET, RETENTION_DAYS, extOf } from "@/lib/config";
import type { DocumentRow } from "@/lib/format";
import { newToken } from "@/lib/security";
import { verifyUploaded } from "@/lib/storage-check";
import { adminDb } from "@/lib/supabase";

type Ctx = { params: Promise<{ id: string }> };

/** 只取当前管理员自己的文档；别人的文档一律当作不存在 */
async function ownDoc(id: string, ownerId: string) {
  const { data } = await adminDb()
    .from("documents")
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
 *  - regenerate                     生成新链接（旧链接立即失效）
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;
  const doc = await ownDoc(id, admin.id);
  if (!doc) return bad("未找到", 404);

  const body = await req.json().catch(() => ({}));
  const db = adminDb();
  const now = new Date().toISOString();
  let update: Partial<DocumentRow> = {};

  switch (body.action) {
    case "rename": {
      const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
      if (!title) return bad("标题不能为空");
      update = { title };
      break;
    }
    case "replace": {
      const uploaded = await verifyUploaded(admin.id, body.path);
      if (!uploaded) return bad("找不到已上传的文件");
      const name =
        typeof body.originalName === "string" && body.originalName.trim()
          ? body.originalName.trim().slice(0, 200)
          : body.path;
      update = {
        file_path: body.path,
        original_name: name,
        mime_type: ALLOWED_TYPES[extOf(body.path)!],
        size_bytes: uploaded.size,
      };
      break;
    }
    case "extend":
      update = {
        expires_at: new Date(Date.now() + RETENTION_DAYS * 86_400_000).toISOString(),
        reminder_sent_at: null,
      };
      break;
    case "regenerate":
      update = { token: newToken() };
      break;
    default:
      return bad("未知操作");
  }

  const { error } = await db.from("documents").update({ ...update, updated_at: now }).eq("id", doc.id);
  if (error) return bad("保存失败", 500);
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
  if (!doc) return bad("未找到", 404);

  const db = adminDb();
  await db.storage.from(BUCKET).remove([doc.file_path]);
  const { error } = await db.from("documents").delete().eq("id", doc.id);
  if (error) return bad("删除失败", 500);
  return NextResponse.json({ ok: true });
}
