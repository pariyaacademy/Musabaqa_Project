-- =====================================================================
-- MUSABAQA PLATFORM — COMPLETE SCHEMA
-- =====================================================================
--
-- This single file reproduces the ENTIRE musabaqa database from scratch,
-- consolidating all 20 migrations applied during development (including
-- several bug fixes discovered during live testing — see NOTES at the
-- bottom for the ones that are easy to get wrong).
--
-- WHY THIS FILE EXISTS: every schema change during this project was
-- applied directly to the live Supabase project. That works fine for one
-- production database, but means nothing is reproducible — a new project
-- (staging, a rebuild, a migration to another host) would start empty.
-- This file closes that gap.
--
-- WHAT IT DOES NOT INCLUDE:
--   * The Qur'an data itself (114 surahs / 6,236 ayahs + Juz/Hizb/page
--     metadata). That is imported separately — see scripts/import-quran.ts
--     — because Qur'anic text must come from the authoritative Tanzil
--     source, never from a checked-in SQL file that could drift.
--   * Your competition/participant/judge records (live data, not schema).
--
-- HOW TO USE ON A FRESH SUPABASE PROJECT:
--   1. Run this whole file in the SQL Editor.
--   2. Add "musabaqa" to Settings → API → Exposed schemas (dashboard-only
--      setting; SQL cannot set it). Also expose its tables there.
--   3. Run the Qur'an importer (see README).
--   4. Create your first super_admin (see the bottom of this file).
-- =====================================================================


-- =====================================================================
-- 1. SCHEMAS
-- =====================================================================

create schema if not exists musabaqa;

-- Internal helper functions live in a SEPARATE schema that is never added
-- to the API's exposed-schemas list. They are SECURITY DEFINER (needed so
-- RLS policies can check other tables without recursing), which would make
-- them callable as public RPC endpoints if they sat in musabaqa itself.
create schema if not exists musabaqa_internal;


-- =====================================================================
-- 2. ENUMS
-- =====================================================================

do $$ begin
  create type musabaqa.app_role as enum ('super_admin','competition_admin','judge','participant');
exception when duplicate_object then null; end $$;

do $$ begin
  create type musabaqa.competition_status as enum
    ('DRAFT','REGISTRATION_OPEN','REGISTRATION_CLOSED','UPCOMING','LIVE','COMPLETED','ARCHIVED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type musabaqa.result_visibility as enum
    ('HIDDEN','AFTER_SUBMISSION','AFTER_ROUND','AFTER_COMPLETION');
exception when duplicate_object then null; end $$;

do $$ begin
  create type musabaqa.aggregation_method as enum
    ('AVERAGE_ALL','DROP_LOWEST','DROP_HIGHEST_AND_LOWEST','WEIGHTED_AVERAGE','CHAIRMAN_OVERRIDE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type musabaqa.gender_restriction as enum ('ANY','MALE','FEMALE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type musabaqa.session_status as enum
    ('WAITING','CHECKED_IN','READY','IN_PROGRESS','SUBMITTED','SCORED','LOCKED','CANCELLED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type musabaqa.question_type as enum
    ('START_OF_SURAH','RANDOM_AYAH','CONTINUE_AYAH','CONTINUE_FROM_LOCATION',
     'SIMILAR_AYAH','PAGE_SELECTION','JUZ_SELECTION','EXAMINER_SELECTED','CUSTOM_RANGE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type musabaqa.question_display_mode as enum
    ('REFERENCE_ONLY','PROMPT_TEXT','FULL_RANGE','EXAMINER_MODE');
exception when duplicate_object then null; end $$;


-- =====================================================================
-- 3. ROLES
-- =====================================================================

create table if not exists musabaqa.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role musabaqa.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
create index if not exists idx_musabaqa_user_roles_user on musabaqa.user_roles(user_id);


-- =====================================================================
-- 4. QUR'AN CORE (IMMUTABLE)
-- =====================================================================

create table if not exists musabaqa.quran_sources (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  source_url text,
  edition text not null,
  script text not null,
  license text,
  imported_at timestamptz not null default now(),
  checksum text,
  notes text
);

create table if not exists musabaqa.surahs (
  id uuid primary key default gen_random_uuid(),
  surah_number int not null unique check (surah_number between 1 and 114),
  name_arabic text not null,
  name_english text not null,
  name_transliteration text not null,
  ayah_count int not null check (ayah_count > 0),
  revelation_type text check (revelation_type in ('Meccan','Medinan')),
  created_at timestamptz not null default now()
);

create table if not exists musabaqa.ayahs (
  id uuid primary key default gen_random_uuid(),
  surah_id uuid not null references musabaqa.surahs(id) on delete restrict,
  surah_number int not null check (surah_number between 1 and 114),
  ayah_number int not null check (ayah_number > 0),
  verse_key text not null unique,
  text_uthmani text not null,
  juz_number int,
  hizb_number int,
  rub_hizb_number int,
  page_number int,
  ruku_number int,
  manzil_number int,
  sajdah boolean not null default false,
  source_id uuid references musabaqa.quran_sources(id),
  created_at timestamptz not null default now(),
  unique (surah_id, ayah_number)
);

create index if not exists idx_ayahs_surah_number on musabaqa.ayahs(surah_number);
create index if not exists idx_ayahs_surah_id on musabaqa.ayahs(surah_id);
create index if not exists idx_ayahs_verse_key on musabaqa.ayahs(verse_key);
create index if not exists idx_ayahs_juz on musabaqa.ayahs(juz_number);
create index if not exists idx_ayahs_hizb on musabaqa.ayahs(hizb_number);
create index if not exists idx_ayahs_rub_hizb on musabaqa.ayahs(rub_hizb_number);
create index if not exists idx_ayahs_page on musabaqa.ayahs(page_number);
create index if not exists idx_ayahs_ruku on musabaqa.ayahs(ruku_number);
create index if not exists idx_ayahs_manzil on musabaqa.ayahs(manzil_number);


-- =====================================================================
-- 5. COMPETITION CORE
-- =====================================================================

create table if not exists musabaqa.competitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  logo_url text,
  organizer text,
  venue text,
  city text,
  country text,
  start_date date,
  end_date date,
  registration_start date,
  registration_end date,
  status musabaqa.competition_status not null default 'DRAFT',
  rules text,
  max_participants int,
  visibility text not null default 'PUBLIC' check (visibility in ('PUBLIC','PRIVATE')),
  result_visibility musabaqa.result_visibility not null default 'AFTER_COMPLETION',
  tie_break_rule text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date),
  check (registration_end is null or registration_start is null or registration_end >= registration_start)
);

create table if not exists musabaqa.competition_admins (
  competition_id uuid not null references musabaqa.competitions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (competition_id, user_id)
);

create table if not exists musabaqa.competition_categories (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references musabaqa.competitions(id) on delete cascade,
  category_name text not null,
  start_juz int check (start_juz between 1 and 30),
  end_juz int check (end_juz between 1 and 30),
  allowed_surahs int[],
  start_page int,
  end_page int,
  number_of_questions int not null default 5 check (number_of_questions > 0),
  duration_minutes int,
  number_of_judges int not null default 1 check (number_of_judges > 0),
  aggregation_method musabaqa.aggregation_method not null default 'AVERAGE_ALL',
  age_min int,
  age_max int,
  gender_restriction musabaqa.gender_restriction not null default 'ANY',
  instructions text,
  status text not null default 'DRAFT' check (status in ('DRAFT','ACTIVE','CLOSED')),
  created_at timestamptz not null default now(),
  check (end_juz is null or start_juz is null or end_juz >= start_juz),
  check (age_max is null or age_min is null or age_max >= age_min)
);
create index if not exists idx_categories_competition on musabaqa.competition_categories(competition_id);

create table if not exists musabaqa.participants (
  id uuid primary key default gen_random_uuid(),
  participant_code text not null unique,
  user_id uuid references auth.users(id),
  full_name text not null,
  date_of_birth date,
  gender text check (gender in ('Male','Female')),
  country text,
  state text,
  lga text,
  city text,
  organization text,
  teacher text,
  phone text,
  email text,
  photo_url text,
  emergency_contact_name text,
  emergency_contact_phone text,
  qr_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED')),
  created_at timestamptz not null default now()
);
create index if not exists idx_participants_user on musabaqa.participants(user_id);

create table if not exists musabaqa.participant_competitions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references musabaqa.participants(id) on delete cascade,
  competition_id uuid not null references musabaqa.competitions(id) on delete cascade,
  category_id uuid not null references musabaqa.competition_categories(id) on delete restrict,
  status text not null default 'REGISTERED'
    check (status in ('REGISTERED','APPROVED','REJECTED','CHECKED_IN','EXAMINED','SCORED','WITHDRAWN')),
  registered_at timestamptz not null default now(),
  unique (participant_id, competition_id)
);
create index if not exists idx_partcomp_competition on musabaqa.participant_competitions(competition_id);
create index if not exists idx_partcomp_category on musabaqa.participant_competitions(category_id);

create table if not exists musabaqa.judges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  full_name text not null,
  phone text,
  email text,
  specialization text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  created_at timestamptz not null default now()
);
create index if not exists idx_judges_user on musabaqa.judges(user_id);

create table if not exists musabaqa.judge_assignments (
  id uuid primary key default gen_random_uuid(),
  judge_id uuid not null references musabaqa.judges(id) on delete cascade,
  competition_id uuid not null references musabaqa.competitions(id) on delete cascade,
  category_id uuid references musabaqa.competition_categories(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  unique (judge_id, competition_id, category_id)
);
create index if not exists idx_judgeassign_competition on musabaqa.judge_assignments(competition_id);


-- =====================================================================
-- 6. PARTICIPANT CODE GENERATION (atomic, collision-free)
-- =====================================================================
-- Generated by a DB trigger rather than app code so concurrent
-- registrations can never race into issuing the same code.

create sequence if not exists musabaqa.participant_code_seq start 1;

create or replace function musabaqa.generate_participant_code()
returns trigger
language plpgsql
set search_path = musabaqa, public
as $$
begin
  if new.participant_code is null then
    new.participant_code := 'MQ' || to_char(current_date, 'YY') || '-' ||
      lpad(nextval('musabaqa.participant_code_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_generate_participant_code on musabaqa.participants;
create trigger trg_generate_participant_code
  before insert on musabaqa.participants
  for each row execute function musabaqa.generate_participant_code();


-- =====================================================================
-- 7. QUESTION BANK & ASSIGNMENTS
-- =====================================================================

create table if not exists musabaqa.questions (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references musabaqa.competition_categories(id) on delete cascade,
  question_type musabaqa.question_type not null,
  start_verse_key text not null references musabaqa.ayahs(verse_key),
  end_verse_key text references musabaqa.ayahs(verse_key),
  surah_number int not null,
  ayah_number int not null,
  juz_number int,
  page_number int,
  difficulty text not null default 'MEDIUM' check (difficulty in ('EASY','MEDIUM','HARD')),
  display_mode musabaqa.question_display_mode not null default 'REFERENCE_ONLY',
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_questions_category on musabaqa.questions(category_id);
create index if not exists idx_questions_surah on musabaqa.questions(surah_number);
create index if not exists idx_questions_status on musabaqa.questions(status);


-- =====================================================================
-- 8. SESSIONS, CHECK-IN, SCORING
-- =====================================================================

create table if not exists musabaqa.competition_sessions (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references musabaqa.competitions(id) on delete cascade,
  category_id uuid not null references musabaqa.competition_categories(id) on delete cascade,
  participant_id uuid not null references musabaqa.participants(id) on delete cascade,
  room text,
  scheduled_time timestamptz,
  status musabaqa.session_status not null default 'WAITING',
  started_at timestamptz,
  completed_at timestamptz,
  locked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_sessions_competition on musabaqa.competition_sessions(competition_id);
create index if not exists idx_sessions_participant on musabaqa.competition_sessions(participant_id);
create index if not exists idx_sessions_status on musabaqa.competition_sessions(status);

-- Created after competition_sessions so the session_id FK can be inline.
create table if not exists musabaqa.question_assignments (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references musabaqa.participants(id) on delete cascade,
  competition_id uuid not null references musabaqa.competitions(id) on delete cascade,
  session_id uuid references musabaqa.competition_sessions(id) on delete set null,
  question_id uuid not null references musabaqa.questions(id) on delete restrict,
  question_order int not null,
  random_seed text,
  status text not null default 'ASSIGNED'
    check (status in ('ASSIGNED','PRESENTED','ANSWERED','SKIPPED')),
  generated_at timestamptz not null default now(),
  unique (session_id, question_order)
);
create index if not exists idx_qassign_participant on musabaqa.question_assignments(participant_id);
create index if not exists idx_qassign_session on musabaqa.question_assignments(session_id);

create table if not exists musabaqa.session_judges (
  session_id uuid not null references musabaqa.competition_sessions(id) on delete cascade,
  judge_id uuid not null references musabaqa.judges(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  weight numeric not null default 1 check (weight > 0),
  is_chairman boolean not null default false,
  primary key (session_id, judge_id)
);
-- At most one chairman per session.
create unique index if not exists idx_session_judges_one_chairman
  on musabaqa.session_judges(session_id) where is_chairman = true;

create table if not exists musabaqa.checkins (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references musabaqa.competition_sessions(id) on delete cascade,
  participant_id uuid not null references musabaqa.participants(id) on delete cascade,
  checked_in_by uuid references auth.users(id),
  checked_in_at timestamptz not null default now(),
  device_info text,
  unique (session_id)  -- prevents duplicate check-in at the DB level
);

create table if not exists musabaqa.score_criteria (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references musabaqa.competition_categories(id) on delete cascade,
  criterion_name text not null,
  max_score numeric not null check (max_score > 0),
  weight numeric not null default 1,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_criteria_category on musabaqa.score_criteria(category_id);

create table if not exists musabaqa.scoring_rules (
  id uuid primary key default gen_random_uuid(),
  criterion_id uuid not null references musabaqa.score_criteria(id) on delete cascade,
  rule_name text not null,
  deduction_value numeric not null,
  description text
);

create table if not exists musabaqa.judge_scores (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references musabaqa.competition_sessions(id) on delete cascade,
  judge_id uuid not null references musabaqa.judges(id) on delete restrict,
  criterion_id uuid not null references musabaqa.score_criteria(id) on delete restrict,
  raw_score numeric not null,
  deductions numeric not null default 0,
  final_score numeric generated always as (raw_score - deductions) stored,
  comments text,
  submitted_at timestamptz,
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  unique (session_id, judge_id, criterion_id)
);
create index if not exists idx_judgescores_session on musabaqa.judge_scores(session_id);

create table if not exists musabaqa.score_corrections (
  id uuid primary key default gen_random_uuid(),
  judge_score_id uuid not null references musabaqa.judge_scores(id) on delete cascade,
  original_score numeric not null,
  corrected_score numeric not null,
  corrected_by uuid not null references auth.users(id),
  reason text not null,
  created_at timestamptz not null default now()
);


-- =====================================================================
-- 9. RESULTS, CERTIFICATES, AUDIT
-- =====================================================================

create table if not exists musabaqa.results (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references musabaqa.competitions(id) on delete cascade,
  category_id uuid not null references musabaqa.competition_categories(id) on delete cascade,
  participant_id uuid not null references musabaqa.participants(id) on delete cascade,
  session_id uuid references musabaqa.competition_sessions(id),
  position int,
  final_score numeric,
  award text,
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (competition_id, category_id, participant_id)
);
create index if not exists idx_results_competition on musabaqa.results(competition_id);
create index if not exists idx_results_category on musabaqa.results(category_id);

create table if not exists musabaqa.certificates (
  id uuid primary key default gen_random_uuid(),
  certificate_code text not null unique,
  result_id uuid not null references musabaqa.results(id) on delete cascade,
  participant_id uuid not null references musabaqa.participants(id) on delete cascade,
  competition_id uuid not null references musabaqa.competitions(id) on delete cascade,
  category_id uuid not null references musabaqa.competition_categories(id) on delete cascade,
  issue_date date not null default current_date,
  qr_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz not null default now()
);

create table if not exists musabaqa.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  old_value jsonb,
  new_value jsonb,
  ip_address text,
  device_metadata text,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_entity on musabaqa.audit_logs(entity_type, entity_id);
create index if not exists idx_audit_user on musabaqa.audit_logs(user_id);
create index if not exists idx_audit_created on musabaqa.audit_logs(created_at);


-- =====================================================================
-- 10. INTERNAL HELPER FUNCTIONS
-- =====================================================================
--
-- CRITICAL: these live in musabaqa_internal, NOT musabaqa.
--
-- They are SECURITY DEFINER (owned by postgres, which has rolbypassrls),
-- which is what lets an RLS policy on table A check table B without
-- re-triggering B's policies — the mechanism that prevents infinite
-- recursion. But that same power would make them dangerous as public RPC
-- endpoints, and any function in an API-exposed schema becomes one. Since
-- musabaqa_internal is never added to the exposed-schemas list, PostgREST
-- never generates routes for them, while RLS can still call them freely.
--
-- Note every function below references its siblings as
-- "musabaqa_internal.*", NOT "musabaqa.*". A function body is plain text
-- resolved fresh at call time — moving a function between schemas does NOT
-- rewrite calls inside other function bodies. (RLS policy expressions are
-- different: they bind to the function's OID and survive schema moves.)

create or replace function musabaqa_internal.has_role(check_role musabaqa.app_role)
returns boolean language sql security definer stable
set search_path = musabaqa, musabaqa_internal, public
as $$
  select exists (
    select 1 from musabaqa.user_roles where user_id = auth.uid() and role = check_role
  );
$$;

create or replace function musabaqa_internal.is_super_admin()
returns boolean language sql security definer stable
set search_path = musabaqa, musabaqa_internal, public
as $$ select musabaqa_internal.has_role('super_admin'); $$;

create or replace function musabaqa_internal.is_admin_of_competition(comp_id uuid)
returns boolean language sql security definer stable
set search_path = musabaqa, musabaqa_internal, public
as $$
  select musabaqa_internal.is_super_admin()
    or exists (
      select 1 from musabaqa.competition_admins ca
      where ca.competition_id = comp_id and ca.user_id = auth.uid()
    );
$$;

create or replace function musabaqa_internal.is_judge_of_competition(comp_id uuid, cat_id uuid default null)
returns boolean language sql security definer stable
set search_path = musabaqa, musabaqa_internal, public
as $$
  select exists (
    select 1
    from musabaqa.judge_assignments ja
    join musabaqa.judges j on j.id = ja.judge_id
    where j.user_id = auth.uid()
      and ja.competition_id = comp_id
      and (cat_id is null or ja.category_id is null or ja.category_id = cat_id)
  );
$$;

create or replace function musabaqa_internal.current_participant_id()
returns uuid language sql security definer stable
set search_path = musabaqa, musabaqa_internal, public
as $$ select id from musabaqa.participants where user_id = auth.uid(); $$;

-- These next two exist specifically to break the judges <-> judge_assignments
-- mutual recursion. Writing either check as a raw inline subquery inside the
-- policy causes "infinite recursion detected in policy for relation judges".
create or replace function musabaqa_internal.judge_row_is_caller(p_judge_id uuid)
returns boolean language sql security definer stable
set search_path = musabaqa, musabaqa_internal, public
as $$
  select exists (
    select 1 from musabaqa.judges where id = p_judge_id and user_id = auth.uid()
  );
$$;

create or replace function musabaqa_internal.judge_has_admin_assignment(p_judge_id uuid)
returns boolean language sql security definer stable
set search_path = musabaqa, musabaqa_internal, public
as $$
  select exists (
    select 1 from musabaqa.judge_assignments ja
    where ja.judge_id = p_judge_id
      and musabaqa_internal.is_admin_of_competition(ja.competition_id)
  );
$$;


-- =====================================================================
-- 11. ENABLE RLS ON EVERY TABLE
-- =====================================================================

alter table musabaqa.user_roles              enable row level security;
alter table musabaqa.quran_sources           enable row level security;
alter table musabaqa.surahs                  enable row level security;
alter table musabaqa.ayahs                   enable row level security;
alter table musabaqa.competitions            enable row level security;
alter table musabaqa.competition_admins      enable row level security;
alter table musabaqa.competition_categories  enable row level security;
alter table musabaqa.participants            enable row level security;
alter table musabaqa.participant_competitions enable row level security;
alter table musabaqa.judges                  enable row level security;
alter table musabaqa.judge_assignments       enable row level security;
alter table musabaqa.questions               enable row level security;
alter table musabaqa.question_assignments    enable row level security;
alter table musabaqa.competition_sessions    enable row level security;
alter table musabaqa.session_judges          enable row level security;
alter table musabaqa.checkins                enable row level security;
alter table musabaqa.score_criteria          enable row level security;
alter table musabaqa.scoring_rules           enable row level security;
alter table musabaqa.judge_scores            enable row level security;
alter table musabaqa.score_corrections       enable row level security;
alter table musabaqa.results                 enable row level security;
alter table musabaqa.certificates            enable row level security;
alter table musabaqa.audit_logs              enable row level security;


-- =====================================================================
-- 12. RLS POLICIES
-- =====================================================================

-- ---- user_roles ----
create policy "user_roles_self_read" on musabaqa.user_roles for select
  using (user_id = auth.uid());
create policy "user_roles_super_admin_all" on musabaqa.user_roles for all
  using (musabaqa_internal.is_super_admin())
  with check (musabaqa_internal.is_super_admin());

-- ---- Qur'an: world-readable, insert-only by super_admin, NEVER updatable ----
-- There is deliberately no UPDATE or DELETE policy on surahs/ayahs: the
-- Qur'anic text is immutable once imported. Correcting it means a
-- controlled re-import, not an in-place edit.
create policy "quran_sources_public_read" on musabaqa.quran_sources for select using (true);
create policy "surahs_public_read" on musabaqa.surahs for select using (true);
create policy "ayahs_public_read" on musabaqa.ayahs for select using (true);
create policy "quran_sources_super_admin_insert" on musabaqa.quran_sources for insert
  with check (musabaqa_internal.is_super_admin());
create policy "surahs_super_admin_insert" on musabaqa.surahs for insert
  with check (musabaqa_internal.is_super_admin());
create policy "ayahs_super_admin_insert" on musabaqa.ayahs for insert
  with check (musabaqa_internal.is_super_admin());

-- ---- competitions ----
create policy "competitions_public_read" on musabaqa.competitions for select
  using (visibility = 'PUBLIC' and status <> 'DRAFT');
create policy "competitions_admin_read" on musabaqa.competitions for select
  using (musabaqa_internal.is_admin_of_competition(id));
create policy "competitions_super_admin_write" on musabaqa.competitions for insert
  with check (musabaqa_internal.is_super_admin());
create policy "competitions_admin_update" on musabaqa.competitions for update
  using (musabaqa_internal.is_admin_of_competition(id));

-- ---- competition_admins ----
create policy "competition_admins_super_admin_all" on musabaqa.competition_admins for all
  using (musabaqa_internal.is_super_admin()) with check (musabaqa_internal.is_super_admin());
create policy "competition_admins_self_read" on musabaqa.competition_admins for select
  using (user_id = auth.uid());

-- ---- competition_categories ----
create policy "categories_public_read" on musabaqa.competition_categories for select
  using (
    status = 'ACTIVE'
    and exists (
      select 1 from musabaqa.competitions c
      where c.id = competition_id and c.visibility = 'PUBLIC' and c.status <> 'DRAFT'
    )
  );
create policy "categories_admin_all" on musabaqa.competition_categories for all
  using (musabaqa_internal.is_admin_of_competition(competition_id))
  with check (musabaqa_internal.is_admin_of_competition(competition_id));
create policy "categories_judge_read" on musabaqa.competition_categories for select
  using (musabaqa_internal.is_judge_of_competition(competition_id, id));

-- ---- participants ----
create policy "participants_self_read" on musabaqa.participants for select
  using (user_id = auth.uid());
create policy "participants_self_update" on musabaqa.participants for update
  using (user_id = auth.uid());
create policy "participants_public_register" on musabaqa.participants for insert
  with check (true);  -- public self-service registration; server route validates
create policy "participants_super_admin_all" on musabaqa.participants for select
  using (musabaqa_internal.is_super_admin());
create policy "participants_admin_read_via_competition" on musabaqa.participants for select
  using (
    exists (
      select 1 from musabaqa.participant_competitions pc
      where pc.participant_id = participants.id
        and musabaqa_internal.is_admin_of_competition(pc.competition_id)
    )
  );
create policy "participants_admin_update_via_competition" on musabaqa.participants for update
  using (
    exists (
      select 1 from musabaqa.participant_competitions pc
      where pc.participant_id = participants.id
        and musabaqa_internal.is_admin_of_competition(pc.competition_id)
    )
  );
create policy "participants_judge_read_via_session" on musabaqa.participants for select
  using (
    exists (
      select 1 from musabaqa.competition_sessions s
      where s.participant_id = participants.id
        and musabaqa_internal.is_judge_of_competition(s.competition_id, s.category_id)
    )
  );
-- Public certificate verification needs the participant's NAME. Scoped so
-- only participants who already hold an issued certificate are visible —
-- a registered participant with no certificate stays fully private.
create policy "participants_public_read_via_certificate" on musabaqa.participants for select
  using (exists (select 1 from musabaqa.certificates c where c.participant_id = participants.id));

-- ---- participant_competitions ----
create policy "partcomp_self_read" on musabaqa.participant_competitions for select
  using (participant_id = musabaqa_internal.current_participant_id());
create policy "partcomp_admin_all" on musabaqa.participant_competitions for all
  using (musabaqa_internal.is_admin_of_competition(competition_id))
  with check (musabaqa_internal.is_admin_of_competition(competition_id));
create policy "partcomp_judge_read" on musabaqa.participant_competitions for select
  using (musabaqa_internal.is_judge_of_competition(competition_id, category_id));
create policy "partcomp_public_insert" on musabaqa.participant_competitions for insert
  with check (participant_id = musabaqa_internal.current_participant_id());

-- ---- judges ----
create policy "judges_self_read" on musabaqa.judges for select using (user_id = auth.uid());
create policy "judges_super_admin_all" on musabaqa.judges for all
  using (musabaqa_internal.is_super_admin()) with check (musabaqa_internal.is_super_admin());
-- Wrapped in a function to avoid recursion with judge_assignments' policies.
create policy "judges_admin_read" on musabaqa.judges for select
  using (musabaqa_internal.judge_has_admin_assignment(id));
-- Any competition admin may browse/manage the judge pool — otherwise it's
-- impossible to assign a judge for the first time (chicken-and-egg).
create policy "judges_any_admin_read" on musabaqa.judges for select
  using (
    musabaqa_internal.is_super_admin()
    or exists (select 1 from musabaqa.competition_admins ca where ca.user_id = auth.uid())
  );
create policy "judges_any_admin_write" on musabaqa.judges for insert
  with check (
    musabaqa_internal.is_super_admin()
    or exists (select 1 from musabaqa.competition_admins ca where ca.user_id = auth.uid())
  );
create policy "judges_any_admin_update" on musabaqa.judges for update
  using (
    musabaqa_internal.is_super_admin()
    or exists (select 1 from musabaqa.competition_admins ca where ca.user_id = auth.uid())
  );

-- ---- judge_assignments ----
-- Wrapped in a function to avoid recursion with judges' policies.
create policy "judgeassign_self_read" on musabaqa.judge_assignments for select
  using (musabaqa_internal.judge_row_is_caller(judge_id));
create policy "judgeassign_admin_all" on musabaqa.judge_assignments for all
  using (musabaqa_internal.is_admin_of_competition(competition_id))
  with check (musabaqa_internal.is_admin_of_competition(competition_id));

-- ---- questions (never expose the full bank to any client) ----
create policy "questions_admin_all" on musabaqa.questions for all
  using (
    exists (
      select 1 from musabaqa.competition_categories cc
      where cc.id = category_id and musabaqa_internal.is_admin_of_competition(cc.competition_id)
    )
  )
  with check (
    exists (
      select 1 from musabaqa.competition_categories cc
      where cc.id = category_id and musabaqa_internal.is_admin_of_competition(cc.competition_id)
    )
  );

-- ---- question_assignments ----
create policy "qassign_self_read" on musabaqa.question_assignments for select
  using (participant_id = musabaqa_internal.current_participant_id());
create policy "qassign_admin_all" on musabaqa.question_assignments for all
  using (musabaqa_internal.is_admin_of_competition(competition_id))
  with check (musabaqa_internal.is_admin_of_competition(competition_id));
create policy "qassign_judge_read" on musabaqa.question_assignments for select
  using (musabaqa_internal.is_judge_of_competition(competition_id));

-- ---- competition_sessions ----
create policy "sessions_admin_all" on musabaqa.competition_sessions for all
  using (musabaqa_internal.is_admin_of_competition(competition_id))
  with check (musabaqa_internal.is_admin_of_competition(competition_id));
create policy "sessions_judge_read_update" on musabaqa.competition_sessions for select
  using (musabaqa_internal.is_judge_of_competition(competition_id, category_id));
create policy "sessions_judge_update" on musabaqa.competition_sessions for update
  using (musabaqa_internal.is_judge_of_competition(competition_id, category_id));
create policy "sessions_self_read" on musabaqa.competition_sessions for select
  using (participant_id = musabaqa_internal.current_participant_id());

-- ---- session_judges ----
create policy "sessionjudges_admin_all" on musabaqa.session_judges for all
  using (exists (select 1 from musabaqa.competition_sessions s
                 where s.id = session_id and musabaqa_internal.is_admin_of_competition(s.competition_id)))
  with check (exists (select 1 from musabaqa.competition_sessions s
                      where s.id = session_id and musabaqa_internal.is_admin_of_competition(s.competition_id)));
create policy "sessionjudges_self_read" on musabaqa.session_judges for select
  using (musabaqa_internal.judge_row_is_caller(judge_id));

-- ---- checkins ----
create policy "checkins_admin_judge_all" on musabaqa.checkins for all
  using (
    exists (select 1 from musabaqa.competition_sessions s
            where s.id = session_id
              and (musabaqa_internal.is_admin_of_competition(s.competition_id)
                   or musabaqa_internal.is_judge_of_competition(s.competition_id, s.category_id)))
  )
  with check (
    exists (select 1 from musabaqa.competition_sessions s
            where s.id = session_id
              and (musabaqa_internal.is_admin_of_competition(s.competition_id)
                   or musabaqa_internal.is_judge_of_competition(s.competition_id, s.category_id)))
  );
create policy "checkins_self_read" on musabaqa.checkins for select
  using (participant_id = musabaqa_internal.current_participant_id());

-- ---- score_criteria / scoring_rules ----
create policy "criteria_admin_all" on musabaqa.score_criteria for all
  using (exists (select 1 from musabaqa.competition_categories cc
                 where cc.id = category_id and musabaqa_internal.is_admin_of_competition(cc.competition_id)))
  with check (exists (select 1 from musabaqa.competition_categories cc
                      where cc.id = category_id and musabaqa_internal.is_admin_of_competition(cc.competition_id)));
create policy "criteria_judge_read" on musabaqa.score_criteria for select
  using (exists (select 1 from musabaqa.competition_categories cc
                 where cc.id = category_id and musabaqa_internal.is_judge_of_competition(cc.competition_id, cc.id)));
create policy "rules_admin_all" on musabaqa.scoring_rules for all
  using (exists (select 1 from musabaqa.score_criteria sc
                 join musabaqa.competition_categories cc on cc.id = sc.category_id
                 where sc.id = criterion_id and musabaqa_internal.is_admin_of_competition(cc.competition_id)))
  with check (exists (select 1 from musabaqa.score_criteria sc
                      join musabaqa.competition_categories cc on cc.id = sc.category_id
                      where sc.id = criterion_id and musabaqa_internal.is_admin_of_competition(cc.competition_id)));
create policy "rules_judge_read" on musabaqa.scoring_rules for select
  using (exists (select 1 from musabaqa.score_criteria sc
                 join musabaqa.competition_categories cc on cc.id = sc.category_id
                 where sc.id = criterion_id and musabaqa_internal.is_judge_of_competition(cc.competition_id, cc.id)));

-- ---- judge_scores ----
-- A judge may write only their OWN scores, and only while unlocked.
-- Admins retain full access for the audited correction workflow.
create policy "judgescores_own_write" on musabaqa.judge_scores for insert
  with check (musabaqa_internal.judge_row_is_caller(judge_id));
create policy "judgescores_own_update_unlocked" on musabaqa.judge_scores for update
  using (locked = false and musabaqa_internal.judge_row_is_caller(judge_id));
create policy "judgescores_own_read" on musabaqa.judge_scores for select
  using (musabaqa_internal.judge_row_is_caller(judge_id));
create policy "judgescores_admin_all" on musabaqa.judge_scores for all
  using (exists (select 1 from musabaqa.competition_sessions s
                 where s.id = session_id and musabaqa_internal.is_admin_of_competition(s.competition_id)))
  with check (exists (select 1 from musabaqa.competition_sessions s
                      where s.id = session_id and musabaqa_internal.is_admin_of_competition(s.competition_id)));

-- ---- score_corrections ----
create policy "corrections_admin_all" on musabaqa.score_corrections for all
  using (exists (select 1 from musabaqa.judge_scores js
                 join musabaqa.competition_sessions s on s.id = js.session_id
                 where js.id = judge_score_id and musabaqa_internal.is_admin_of_competition(s.competition_id)))
  with check (exists (select 1 from musabaqa.judge_scores js
                      join musabaqa.competition_sessions s on s.id = js.session_id
                      where js.id = judge_score_id and musabaqa_internal.is_admin_of_competition(s.competition_id)));
create policy "corrections_judge_read" on musabaqa.score_corrections for select
  using (exists (select 1 from musabaqa.judge_scores js
                 where js.id = judge_score_id and musabaqa_internal.judge_row_is_caller(js.judge_id)));

-- ---- results ----
create policy "results_public_read" on musabaqa.results for select
  using (
    published = true
    and exists (select 1 from musabaqa.competitions c
                where c.id = competition_id and c.result_visibility <> 'HIDDEN')
  );
create policy "results_self_read" on musabaqa.results for select
  using (participant_id = musabaqa_internal.current_participant_id());
create policy "results_admin_all" on musabaqa.results for all
  using (musabaqa_internal.is_admin_of_competition(competition_id))
  with check (musabaqa_internal.is_admin_of_competition(competition_id));

-- ---- certificates ----
create policy "certificates_public_read" on musabaqa.certificates for select using (true);
create policy "certificates_admin_all" on musabaqa.certificates for all
  using (musabaqa_internal.is_admin_of_competition(competition_id))
  with check (musabaqa_internal.is_admin_of_competition(competition_id));

-- ---- audit_logs ----
create policy "audit_insert_any_authenticated" on musabaqa.audit_logs for insert
  with check (auth.uid() is not null);
create policy "audit_super_admin_read" on musabaqa.audit_logs for select
  using (musabaqa_internal.is_super_admin());


-- =====================================================================
-- 13. GRANTS
-- =====================================================================
--
-- EASY TO MISS: RLS policies are NOT sufficient on their own. Postgres
-- checks ordinary table privileges BEFORE it ever evaluates RLS, so
-- without these grants every API request fails with a permission error
-- no matter how permissive the policies are. Supabase does this
-- automatically for the "public" schema; a custom schema needs it doing
-- explicitly.

grant usage on schema musabaqa to anon, authenticated, service_role;
grant usage on schema musabaqa_internal to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema musabaqa to anon, authenticated;
grant all on all tables in schema musabaqa to service_role;
grant usage, select on all sequences in schema musabaqa to anon, authenticated, service_role;
grant execute on all functions in schema musabaqa to anon, authenticated, service_role;
grant execute on all functions in schema musabaqa_internal to anon, authenticated, service_role;

alter default privileges in schema musabaqa
  grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema musabaqa
  grant all on tables to service_role;
alter default privileges in schema musabaqa
  grant usage, select on sequences to anon, authenticated, service_role;
alter default privileges in schema musabaqa
  grant execute on functions to anon, authenticated, service_role;
alter default privileges in schema musabaqa_internal
  grant execute on functions to anon, authenticated, service_role;


-- =====================================================================
-- NOTES / GOTCHAS (learned the hard way during deployment)
-- =====================================================================
--
-- 1. EXPOSED SCHEMAS (dashboard only, cannot be set via SQL)
--    Settings → API → Exposed schemas must include "musabaqa", and its
--    tables must be exposed too. Symptom if missed: every query fails and
--    PostgREST's log reports far fewer relations than you have tables.
--
-- 2. SUPABASE_URL MUST BE THE BARE PROJECT URL
--    Use https://<ref>.supabase.co — NOT the Data API page's
--    https://<ref>.supabase.co/rest/v1/ which the dashboard shows with a
--    Copy button. The client appends /rest/v1 and /auth/v1 itself;
--    including it produces doubled paths (/rest/v1/rest/v1/...) that 404,
--    breaking both data access AND login with misleading error messages.
--
-- 3. RLS RECURSION
--    Any policy on table A that checks table B, where B's policies check A,
--    causes "infinite recursion detected in policy". Always route
--    cross-table checks through a SECURITY DEFINER function.
--
-- 4. SCHEMA MOVES DON'T REWRITE FUNCTION BODIES
--    ALTER FUNCTION ... SET SCHEMA relocates the function but leaves
--    hardcoded schema-qualified calls inside OTHER function bodies
--    pointing at the old location. RLS policies are fine (they bind by
--    OID); function-to-function calls are not.
--
-- 5. A COMPETITION IN 'DRAFT' IS INVISIBLE PUBLICLY
--    competitions_public_read requires status <> 'DRAFT'. A competition
--    left in DRAFT has no public page and therefore no Register button —
--    which looks like "registration is broken" rather than a status issue.


-- =====================================================================
-- BOOTSTRAP: create the first super_admin
-- =====================================================================
-- There is no one to grant this through the UI on a fresh database, so it
-- must be done once by hand. Create the user first in
-- Authentication → Users (tick "Auto Confirm User"), copy their UID, then:
--
--   insert into musabaqa.user_roles (user_id, role)
--   values ('PASTE-USER-UUID-HERE', 'super_admin');
--
-- Every admin and judge after that can be added through /admin/roles and
-- /admin/judges in the app.
