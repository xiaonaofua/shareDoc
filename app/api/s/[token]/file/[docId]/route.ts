import { NextResponse } from "next/server";
import { BUCKET } from "@/lib/config";
import { findSpaceDoc } from "@/lib/docs";
import { spaceAccess } from "@/lib/space-access";
import { adminDb } from "@/lib/supabase";

/** 从空间下载：确认能进入空间后，跳转到 60 秒有效的签名地址 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string; docId: string }> }) {
  const { token, docId } = await params;
  const access = await spaceAccess(token);
  if (!access) return new NextResponse("Not found", { status: 404 });
  if (access.status !== "ok") return NextResponse.redirect(new URL(`/s/${token}`, req.url));

  const doc = await findSpaceDoc(access.space.id, docId);
  if (!doc) return new NextResponse("Not found", { status: 404 });

  const { data, error } = await adminDb()
    .storage.from(BUCKET)
    .createSignedUrl(doc.file_path, 60, { download: doc.original_name });
  if (error || !data) return new NextResponse("文件暂时无法获取", { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
