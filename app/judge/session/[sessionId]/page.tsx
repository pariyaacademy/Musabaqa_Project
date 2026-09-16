import { notFound } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { getAyahByVerseKey } from "@/lib/quran/queries";
import ScoreForm from "./ScoreForm";

export const dynamic = "force-dynamic";

async function loadSessionData(sessionId: string) {
  const db = getServerClient();

  const { data: session, error } = await db
    .schema("musabaqa")
    .from("competition_sessions")
    .select(
      "id, status, category_id, participants(id, participant_code, full_name, photo_url), competition_categories(category_name)"
    )
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw error;
  if (!session) return null;

  const { data: criteria, error: criteriaError } = await db
    .schema("musabaqa")
    .from("score_criteria")
    .select("id, criterion_name, max_score, display_order")
    .eq("category_id", session.category_id)
    .order("display_order", { ascending: true });
  if (criteriaError) throw criteriaError;

  // Questions ASSIGNED to this specific session only — never the full bank
  // (spec section 20). Empty until an admin has run the question generator
  // and assignQuestionsToSession() for this participant.
  const { data: assignments, error: assignmentsError } = await db
    .schema("musabaqa")
    .from("question_assignments")
    .select("question_order, questions(question_type, start_verse_key, display_mode, difficulty)")
    .eq("session_id", sessionId)
    .order("question_order", { ascending: true });
  if (assignmentsError) throw assignmentsError;

  const questions = await Promise.all(
    (assignments ?? []).map(async (a) => {
      const q = Array.isArray(a.questions) ? a.questions[0] : a.questions;
      let ayahText: string | null = null;
      if (q && (q.display_mode === "FULL_RANGE" || q.display_mode === "PROMPT_TEXT")) {
        const ayah = await getAyahByVerseKey(db, q.start_verse_key);
        ayahText = ayah?.text_uthmani ?? null;
      }
      return { order: a.question_order, ...q, ayahText };
    })
  );

  // This judge's own existing scores for this session, to prefill the form.
  const {
    data: { user },
  } = await db.auth.getUser();
  const { data: judge } = await db.schema("musabaqa").from("judges").select("id").eq("user_id", user?.id ?? "").maybeSingle();

  let existingScores: { criterion_id: string; raw_score: number; deductions: number; locked: boolean }[] = [];
  if (judge) {
    const { data } = await db
      .schema("musabaqa")
      .from("judge_scores")
      .select("criterion_id, raw_score, deductions, locked")
      .eq("session_id", sessionId)
      .eq("judge_id", judge.id);
    existingScores = data ?? [];
  }

  return { session, criteria: criteria ?? [], questions, existingScores };
}

export default async function JudgeSessionPage({ params }: { params: { sessionId: string } }) {
  const data = await loadSessionData(params.sessionId);
  if (!data) notFound();
  const { session, criteria, questions, existingScores } = data;

  const participant = Array.isArray(session.participants) ? session.participants[0] : session.participants;
  const category = Array.isArray(session.competition_categories) ? session.competition_categories[0] : session.competition_categories;

  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-forest dark:text-forest-light">{category?.category_name}</p>
      <h1 className="mt-2 font-display text-3xl text-ink dark:text-dark-ink">{participant?.full_name}</h1>
      <p className="mt-1 tabnum text-ink-soft dark:text-dark-ink/60">{participant?.participant_code}</p>

      <div className="star-divider my-8" />

      <h2 className="font-display text-xl text-ink dark:text-dark-ink">Questions</h2>
      {questions.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft dark:text-dark-ink/60">No questions have been assigned to this session yet.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {questions.map((q) => (
            <li key={q.order} className="border border-hairline dark:border-dark-hairline p-4">
              <p className="text-xs uppercase tracking-wide text-ink-soft dark:text-dark-ink/50">
                Question {q.order} · {q.question_type?.replace(/_/g, " ")}
                {q.difficulty ? ` · ${q.difficulty}` : ""}
              </p>
              <p className="mt-1 tabnum text-ink dark:text-dark-ink">{q.start_verse_key}</p>
              {q.ayahText && <p dir="rtl" className="mt-2 font-arabic text-xl leading-loose text-ink dark:text-dark-ink">{q.ayahText}</p>}
            </li>
          ))}
        </ol>
      )}

      <div className="star-divider my-8" />

      <h2 className="font-display text-xl text-ink dark:text-dark-ink">Scoring</h2>
      {criteria.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft dark:text-dark-ink/60">No scoring criteria configured for this category yet.</p>
      ) : (
        <ScoreForm sessionId={session.id} criteria={criteria} existingScores={existingScores} />
      )}
    </div>
  );
}
