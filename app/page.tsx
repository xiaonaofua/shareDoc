import { notFound } from "next/navigation";

// 首页不暴露任何内容：没有正确链接的人只会看到 404
export default function Home() {
  notFound();
}
