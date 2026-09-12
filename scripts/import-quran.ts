/**
 * scripts/import-quran.ts
 *
 * Imports a Tanzil Qur'an text file (format: `surah|ayah|text`, one ayah per
 * line, trailing `#`-prefixed copyright block) into the `musabaqa` schema.
 *
 * CRITICAL RULES (see project spec):
 *  - This script NEVER generates, corrects, or reconstructs Qur'anic text.
 *  - It treats the supplied file as the sole source of truth.
 *  - If validation fails for ANY reason, the import is aborted before any
 *    write happens. No partial imports.
 *  - Re-running this script against a source that has already been imported
 *    (same checksum) is a safe no-op — it will not create duplicates.
 *  - The `ayahs` and `surahs` tables have no UPDATE policy in Postgres RLS,
 *    so even a compromised admin session cannot silently edit verse text.
 *    The only legitimate path to change the corpus is: replace the source
 *    file, bump the edition/checksum, and re-run this script, which inserts
 *    into a NEW `quran_sources` row rather than mutating existing ayahs.
 *
 * USAGE
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npm run import:quran -- /path/to/quran-uthmani.txt
 *
 * REQUIRED ENV VARS
 *   SUPABASE_URL                 Project URL (e.g. https://xxxx.supabase.co)
 *   SUPABASE_SERVICE_ROLE_KEY    Service role key (NEVER expose to browser)
 */

import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Canonical structural counts for the standard 114-surah / 6236-ayah Qur'an.
// Used ONLY to validate the imported file's structure — never to generate
// or substitute text. If these don't match, the import is refused.
// ---------------------------------------------------------------------------
const EXPECTED_AYAH_COUNTS: readonly number[] = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128,
  111, 110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54,
  45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62,
  55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28,
  20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15,
  21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6,
];
const EXPECTED_TOTAL_AYAHS = 6236;
const EXPECTED_SURAH_COUNT = 114;

interface ParsedAyah {
  lineNo: number;
  surah: number;
  ayah: number;
  verseKey: string;
  text: string;
}

interface ValidationReport {
  surahsDetected: number;
  ayahsDetected: number;
  duplicateVerseKeys: string[];
  missingSurahs: number[];
  missingAyahs: string[];
  countMismatches: { surah: number; expected: number; actual: number }[];
  malformedLines: number[];
  emptyTextLines: number[];
  ok: boolean;
}

function parseSourceFile(raw: string): {
  ayahs: ParsedAyah[];
  malformedLines: number[];
} {
  const ayahs: ParsedAyah[] = [];
  const malformedLines: number[] = [];
  const lines = raw.split(/\r?\n/);

  lines.forEach((line, idx) => {
    const lineNo = idx + 1;
    if (line.length === 0 || line.startsWith("#")) return;

    const parts = line.split("|");
    if (parts.length !== 3) {
      malformedLines.push(lineNo);
      return;
    }
    const [surahStr, ayahStr, text] = parts;
    const surah = Number(surahStr);
    const ayah = Number(ayahStr);
    if (!Number.isInteger(surah) || !Number.isInteger(ayah) || !text) {
      malformedLines.push(lineNo);
      return;
    }
    ayahs.push({ lineNo, surah, ayah, verseKey: `${surah}:${ayah}`, text });
  });

  return { ayahs, malformedLines };
}

function validate(ayahs: ParsedAyah[], malformedLines: number[]): ValidationReport {
  const bySurah = new Map<number, number[]>();
  const verseKeyCounts = new Map<string, number>();
  const emptyTextLines: number[] = [];

  for (const a of ayahs) {
    if (!a.text.trim()) emptyTextLines.push(a.lineNo);
    if (!bySurah.has(a.surah)) bySurah.set(a.surah, []);
    bySurah.get(a.surah)!.push(a.ayah);
    verseKeyCounts.set(a.verseKey, (verseKeyCounts.get(a.verseKey) ?? 0) + 1);
  }

  const duplicateVerseKeys = [...verseKeyCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key]) => key);

  const missingSurahs: number[] = [];
  const missingAyahs: string[] = [];
  const countMismatches: { surah: number; expected: number; actual: number }[] = [];

  for (let s = 1; s <= EXPECTED_SURAH_COUNT; s++) {
    const ayahNumbers = bySurah.get(s);
    if (!ayahNumbers) {
      missingSurahs.push(s);
      continue;
    }
    const expected = EXPECTED_AYAH_COUNTS[s - 1];
    const sorted = [...ayahNumbers].sort((a, b) => a - b);
    if (sorted.length !== expected) {
      countMismatches.push({ surah: s, expected, actual: sorted.length });
    }
    // Check for gaps within this surah's ayah numbers (1..expected, no gaps)
    const present = new Set(sorted);
    for (let n = 1; n <= expected; n++) {
      if (!present.has(n)) missingAyahs.push(`${s}:${n}`);
    }
  }

  const ok =
    malformedLines.length === 0 &&
    duplicateVerseKeys.length === 0 &&
    missingSurahs.length === 0 &&
    missingAyahs.length === 0 &&
    countMismatches.length === 0 &&
    emptyTextLines.length === 0 &&
    ayahs.length === EXPECTED_TOTAL_AYAHS &&
    bySurah.size === EXPECTED_SURAH_COUNT;

  return {
    surahsDetected: bySurah.size,
    ayahsDetected: ayahs.length,
    duplicateVerseKeys,
    missingSurahs,
    missingAyahs,
    countMismatches,
    malformedLines,
    emptyTextLines,
    ok,
  };
}

function extractEditionFromCopyrightBlock(raw: string): string | null {
  // Tanzil files embed a line like: "#  Tanzil Quran Text (Uthmani, Version 1.1)"
  const match = raw.match(/Tanzil Quran Text \(([^)]+)\)/i);
  return match ? match[1] : null;
}

function printReport(report: ValidationReport, edition: string | null) {
  console.log("");
  console.log("QUR'AN IMPORT VALIDATION");
  console.log(`Detected edition: ${edition ?? "UNKNOWN (no Tanzil copyright block found)"}`);
  console.log(`Surahs detected: ${report.surahsDetected}`);
  console.log(`Ayahs detected: ${report.ayahsDetected}`);
  console.log(`Duplicate verse_keys: ${report.duplicateVerseKeys.length}`);
  console.log(`Missing surahs: ${report.missingSurahs.length}`);
  console.log(`Missing ayahs: ${report.missingAyahs.length}`);
  console.log(`Ayah-count mismatches: ${report.countMismatches.length}`);
  console.log(`Malformed rows: ${report.malformedLines.length}`);
  console.log(`Empty-text rows: ${report.emptyTextLines.length}`);
  if (!report.ok) {
    console.log("");
    console.log("--- DETAILS ---");
    if (report.duplicateVerseKeys.length)
      console.log("Duplicates:", report.duplicateVerseKeys.slice(0, 20));
    if (report.missingSurahs.length)
      console.log("Missing surahs:", report.missingSurahs);
    if (report.missingAyahs.length)
      console.log("Missing ayahs (first 20):", report.missingAyahs.slice(0, 20));
    if (report.countMismatches.length)
      console.log("Count mismatches:", report.countMismatches);
    if (report.malformedLines.length)
      console.log("Malformed lines:", report.malformedLines.slice(0, 20));
    if (report.emptyTextLines.length)
      console.log("Empty text lines:", report.emptyTextLines.slice(0, 20));
  }
  console.log(`Import status: ${report.ok ? "SUCCESS" : "FAILED — ABORTED, NO DATA WRITTEN"}`);
  console.log("");
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npm run import:quran -- /path/to/quran-uthmani.txt");
    process.exit(1);
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
    process.exit(1);
  }

  const absPath = resolve(filePath);
  const raw = readFileSync(absPath, "utf-8");
  const checksum = createHash("sha256").update(raw).digest("hex");
  const edition = extractEditionFromCopyrightBlock(raw);

  // STOP if this doesn't look like the Uthmani edition. Do not guess, do not proceed.
  if (!edition || !/uthmani/i.test(edition)) {
    console.error(
      `REFUSING TO IMPORT: expected a Tanzil "Uthmani" edition, but detected: ${edition ?? "no edition marker found"}.`
    );
    console.error("This project requires the Uthmani (Madinah/Madani Mushaf) text specifically.");
    process.exit(1);
  }

  const { ayahs, malformedLines } = parseSourceFile(raw);
  const report = validate(ayahs, malformedLines);
  printReport(report, edition);

  if (!report.ok) {
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Idempotency: if this exact file (by checksum) was already imported, stop.
  const { data: existingSource, error: sourceLookupError } = await supabase
    .schema("musabaqa")
    .from("quran_sources")
    .select("id, checksum")
    .eq("checksum", checksum)
    .maybeSingle();

  if (sourceLookupError) {
    console.error("Failed to check for existing source:", sourceLookupError.message);
    process.exit(1);
  }

  if (existingSource) {
    console.log(`This exact file (checksum ${checksum.slice(0, 12)}...) was already imported as source ${existingSource.id}. Nothing to do.`);
    return;
  }

  // Record the source BEFORE inserting ayahs, so every ayah can reference it.
  const { data: sourceRow, error: sourceInsertError } = await supabase
    .schema("musabaqa")
    .from("quran_sources")
    .insert({
      source_name: "Tanzil Project",
      source_url: "https://tanzil.net",
      edition,
      script: "Uthmani (Madinah/Madani Mushaf)",
      license: "Creative Commons Attribution 3.0",
      checksum,
      notes: `Imported by scripts/import-quran.ts. Structural validation: ${report.surahsDetected} surahs, ${report.ayahsDetected} ayahs, 0 discrepancies.`,
    })
    .select("id")
    .single();

  if (sourceInsertError || !sourceRow) {
    console.error("Failed to insert quran_sources row:", sourceInsertError?.message);
    process.exit(1);
  }
  const sourceId = sourceRow.id;
  console.log(`Recorded source: ${sourceId}`);

  // Look up surah_id per surah_number (surahs table must already be seeded —
  // see the accompanying migration; this script does not invent surah metadata).
  const { data: surahRows, error: surahFetchError } = await supabase
    .schema("musabaqa")
    .from("surahs")
    .select("id, surah_number");

  if (surahFetchError || !surahRows || surahRows.length !== EXPECTED_SURAH_COUNT) {
    console.error(
      "surahs table is not properly seeded. Run the schema migration (which inserts all 114 surahs) before importing ayahs.",
      surahFetchError?.message
    );
    process.exit(1);
  }
  const surahIdByNumber = new Map(surahRows.map((s) => [s.surah_number, s.id]));

  // Batch insert ayahs.
  const BATCH_SIZE = 500;
  let inserted = 0;
  for (let i = 0; i < ayahs.length; i += BATCH_SIZE) {
    const batch = ayahs.slice(i, i + BATCH_SIZE).map((a) => ({
      surah_id: surahIdByNumber.get(a.surah),
      surah_number: a.surah,
      ayah_number: a.ayah,
      verse_key: a.verseKey,
      text_uthmani: a.text,
      source_id: sourceId,
    }));

    const { error: insertError } = await supabase.schema("musabaqa").from("ayahs").insert(batch);
    if (insertError) {
      console.error(`Batch starting at row ${i} failed:`, insertError.message);
      console.error("Import aborted partway through. Investigate before re-running.");
      process.exit(1);
    }
    inserted += batch.length;
    console.log(`Inserted ${inserted}/${ayahs.length} ayahs...`);
  }

  console.log("");
  console.log(`DONE. ${inserted} ayahs imported under source ${sourceId}.`);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
