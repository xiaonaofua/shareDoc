import { NextResponse } from "next/server";
import { findSpace, spaceKey } from "@/lib/docs";
import { handleUnlock } from "@/lib/unlock";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await findSpace(token);
  if (!found) return NextResponse.json({ error: "notFound" }, { status: 404 });
  return handleUnlock(req, spaceKey(token), found.pinHash);
}
