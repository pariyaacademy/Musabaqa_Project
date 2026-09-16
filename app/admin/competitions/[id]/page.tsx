import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import NewCategoryForm from "./NewCategoryForm";
import ApproveParticipantButtons from "./ApproveParticipantButtons";
import AddCompetitionAdminForm from "./AddCompetitionAdminForm";
import StatusControl from "./StatusControl";

export const dynamic = "force-dynamic";

async function getData(competitionId: string) {
  const db = getServerClient();

  const { data: competition, error } = await db
    .schema("musabaqa")
    .from("competitions")
    .select("id, name, status, city, country")
    .eq("id", competitionId)
    .maybeSingle();
  if (error) throw error;
  if (!competition) return null;

  const { data: categories } = await db
    .schema("musabaqa")
    .from("competition_categories")
    .select("id, category_name, status, start_juz, end_juz")
    .eq("competition_id", competitionId)
    .order("category_name", { ascending: true });

  const { data: pendingParticipants } = await db
    .schema("musabaqa")
    .from("participant_competitions")
    .select("id, status, participants(id, participant_code, full_name, status), competition_categories(category_name)")
    .eq("competition_id", competitionId)
    .eq("status", "REGISTERED");

  return { competition, categories: categories ?? [], pendingParticipants: pendingParticipants ?? [] };
}

export default async function AdminCompetitionDetailPage({ params }: { params: { id: string } }) {
  const data = await getData(params.id);
  if (!data) notFound();
  const { competition, categories, pendingParticipants } = data;

  return (
    <div>
      <StatusControl competitionId={competition.id} currentStatus={competition.status} />
      <h1 className="mt-2 font-display text-3xl text-ink">{competition.name}</h1>

      <div className="star-divider my-8" />

      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl text-ink">Categories</h2>
        <Link href={`/admin/competitions/${competition.id}/schedule`} className="text-sm text-emerald hover:text-ink">
          View full schedule →
        </Link>
      </div>
      <div className="mt-4">
        <NewCategoryForm competitionId={competition.id} />
      </div>
      {categories.length > 0 && (
        <ul className="mt-6 divide-y divide-hairline border-t border-hairline">
          {categories.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-3">
              <div>
                <Link href={`/admin/competitions/${competition.id}/categories/${c.id}`} className="text-ink hover:text-emerald">
                  {c.category_name}
                </Link>
                <p className="text-xs text-ink/50">
                  {c.start_juz && c.end_juz ? `Juz ${c.start_juz}–${c.end_juz}` : "No range set"}
                </p>
              </div>
              <span className="text-xs uppercase tracking-wide text-ink/50">{c.status}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="star-divider my-8" />

      <h2 className="font-display text-2xl text-ink">Pending registrations</h2>
      {pendingParticipants.length === 0 ? (
        <p className="mt-4 text-ink/60">No registrations waiting for approval.</p>
      ) : (
        <ul className="mt-6 divide-y divide-hairline border-t border-hairline">
          {pendingParticipants.map((pc) => {
            const p = Array.isArray(pc.participants) ? pc.participants[0] : pc.participants;
            const cat = Array.isArray(pc.competition_categories) ? pc.competition_categories[0] : pc.competition_categories;
            return (
              <li key={pc.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-ink">{p?.full_name}</p>
                  <p className="tabnum text-xs text-ink/50">
                    {p?.participant_code} · {cat?.category_name}
                  </p>
                </div>
                {p && <ApproveParticipantButtons participantId={p.id} />}
              </li>
            );
          })}
        </ul>
      )}

      <div className="star-divider my-8" />

      <h2 className="font-display text-2xl text-ink">Administrators</h2>
      <p className="mt-2 text-sm text-ink/60">
        Add someone as an admin of this specific competition. If they don&apos;t have an account yet,
        they&apos;ll get an invite email.
      </p>
      <div className="mt-4">
        <AddCompetitionAdminForm competitionId={competition.id} />
      </div>
    </div>
  );
}
