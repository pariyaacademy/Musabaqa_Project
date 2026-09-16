import Link from "next/link";
import { getServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function JudgeQueuePage() {
  const db = getServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();

  // RLS (sessions_judge_read_update) already restricts this to sessions the
  // signed-in judge is actually assigned to — no need to filter by judge_id
  // in the query itself, but we still need it to join session_judges cleanly.
  const { data: judge } = await db.schema("musabaqa").from("judges").select("id, full_name").eq("user_id", user?.id ?? "").maybeSingle();

  if (!judge) {
    return (
      <div>
        <h1 className="font-display text-3xl text-ink dark:text-dark-ink">Judge queue</h1>
        <p className="mt-4 text-ink-soft dark:text-dark-ink/60">No judge profile is linked to your account yet.</p>
      </div>
    );
  }

  const { data: sessions, error } = await db
    .schema("musabaqa")
    .from("competition_sessions")
    .select(
      "id, status, room, scheduled_time, participants(participant_code, full_name), competition_categories(category_name), session_judges!inner(judge_id)"
    )
    .eq("session_judges.judge_id", judge.id)
    .order("scheduled_time", { ascending: true });

  if (error) throw error;

  return (
    <div>
      <h1 className="font-display text-3xl text-ink dark:text-dark-ink">Your session queue</h1>
      <p className="mt-2 text-ink-soft dark:text-dark-ink/60">Signed in as {judge.full_name}</p>

      {!sessions || sessions.length === 0 ? (
        <p className="mt-8 text-ink-soft dark:text-dark-ink/60">No sessions assigned to you yet.</p>
      ) : (
        <ul className="mt-8 divide-y divide-hairline dark:divide-dark-hairline border-t border-hairline dark:border-dark-hairline">
          {sessions.map((s) => {
            const participant = Array.isArray(s.participants) ? s.participants[0] : s.participants;
            const category = Array.isArray(s.competition_categories) ? s.competition_categories[0] : s.competition_categories;
            return (
              <li key={s.id} className="flex items-center justify-between py-4">
                <div>
                  <p className="font-display text-lg text-ink dark:text-dark-ink">{participant?.full_name}</p>
                  <p className="text-sm tabnum text-ink-soft dark:text-dark-ink/60">
                    {participant?.participant_code} · {category?.category_name}
                    {s.room ? ` · Room ${s.room}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs uppercase tracking-wide text-ink-soft dark:text-dark-ink/50">{s.status}</span>
                  <Link
                    href={`/judge/session/${s.id}`}
                    className="border border-forest px-4 py-2 text-sm text-forest dark:text-forest-light hover:bg-forest hover:text-white"
                  >
                    Open
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
