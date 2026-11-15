import { NextResponse } from "next/server";
import { bad, requireAdmin } from "@/lib/api";
import { BUCKET } from "@/lib/config";
import { isNoteName, kindOf } from "@/lib/filetypes";
import type { DocumentRow } from "@/lib/format";
import { adminDb } from "@/lib/supabase";
import { decodeText } from "@/lib/text";

const MAX_EDIT_BYTES = 2 * 1024 * 1024;

/** 读取自己文本文档 / 笔记的内容，供在线编辑 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;

  const db = adminDb();
  const { data: doc } = await db
    .from("sharedoc_documents")
    .select("*")
    .eq("id", id)
    .eq("owner_id", admin.id)
    .maybeSingle<DocumentRow>();
  if (!doc) return bad("notFound", 404);
  const kind = kindOf(doc.file_path);
  if (kind !== "text" && kind !== "markdown" && !isNoteName(doc.original_name)) return bad("notEditable");
  if ((doc.size_bytes ?? 0) > MAX_EDIT_BYTES) return bad("editTooLarge");

  const { data } = await db.storage.from(BUCKET).download(doc.file_path);
  if (!data) return bad("readFailed", 500);
  return NextResponse.json({ text: decodeText(new Uint8Array(await data.arrayBuffer())) });
}
