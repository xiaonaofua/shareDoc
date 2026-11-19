import { NextResponse } from "next/server";
import { findSpace, findSpaceDoc } from "@/lib/docs";
import { handleUnlock } from "@/lib/unlock";

/** 在文件夹里输入某个文件的密码（和这个文件单独链接的密码是同一个，输一次两边都有效） */
export async function POST(req: Request, { params }: { params: Promise<{ token: string; docId: string }> }) {
  const { token, docId } = await params;
  const found = await findSpace(token);
  const doc = found && (await findSpaceDoc(found.space.id, docId));
  if (!found || !doc) return NextResponse.json({ error: "notFound" }, { status: 404 });
  return handleUnlock(req, doc.token, found.pinHash);
}
