import { NextResponse } from "next/server";
import { getAdmin, type Admin } from "./auth";

/** API 路由里用：未登录返回 401 响应，否则返回管理员信息 */
export async function requireAdmin(): Promise<Admin | NextResponse> {
  const admin = await getAdmin();
  return admin ?? NextResponse.json({ error: "loginRequired" }, { status: 401 });
}

/** 错误只返回代码（见 lib/i18n.ts 的 err_*），由浏览器按当前语言显示 */
export const bad = (code: string, status = 400, vars?: Record<string, string | number>) =>
  NextResponse.json({ error: code, vars }, { status });
