-- Additive recruiter invitation / contracting workflow. No legacy account is
-- completed, re-verified or migrated by this migration. All writes go through
-- authenticated Edge Functions; browser clients cannot approve themselves.
create table public.recruiter_onboarding_cases (
  id uuid primary key default gen_random_uuid(),
  revision integer not null default 0,
  kind text not null check (kind in ('individual', 'agency')),
  email text not null check (email = lower(trim(email))),
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  claimed_by uuid references auth.users(id),
  claimed_at timestamptz,
  contract_template_hash text,
  profile jsonb not null default '{}'::jsonb,
  internal_note text not null default '',
  feedback text not null default '',
  state text not null default 'invited' check (state in ('invited','draft','review','approved')),
  checks jsonb not null default '{}'::jsonb,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  last_mail_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((claimed_by is null) = (claimed_at is null)),
  check (state = 'invited' or claimed_by is not null),
  check (state <> 'approved' or (reviewed_by is not null and reviewed_at is not null
    and checks @> '{"identity":true,"business":true,"tax":true,"authority":true,"privacy":true}'::jsonb
    and (kind <> 'agency' or checks @> '{"user_authority":true}'::jsonb)))
);

-- Contract v2.1 calendar rule, kept equivalent to recruiter-deadline.ts.
create function public.recruiter_counter_deadline(signed_at timestamptz) returns timestamptz
language plpgsql immutable strict set search_path = public as $$
declare
  last_day date := (signed_at at time zone 'Europe/Berlin')::date + 30;
  y integer; a integer; b integer; c integer; d integer; e integer; f integer; g integer;
  h integer; i integer; k integer; l integer; m integer; n integer; easter_day date;
begin
  loop
    y := extract(year from last_day)::integer;
    a := y % 19; b := y / 100; c := y % 100; d := b / 4; e := b % 4;
    f := (b + 8) / 25; g := (b - f + 1) / 3;
    h := (19 * a + b - d - g + 15) % 30; i := c / 4; k := c % 4;
    l := (32 + 2 * e + 2 * i - h - k) % 7; m := (a + 11 * h + 22 * l) / 451;
    n := h + l - 7 * m + 114;
    easter_day := make_date(y, n / 31, n % 31 + 1);
    exit when extract(isodow from last_day) < 6
      and to_char(last_day,'MM-DD') not in ('01-01','01-06','05-01','08-15','10-03','11-01','12-25','12-26')
      and last_day not in (easter_day-2,easter_day+1,easter_day+39,easter_day+50,easter_day+60);
    last_day := last_day + 1;
  end loop;
  return (last_day + 1)::timestamp at time zone 'Europe/Berlin';
end;
$$;

create table public.recruiter_contract_envelopes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.recruiter_onboarding_cases(id),
  revision integer not null default 0,
  package_version text not null,
  source_reference text not null,
  snapshot jsonb not null,
  documents jsonb not null check (jsonb_typeof(documents) = 'array'),
  approved_by uuid not null references auth.users(id),
  approved_at timestamptz not null default now(),
  recruiter_client_user_id uuid references auth.users(id),
  counter_user_id uuid not null references auth.users(id),
  counter_name text not null,
  counter_email text not null,
  state text not null default 'prepared' check (state in
    ('prepared','creating','sent','completed','declined','voided','manual_review')),
  closure_reason text,
  transaction_id uuid not null default gen_random_uuid() unique,
  create_started_at timestamptz,
  envelope_id text unique,
  recruiter_signed_at timestamptz,
  countersigned_at timestamptz,
  signed_document_path text,
  signed_document_sha256 text,
  certificate_path text,
  certificate_sha256 text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (countersigned_at is null or recruiter_signed_at is not null),
  check (state <> 'completed' or (envelope_id is not null and recruiter_signed_at is not null
    and countersigned_at is not null and countersigned_at >= recruiter_signed_at
    and countersigned_at < public.recruiter_counter_deadline(recruiter_signed_at)
    and signed_document_path is not null and signed_document_sha256 is not null
    and certificate_path is not null and certificate_sha256 is not null))
);
create unique index recruiter_contract_one_live_per_case
  on public.recruiter_contract_envelopes(case_id)
  where state not in ('declined','voided');

create function public.recruiter_contract_insert_guard() returns trigger
language plpgsql set search_path = public as $$
declare c public.recruiter_onboarding_cases;
begin
  -- Serialize package release with corrections, not just with other releases.
  select * into c from public.recruiter_onboarding_cases where id = new.case_id for update;
  if c.state not in ('review','approved') or c.claimed_by is null or c.revoked_at is not null or new.snapshot is distinct from c.profile then
    raise exception 'Only the confirmed current profile may enter a contract package';
  end if;
  if new.recruiter_client_user_id is not null and (
    new.recruiter_client_user_id is distinct from c.claimed_by
    or lower(trim(new.snapshot->>'signerEmail')) is distinct from c.email
  ) then
    raise exception 'Embedded signing must belong to the claimed recipient account';
  end if;
  return new;
end;
$$;
create trigger recruiter_contract_insert_guard before insert on public.recruiter_contract_envelopes
  for each row execute function public.recruiter_contract_insert_guard();
revoke all on function public.recruiter_contract_insert_guard() from public;

create table public.recruiter_onboarding_audit (
  id bigint generated always as identity primary key,
  case_id uuid not null references public.recruiter_onboarding_cases(id),
  envelope_record_id uuid references public.recruiter_contract_envelopes(id),
  event text not null,
  revision integer not null,
  occurred_at timestamptz not null default now()
);

alter table public.recruiter_onboarding_cases enable row level security;
alter table public.recruiter_contract_envelopes enable row level security;
alter table public.recruiter_onboarding_audit enable row level security;
revoke all on public.recruiter_onboarding_cases, public.recruiter_contract_envelopes,
  public.recruiter_onboarding_audit from anon, authenticated;
grant all on public.recruiter_onboarding_cases, public.recruiter_contract_envelopes,
  public.recruiter_onboarding_audit to service_role;
grant usage, select on sequence public.recruiter_onboarding_audit_id_seq to service_role;

create function public.recruiter_onboarding_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.revision <> old.revision + 1 then
    raise exception 'Concurrent update: reload the recruiter onboarding record' using errcode = '40001';
  end if;
  if tg_table_name = 'recruiter_contract_envelopes' then
    if (new.countersigned_at is not null or new.state = 'completed') and not exists (
      select 1 from public.recruiter_onboarding_cases where id=new.case_id and state='approved' and revoked_at is null
    ) then raise exception 'Matchunt review must precede confirmed countersignature'; end if;
    if row(new.case_id,new.snapshot,new.documents,new.package_version,new.source_reference,
      new.approved_by,new.approved_at,new.recruiter_client_user_id,new.counter_user_id,new.counter_name,new.counter_email,new.transaction_id)
      is distinct from row(old.case_id,old.snapshot,old.documents,old.package_version,old.source_reference,
      old.approved_by,old.approved_at,old.recruiter_client_user_id,old.counter_user_id,old.counter_name,old.counter_email,old.transaction_id) then
      raise exception 'Released contract packages are immutable';
    end if;
    if (old.envelope_id is not null and new.envelope_id is distinct from old.envelope_id)
      or (old.recruiter_signed_at is not null and new.recruiter_signed_at is distinct from old.recruiter_signed_at)
      or (old.countersigned_at is not null and new.countersigned_at is distinct from old.countersigned_at) then
      raise exception 'Signing evidence is immutable';
    end if;
    if old.state in ('completed','declined','voided','manual_review') and new.state <> old.state then
      raise exception 'Terminal contract state is immutable';
    end if;
  else
    if row(new.kind,new.email,new.token_hash,new.created_by,new.created_at,new.contract_template_hash)
      is distinct from row(old.kind,old.email,old.token_hash,old.created_by,old.created_at,old.contract_template_hash) then
      raise exception 'Invitation identity is immutable';
    end if;
    if old.claimed_by is not null and row(new.claimed_by,new.claimed_at) is distinct from row(old.claimed_by,old.claimed_at) then
      raise exception 'Invitation ownership is immutable';
    end if;
    if exists (select 1 from public.recruiter_contract_envelopes e where e.case_id = old.id
      and e.state not in ('declined','voided'))
      and (new.profile is distinct from old.profile or new.state not in ('review','approved')) then
      raise exception 'Contract data is frozen; close the old envelope before corrections';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger recruiter_case_guard before update on public.recruiter_onboarding_cases
  for each row execute function public.recruiter_onboarding_guard();
create trigger recruiter_envelope_guard before update on public.recruiter_contract_envelopes
  for each row execute function public.recruiter_onboarding_guard();

create function public.recruiter_onboarding_log() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'recruiter_onboarding_cases' then
    insert into public.recruiter_onboarding_audit(case_id,event,revision)
      values(new.id, 'case.' || new.state, new.revision);
  else
    insert into public.recruiter_onboarding_audit(case_id,envelope_record_id,event,revision)
      values(new.case_id,new.id,'contract.' || new.state,new.revision);
  end if;
  return new;
end;
$$;
create trigger recruiter_case_log after insert or update on public.recruiter_onboarding_cases
  for each row execute function public.recruiter_onboarding_log();
create trigger recruiter_envelope_log after insert or update on public.recruiter_contract_envelopes
  for each row execute function public.recruiter_onboarding_log();
revoke all on function public.recruiter_onboarding_guard(), public.recruiter_onboarding_log() from public;

-- Private originals and signed evidence, served only through short-lived URLs
-- after case ownership/admin checks. No browser upload/write policy.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('recruiter-contracts','recruiter-contracts',false,10485760,array['application/pdf']);
