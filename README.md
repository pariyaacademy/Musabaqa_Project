# Musabaqa — Qur'an Memorization Competition Platform

## Status: Qur'an data live · Full schema live · Public + judge app running

The Qur'an corpus (114 surahs, 6,236 ayahs, Tanzil Uthmani edition) is
imported and verified in your Supabase project (`pariyaacademy's Project`,
`musabaqa` schema). The full competition/judge/scoring/certificate schema is
live with RLS on every table. This repo contains a real Next.js app with
working public and judge-facing pages, backed by the `lib/` services.

## Running it locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create `.env.local` in the project root:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://dcvgdmtkuccfmsbosboc.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...        # anon/public key — safe to expose
   SUPABASE_URL=https://dcvgdmtkuccfmsbosboc.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=...            # service_role key — NEVER expose to the browser
   ```
   Find both keys in the Supabase dashboard under Project Settings → API.
3. Run the dev server:
   ```bash
   npm run dev
   ```
   Then open http://localhost:3000.

## What's actually clickable right now

- **`/`** — home page, lists competitions from the live database.
- **`/competitions/[id]`** — competition detail + its categories.
- **`/register/[categoryId]`** — public registration form → posts to
  `/api/register`, which runs `registerParticipant()` (full server-side
  eligibility validation) and returns a real participant code.
- **`/verify`** — certificate verification by code → `/api/verify`.
- **`/login`** — sign in for judges/organizers (participants don't need
  accounts). Session cookies refreshed by `middleware.ts` on every request.
- **`/judge`** — signed-in judge's session queue, scoped automatically by
  RLS to only sessions they're assigned to.
- **`/judge/session/[sessionId]`** — the actual scoring interface: shows the
  participant, the questions assigned to *this session only* (never the
  full question bank), and a form per scoring criterion. Submits to
  `/api/scoring/submit`, locks via `/api/scoring/lock`.
- **`/scoreboard/[categoryId]`** — live-updating scoreboard via Supabase
  Realtime; updates automatically when scores change, respecting the
  competition's configured `result_visibility`.

### Setting up a judge login for testing

1. In the Supabase dashboard → Authentication → Users, create a user (email + password).
2. In SQL Editor, link them:
   ```sql
   insert into musabaqa.user_roles (user_id, role) values ('<their auth.users id>', 'judge');
   update musabaqa.judges set user_id = '<their auth.users id>' where id = '<a judges.id>';
   ```
3. Sign in at `/login` with that email/password, then visit `/judge`.

These pages are unstyled-by-a-template on purpose — a custom ivory/pine-teal/
emerald/gold palette (Fraunces + Inter, Amiri reserved for Arabic text)
rather than a generic dashboard look.

**Not yet built:** the admin dashboard (competition/category/question CRUD,
participant approval, question generation trigger, results publishing UI).
All the backend logic for it already exists in `lib/` — it just needs pages.

## Qur'an import (already done, kept for reference)

`scripts/import-quran.ts` and `scripts/validate-quran.ts` remain here in
case you ever need to re-import (e.g. a corrected dataset). See the script
comments for usage — it refuses to run against anything but a verified
Tanzil "Uthmani" file.

## Known gaps

- Juz/Hizb/Rub/page/Ruku/Manzil boundary metadata on `ayahs` is still NULL —
  needs Tanzil's `quran-data.xml` or equivalent verified source. Not
  fabricated; upload it when ready.
- Pre-existing `public` (school system) tables have RLS enabled but no
  policies — flagged by Supabase's advisor, unrelated to Musabaqa, not
  touched without being asked.

## Admin workflow (spec sections 10–31, condensed into working pages)

- **`/admin`** — dashboard stats (competitions, active, participants, judges, pending scoring, published results).
- **`/admin/competitions`** — list + create (super_admin only, per RLS; creator is auto-added as that competition's admin).
- **`/admin/competitions/[id]`** — create categories, approve/reject pending registrations.
- **`/admin/competitions/[id]/categories/[categoryId]`** — add scoring criteria, trigger question generation (`generateCategoryQuestions`), create sessions (auto-assigns judges + a random slice of the question pool via `assignQuestionsToSession`).
- **`/admin/results/[categoryId]`** — aggregate submitted sessions, rank the category, publish individual results, generate certificates.

This closes the full loop end to end: register → approve → generate questions → create session → judge scores → lock → aggregate → rank → publish → certificate → public verify.

## Judge/admin account creation (no more raw SQL needed)

- **`/admin/judges`** — create a judge record, then click "Invite" to send
  them a real Supabase Auth email invite. They set a password and land at
  `/judge`. Available to any competition_admin or super_admin.
- **`/admin/roles`** — grant `competition_admin`, `judge`, or `super_admin`
  by email (super_admin only). Finds an existing account or sends an
  invite if the email is new.
- **Competition detail page → Administrators** — add someone as an admin
  of that *specific* competition (separate from the general
  `competition_admin` role — this is what actually satisfies
  `is_admin_of_competition()` in RLS for that competition).

Bootstrapping the very first super_admin still requires one manual SQL
insert (there's no one to grant it otherwise):
```sql
insert into musabaqa.user_roles (user_id, role) values ('<your auth.users id>', 'super_admin');
```
Every admin/judge added after that can go through the UI.

## PDF certificates

- **`/api/certificates/[code]/pdf`** — public download, landscape PDF with
  the brand palette, participant/competition/category/position/score,
  certificate ID, issue date, organizer, and an embedded QR code linking
  back to `/verify`. Uses pdf-lib with standard PDF fonts (no external font
  fetching, so it can't fail on a network hiccup at request time).
- Linked from `/verify` once a certificate resolves, and from
  `/admin/results/[categoryId]` next to each generated certificate.

## Session scheduling

- Session creation now has a real date/time picker (`/admin/.../categories/[categoryId]`).
- **Conflict detection** (`lib/scheduling/conflicts.ts`): before creating a
  session, checks for overlapping time windows (using each session's
  category duration) where a chosen judge is already booked, or the same
  room is already in use. Returns warnings but never blocks creation — an
  admin may have a legitimate reason to override, and the system can't
  judge that for them.
- **`/admin/competitions/[id]/schedule`** — the full competition schedule,
  grouped by day and sorted by time, across every category: participant,
  category, room, judges, status. Linked from the competition detail page.

## Localization (English / Hausa)

- **`lib/i18n/dictionaries.ts`** — string dictionary for both locales,
  covering the pages a participant or their family actually use: home,
  competition detail, registration, verification, and shared nav/footer.
  Admin and judge tooling stays English-only for now (internal staff use)
  — extending this is just adding more keys to the same dictionary, no
  restructuring needed.
- **Cookie-based, not URL-based** (`lib/i18n/locale.ts`, `actions.ts`) — no
  `/en/...` vs `/ha/...` path prefixes. A language switcher (EN / HA) sits
  in the header on every page.
- **Important:** the Hausa strings were written by Claude, not reviewed by
  a native speaker. They should be fine for everyday use but deserve a
  proofread from someone fluent before this goes in front of real families
  — unlike the Qur'an text itself, this is ordinary UI copy and low-risk to
  fix later, but worth flagging honestly rather than presenting it as
  verified.

## Database schema (`supabase/migrations/`)

`00000000000000_complete_schema.sql` reproduces the **entire** database
from scratch — 23 tables, 66 RLS policies, 7 internal helper functions,
8 enums, all grants, the participant-code trigger, and every bug fix
found during live deployment. Verified to match the live database
object-for-object.

Run it on a fresh Supabase project, then:
1. Add `musabaqa` to Settings → API → Exposed schemas (dashboard-only;
   SQL can't set it), and expose its tables.
2. Import the Qur'an data (`scripts/import-quran.ts`) — deliberately NOT
   in the SQL file, since Qur'anic text must come from the authoritative
   Tanzil source.
3. Create your first super_admin (instructions at the bottom of the file).

The file's NOTES section documents the non-obvious failure modes hit
during this deployment — wrong `SUPABASE_URL` format, missing grants,
RLS recursion, schema moves not rewriting function bodies, and DRAFT
competitions being invisible publicly. Worth reading before touching the
schema.
