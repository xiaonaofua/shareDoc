import { cookies, headers } from "next/headers";
import { LANG_COOKIE, pickLang, translator, type Lang } from "./i18n";

/** 服务端组件读取当前语言 */
export async function getLang(): Promise<Lang> {
  const [c, h] = await Promise.all([cookies(), headers()]);
  return pickLang(c.get(LANG_COOKIE)?.value, h.get("accept-language"));
}

export async function getT() {
  const lang = await getLang();
  return { lang, t: translator(lang) };
}
