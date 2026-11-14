import { isAdminEmail } from "./config";
import { sessionClient } from "./supabase";

export type Admin = { id: string; email: string };

/** 返回已登录且在白名单中的管理员，否则返回 null */
export async function getAdmin(): Promise<Admin | null> {
  const supabase = await sessionClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user || !isAdminEmail(user.email)) return null;
  return { id: user.id, email: user.email! };
}
