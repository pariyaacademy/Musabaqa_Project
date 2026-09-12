import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { GenerateQuestionsButton, AddCriterionForm, NewSessionForm } from "./Controls";

export const dynamic = "force-dynamic";

async function getData(competitionId: string, categoryId: string) {
  const db = getServerClient();

  const { data: category, error } = await db
    .schema("musabaqa")
    .from("competition_categories")
    .select("id, category_name, start_juz, end_juz, number_of_questions, aggregation_method")
    .eq("id", categoryId)
    .eq("competition_id", competitionId)
    .maybeSingle();
  if (error) throw error;
  if (!category) return null;

  const { data: criteria } = await db
    .schema("musabaqa")
    .from("score_criteria")
    .select("id, criterion_name, max_score, weight")
    .eq("category_id", categoryId)
    .order("display_order", { ascending: true });

  const { count: questionPoolSize } = await db
    .schema("musabaqa")
    .from("questions")
    .select("*", { count: "exact", head: true })
    .eq("category_id", categoryId)
    .eq("status", "ACTIVE");

  const { data: approvedParticipants } = await db
    .schema("musabaqa")
    .from("participant_competitions")
    .select("participants(id, participant_code, full_name)")
    .eq("category_id", categoryId)
    .eq("status", "APPROVED");

  const { data: judges } = await db.schema("musabaqa").from("judges").select("id, full_name").eq("status", "ACTIVE");

  const { data: sessions } = await db
    .schema("musabaqa")
    .from("competition_sessions")
    .select("id, status, participants(full_name, participant_code)")
    .eq("category_id", categoryId)
    .order("created_at", { ascending: false });

  return {
    category,
    criteria: criteria ?? [],
    questionPoolSize: questionPoolSize ?? 0,
    participants: (approvedParticipants ?? [])
      .map((pc) => (Array.isArray(pc.participants) ? pc.participants[0] : pc.participants))
      .filter(Boolean) as { id: string; participant_code: string; full_name: string }[],
    judges: judges ?? [],
    sessions: sessions ?? [],
  };
}

export default async function CategoryAdminPage({ params }: { params: { id: string; categoryId: string } }) {
  const data = await getData(params.id, params.categoryId);
  if (!data) notFound();
  const { category, criteria, questionPoolSize, participants, judges, sessions } = data;

  return (
    <div>
      <h1 className="font-display text-3xl text-ink">{category.category_name}</h1>
      <p className="mt-1 text-ink/60">
        {category.start_juz && category.end_juz ? `Juz ${category.start_juz}–${category.end_juz}` : "No range set"} ·{" "}
        {category.aggregation_method.replace(/_/g, " ").toLowerCase()}
      </p>

      <div className="star-divider my-8" />

      <h2 className="font-display text-xl text-ink">Scoring criteria</h2>
      {criteria.length > 0 && (
        <ul className="mt-4 divide-y divide-hairline border-t border-hairline">
          {criteria.map((c) => (
            <li key={c.id} className="flex justify-between py-2 text-sm">
              <span className="text-ink">{c.criterion_name}</span>
              <span className="tabnum text-ink/60">
                max {c.max_score} · weight {c.weight}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4">
        <AddCriterionForm categoryId={category.id} />
      </div>

      <div className="star-divider my-8" />

      <h2 className="font-display text-xl text-ink">Question pool</h2>
      <p className="mt-2 text-sm text-ink/60">
        {questionPoolSize} active question{questionPoolSize === 1 ? "" : "s"} generated · target {category.number_of_questions} per session
      </p>
      <div className="mt-4">
        <GenerateQuestionsButton categoryId={category.id} />
      </div>

      <div className="star-divider my-8" />

      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-ink">Sessions</h2>
        <Link href={`/admin/results/${category.id}`} className="text-sm text-emerald hover:text-ink">
          View results →
        </Link>
      </div>
      {sessions.length > 0 && (
        <ul className="mt-4 divide-y divide-hairline border-t border-hairline">
          {sessions.map((s) => {
            const p = Array.isArray(s.participants) ? s.participants[0] : s.participants;
            return (
              <li key={s.id} className="flex justify-between py-2 text-sm">
                <span className="text-ink">{p?.full_name}</span>
                <span className="text-xs uppercase tracking-wide text-ink/50">{s.status}</span>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-4">
        <NewSessionForm competitionId={params.id} categoryId={category.id} participants={participants} judges={judges} />
      </div>
    </div>
  );
}
