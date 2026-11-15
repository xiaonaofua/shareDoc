import { redirect } from "next/navigation";

// 管理入口已改为根域名
export default function OldLogin() {
  redirect("/");
}
