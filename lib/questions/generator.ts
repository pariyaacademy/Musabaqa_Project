/**
 * lib/questions/generator.ts
 *
 * Spec sections 17-21. This is the ONLY place questions get generated or
 * assigned. Two separate concerns, matching the spec's own distinction:
 *
 *  1. generateCategoryQuestions() — builds the pool of candidate questions
 *     for a category, scoped to its resolved Qur'anic range, with
 *     randomization, duplicate prevention, surah-distribution balancing,
 *     and a configurable minimum distance between questions.
 *
 *  2. assignQuestionsToSession() — takes questions from that pool and
 *     STORES a specific ordered assignment for a participant's session.
 *     Never called twice for the same session (idempotent) — the whole
 *     point (section 19) is that a judge reopening the page sees the same
 *     questions, not a fresh random draw.
 *
 * Both are meant to run with a database client scoped to an authenticated
 * COMPETITION_ADMIN (or the service-role admin client for background jobs)
 * — RLS on `questions` and `question_assignments` enforces that only an
 * admin of the relevant competition can write here, matching section 20:
 * never send the full question bank to the browser.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRandomAyahWithinRange, type Ayah } from "../quran/queries";
import { resolveCategoryRange } from "../competition/category-range";
import { writeAuditLog } from "../audit/log";

export type QuestionType =
  | "START_OF_SURAH"
  | "RANDOM_AYAH"
  | "CONTINUE_AYAH"
  | "CONTINUE_FROM_LOCATION"
  | "SIMILAR_AYAH"
  | "PAGE_SELECTION"
  | "JUZ_SELECTION"
  | "EXAMINER_SELECTED"
  | "CUSTOM_RANGE";

export type Difficulty = "EASY" | "MEDIUM" | "HARD";

export interface GenerateQuestionsOptions {
  count: number;
  questionTypes?: QuestionType[]; // default: all types except EXAMINER_SELECTED (that one's manual by definition)
  difficultyMix?: Difficulty[]; // cycled across generated questions; default: even MEDIUM
  /** Minimum ayah-number distance apart (within the same surah) between any two generated questions. */
  minDistance?: number;
  createdBy: string; // auth.users.id of the acting admin, for audit + created_by column
}

export interface GeneratedQuestion {
  id: string;
  category_id: string;
  question_type: QuestionType;
  start_verse_key: string;
  end_verse_key: string | null;
  surah_number: number;
  ayah_number: number;
  juz_number: number | null;
  page_number: number | null;
  difficulty: Difficulty;
  status: "ACTIVE" | "INACTIVE";
}

const ALL_TYPES: QuestionType[] = [
  "START_OF_SURAH",
  "RANDOM_AYAH",
  "CONTINUE_AYAH",
  "CONTINUE_FROM_LOCATION",
  "SIMILAR_AYAH",
  "PAGE_SELECTION",
  "JUZ_SELECTION",
  "CUSTOM_RANGE",
];

const MAX_ATTEMPTS_PER_QUESTION = 40;

function tooClose(candidate: Ayah, existing: Ayah[], minDistance: number): boolean {
  return existing.some(
    (e) => e.surah_number === candidate.surah_number && Math.abs(e.ayah_number - candidate.ayah_number) < minDistance
  );
}

/**
 * Generates `count` new questions for a category, persisted in
 * musabaqa.questions. Existing ACTIVE questions in the category are treated
 * as exclusions (duplicate prevention carries across generation runs, not
 * just within one run).
 */
export async function generateCategoryQuestions(
  db: SupabaseClient,
  categoryId: string,
  options: GenerateQuestionsOptions
): Promise<GeneratedQuestion[]> {
  const { count, createdBy } = options;
  const minDistance = options.minDistance ?? 3;
  const types = options.questionTypes?.length ? options.questionTypes : ALL_TYPES;
  const difficulties = options.difficultyMix?.length ? options.difficultyMix : (["MEDIUM"] as Difficulty[]);

  const range = await resolveCategoryRange(db, categoryId);

  // Load existing active questions for this category, both to avoid exact
  // duplicates and to feed the distance/balance checks against past runs too.
  const { data: existingRows, error: existingError } = await db
    .schema("musabaqa")
    .from("questions")
    .select("start_verse_key, surah_number, ayah_number")
    .eq("category_id", categoryId)
    .eq("status", "ACTIVE");
  if (existingError) throw existingError;

  const existingKeys = new Set((existingRows ?? []).map((r) => r.start_verse_key as string));
  const existingAyahsForDistance = (existingRows ?? []).map((r) => ({
    surah_number: r.surah_number,
    ayah_number: r.ayah_number,
  })) as Ayah[];

  const picked: Ayah[] = [];
  const surahCounts = new Map<number, number>();

  for (let i = 0; i < count; i++) {
    let candidate: Ayah | null = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_QUESTION; attempt++) {
      const tryAyah = await getRandomAyahWithinRange(db, range);

      if (existingKeys.has(tryAyah.verse_key)) continue;
      if (picked.some((p) => p.verse_key === tryAyah.verse_key)) continue;
      if (tooClose(tryAyah, [...existingAyahsForDistance, ...picked], minDistance)) continue;

      // Balanced surah distribution: soft cap — don't let one surah dominate
      // beyond roughly double its "fair share" of the batch, unless the
      // range only spans a single surah (in which case this can't apply).
      const surahsInRange = range.allowedSurahs?.length ?? null;
      if (surahsInRange && surahsInRange > 1) {
        const fairShare = Math.max(1, Math.ceil(count / surahsInRange));
        const currentCount = surahCounts.get(tryAyah.surah_number) ?? 0;
        if (currentCount >= fairShare * 2) continue;
      }

      candidate = tryAyah;
      break;
    }

    if (!candidate) {
      throw new Error(
        `Could not find a suitable ayah for question ${i + 1}/${count} after ${MAX_ATTEMPTS_PER_QUESTION} attempts. ` +
          `The category's range may be too narrow for ${count} well-spaced questions (minDistance=${minDistance}).`
      );
    }

    picked.push(candidate);
    surahCounts.set(candidate.surah_number, (surahCounts.get(candidate.surah_number) ?? 0) + 1);
  }

  const rows = picked.map((ayah) => {
    const questionType = types[Math.floor(Math.random() * types.length)];
    const difficulty = difficulties[Math.floor(Math.random() * difficulties.length)];
    return {
      category_id: categoryId,
      question_type: questionType,
      start_verse_key: ayah.verse_key,
      end_verse_key: null as string | null,
      surah_number: ayah.surah_number,
      ayah_number: ayah.ayah_number,
      juz_number: ayah.juz_number,
      page_number: ayah.page_number,
      difficulty,
      display_mode: "REFERENCE_ONLY" as const,
      status: "ACTIVE" as const,
      created_by: createdBy,
    };
  });

  const { data: inserted, error: insertError } = await db
    .schema("musabaqa")
    .from("questions")
    .insert(rows)
    .select("id, category_id, question_type, start_verse_key, end_verse_key, surah_number, ayah_number, juz_number, page_number, difficulty, status");

  if (insertError) throw insertError;

  await writeAuditLog(db, {
    userId: createdBy,
    action: "question_generation",
    entityType: "competition_category",
    entityId: categoryId,
    newValue: { count: inserted?.length ?? 0, minDistance, types, difficulties },
  });

  return (inserted ?? []) as GeneratedQuestion[];
}

export interface AssignQuestionsOptions {
  sessionId: string;
  participantId: string;
  competitionId: string;
  questionIds: string[]; // order matters — this becomes question_order
  randomSeed?: string;
  assignedBy: string; // for audit log
}

/**
 * Stores a specific ordered set of questions for a session. Idempotent: if
 * this session already has assignments, returns them unchanged rather than
 * generating a new set — per spec section 19, a judge reopening the page
 * must see the SAME questions, not a new random draw.
 */
export async function assignQuestionsToSession(db: SupabaseClient, opts: AssignQuestionsOptions) {
  const { data: existing, error: existingError } = await db
    .schema("musabaqa")
    .from("question_assignments")
    .select("id, question_id, question_order, status")
    .eq("session_id", opts.sessionId)
    .order("question_order", { ascending: true });
  if (existingError) throw existingError;

  if (existing && existing.length > 0) {
    return existing; // already assigned — do not regenerate
  }

  const rows = opts.questionIds.map((questionId, idx) => ({
    participant_id: opts.participantId,
    competition_id: opts.competitionId,
    session_id: opts.sessionId,
    question_id: questionId,
    question_order: idx + 1,
    random_seed: opts.randomSeed ?? null,
    status: "ASSIGNED" as const,
  }));

  const { data: inserted, error: insertError } = await db
    .schema("musabaqa")
    .from("question_assignments")
    .insert(rows)
    .select("id, question_id, question_order, status");
  if (insertError) throw insertError;

  await writeAuditLog(db, {
    userId: opts.assignedBy,
    action: "question_assignment",
    entityType: "competition_session",
    entityId: opts.sessionId,
    newValue: { questionCount: rows.length, participantId: opts.participantId },
  });

  return inserted ?? [];
}
