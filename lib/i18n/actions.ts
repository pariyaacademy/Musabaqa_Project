"use server";

/**
 * lib/i18n/actions.ts
 *
 * Separate file (rather than combined with locale.ts) because a file with
 * a top-level "use server" directive must export ONLY async Server
 * Actions — getLocale() is sync and reads cookies() directly, so it can't
 * live here.
 */
import { cookies } from "next/headers";
import { locales, type Locale } from "./dictionaries";
import { LOCALE_COOKIE } from "./locale";

export async function setLocale(locale: Locale) {
  if (!(locales as readonly string[]).includes(locale)) return;
  cookies().set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365 });
}
