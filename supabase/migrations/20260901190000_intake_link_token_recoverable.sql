-- ============================================================================
-- Aufnahme-Links wieder anzeigbar machen
-- ----------------------------------------------------------------------------
-- BEFUND aus dem Betrieb: Der Klartext-Token wurde genau einmal angezeigt --
--   direkt nach dem Anlegen. Wer das Fenster schliesst, kommt an seinen Link
--   nicht mehr heran und muss einen neuen erzeugen. Der alte laeuft dabei
--   unsichtbar weiter, weil ihn niemand widerruft. Aus einer Sicherheits-
--   massnahme wird so ein Hygieneproblem.
--
-- NEUBEWERTUNG DES RISIKOS: Ein Link-Token traegt die Vorbelegung (Firmenname,
--   Ansprechpartner, Aufhaenger) und erlaubt, eine Aufnahme zu BEGINNEN. Er
--   oeffnet keinen fremden Entwurf: intake-start legt bei jedem Aufruf einen
--   neuen Entwurf mit eigenem Token an. Die schuetzenswerten Daten --
--   Gehaltsbaender, interne Vakanzgruende, gescheiterte Suchversuche -- haengen
--   am ENTWURFS-Token in intake_draft_tokens, und der bleibt hash-only.
--
-- ENTSCHEIDUNG: Link-Token verschluesselt statt gehasht ablegen. Ein
--   Datenbank-Dump allein liefert damit weiterhin keine funktionierenden Links
--   (der Schluessel liegt in ENCRYPTION_KEY, nicht in der Datenbank), aber der
--   Admin kann seinen Link erneut anzeigen. Fuer den Fall, dass ein Link doch
--   abhandenkommt, gibt es zusaetzlich das Rotieren: neuer Token, alter sofort
--   ungueltig.
--
-- token_hash bleibt und bleibt der Suchschluessel -- der Abgleich in
-- intake-start aendert sich nicht.
--
-- Rein additiv.
-- ============================================================================

BEGIN;

ALTER TABLE public.intake_links
  ADD COLUMN IF NOT EXISTS token_encrypted   text,
  ADD COLUMN IF NOT EXISTS token_rotated_at  timestamptz,
  ADD COLUMN IF NOT EXISTS token_rotated_by  uuid;

COMMENT ON COLUMN public.intake_links.token_encrypted IS
  'Der Link-Token, AES-256-GCM verschluesselt mit ENCRYPTION_KEY (dasselbe '
  'Verfahren wie fuer die OAuth-Token der CRM-Integrationen). Erlaubt dem Admin, '
  'den Link erneut anzuzeigen. Ein Dump ohne den Schluessel ist wertlos. '
  'NICHT zu verwechseln mit intake_draft_tokens.token_hash: Entwurfs-Token '
  'bleiben hash-only, weil dort die vertraulichen Angaben haengen.';
COMMENT ON COLUMN public.intake_links.token_rotated_at IS
  'Wann der Token zuletzt ersetzt wurde. Beim Rotieren wird der alte sofort '
  'ungueltig -- der Hash aendert sich, der alte Link findet nichts mehr.';

-- Bestandslinks haben keinen verschluesselten Token; sie lassen sich nur
-- rotieren, nicht anzeigen. Das ist kein Fehler, sondern die Folge davon, dass
-- sie ueberhaupt nie speicherbar waren.

COMMIT;
