import { adminDb } from "./supabase";

/**
 * 管理员白名单存在 Supabase 表 sharedoc_admins 里（登录ID ↔ 邮箱）。
 * 这样 Vercel 上不用再配置管理员相关的环境变量。
 */
export async function emailForLoginId(loginId: string): Promise<string | null> {
  const { data } = await adminDb()
    .from("sharedoc_admins")
    .select("email")
    .eq("login_id", loginId.trim().toLowerCase())
    .maybeSingle<{ email: string }>();
  return data?.email?.toLowerCase() ?? null;
}

export async function loginIdForEmail(email: string): Promise<string | null> {
  const { data } = await adminDb()
    .from("sharedoc_admins")
    .select("login_id")
    .ilike("email", email)
    .maybeSingle<{ login_id: string }>();
  return data?.login_id ?? null;
}
