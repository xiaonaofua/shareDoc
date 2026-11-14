import { NextResponse } from "next/server";
import { adminAccounts } from "@/lib/config";
import { sessionClient } from "@/lib/supabase";

/** 用“登录ID + 密码”登录：ID 在服务器端换成对应邮箱再交给 Supabase Auth */
export async function POST(req: Request) {
  const { id, password } = await req.json().catch(() => ({}));
  const fail = NextResponse.json({ error: "ID 或密码不正确" }, { status: 401 });
  if (typeof id !== "string" || typeof password !== "string" || !password) return fail;

  const email = adminAccounts().get(id.trim().toLowerCase());
  if (!email) return fail;

  const supabase = await sessionClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return fail;
  return NextResponse.json({ ok: true });
}
