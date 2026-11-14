import { NextResponse } from "next/server";
import { BUCKET, REMIND_DAYS_BEFORE, siteUrl } from "@/lib/config";
import { escapeHtml, sendMail } from "@/lib/email";
import { formatDate, type DocumentRow } from "@/lib/format";
import { adminDb } from "@/lib/supabase";

/**
 * 每天由 Vercel Cron 调用一次：
 *  1. 即将到期（默认 3 天内）且还没提醒过的文档 → 按所属管理员分组发邮件
 *  2. 已到期的文档 → 只有“已发过提醒”的才删除（保证删除前一定先提醒过）
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const db = adminDb();
  const now = new Date();
  const remindBefore = new Date(now.getTime() + REMIND_DAYS_BEFORE * 86_400_000);

  // ---- 1. 提醒 ----
  const { data: soon } = await db
    .from("documents")
    .select("*")
    .is("reminder_sent_at", null)
    .lte("expires_at", remindBefore.toISOString())
    .returns<DocumentRow[]>();

  const byOwner = new Map<string, DocumentRow[]>();
  for (const d of soon ?? []) byOwner.set(d.owner_email, [...(byOwner.get(d.owner_email) ?? []), d]);

  let reminded = 0;
  for (const [email, docs] of byOwner) {
    const items = docs
      .map((d) => `<li><b>${escapeHtml(d.title)}</b>（${escapeHtml(d.original_name)}）— ${formatDate(d.expires_at)} 删除</li>`)
      .join("");
    const html = `
      <p>以下文档即将自动删除：</p>
      <ul>${items}</ul>
      <p>如需保留，请登录后台点击“延长”：<a href="${siteUrl()}/admin">${siteUrl()}/admin</a></p>`;
    const ok = await sendMail(email, `【Doc Share】${docs.length} 个文档即将自动删除`, html);
    if (ok) {
      await db
        .from("documents")
        .update({ reminder_sent_at: now.toISOString() })
        .in("id", docs.map((d) => d.id));
      reminded += docs.length;
    }
  }

  // ---- 2. 删除（必须已提醒过）----
  const { data: expired } = await db
    .from("documents")
    .select("id, file_path")
    .lte("expires_at", now.toISOString())
    .not("reminder_sent_at", "is", null)
    .returns<Pick<DocumentRow, "id" | "file_path">[]>();

  let deleted = 0;
  if (expired?.length) {
    const { error } = await db.storage.from(BUCKET).remove(expired.map((d) => d.file_path));
    if (!error) {
      await db.from("documents").delete().in("id", expired.map((d) => d.id));
      deleted = expired.length;
    }
  }

  // ---- 3. 清理旧的密码错误记录 ----
  await db
    .from("pin_attempts")
    .delete()
    .lt("window_start", new Date(now.getTime() - 86_400_000).toISOString());

  return NextResponse.json({ reminded, deleted });
}
