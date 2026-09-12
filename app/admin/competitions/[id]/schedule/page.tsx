import { notFound } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface SessionRow {
  id: string;
  scheduled_time: string | null;
  room: string | null;
  status: string;
  participants: { full_name: string; participant_code: string } | null;
  competition_categories: { category_name: string } | null;
  session_judges: { judges: { full_name: string } | null }[];
}

async function getData(competitionId: string) {
  const db = getServerClient();

  const { data: competition, error } = await db
    .schema("musabaqa")
    .from("competitions")
    .select("id, name")
    .eq("id", competitionId)
    .maybeSingle();
  if (error) throw error;
  if (!competition) return null;

  const { data: sessions, error: sessionsError } = await db
    .schema("musabaqa")
    .from("competition_sessions")
    .select(
      "id, scheduled_time, room, status, participants(full_name, participant_code), competition_categories(category_name), session_judges(judges(full_name))"
    )
    .eq("competition_id", competitionId)
    .order("scheduled_time", { ascending: true, nullsFirst: false });
  if (sessionsError) throw sessionsError;

  return { competition, sessions: (sessions ?? []) as unknown as SessionRow[] };
}

function dayKey(iso: string | null): string {
  if (!iso) return "Unscheduled";
  return new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function timeLabel(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default async function SchedulePage({ params }: { params: { id: string } }) {
  const data = await getData(params.id);
  if (!data) notFound();
  const { competition, sessions } = data;

  const groups = new Map<string, SessionRow[]>();
  for (const s of sessions) {
    const key = dayKey(s.scheduled_time);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }
  // Keep "Unscheduled" last regardless of where it sorted alphabetically.
  const orderedKeys = [...groups.keys()].filter((k) => k !== "Unscheduled");
  if (groups.has("Unscheduled")) orderedKeys.push("Unscheduled");

  return (
    <div>
      <h1 className="font-display text-3xl text-ink">Schedule — {competition.name}</h1>

      {sessions.length === 0 ? (
        <p className="mt-8 text-ink/60">No sessions created yet.</p>
      ) : (
        orderedKeys.map((key) => (
          <div key={key} className="mt-10">
            <h2 className="font-display text-xl text-ink">{key}</h2>
            <table className="mt-4 w-full border-t border-hairline text-sm">
              <thead>
                <tr className="border-b border-hairline text-left text-ink/60">
                  <th className="py-2 font-normal">Time</th>
                  <th className="py-2 font-normal">Participant</th>
                  <th className="py-2 font-normal">Category</th>
                  <th className="py-2 font-normal">Room</th>
                  <th className="py-2 font-normal">Judges</th>
                  <th className="py-2 font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {groups.get(key)!.map((s) => (
                  <tr key={s.id} className="border-b border-hairline">
                    <td className="py-3 tabnum">{timeLabel(s.scheduled_time)}</td>
                    <td className="py-3 text-ink">
                      {s.participants?.full_name}
                      <span className="ml-2 tabnum text-xs text-ink/50">{s.participants?.participant_code}</span>
                    </td>
                    <td className="py-3 text-ink/70">{s.competition_categories?.category_name}</td>
                    <td className="py-3 text-ink/70">{s.room ?? "—"}</td>
                    <td className="py-3 text-ink/70">
                      {s.session_judges.map((sj) => sj.judges?.full_name).filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="py-3 text-xs uppercase tracking-wide text-ink/50">{s.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}
