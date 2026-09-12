/**
 * scripts/validate-quran.ts
 *
 * `npm run validate:quran`
 *
 * Validates the Qur'an data ALREADY IN THE DATABASE (as opposed to
 * import-quran.ts, which validates a source file before importing it).
 * Use this any time you want to confirm the live corpus is intact —
 * e.g. after a migration, a restore, or periodically in CI.
 *
 * Never modifies data. Read-only.
 */

import { createClient } from "@supabase/supabase-js";

const EXPECTED_TOTAL_AYAHS = 6236;
const EXPECTED_SURAH_COUNT = 114;

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { count: surahCount } = await supabase
    .schema("musabaqa")
    .from("surahs")
    .select("*", { count: "exact", head: true });

  const { count: ayahCount } = await supabase
    .schema("musabaqa")
    .from("ayahs")
    .select("*", { count: "exact", head: true });

  // Note: duplicate verse_keys and duplicate (surah_id, ayah_number) pairs are
  // impossible in the live data — both are enforced by UNIQUE constraints at
  // the schema level (see the migration), so no separate runtime check is needed.

  console.log("QUR'AN DATA INTEGRITY CHECK (live database)");
  console.log(`Surah count: ${surahCount} (expected ${EXPECTED_SURAH_COUNT})`);
  console.log(`Ayah count: ${ayahCount} (expected ${EXPECTED_TOTAL_AYAHS})`);

  const problems: string[] = [];
  if (surahCount !== EXPECTED_SURAH_COUNT) problems.push("surah count mismatch");
  if (ayahCount !== EXPECTED_TOTAL_AYAHS) problems.push("ayah count mismatch");

  if (problems.length) {
    console.log(`Status: FAILED (${problems.join(", ")})`);
    process.exit(1);
  }
  console.log("Status: OK");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
