-- Headhunter-Profil, Etappe 2 (freigegeben 22.09.2026): Foto, LinkedIn, Kontoinhaber,
-- aktuelle Schwerpunkte, Nachweise mit Prüfung durch Matchunt und Erinnerung vor Ablauf.
-- Läuft nicht automatisch: in Lovable ausdrücklich anstoßen.

-- 1. Profil: neue Felder. Der unterschriebene Vertrag behält seinen Stand; hier steht der aktuelle.
alter table public.profiles
  add column if not exists avatar_path text,
  add column if not exists linkedin_url text,
  add column if not exists bank_account_holder text,
  add column if not exists recruiter_expertise jsonb;

comment on column public.profiles.avatar_path is 'Foto im privaten Bucket recruiter-avatars; nur für den Headhunter selbst und Admins sichtbar.';
comment on column public.profiles.recruiter_expertise is 'Aktuelle Schwerpunkte des Headhunters. Der unterschriebene Vertrag behält den Stand der Unterschrift.';

-- 2. Nachweise. Schreiben nur über die Edge Functions (Service-Rolle): Status und Prüfung setzt niemand selbst.
create table if not exists public.recruiter_evidence (
  id uuid primary key default gen_random_uuid(),
  recruiter_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('business', 'insurance', 'authority', 'income')),
  file_path text,
  file_name text,
  declaration text check (declaration in ('below', 'above')),
  valid_until date,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reason text,
  uploaded_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  reminded_at timestamptz,
  -- Erklärung ohne Datei, alle anderen mit Datei.
  constraint recruiter_evidence_shape check (
    (kind = 'income' and declaration is not null and file_path is null)
    or (kind <> 'income' and file_path is not null and declaration is null)
  )
);

create index if not exists recruiter_evidence_by_recruiter on public.recruiter_evidence (recruiter_id, kind, uploaded_at desc);
create index if not exists recruiter_evidence_pending on public.recruiter_evidence (uploaded_at) where status = 'pending';

alter table public.recruiter_evidence enable row level security;

drop policy if exists "Headhunter sehen ihre Nachweise" on public.recruiter_evidence;
create policy "Headhunter sehen ihre Nachweise" on public.recruiter_evidence
  for select to authenticated using (recruiter_id = auth.uid());

drop policy if exists "Admins sehen alle Nachweise" on public.recruiter_evidence;
create policy "Admins sehen alle Nachweise" on public.recruiter_evidence
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- 3. Speicher: beide Buckets privat. Jeder Headhunter hat einen eigenen Ordner (erste Pfadstufe = Konto-ID).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('recruiter-avatars', 'recruiter-avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('recruiter-evidence', 'recruiter-evidence', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

drop policy if exists "Headhunter verwalten ihr Foto" on storage.objects;
create policy "Headhunter verwalten ihr Foto" on storage.objects
  for all to authenticated
  using (bucket_id = 'recruiter-avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'recruiter-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Admins sehen Headhunter-Fotos" on storage.objects;
create policy "Admins sehen Headhunter-Fotos" on storage.objects
  for select to authenticated using (bucket_id = 'recruiter-avatars' and public.has_role(auth.uid(), 'admin'));

drop policy if exists "Headhunter laden Nachweise hoch" on storage.objects;
create policy "Headhunter laden Nachweise hoch" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'recruiter-evidence' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Headhunter sehen ihre Nachweis-Dateien" on storage.objects;
create policy "Headhunter sehen ihre Nachweis-Dateien" on storage.objects
  for select to authenticated using (bucket_id = 'recruiter-evidence' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Admins sehen alle Nachweis-Dateien" on storage.objects;
create policy "Admins sehen alle Nachweis-Dateien" on storage.objects
  for select to authenticated using (bucket_id = 'recruiter-evidence' and public.has_role(auth.uid(), 'admin'));

-- 4. Täglich 06:00 UTC: Erinnerung 30 Tage vor Ablauf eines Nachweises (gleiches Muster wie die anderen Cron-Läufe).
select cron.schedule(
  'recruiter-evidence-reminder',
  '0 6 * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/recruiter-evidence-reminder',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
