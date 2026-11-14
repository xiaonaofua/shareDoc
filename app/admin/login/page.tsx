import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getAdmin()) redirect("/admin");
  return (
    <main>
      <div className="card center">
        <h1>管理员登录</h1>
        <LoginForm />
      </div>
    </main>
  );
}
