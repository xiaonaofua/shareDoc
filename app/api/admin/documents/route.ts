import { NextResponse } from "next/server";
import { bad, requireAdmin } from "@/lib/api";
import { FILE_TYPES, RETENTION_DAYS, extOf } from "@/lib/config";
import { ownSpaceId } from "@/lib/docs";
import { newToken } from "@/lib/security";
import { verifyUploaded } from "@/lib/storage-check";
import { adminDb } from "@/lib/supabase";

/** 上传完成后登记文档，并生成它的独立链接令牌 */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { path, title, originalName, requirePin, spaceId } = await req.json().catch(() => ({}));
  const uploaded = await verifyUploaded(admin.id, path);
  if (!uploaded) return bad("找不到已上传的文件");
  const name = typeof originalName === "string" && originalName.trim() ? originalName.trim().slice(0, 200) : path;
  const ext = extOf(path)!;
  const space = await ownSpaceId(admin.id, spaceId);
  if (space === undefined) return bad("空间不存在");

  const { data, error } = await adminDb()
    .from("sharedoc_documents")
    .insert({
      owner_id: admin.id,
      owner_email: admin.email,
      token: newToken(),
      title: (typeof title === "string" && title.trim() ? title.trim() : name).slice(0, 200),
      require_pin: requirePin !== false,
      file_path: path,
      original_name: name,
      mime_type: FILE_TYPES[ext].mime,
      // 只在放入空间时才写这一列：数据库还没加 space_id 列时，普通上传也能正常工作
      ...(space ? { space_id: space } : {}),
      size_bytes: uploaded.size,
      expires_at: new Date(Date.now() + RETENTION_DAYS * 86_400_000).toISOString(),
    })
    .select("id")
    .single();
  if (error) return bad("保存失败", 500);
  return NextResponse.json({ id: data.id });
}
