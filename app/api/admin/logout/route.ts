import { NextResponse } from "next/server";
import { sessionClient } from "@/lib/supabase";

export async function POST() {
  const supabase = await sessionClient();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
