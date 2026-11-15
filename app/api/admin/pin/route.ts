import { NextResponse } from "next/server";
import { bad, requireAdmin } from "@/lib/api";
import { hashPin, isValidPin } from "@/lib/security";
import { adminDb } from "@/lib/supabase";

/** 设置/修改自己的 4 位查看密码（作用于自己名下所有文档） */
export async function PUT(req: Request) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const { pin } = await req.json().catch(() => ({}));
  if (!isValidPin(pin)) return bad("pinFormat");

  const { error } = await adminDb()
    .from("sharedoc_admin_settings")
    .upsert({ user_id: admin.id, pin_hash: hashPin(pin), updated_at: new Date().toISOString() });
  if (error) return bad("saveFailed", 500);
  return NextResponse.json({ ok: true });
}
