/**
 * lib/competition/category-range.ts
 *
 * Spec section 45: "Create a reusable range system... Do not scatter
 * category logic throughout the application. Create one reusable service."
 *
 * This is that service. Every place that needs to know "what part of the
 * Qur'an is this category allowed to draw from" calls resolveCategoryRange()
 * — nothing else re-derives it.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { VerseRange } from "../quran/queries";

export interface CategoryRow {
  id: string;
  start_juz: number | null;
  end_juz: number | null;
  allowed_surahs: number[] | null;
  start_page: number | null;
  end_page: number | null;
}

export async function resolveCategoryRange(
  db: SupabaseClient,
  categoryId: string
): Promise<VerseRange> {
  const { data, error } = await db
    .schema("musabaqa")
    .from("competition_categories")
    .select("id, start_juz, end_juz, allowed_surahs, start_page, end_page")
    .eq("id", categoryId)
    .single();

  if (error) throw error;
  if (!data) throw new Error(`Category ${categoryId} not found.`);

  const category = data as CategoryRow;

  // A category with none of these set has no meaningful range — that's a
  // configuration error, not something to silently default to "whole Qur'an".
  const hasAnyBound =
    category.start_juz != null ||
    category.end_juz != null ||
    (category.allowed_surahs && category.allowed_surahs.length > 0) ||
    category.start_page != null;

  if (!hasAnyBound) {
    throw new Error(
      `Category ${categoryId} has no juz/surah/page range configured. Refusing to generate questions from an unbounded range — configure the category first.`
    );
  }

  return {
    startJuz: category.start_juz,
    endJuz: category.end_juz,
    allowedSurahs: category.allowed_surahs,
    startPage: category.start_page,
    endPage: category.end_page,
  };
}
