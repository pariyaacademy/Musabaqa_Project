import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicClient } from "@/lib/supabase/public";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionaries";

export const revalidate = 30;

interface CategoryRow {
  id: string;
  category_name: string;
  start_juz: number | null;
  end_juz: number | null;
  duration_minutes: number | null;
  age_min: number | null;
  age_max: number | null;
  gender_restriction: string;
  status: string;
}

async function getCompetition(id: string) {
  const db = getPublicClient();
  const { data: competition, error } = await db
    .schema("musabaqa")
    .from("competitions")
    .select("id, name, description, venue, city, country, rules, status, result_visibility")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!competition) return null;

  const { data: categories, error: catError } = await db
    .schema("musabaqa")
    .from("competition_categories")
    .select("id, category_name, start_juz, end_juz, duration_minutes, age_min, age_max, gender_restriction, status")
    .eq("competition_id", id)
    .order("category_name", { ascending: true });
  if (catError) throw catError;

  return { competition, categories: (categories ?? []) as CategoryRow[] };
}

function rangeLabel(cat: CategoryRow, t: Dictionary) {
  if (cat.start_juz && cat.end_juz) {
    return cat.start_juz === cat.end_juz ? `Juz ${cat.start_juz}` : `Juz ${cat.start_juz}–${cat.end_juz}`;
  }
  return t.competition.customRange;
}

export default async function CompetitionPage({ params }: { params: { id: string } }) {
  const t = getDictionary(getLocale());
  const data = await getCompetition(params.id);
  if (!data) notFound();
  const { competition, categories } = data;

  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-emerald">
        {t.status[competition.status as keyof typeof t.status] ?? competition.status.replace(/_/g, " ")}
      </p>
      <h1 className="mt-2 font-display text-3xl text-ink">{competition.name}</h1>
      <p className="mt-1 text-ink/60">
        {[competition.venue, competition.city, competition.country].filter(Boolean).join(", ")}
      </p>
      {competition.description && <p className="mt-4 max-w-2xl text-ink/80">{competition.description}</p>}

      <div className="star-divider my-10" />

      <h2 className="font-display text-2xl text-ink">{t.competition.categories}</h2>
      {categories.length === 0 ? (
        <p className="mt-4 text-ink/60">{t.competition.noCategoriesYet}</p>
      ) : (
        <ul className="mt-6 divide-y divide-hairline border-t border-hairline">
          {categories.map((cat) => (
            <li key={cat.id} className="flex items-center justify-between py-4">
              <div>
                <p className="font-display text-lg text-ink">{cat.category_name}</p>
                <p className="text-sm text-ink/60">
                  {rangeLabel(cat, t)}
                  {cat.duration_minutes ? ` · ${cat.duration_minutes} ${t.competition.minutes}` : ""}
                  {cat.age_min || cat.age_max ? ` · ${t.competition.ageRange} ${cat.age_min ?? "—"}–${cat.age_max ?? "—"}` : ""}
                  {cat.gender_restriction !== "ANY"
                    ? ` · ${cat.gender_restriction === "MALE" ? t.competition.maleOnly : t.competition.femaleOnly}`
                    : ""}
                </p>
              </div>
              {cat.status === "ACTIVE" ? (
                <Link
                  href={`/register/${cat.id}`}
                  className="border border-emerald px-4 py-2 text-sm text-emerald hover:bg-emerald hover:text-ivory"
                >
                  {t.competition.register}
                </Link>
              ) : (
                <span className="text-xs uppercase tracking-wide text-ink/40">{t.competition.closed}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {competition.rules && (
        <>
          <div className="star-divider my-10" />
          <h2 className="font-display text-2xl text-ink">{t.competition.rules}</h2>
          <p className="mt-4 max-w-2xl whitespace-pre-line text-ink/80">{competition.rules}</p>
        </>
      )}
    </div>
  );
}
