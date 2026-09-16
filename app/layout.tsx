import type { Metadata } from "next";
import { Fraunces, Inter, Amiri } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { getServerClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import SignOutButton from "./SignOutButton";
import LanguageSwitcher from "./LanguageSwitcher";
import ThemeToggle from "./ThemeToggle";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["400", "500", "600"],
});
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const amiri = Amiri({ subsets: ["arabic"], variable: "--font-amiri", weight: ["400", "700"] });

export const metadata: Metadata = {
  title: "Musabaqa — Qur'an Memorization Competitions",
  description: "Register, follow live results, and verify certificates for Qur'an memorization competitions.",
};

// Runs before first paint so a saved dark preference doesn't flash white.
const noFlashScript = `
(function() {
  try {
    var saved = localStorage.getItem('theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (saved === 'dark' || (!saved && prefersDark)) {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
})();
`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const db = getServerClient();
  const { data: { user } } = await db.auth.getUser();
  const locale = getLocale();
  const t = getDictionary(locale);
  const year = new Date().getFullYear();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
      </head>
      <body className={`${fraunces.variable} ${inter.variable} ${amiri.variable}`}>
        <header className="sticky top-0 z-40 border-b border-hairline bg-surface/90 backdrop-blur dark:border-dark-hairline dark:bg-dark-surface/90">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded bg-forest text-sm font-semibold text-white">
                M
              </span>
              <span className="font-display text-xl tracking-tight text-ink dark:text-dark-ink">Musabaqa</span>
            </Link>

            <nav className="flex items-center gap-1 text-sm">
              <Link href="/" className="rounded px-3 py-2 text-ink-soft transition-colors hover:bg-surface-alt hover:text-forest dark:text-dark-ink/70 dark:hover:bg-dark-surface-alt dark:hover:text-forest-light">
                {t.nav.competitions}
              </Link>
              <Link href="/verify" className="rounded px-3 py-2 text-ink-soft transition-colors hover:bg-surface-alt hover:text-forest dark:text-dark-ink/70 dark:hover:bg-dark-surface-alt dark:hover:text-forest-light">
                {t.nav.verify}
              </Link>
              {user && (
                <>
                  <Link href="/judge" className="rounded px-3 py-2 text-ink-soft transition-colors hover:bg-surface-alt hover:text-forest dark:text-dark-ink/70 dark:hover:bg-dark-surface-alt dark:hover:text-forest-light">
                    {t.nav.judgeQueue}
                  </Link>
                  <Link href="/admin" className="rounded px-3 py-2 text-ink-soft transition-colors hover:bg-surface-alt hover:text-forest dark:text-dark-ink/70 dark:hover:bg-dark-surface-alt dark:hover:text-forest-light">
                    {t.nav.admin}
                  </Link>
                </>
              )}

              <span className="mx-2 h-5 w-px bg-hairline dark:bg-dark-hairline" />

              <ThemeToggle />
              <LanguageSwitcher current={locale} />

              {user ? (
                <span className="ml-1 text-ink-soft dark:text-dark-ink/70">
                  <SignOutButton label={t.nav.signOut} />
                </span>
              ) : (
                <Link href="/login" className="ml-2 rounded bg-forest px-4 py-2 text-white transition-colors hover:bg-forest-dark">
                  {t.nav.signIn}
                </Link>
              )}
            </nav>
          </div>
        </header>

        <main className="mx-auto min-h-[70vh] max-w-6xl px-6 py-12">{children}</main>

        <footer className="border-t border-hairline bg-surface-alt dark:border-dark-hairline dark:bg-dark-surface-alt">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-6 py-8">
            <p className="text-sm text-ink dark:text-dark-ink">
              Copyrights AMA Devs {year}, All rights reserved!
            </p>
            {/* Tanzil's Qur'an text is CC-BY licensed — this credit is a
                condition of using it and must stay. */}
            <p className="text-xs text-ink-soft dark:text-dark-ink/50">{t.footer.textSource}</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
