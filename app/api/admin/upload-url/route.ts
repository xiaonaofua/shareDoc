import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { bad, requireAdmin } from "@/lib/api";
import { BUCKET, MAX_FILE_BYTES, extOf } from "@/lib/config";
import { adminDb } from "@/lib/supabase";

/**
 * 签发一次性上传地址。浏览器拿着它把文件直接传给 Supabase，
 * 不经过 Vercel（Vercel 函数的请求体有大小限制）。
 */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { fileName, size } = await req.json().catch(() => ({}));
  if (typeof fileName !== "string") return bad("missingName");
  const ext = extOf(fileName);
  if (!ext) return bad("unsupportedType");
  if (typeof size !== "number" || size <= 0 || size > MAX_FILE_BYTES) {
    return bad("fileTooLarge", 400, { mb: Math.round(MAX_FILE_BYTES / 1024 / 1024) });
  }

  const path = `${admin.id}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await adminDb().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return bad("uploadUrlFailed", 500);
  return NextResponse.json({ path: data.path, token: data.token });
}
