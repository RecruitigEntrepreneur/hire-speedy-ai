-- Mitarbeit an einer Kunden-Aufnahme (26.11.2026).
--
-- „Jemand anderes kennt die Stelle besser“: Der Kunde lädt eine Kollegin ein, die
-- Stelle zu beschreiben. Sie bekommt einen eigenen Zugang (intake_draft_tokens) mit
-- der Rolle 'beschreiben': Stelle ja, Kontakt, Paket, Anfrage und Vertrag nein.
-- Ihre E-Mail-Bestätigung gehört zu IHREM Zugang und ändert den Ansprechpartner der
-- Aufnahme nicht; „Fertig, zurück“ wird am Zugang vermerkt.
--
-- Nur neue Spalten, keine Daten. Bestehende Zugänge behalten die Rolle 'voll'.

alter table public.intake_draft_tokens
  add column if not exists rolle text not null default 'voll',
  add column if not exists bestaetigt_am timestamptz,
  add column if not exists bestaetigt_email text,
  add column if not exists zurueckgegeben_am timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'intake_draft_tokens_rolle_check'
  ) then
    alter table public.intake_draft_tokens
      add constraint intake_draft_tokens_rolle_check check (rolle in ('voll', 'beschreiben'));
  end if;
end $$;

comment on column public.intake_draft_tokens.rolle is
  'voll = darf alles (Erstbearbeiter, Entscheider); beschreiben = eingeladene Kollegin, nur die Stelle';
comment on column public.intake_draft_tokens.bestaetigt_am is
  'E-Mail-Bestätigung der eingeladenen Person (Rolle beschreiben), unabhängig vom Ansprechpartner';
comment on column public.intake_draft_tokens.zurueckgegeben_am is
  'Die eingeladene Person hat „Fertig, zurück“ gedrückt';

-- Codes einer eingeladenen Person gehören zu ihrem Zugang: so entwertet ihr Code
-- nicht den Code des Ansprechpartners und umgekehrt.
alter table public.intake_email_verifications
  add column if not exists token_id uuid references public.intake_draft_tokens(id) on delete set null;

create index if not exists intake_email_verifications_token_idx
  on public.intake_email_verifications (token_id);

create index if not exists intake_draft_tokens_draft_rolle_idx
  on public.intake_draft_tokens (draft_id, rolle);