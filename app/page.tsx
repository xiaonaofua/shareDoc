import { getAdmin } from "@/lib/auth";
import { MAX_FILE_BYTES, RETENTION_DAYS } from "@/lib/config";
import type { DocumentRow, SpaceRow } from "@/lib/format";
import { adminDb } from "@/lib/supabase";
import AdminClient from "./admin/AdminClient";
import LoginForm from "./ui/LoginForm";

export const dynamic = "force-dynamic";

/** 根域名：未登录显示登录，登录后就是管理后台 */
export default async function Home() {
  const admin = await getAdmin();
  if (!admin) return <LoginForm />;

  const db = adminDb();
  const [{ data: docs }, { data: spaces }, { data: setting }] = await Promise.all([
    db
      .from("sharedoc_documents")
      .select("*")
      .eq("owner_id", admin.id)
      .order("created_at", { ascending: false })
      .returns<DocumentRow[]>(),
    db
      .from("sharedoc_spaces")
      .select("*")
      .eq("owner_id", admin.id)
      .order("created_at", { ascending: true })
      .returns<SpaceRow[]>(),
    db
      .from("sharedoc_admin_settings")
      .select("pin_hash")
      .eq("user_id", admin.id)
      .maybeSingle<{ pin_hash: string | null }>(),
  ]);

  return (
    <AdminClient
      loginId={admin.loginId}
      docs={docs ?? []}
      spaces={spaces ?? []}
      hasPin={!!setting?.pin_hash}
      supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL!}
      supabaseAnonKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}
      maxFileBytes={MAX_FILE_BYTES}
      retentionDays={RETENTION_DAYS}
    />
  );
}
