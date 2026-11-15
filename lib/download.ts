import { NextResponse } from "next/server";
import { BUCKET } from "./config";
import type { DocumentRow } from "./format";
import { adminDb } from "./supabase";

/** 跳转到 60 秒有效的下载地址（只在允许下载时调用） */
export async function redirectToDownload(doc: DocumentRow) {
  const { data, error } = await adminDb()
    .storage.from(BUCKET)
    .createSignedUrl(doc.file_path, 60, { download: doc.original_name });
  if (error || !data) return NextResponse.json({ error: "readFailed" }, { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
