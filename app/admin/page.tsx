import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth";
import { MAX_FILE_BYTES, RETENTION_DAYS } from "@/lib/config";
import type { DocumentRow } from "@/lib/format";
import { adminDb } from "@/lib/supabase";
import AdminClient from "./AdminClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");

  const db = adminDb();
  const [{ data: docs }, { data: setting }] = await Promise.all([
    db
      .from("sharedoc_documents")
      .select("*")
      .eq("owner_id", admin.id)
      .order("created_at", { ascending: false })
      .returns<DocumentRow[]>(),
    db.from("sharedoc_admin_settings").select("pin_hash").eq("user_id", admin.id).maybeSingle<{ pin_hash: string | null }>(),
  ]);


  return (
    <AdminClient
      loginId={admin.loginId}
      docs={docs ?? []}
      hasPin={!!setting?.pin_hash}
      supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL!}
      supabaseAnonKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}
      maxFileBytes={MAX_FILE_BYTES}
      retentionDays={RETENTION_DAYS}
    />
  );
}
