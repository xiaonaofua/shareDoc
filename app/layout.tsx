import type { Metadata, Viewport } from "next";
import { HTML_LANG } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import { I18nProvider } from "./ui/I18n";
import "./globals.css";

export const metadata: Metadata = {
  title: "Doc Share",
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={HTML_LANG[lang]}>
      <body>
        <I18nProvider lang={lang}>{children}</I18nProvider>
      </body>
    </html>
  );
}
