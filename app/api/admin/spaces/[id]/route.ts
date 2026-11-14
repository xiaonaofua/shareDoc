import { NextResponse } from "next/server";
import { bad, requireAdmin } from "@/lib/api";
import { ownSpaceId } from "@/lib/docs";
import type { SpaceRow } from "@/lib/format";
import { newToken } from "@/lib/security";
import { adminDb } from "@/lib/supabase";

type Ctx = { params: Promise<{ id: string }> };

/**
 * 编辑空间。action：
 *  - rename     { title }
 *  - access     { requirePin }
 *  - regenerate               生成新链接（旧链接立即失效）
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const id = await ownSpaceId(admin.id, (await params).id);
  if (!id) return bad("未找到", 404);

  const body = await req.json().catch(() => ({}));
  let update: Partial<SpaceRow>;
  switch (body.action) {
    case "rename": {
      const title = typeof body.title === "string" ? body.title.trim().slice(0, 100) : "";
      if (!title) return bad("名称不能为空");
      update = { title };
      break;
    }
    case "access":
      if (typeof body.requirePin !== "boolean") return bad("参数错误");
      update = { require_pin: body.requirePin };
      break;
    case "regenerate":
      update = { token: newToken() };
      break;
    default:
      return bad("未知操作");
  }

  const { error } = await adminDb()
    .from("sharedoc_spaces")
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return bad("保存失败", 500);
  return NextResponse.json({ ok: true });
}

/** 删除空间：空间里的文档不会被删除，只是移出空间 */
export async function DELETE(_req: Request, { params }: Ctx) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const id = await ownSpaceId(admin.id, (await params).id);
  if (!id) return bad("未找到", 404);

  const db = adminDb();
  await db.from("sharedoc_documents").update({ space_id: null }).eq("space_id", id);
  const { error } = await db.from("sharedoc_spaces").delete().eq("id", id);
  if (error) return bad("删除失败", 500);
  return NextResponse.json({ ok: true });
}
