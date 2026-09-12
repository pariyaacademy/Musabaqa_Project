/**
 * lib/i18n/locale.ts
 *
 * Cookie-based locale, not path-based routing (no /en/... vs /ha/...
 * URL prefixes). Simpler to layer onto an app that already has all its
 * routes defined, and the participant-facing pages don't need SEO-grade
 * per-locale URLs — a persistent preference is enough.
 */
import { cookies } from "next/headers";
import { defaultLocale, locales, type Locale } from "./dictionaries";

export const LOCALE_COOKIE = "locale";

export function getLocale(): Locale {
  const value = cookies().get(LOCALE_COOKIE)?.value;
  return (locales as readonly string[]).includes(value ?? "") ? (value as Locale) : defaultLocale;
}
