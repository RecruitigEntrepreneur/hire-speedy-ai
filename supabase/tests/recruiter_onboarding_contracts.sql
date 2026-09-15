-- Run ONLY against a disposable, empty PostgreSQL database, not Supabase/live.
-- This fixture stubs auth/storage and rolls back every table/role/change.
\set ON_ERROR_STOP on
begin;
create role anon;
create role authenticated;
create role service_role;
create schema auth;
create schema storage;
create table auth.users(id uuid primary key);
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
\ir ../migrations/20260915170000_recruiter_onboarding_contracts.sql
\ir ../migrations/20260915190000_recruiter_website_entry.sql

do $$ begin
  if public.recruiter_counter_deadline('2026-09-15T10:00:00Z') <> '2026-10-15T22:00:00Z'::timestamptz
    or public.recruiter_counter_deadline('2026-08-27T10:00:00Z') <> '2026-09-28T22:00:00Z'::timestamptz
    or public.recruiter_counter_deadline('2026-09-25T10:00:00Z') <> '2026-10-26T23:00:00Z'::timestamptz
    or public.recruiter_counter_deadline('2026-03-05T10:00:00Z') <> '2026-04-07T22:00:00Z'::timestamptz
    or public.recruiter_counter_deadline('2026-12-02T10:00:00Z') <> '2027-01-04T23:00:00Z'::timestamptz
    or public.recruiter_counter_deadline('2026-09-14T22:30:00Z') <> '2026-10-15T22:00:00Z'::timestamptz then
    raise exception 'Munich calendar deadline differs from application policy';
  end if;
end; $$;

create function public.expect_rejection(statement text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then return;
  end;
  raise exception 'Expected rejection but statement succeeded: %', statement;
end;
$$;
insert into auth.users values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
insert into public.recruiter_onboarding_cases(id,kind,email,token_hash,expires_at,created_by,profile)
values ('10000000-0000-0000-0000-000000000001','agency','alex@example.test','hash',now()+interval '7 days','00000000-0000-0000-0000-000000000001','{"name":"Alex","company":"Test Agency"}');

-- Website cases have an owner but no fictitious inviting admin.
insert into public.recruiter_onboarding_cases(kind,email,token_hash,expires_at,entry_source,claimed_by,claimed_at,state)
values ('individual','website@example.test','website-hash',now(),'website','00000000-0000-0000-0000-000000000001',now(),'draft');
select public.expect_rejection('insert into public.recruiter_onboarding_cases(kind,email,token_hash,expires_at,entry_source,claimed_by,claimed_at,state) values (''individual'',''website@example.test'',''duplicate'',now(),''website'',''00000000-0000-0000-0000-000000000001'',now(),''draft'')');
select public.expect_rejection('update public.recruiter_onboarding_cases set entry_source=''invitation'',revision=1 where entry_source=''website''');
select public.expect_rejection('update public.recruiter_onboarding_cases set state=''approved'',revision=1 where entry_source=''website''');
delete from public.recruiter_onboarding_audit where case_id in(select id from public.recruiter_onboarding_cases where entry_source='website');
delete from public.recruiter_onboarding_cases where entry_source='website';

-- No direct reads, approvals or signature writes for a browser identity.
set local role authenticated;
select public.expect_rejection('select * from public.recruiter_onboarding_cases');
select public.expect_rejection('update public.recruiter_onboarding_cases set state=''approved''');
select public.expect_rejection('insert into public.recruiter_onboarding_audit(case_id,event,revision) values(''10000000-0000-0000-0000-000000000001'',''fake'',1)');
reset role;

-- CAS and verified-owner invariants.
select public.expect_rejection('update public.recruiter_onboarding_cases set revision=0');
select public.expect_rejection('update public.recruiter_onboarding_cases set revision=1,state=''draft''');
update public.recruiter_onboarding_cases set revision=1,state='review',claimed_by='00000000-0000-0000-0000-000000000002',claimed_at=now();
select public.expect_rejection('update public.recruiter_onboarding_cases set revision=2,claimed_by=''00000000-0000-0000-0000-000000000001''');
select public.expect_rejection('update public.recruiter_onboarding_cases set revision=2,email=''other@example.test''');

-- Even a service-side bug cannot skip the privacy / agency authority checks.
select public.expect_rejection('update public.recruiter_onboarding_cases set revision=2,state=''approved'',reviewed_by=''00000000-0000-0000-0000-000000000001'',reviewed_at=now(),checks=''{"identity":true,"business":true,"tax":true,"authority":true}''');
select public.expect_rejection('update public.recruiter_onboarding_cases set revision=2,state=''approved'',reviewed_by=''00000000-0000-0000-0000-000000000001'',reviewed_at=now(),checks=''{"identity":true,"business":true,"tax":true,"authority":true,"privacy":true}''');

insert into public.recruiter_contract_envelopes(id,case_id,package_version,source_reference,snapshot,documents,approved_by,counter_user_id,counter_name,counter_email)
values('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','test-v1','SQL fixture only','{"name":"Alex","company":"Test Agency"}','[]','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Test Admin','admin@example.test');
-- Recruiter may sign before review; Matchunt countersignature remains blocked.
select public.expect_rejection('update public.recruiter_contract_envelopes set revision=1,recruiter_signed_at=now(),countersigned_at=now()');
update public.recruiter_onboarding_cases set revision=2,state='approved',reviewed_by='00000000-0000-0000-0000-000000000001',reviewed_at=now(),checks='{"identity":true,"business":true,"tax":true,"authority":true,"privacy":true,"user_authority":true}';

select public.expect_rejection('update public.recruiter_onboarding_cases set revision=3,profile=''{"company":"Changed"}''');
select public.expect_rejection('update public.recruiter_contract_envelopes set revision=1,recruiter_client_user_id=''00000000-0000-0000-0000-000000000002''');
select public.expect_rejection('update public.recruiter_contract_envelopes set revision=1,snapshot=''{}''');
select public.expect_rejection('update public.recruiter_contract_envelopes set revision=1,documents=''[{"path":"replacement.pdf"}]''');
select public.expect_rejection('update public.recruiter_contract_envelopes set revision=1,state=''completed''');
select public.expect_rejection('update public.recruiter_contract_envelopes set revision=1,countersigned_at=now()');

update public.recruiter_contract_envelopes set revision=1,state='sent',envelope_id='provider-id',recruiter_signed_at='2026-09-15T10:00:00Z';
select public.expect_rejection('update public.recruiter_contract_envelopes set revision=2,recruiter_signed_at=now()');
select public.expect_rejection('update public.recruiter_contract_envelopes set revision=2,envelope_id=''replacement''');
select public.expect_rejection('update public.recruiter_contract_envelopes set revision=2,state=''completed'',countersigned_at=''2026-09-14T10:00:00Z'',signed_document_path=''test.pdf'',signed_document_sha256=''hash'',certificate_path=''certificate.pdf'',certificate_sha256=''hash''');
select public.expect_rejection('update public.recruiter_contract_envelopes set revision=2,state=''completed'',countersigned_at=''2026-10-15T22:00:00Z'',signed_document_path=''test.pdf'',signed_document_sha256=''hash'',certificate_path=''certificate.pdf'',certificate_sha256=''hash''');
update public.recruiter_contract_envelopes set revision=2,state='completed',countersigned_at='2026-09-16T10:00:00Z',signed_document_path='test.pdf',signed_document_sha256='hash',certificate_path='certificate.pdf',certificate_sha256='hash';
select public.expect_rejection('update public.recruiter_contract_envelopes set revision=3,state=''sent''');

do $$ begin
  if (select count(*) from public.recruiter_onboarding_audit) <> 6 then raise exception 'Audit entries missing or failed writes were logged'; end if;
  if (select public from storage.buckets where id='recruiter-contracts') then raise exception 'Contract bucket must be private'; end if;
  raise notice 'Recruiter onboarding SQL invariants passed';
end; $$;
rollback;
