-- A website signup has no inviting admin. Do not fabricate an admin approval.
alter table public.recruiter_onboarding_cases
  add column entry_source text not null default 'invitation' check (entry_source in ('invitation','website')),
  alter column created_by drop not null;
alter table public.recruiter_onboarding_cases add constraint recruiter_entry_creator check (
  (entry_source='invitation' and created_by is not null) or
  (entry_source='website' and created_by is null and claimed_by is not null)
);
create unique index recruiter_one_website_case_per_user
  on public.recruiter_onboarding_cases(claimed_by) where entry_source='website';
alter table public.recruiter_contract_envelopes alter column approved_by drop not null;

create function public.recruiter_entry_source_guard() returns trigger
language plpgsql set search_path=public as $$
begin
  if new.entry_source is distinct from old.entry_source then
    raise exception 'Onboarding entry source is immutable';
  end if;
  return new;
end;
$$;
create trigger recruiter_entry_source_guard before update on public.recruiter_onboarding_cases
  for each row execute function public.recruiter_entry_source_guard();
revoke all on function public.recruiter_entry_source_guard() from public;
