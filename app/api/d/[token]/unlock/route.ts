import { NextResponse } from "next/server";
import { findSharedDoc } from "@/lib/docs";
import { handleUnlock } from "@/lib/unlock";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await findSharedDoc(token);
  if (!found) return NextResponse.json({ error: "未找到" }, { status: 404 });
  return handleUnlock(req, token, found.pinHash);
}
