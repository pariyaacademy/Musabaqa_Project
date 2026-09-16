"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLocale } from "@/lib/i18n/actions";
import type { Locale } from "@/lib/i18n/dictionaries";

export default function LanguageSwitcher({ current }: { current: Locale }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function change(locale: Locale) {
    if (locale === current) return;
    startTransition(async () => {
      await setLocale(locale);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1 text-xs text-ink-soft dark:text-dark-ink/50">
      <button
        onClick={() => change("en")}
        disabled={isPending}
        className={current === "en" ? "font-medium text-forest dark:text-forest-light" : "hover:text-ink dark:text-dark-ink"}
      >
        EN
      </button>
      <span>/</span>
      <button
        onClick={() => change("ha")}
        disabled={isPending}
        className={current === "ha" ? "font-medium text-forest dark:text-forest-light" : "hover:text-ink dark:text-dark-ink"}
      >
        HA
      </button>
    </div>
  );
}
