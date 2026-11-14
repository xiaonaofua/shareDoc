import { adminDb } from "./supabase";

/**
 * 直接使用 Supabase 项目（memo）里已有的用户作为管理员。
 * 登录 ID 可以是完整邮箱，也可以只写 @ 前面的部分（例如 co2sou）。
 */
export async function emailForLoginId(input: string): Promise<string | null> {
  const id = input.trim().toLowerCase();
  if (!id) return null;
  if (id.includes("@")) return id;

  const { data, error } = await adminDb().auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) return null;
  const matches = data.users
    .map((u) => u.email?.toLowerCase())
    .filter((e): e is string => !!e && e.split("@")[0] === id);
  // 同一个前缀对应多个邮箱时无法判断是谁，要求输入完整邮箱
  return matches.length === 1 ? matches[0] : null;
}

/** 后台右上角显示用的名字 */
export const loginIdOf = (email: string) => email.split("@")[0];
