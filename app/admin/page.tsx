import Link from "next/link";
import { getServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function getStats() {
  const db = getServerClient();

  // RLS already scopes all of these to competitions the signed-in admin
  // manages (or everything, if super_admin) — no manual filtering needed.
  const [{ count: competitionCount }, { count: activeCount }, { count: participantCount }, { count: judgeCount }, { count: pendingScoring }, { count: publishedResults }] =
    await Promise.all([
      db.schema("musabaqa").from("competitions").select("*", { count: "exact", head: true }),
      db.schema("musabaqa").from("competitions").select("*", { count: "exact", head: true }).in("status", ["LIVE", "REGISTRATION_OPEN"]),
      db.schema("musabaqa").from("participant_competitions").select("*", { count: "exact", head: true }),
      db.schema("musabaqa").from("judges").select("*", { count: "exact", head: true }),
      db.schema("musabaqa").from("competition_sessions").select("*", { count: "exact", head: true }).in("status", ["SUBMITTED", "CHECKED_IN", "READY", "IN_PROGRESS"]),
      db.schema("musabaqa").from("results").select("*", { count: "exact", head: true }).eq("published", true),
    ]);

  return {
    competitions: competitionCount ?? 0,
    active: activeCount ?? 0,
    participants: participantCount ?? 0,
    judges: judgeCount ?? 0,
    pendingScoring: pendingScoring ?? 0,
    publishedResults: publishedResults ?? 0,
  };
}

export default async function AdminDashboard() {
  const stats = await getStats();

  const cards = [
    { label: "Competitions", value: stats.competitions },
    { label: "Active now", value: stats.active },
    { label: "Participants registered", value: stats.participants },
    { label: "Judges", value: stats.judges },
    { label: "Sessions pending scoring", value: stats.pendingScoring },
    { label: "Published results", value: stats.publishedResults },
  ];

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-ink dark:text-dark-ink">Admin dashboard</h1>
        <div className="flex gap-3">
          <Link href="/admin/competitions" className="border border-forest px-4 py-2 text-sm text-forest dark:text-forest-light hover:bg-forest hover:text-white">
            Manage competitions
          </Link>
          <Link href="/admin/judges" className="border border-forest px-4 py-2 text-sm text-forest dark:text-forest-light hover:bg-forest hover:text-white">
            Manage judges
          </Link>
          <Link href="/admin/roles" className="border border-forest px-4 py-2 text-sm text-forest dark:text-forest-light hover:bg-forest hover:text-white">
            User roles
          </Link>
        </div>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-px border border-hairline dark:border-dark-hairline bg-hairline md:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-surface dark:bg-dark-surface-alt p-6">
            <p className="font-display text-3xl tabnum text-ink dark:text-dark-ink">{c.value}</p>
            <p className="mt-1 text-sm text-ink-soft dark:text-dark-ink/60">{c.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
