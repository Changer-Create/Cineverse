create table if not exists public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  feedback_type text not null default 'bug' check (feedback_type in ('bug','function','data','ui','other')),
  description text not null check (char_length(description) between 2 and 5000),
  reproduction_steps text check (reproduction_steps is null or char_length(reproduction_steps) <= 5000),
  expected_result text check (expected_result is null or char_length(expected_result) <= 5000),
  contact text check (contact is null or char_length(contact) <= 500),
  page_url text check (page_url is null or char_length(page_url) <= 2000),
  page_hash text check (page_hash is null or char_length(page_hash) <= 1000),
  browser text check (browser is null or char_length(browser) <= 1000),
  platform text check (platform is null or char_length(platform) <= 500),
  viewport text check (viewport is null or char_length(viewport) <= 100),
  app_version text check (app_version is null or char_length(app_version) <= 200),
  diagnostics jsonb not null default '{}'::jsonb,
  screenshot_path text check (screenshot_path is null or char_length(screenshot_path) <= 1000),
  status text not null default 'new' check (status in ('new','confirmed','fixing','fixed','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bug_reports_status_created_at_idx on public.bug_reports(status, created_at desc);
create index if not exists bug_reports_user_created_at_idx on public.bug_reports(user_id, created_at desc);

alter table public.bug_reports enable row level security;
revoke all on table public.bug_reports from anon, authenticated;
grant insert on table public.bug_reports to anon, authenticated;

create policy "bug_reports_anon_insert"
on public.bug_reports
for insert
to anon
with check (
  user_id is null
  and status = 'new'
  and screenshot_path is null
);

create policy "bug_reports_authenticated_insert"
on public.bug_reports
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and status = 'new'
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bug-report-screenshots',
  'bug-report-screenshots',
  false,
  4194304,
  array['image/png','image/jpeg','image/webp']
);

create policy "bug_report_screenshot_upload_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'bug-report-screenshots'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "bug_report_screenshot_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'bug-report-screenshots'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
