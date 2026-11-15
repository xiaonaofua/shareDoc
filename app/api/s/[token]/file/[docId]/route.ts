import { NextResponse } from "next/server";
import { findSpaceDoc } from "@/lib/docs";
import { redirectToDownload } from "@/lib/download";
import { spaceAccess } from "@/lib/space-access";

/** 从文件夹链接下载：文件夹必须开启了“允许下载”，并且能进入文件夹 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string; docId: string }> }) {
  const { token, docId } = await params;
  const access = await spaceAccess(token);
  if (!access || access.space.allow_download !== true) return new NextResponse("Not found", { status: 404 });
  if (access.status !== "ok") return NextResponse.redirect(new URL(`/s/${token}`, req.url));

  const doc = await findSpaceDoc(access.space.id, docId);
  if (!doc) return new NextResponse("Not found", { status: 404 });
  return redirectToDownload(doc);
}
