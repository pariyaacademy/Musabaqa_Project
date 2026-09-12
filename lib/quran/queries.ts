/**
 * lib/quran/queries.ts
 *
 * Reusable Qur'an query functions (spec section 44). These are the ONLY
 * sanctioned way the rest of the app reads Qur'an text — nothing else should
 * hand-roll a query against musabaqa.ayahs. Every function here reads from
 * the local, immutable, already-validated dataset. None of them generate,
 * infer, or synthesize verse text.
 *
 * All functions take a SupabaseClient so callers control whether this runs
 * with RLS (normal reads — fine, ayahs are public-readable) or via the admin
 * client (not needed here, but kept generic for reuse).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface Ayah {
  id: string;
  surah_id: string;
  surah_number: number;
  ayah_number: number;
  verse_key: string;
  text_uthmani: string;
  juz_number: number | null;
  hizb_number: number | null;
  rub_hizb_number: number | null;
  page_number: number | null;
  ruku_number: number | null;
  manzil_number: number | null;
  sajdah: boolean;
}

const AYAH_COLUMNS =
  "id, surah_id, surah_number, ayah_number, verse_key, text_uthmani, juz_number, hizb_number, rub_hizb_number, page_number, ruku_number, manzil_number, sajdah";

export async function getAyahByVerseKey(db: SupabaseClient, verseKey: string): Promise<Ayah | null> {
  const { data, error } = await db
    .schema("musabaqa")
    .from("ayahs")
    .select(AYAH_COLUMNS)
    .eq("verse_key", verseKey)
    .maybeSingle();
  if (error) throw error;
  return data as Ayah | null;
}

export async function getAyahsBySurah(db: SupabaseClient, surahNumber: number): Promise<Ayah[]> {
  const { data, error } = await db
    .schema("musabaqa")
    .from("ayahs")
    .select(AYAH_COLUMNS)
    .eq("surah_number", surahNumber)
    .order("ayah_number", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Ayah[];
}

export async function getAyahsByJuz(db: SupabaseClient, juzNumber: number): Promise<Ayah[]> {
  const { data, error } = await db
    .schema("musabaqa")
    .from("ayahs")
    .select(AYAH_COLUMNS)
    .eq("juz_number", juzNumber)
    .order("surah_number", { ascending: true })
    .order("ayah_number", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Ayah[];
}

export async function getAyahsByPage(db: SupabaseClient, pageNumber: number): Promise<Ayah[]> {
  const { data, error } = await db
    .schema("musabaqa")
    .from("ayahs")
    .select(AYAH_COLUMNS)
    .eq("page_number", pageNumber)
    .order("surah_number", { ascending: true })
    .order("ayah_number", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Ayah[];
}

export async function getAyahsByHizb(db: SupabaseClient, hizbNumber: number): Promise<Ayah[]> {
  const { data, error } = await db
    .schema("musabaqa")
    .from("ayahs")
    .select(AYAH_COLUMNS)
    .eq("hizb_number", hizbNumber)
    .order("surah_number", { ascending: true })
    .order("ayah_number", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Ayah[];
}

export async function getAyahsByRub(db: SupabaseClient, rubHizbNumber: number): Promise<Ayah[]> {
  const { data, error } = await db
    .schema("musabaqa")
    .from("ayahs")
    .select(AYAH_COLUMNS)
    .eq("rub_hizb_number", rubHizbNumber)
    .order("surah_number", { ascending: true })
    .order("ayah_number", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Ayah[];
}

export async function getAyahsByRuku(db: SupabaseClient, rukuNumber: number): Promise<Ayah[]> {
  const { data, error } = await db
    .schema("musabaqa")
    .from("ayahs")
    .select(AYAH_COLUMNS)
    .eq("ruku_number", rukuNumber)
    .order("surah_number", { ascending: true })
    .order("ayah_number", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Ayah[];
}

export async function getAyahsByManzil(db: SupabaseClient, manzilNumber: number): Promise<Ayah[]> {
  const { data, error } = await db
    .schema("musabaqa")
    .from("ayahs")
    .select(AYAH_COLUMNS)
    .eq("manzil_number", manzilNumber)
    .order("surah_number", { ascending: true })
    .order("ayah_number", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Ayah[];
}

/**
 * Fetch a contiguous range of ayahs, e.g. for CONTINUE_FROM_LOCATION or
 * FULL_RANGE question display modes. Range is inclusive on both ends and
 * must fall within a single surah (ayah numbers are only meaningful per-surah).
 */
export async function getAyahRange(
  db: SupabaseClient,
  surahNumber: number,
  startAyah: number,
  endAyah: number
): Promise<Ayah[]> {
  const { data, error } = await db
    .schema("musabaqa")
    .from("ayahs")
    .select(AYAH_COLUMNS)
    .eq("surah_number", surahNumber)
    .gte("ayah_number", startAyah)
    .lte("ayah_number", endAyah)
    .order("ayah_number", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Ayah[];
}

/**
 * Pick one uniformly random ayah from the entire corpus. Rarely what you
 * want for competition purposes (use getRandomAyahWithinRange with a
 * category's resolved range instead) — provided for completeness/testing.
 */
export async function getRandomAyah(db: SupabaseClient): Promise<Ayah> {
  const { count, error: countError } = await db
    .schema("musabaqa")
    .from("ayahs")
    .select("*", { count: "exact", head: true });
  if (countError) throw countError;
  if (!count) throw new Error("ayahs table is empty — has the Qur'an been imported yet?");

  const offset = Math.floor(Math.random() * count);
  const { data, error } = await db
    .schema("musabaqa")
    .from("ayahs")
    .select(AYAH_COLUMNS)
    .order("id", { ascending: true })
    .range(offset, offset)
    .single();
  if (error) throw error;
  return data as Ayah;
}

export interface VerseRange {
  /** Inclusive juz bounds, or null to not constrain by juz. */
  startJuz?: number | null;
  endJuz?: number | null;
  /** Restrict to specific surahs, or null/omitted for no surah restriction. */
  allowedSurahs?: number[] | null;
  /** Inclusive page bounds, or null to not constrain by page. */
  startPage?: number | null;
  endPage?: number | null;
}

/**
 * Pick one random ayah constrained to a resolved range (see
 * lib/competition/category-range.ts, which turns a category config into
 * this VerseRange shape). This is the function the question generator
 * actually uses — never getRandomAyah() unconstrained.
 */
export async function getRandomAyahWithinRange(db: SupabaseClient, range: VerseRange): Promise<Ayah> {
  let query = db.schema("musabaqa").from("ayahs").select(AYAH_COLUMNS, { count: "exact" });

  if (range.startJuz != null) query = query.gte("juz_number", range.startJuz);
  if (range.endJuz != null) query = query.lte("juz_number", range.endJuz);
  if (range.allowedSurahs?.length) query = query.in("surah_number", range.allowedSurahs);
  if (range.startPage != null) query = query.gte("page_number", range.startPage);
  if (range.endPage != null) query = query.lte("page_number", range.endPage);

  const { data, count, error } = await query;
  if (error) throw error;
  if (!data || !count) throw new Error("No ayahs match the given range.");

  const pick = data[Math.floor(Math.random() * data.length)];
  return pick as Ayah;
}
