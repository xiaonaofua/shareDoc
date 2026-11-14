import { loginIdForEmail } from "./admins";
import { sessionClient } from "./supabase";

export type Admin = { id: string; email: string; loginId: string };

/** 返回已登录且在 sharedoc_admins 白名单中的管理员，否则返回 null */
export async function getAdmin(): Promise<Admin | null> {
  const supabase = await sessionClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user?.email) return null;
  const loginId = await loginIdForEmail(user.email);
  if (!loginId) return null;
  return { id: user.id, email: user.email, loginId };
}
