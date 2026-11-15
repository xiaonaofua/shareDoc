"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { useRouter } from "next/navigation";
import { LANGS, LANG_COOKIE, LANG_LABEL, errorText, translator, type Key, type Lang, type T } from "@/lib/i18n";

const Ctx = createContext<Lang>("zh");

export function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <Ctx.Provider value={lang}>{children}</Ctx.Provider>;
}

export const useLang = () => useContext(Ctx);
export function useT(): T {
  const lang = useLang();
  return useMemo(() => translator(lang), [lang]);
}

/** 调用后台 API；出错时抛出已翻译好的错误信息 */
export function useApi() {
  const t = useT();
  return useCallback(
    async (url: string, method: string, body?: unknown, fallback: Key = "genericError") => {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(errorText(t, json, fallback));
      return json;
    },
    [t],
  );
}

export function setLangCookie(lang: Lang) {
  document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
}

/** 语言切换：分段按钮（设置里）或小下拉框（访问者页面角落） */
export function LangSwitch({ compact }: { compact?: boolean }) {
  const lang = useLang();
  const router = useRouter();
  const change = (l: Lang) => {
    setLangCookie(l);
    router.refresh();
  };
  if (compact) {
    return (
      <select className="lang-select" value={lang} onChange={(e) => change(e.target.value as Lang)} aria-label="Language">
        {LANGS.map((l) => (
          <option key={l} value={l}>
            {LANG_LABEL[l]}
          </option>
        ))}
      </select>
    );
  }
  return (
    <div className="segmented" role="group" aria-label="Language">
      {LANGS.map((l) => (
        <button key={l} className={l === lang ? "on" : ""} onClick={() => change(l)}>
          {LANG_LABEL[l]}
        </button>
      ))}
    </div>
  );
}
