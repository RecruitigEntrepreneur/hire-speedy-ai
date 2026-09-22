-- Partnerstatus „Matchunt Partner“ (Etappe 3, freigegeben 22.09.2026): Partnernummer,
-- öffentliche Prüfseite, Einwilligungen, „Ist eingerichtet“ je Stelle.
-- Läuft nicht automatisch: in Lovable ausdrücklich anstoßen, NACH 20260922120000_recruiter_profile_stage2.sql.

create extension if not exists pgcrypto with schema extensions;

-- 1. Partnernummer MP-XXXX-XXXX ohne 0, 1, I, L, O, U: nicht erratbar, nicht verwechselbar.
--    Bytes ab 240 werden verworfen, damit jedes der 30 Zeichen gleich wahrscheinlich ist.
create or replace function public.recruiter_partner_number()
returns text
language plpgsql
volatile
set search_path = public, extensions
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTVWXYZ';
  bytes bytea := extensions.gen_random_bytes(32);
  result text := '';
  i int := 0;
  b int;
begin
  while length(result) < 8 loop
    if i >= 32 then
      bytes := extensions.gen_random_bytes(32);
      i := 0;
    end if;
    b := get_byte(bytes, i);
    i := i + 1;
    if b < 240 then
      result := result || substr(alphabet, (b % 30) + 1, 1);
    end if;
  end loop;
  return 'MP-' || substr(result, 1, 4) || '-' || substr(result, 5, 4);
end;
$$;

-- 2. Ein Status je Konto. Schreiben nur die Edge Functions (Service-Rolle): verliehen bei der
--    Freischaltung, beendet von Matchunt; der Headhunter ändert nur Einwilligungen und Einrichtung.
create table if not exists public.recruiter_partner_status (
  user_id uuid primary key references auth.users(id) on delete cascade,
  partner_number text not null unique default public.recruiter_partner_number()
    check (partner_number ~ '^MP-[2-9A-HJKMNP-TV-Z]{4}-[2-9A-HJKMNP-TV-Z]{4}$'),
  tier text not null default 'partner' check (tier in ('partner', 'gold')),
  contract_version text not null,
  granted_at timestamptz not null default now(),
  ended_at timestamptz,
  end_reason text check (end_reason in ('revoked', 'contract_ended')),
  directory_consent_at timestamptz,
  show_expertise_at timestamptz,
  channels jsonb not null default '{}'::jsonb,
  website_domain text,
  website_seen_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint recruiter_partner_status_end check ((ended_at is null) = (end_reason is null))
);

comment on table public.recruiter_partner_status is 'Partnerstatus „Matchunt Partner“ ab Vertrag 2.1 (Anlage 6). Öffentlich nur über die Function partner-check.';
comment on column public.recruiter_partner_status.granted_at is 'Partner seit: Gegenzeichnung des ersten Vertrags ab 2.1.';
comment on column public.recruiter_partner_status.directory_consent_at is 'Einwilligung ins öffentliche Partnerverzeichnis; null = keine. Die Verzeichnisseite folgt.';
comment on column public.recruiter_partner_status.show_expertise_at is 'Einwilligung, die Schwerpunkte auf der Prüfseite zu zeigen; null = keine.';
comment on column public.recruiter_partner_status.channels is 'Selbst gemeldete Einrichtung: {"linkedin"|"signature"|"post": Zeitstempel}.';
comment on column public.recruiter_partner_status.website_domain is 'Website, auf der das Abzeichen zuletzt geladen wurde (nur Domain, keine Besucherdaten).';

alter table public.recruiter_partner_status enable row level security;

drop policy if exists "Headhunter sehen ihren Partnerstatus" on public.recruiter_partner_status;
create policy "Headhunter sehen ihren Partnerstatus" on public.recruiter_partner_status
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "Admins sehen alle Partnerstatus" on public.recruiter_partner_status;
create policy "Admins sehen alle Partnerstatus" on public.recruiter_partner_status
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- 3. Nachtragen für alle, die schon freigeschaltet sind und einen gegengezeichneten Vertrag ab 2.1 haben.
--    „Partner seit“ ist die erste Gegenzeichnung. Altverträge bekommen den Status erst mit 2.1.
insert into public.recruiter_partner_status (user_id, contract_version, granted_at)
select distinct on (c.claimed_by) c.claimed_by, e.package_version, coalesce(e.countersigned_at, now())
from public.recruiter_contract_envelopes e
join public.recruiter_onboarding_cases c on c.id = e.case_id
join public.user_roles r on r.user_id = c.claimed_by and r.role = 'recruiter' and r.verified = true
where e.state = 'completed'
  and c.state = 'approved'
  and c.revoked_at is null
  and c.claimed_by is not null
  and e.package_version ~ '^\d+(\.\d+)*$'
  and string_to_array(e.package_version, '.')::int[] >= array[2, 1]
order by c.claimed_by, e.countersigned_at asc nulls last
on conflict (user_id) do nothing;
