import type { Metadata } from "next";
import { Fraunces, Inter, Amiri } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { getServerClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import SignOutButton from "./SignOutButton";
import LanguageSwitcher from "./LanguageSwitcher";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["400", "500", "600"],
});
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const amiri = Amiri({
  subsets: ["arabic"],
  variable: "--font-amiri",
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Musabaqa — Qur'an Memorization Competitions",
  description: "Register, follow live results, and verify certificates for Qur'an memorization competitions.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const db = getServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  const locale = getLocale();
  const t = getDictionary(locale);

  return (
    <html lang={locale}>
      <body className={`${fraunces.variable} ${inter.variable} ${amiri.variable}`}>
        <header className="border-b border-hairline">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
            <Link href="/" className="font-display text-xl tracking-tight text-ink">
              Musabaqa
            </Link>
            <nav className="flex items-center gap-6 text-sm text-ink/70">
              <Link href="/" className="hover:text-emerald">
                {t.nav.competitions}
              </Link>
              <Link href="/verify" className="hover:text-emerald">
                {t.nav.verify}
              </Link>
              {user ? (
                <>
                  <Link href="/judge" className="hover:text-emerald">
                    {t.nav.judgeQueue}
                  </Link>
                  <Link href="/admin" className="hover:text-emerald">
                    {t.nav.admin}
                  </Link>
                  <SignOutButton label={t.nav.signOut} />
                </>
              ) : (
                <Link href="/login" className="hover:text-emerald">
                  {t.nav.signIn}
                </Link>
              )}
              <LanguageSwitcher current={locale} />
            </nav>
          </div>
        </header>
        <main className="mx-auto min-h-[70vh] max-w-5xl px-6 py-10">{children}</main>
        <footer className="border-t border-hairline">
          <div className="mx-auto max-w-5xl px-6 py-8 text-sm text-ink/60">{t.footer.textSource}</div>
        </footer>
      </body>
    </html>
  );
}
