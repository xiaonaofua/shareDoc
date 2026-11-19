import { NextResponse } from "next/server";
import { bad, requireAdmin } from "@/lib/api";
import { newToken } from "@/lib/security";
import { adminDb } from "@/lib/supabase";

/** 新建空间 */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { title } = await req.json().catch(() => ({}));
  const name = typeof title === "string" ? title.trim().slice(0, 100) : "";
  if (!name) return bad("nameRequired");

  const { data, error } = await adminDb()
    .from("sharedoc_spaces")
    .insert({ owner_id: admin.id, token: newToken(), title: name })
    .select("id")
    .single();
  if (error) return bad("saveFailed", 500);
  return NextResponse.json({ id: data.id });
}
