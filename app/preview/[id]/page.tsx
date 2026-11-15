import { notFound, redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth";
import type { DocumentRow } from "@/lib/format";
import { adminDb } from "@/lib/supabase";
import { DocViewer } from "@/lib/viewer";
import { getT } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** 管理员预览自己的文件：不需要输入查看密码，看到的效果和访问者一样 */
export default async function AdminPreview({ params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) redirect("/");
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const db = adminDb();
  const { data: doc } = await db
    .from("sharedoc_documents")
    .select("*")
    .eq("id", id)
    .eq("owner_id", admin.id)
    .maybeSingle<DocumentRow>();
  if (!doc) notFound();

  // 返回时回到文件所在的文件夹
  const { t } = await getT();
  let back = { href: "/", label: t("files") };
  if (doc.space_id) {
    const { data: space } = await db
      .from("sharedoc_spaces")
      .select("title")
      .eq("id", doc.space_id)
      .maybeSingle<{ title: string }>();
    if (space) back = { href: `/#${doc.space_id}`, label: space.title };
  }

  return <DocViewer doc={doc} back={back} />;
}
