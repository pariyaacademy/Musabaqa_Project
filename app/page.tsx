import Link from "next/link";
import { getPublicClient } from "@/lib/supabase/public";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary, type Dictionary } from "@/lib/i18n/dictionaries";

export const revalidate = 30;

interface CompetitionSummary {
  id: string;
  name: string;
  description: string | null;
  venue: string | null;
  city: string | null;
  country: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
}

async function getCompetitions(): Promise<CompetitionSummary[]> {
  const db = getPublicClient();
  const { data, error } = await db
    .schema("musabaqa")
    .from("competitions")
    .select("id, name, description, venue, city, country, start_date, end_date, status")
    .order("start_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CompetitionSummary[];
}

function formatDateRange(start: string | null, end: string | null, t: Dictionary) {
  if (!start) return t.home.datesTba;
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  const s = new Date(start).toLocaleDateString("en-US", opts);
  if (!end || end === start) return s;
  const e = new Date(end).toLocaleDateString("en-US", opts);
  return `${s} – ${e}`;
}

export default async function HomePage() {
  const t = getDictionary(getLocale());
  const competitions = await getCompetitions();
  const featured = competitions.find((c) => c.status === "LIVE" || c.status === "REGISTRATION_OPEN") ?? competitions[0];
  const rest = competitions.filter((c) => c.id !== featured?.id);

  return (
    <div>
      {/* Asymmetric hero: headline on the left, the most relevant competition as a live preview on the right */}
      <section className="grid grid-cols-1 gap-10 border-b border-hairline dark:border-dark-hairline pb-10 md:grid-cols-5">
        <div className="md:col-span-3">
          <h1 className="max-w-md font-display text-4xl font-medium leading-tight text-ink dark:text-dark-ink md:text-5xl">
            {t.home.heading1}
            <br />
            {t.home.heading2}
          </h1>
          <p className="mt-5 max-w-sm text-ink-soft dark:text-dark-ink/70">{t.home.subtext}</p>
        </div>

        {featured && (
          <div className="md:col-span-2 md:justify-self-end">
            <div className="rounded border border-hairline bg-surface-alt p-6 dark:border-dark-hairline dark:bg-dark-surface-alt">
              <p className="text-xs uppercase tracking-wide text-forest dark:text-forest-light">
                {t.status[featured.status as keyof typeof t.status] ?? featured.status}
              </p>
              <h2 className="mt-2 font-display text-xl text-ink dark:text-dark-ink">{featured.name}</h2>
              <p className="mt-1 text-sm text-ink-soft dark:text-dark-ink/60">
                {[featured.venue, featured.city, featured.country].filter(Boolean).join(", ") || t.home.venueTba}
              </p>
              <p className="mt-1 text-sm text-ink-soft dark:text-dark-ink/60">{formatDateRange(featured.start_date, featured.end_date, t)}</p>
              <Link
                href={`/competitions/${featured.id}`}
                className="mt-4 inline-block border-b border-forest text-sm text-forest dark:text-forest-light hover:border-ink hover:text-ink dark:text-dark-ink"
              >
                {t.home.viewCompetition}
              </Link>
            </div>
          </div>
        )}
      </section>

      <div className="star-divider my-10" />

      <section>
        <h2 className="font-display text-2xl text-ink dark:text-dark-ink">{t.home.allCompetitions}</h2>
        {rest.length === 0 && competitions.length <= 1 ? (
          <p className="mt-4 text-ink-soft dark:text-dark-ink/60">{t.home.noOtherCompetitions}</p>
        ) : (
          <ul className="mt-6 divide-y divide-hairline dark:divide-dark-hairline border-t border-hairline dark:border-dark-hairline">
            {(rest.length ? rest : competitions).map((c) => (
              <li key={c.id} className="flex items-center justify-between py-4">
                <div>
                  <Link href={`/competitions/${c.id}`} className="font-display text-lg text-ink dark:text-dark-ink hover:text-forest dark:text-forest-light">
                    {c.name}
                  </Link>
                  <p className="text-sm text-ink-soft dark:text-dark-ink/60">
                    {[c.city, c.country].filter(Boolean).join(", ")} · {formatDateRange(c.start_date, c.end_date, t)}
                  </p>
                </div>
                <span className="text-xs uppercase tracking-wide text-ink-soft dark:text-dark-ink/50">
                  {t.status[c.status as keyof typeof t.status] ?? c.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
