import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { findSharedDoc } from "@/lib/docs";
import { checkUnlockCookie, unlockCookieName } from "@/lib/security";
import { adminDb } from "@/lib/supabase";
import { BUCKET } from "@/lib/config";

/** 下载：校验密码 Cookie 后，跳转到 60 秒有效的签名地址 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await findSharedDoc(token);
  if (!found) return new NextResponse("Not found", { status: 404 });

  const store = await cookies();
  if (!checkUnlockCookie(store.get(unlockCookieName(token))?.value, token, found.pinHash)) {
    return NextResponse.redirect(new URL(`/d/${token}`, _req.url));
  }

  const { data, error } = await adminDb()
    .storage.from(BUCKET)
    .createSignedUrl(found.doc.file_path, 60, { download: found.doc.original_name });
  if (error || !data) return new NextResponse("文件暂时无法获取", { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
