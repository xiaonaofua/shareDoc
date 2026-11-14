import { loginIdOf } from "./admins";
import { sessionClient } from "./supabase";

export type Admin = { id: string; email: string; loginId: string };

/**
 * 返回当前登录的用户。Supabase 项目里的用户都视为管理员，
 * 所以请在 Supabase 里关闭“允许新用户注册”。
 */
export async function getAdmin(): Promise<Admin | null> {
  const supabase = await sessionClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user?.email) return null;
  return { id: user.id, email: user.email, loginId: loginIdOf(user.email) };
}
