import { NextResponse } from "next/server";
import { getAdmin, type Admin } from "./auth";

/** API 路由里用：未登录返回 401 响应，否则返回管理员信息 */
export async function requireAdmin(): Promise<Admin | NextResponse> {
  const admin = await getAdmin();
  return admin ?? NextResponse.json({ error: "请先登录" }, { status: 401 });
}

export const bad = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status });
