import { NextResponse } from "next/server";
import { BUCKET } from "@/lib/config";
import { adminDb } from "@/lib/supabase";

/**
 * 每天由 Vercel Cron 调用一次（见 vercel.json），删除已过期的文档。
 * 这个接口只会删除“已经过期、本来就无法访问”的文件，被别人调用也没有危害，
 * 所以默认不需要密钥；如果设置了 CRON_SECRET 环境变量，则会校验它。
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const db = adminDb();
  const now = new Date();

  const { data: expired } = await db
    .from("sharedoc_documents")
    .select("id, file_path")
    .lte("expires_at", now.toISOString())
    .returns<{ id: string; file_path: string }[]>();

  let deleted = 0;
  if (expired?.length) {
    const { error } = await db.storage.from(BUCKET).remove(expired.map((d) => d.file_path));
    if (!error) {
      await db.from("sharedoc_documents").delete().in("id", expired.map((d) => d.id));
      deleted = expired.length;
    }
  }

  // 顺便清理一天前的密码错误记录
  await db
    .from("sharedoc_pin_attempts")
    .delete()
    .lt("window_start", new Date(now.getTime() - 86_400_000).toISOString());

  return NextResponse.json({ deleted });
}
