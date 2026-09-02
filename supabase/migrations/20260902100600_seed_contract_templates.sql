-- ============================================================================
-- Die Vertragstexte
-- ----------------------------------------------------------------------------
-- 20260902100100 legte contract_templates an, aber ohne Inhalt. Ohne aktiven
-- Text scheitert jede Anfrage mit 'not_deployed' -- intake-submit und
-- contract-admin verlangen beide eine aktive Fassung. Diese Migration fuellt
-- sie.
--
-- Zwei Dokumente:
--   framework  -- der Rahmenvertrag, einmal je Kunde
--   assignment -- der Einzelauftrag, je Position darunter
--
-- Die Preise stehen NICHT im Text. Sie kommen aus dem Preis-Snapshot des
-- Einzelauftrags und werden vom Dokumentengenerator als Datenblock davor
-- gesetzt. Stuenden sie im Text, gaebe es zwei Wahrheiten -- und die im Text
-- waere die, die niemand pflegt.
--
-- Der Text ist zu unseren Gunsten formuliert, aber ohne Schutzbehauptungen,
-- die einer Pruefung nicht standhalten: keine Zusicherung einer
-- Ersatzbesetzung, keine Haftungsfreizeichnung fuer Vorsatz und grobe
-- Fahrlaessigkeit, keine Verkuerzung zwingender Fristen.
-- ============================================================================

BEGIN;

INSERT INTO public.contract_templates (
  doc_type, version, is_active, language, title, body_md, body_sha256,
  vendor_vat_id, agb_version, effective_from
) VALUES (
'framework', 1, true, 'de',
'Rahmenvertrag über Personalvermittlung',
$md$
# Rahmenvertrag über Personalvermittlung

zwischen der Bluewater & Bridge GmbH, Adlzreiterstraße 2, 80337 München,
eingetragen im Handelsregister des Amtsgerichts München unter HRB 288632
(nachfolgend „Matchunt", zugleich die von der Gesellschaft geführte Marke),
und dem im Datenblatt bezeichneten Auftraggeber (nachfolgend „Auftraggeber").

## § 1 Gegenstand

(1) Matchunt vermittelt dem Auftraggeber Kandidatinnen und Kandidaten zur
Begründung eines eigenen Arbeits- oder Dienstverhältnisses. Eine
Arbeitnehmerüberlassung findet nicht statt.

(2) Dieser Rahmenvertrag regelt die für alle Einzelaufträge geltenden
Bedingungen. Die einzelne Position wird durch einen gesonderten Einzelauftrag
beauftragt, der auf diesen Rahmenvertrag Bezug nimmt.

(3) Aus diesem Rahmenvertrag folgt keine Pflicht des Auftraggebers, Positionen
zu beauftragen, und keine Pflicht von Matchunt, einen angetragenen
Einzelauftrag anzunehmen.

## § 2 Zustandekommen der Einzelaufträge

(1) Wählt der Auftraggeber in der Plattform ein Paket und übermittelt die
Beauftragungsanfrage, gibt er damit ein Angebot auf Abschluss eines
Einzelauftrags ab. Ein Vertrag kommt erst zustande, wenn Matchunt dieses
Angebot annimmt und beide Parteien den Einzelauftrag unterzeichnet haben.

(2) Die Darstellung der Pakete in der Plattform ist freibleibend.

(3) Die Reihenfolge der Unterzeichnung ist: zunächst der Auftraggeber, sodann
Matchunt. Der Einzelauftrag wird mit der Gegenzeichnung durch Matchunt wirksam.

## § 3 Leistungen von Matchunt

(1) Matchunt sucht, prüft und präsentiert geeignete Kandidatinnen und
Kandidaten und begleitet den Auswahlprozess.

(2) Matchunt schuldet ein sorgfältiges Bemühen, nicht den Vermittlungserfolg.
Eine Zusicherung, dass eine Besetzung zustande kommt, wird nicht abgegeben.

(3) Die Auswahlentscheidung sowie die arbeitsrechtliche Prüfung und Gestaltung
des Anstellungsverhältnisses obliegen allein dem Auftraggeber.

## § 4 Mitwirkung des Auftraggebers

(1) Der Auftraggeber stellt die für die Suche erforderlichen Informationen
vollständig und zutreffend zur Verfügung und benennt eine Ansprechperson.

(2) Der Auftraggeber gibt zu vorgestellten Kandidatinnen und Kandidaten
innerhalb angemessener Frist Rückmeldung und teilt Einstellungen unverzüglich
mit.

(3) Vorgestellte Personen dürfen ohne vorherige Zustimmung von Matchunt nicht
an Dritte weitergegeben werden.

## § 5 Vergütung

(1) Die Vergütung ist ein Erfolgshonorar. Sie entsteht, wenn zwischen dem
Auftraggeber oder einem mit ihm verbundenen Unternehmen und einer von Matchunt
vorgestellten Person innerhalb von zwölf Monaten nach der Vorstellung ein
Arbeits- oder Dienstverhältnis begründet wird.

(2) Höhe und Bemessungsgrundlage ergeben sich aus dem im Einzelauftrag
gewählten Paket. Bemessungsgrundlage ist das Bruttojahreszielgehalt aus dem
unterzeichneten Arbeitsvertrag einschließlich vereinbarter variabler
Bestandteile bei Zielerreichung.

(3) Die Vergütung ist zahlbar innerhalb der im Einzelauftrag genannten Frist ab
Rechnungsstellung ohne Abzug. Alle Beträge verstehen sich zuzüglich der
gesetzlichen Umsatzsteuer.

(4) Wird eine vorgestellte Person auf einer anderen als der ausgeschriebenen
Position eingestellt, entsteht die Vergütung ebenfalls; maßgeblich ist dann das
Bruttojahreszielgehalt der tatsächlich besetzten Position.

## § 6 Vertraulichkeit und Datenschutz

(1) Die Parteien behandeln alle im Rahmen der Zusammenarbeit erlangten
Informationen vertraulich.

(2) Die Verarbeitung personenbezogener Daten richtet sich nach der
Datenschutzerklärung von Matchunt und den anwendbaren gesetzlichen
Bestimmungen.

## § 7 Haftung

(1) Matchunt haftet unbeschränkt für Vorsatz und grobe Fahrlässigkeit sowie
für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit.

(2) Bei einfacher Fahrlässigkeit haftet Matchunt nur bei Verletzung einer
wesentlichen Vertragspflicht und begrenzt auf den vertragstypischen,
vorhersehbaren Schaden.

(3) Matchunt haftet nicht für die Eignung, Leistung oder das Verbleiben einer
vermittelten Person. Die Auswahlentscheidung trifft der Auftraggeber.

## § 8 Laufzeit

(1) Der Rahmenvertrag läuft auf unbestimmte Zeit und kann von beiden Parteien
mit einer Frist von vier Wochen zum Monatsende gekündigt werden.

(2) Bereits erteilte Einzelaufträge bleiben von einer Kündigung unberührt und
werden nach diesem Rahmenvertrag abgewickelt.

## § 9 Schlussbestimmungen

(1) Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des
UN-Kaufrechts.

(2) Ist der Auftraggeber Kaufmann, juristische Person des öffentlichen Rechts
oder öffentlich-rechtliches Sondervermögen, ist Gerichtsstand München.

(3) Änderungen und Ergänzungen bedürfen der Textform. Ergänzend gelten die
Allgemeinen Geschäftsbedingungen von Matchunt in der im Datenblatt genannten
Fassung. Bei Widersprüchen gehen die Regelungen dieses Rahmenvertrags und des
Einzelauftrags vor.

(4) Sollte eine Bestimmung unwirksam sein, bleibt der Vertrag im Übrigen
wirksam.
$md$,
'689d2bf9d5ada355d6fd63754ee796fc8835be91ecc1d7b892aff1533196bc07',
'DE365690081', '2026-06', CURRENT_DATE
),
(
'assignment', 1, true, 'de',
'Einzelauftrag zur Personalvermittlung',
$md$
# Einzelauftrag zur Personalvermittlung

Dieser Einzelauftrag ergänzt den zwischen den Parteien geschlossenen
Rahmenvertrag über Personalvermittlung. Position, gewähltes Paket, Honorarsatz
und Zahlungsziel ergeben sich aus dem vorangestellten Datenblatt.

## § 1 Beauftragung

(1) Der Auftraggeber beauftragt Matchunt mit der Suche und Vorstellung
geeigneter Kandidatinnen und Kandidaten für die im Datenblatt bezeichnete
Position.

(2) Der Einzelauftrag kommt zustande, wenn beide Parteien ihn unterzeichnet
haben. Die Reihenfolge ist: zunächst der Auftraggeber, sodann Matchunt.

## § 2 Vergütung

(1) Die Vergütung ist ein Erfolgshonorar in Höhe des im Datenblatt genannten
Prozentsatzes des Bruttojahreszielgehalts. Sie wird fällig, wenn ein Arbeits-
oder Dienstverhältnis mit einer vorgestellten Person zustande kommt.

(2) Maßgeblich ist das Bruttojahreszielgehalt aus dem unterzeichneten
Arbeitsvertrag. Ein zuvor in der Plattform angezeigter Betrag beruht auf der
Gehaltsangabe des Auftraggebers und ist eine unverbindliche Schätzung.

(3) Der Auftraggeber übermittelt Matchunt nach Vertragsschluss mit der
vermittelten Person die für die Abrechnung erforderlichen Angaben zum
vereinbarten Bruttojahreszielgehalt.

(4) Vor der Vermittlung entstehen keine Kosten. Es fällt kein Retainer und
keine Aufwandspauschale an.

## § 3 Continuity-Leistung

Diese Bestimmung gilt nur, wenn im Datenblatt ein Continuity-Zeitraum
ausgewiesen ist.

(1) Scheidet die vermittelte Person innerhalb des im Datenblatt genannten
Zeitraums ab dem ersten Arbeitstag aus dem Arbeitsverhältnis aus, führt
Matchunt einmalig einen erneuten Suchlauf für dieselbe Position durch.

(2) Für den erneuten Suchlauf entsteht kein weiteres Vermittlungshonorar.

(3) Der erneute Suchlauf ist ein Bemühen. Eine Zusicherung, dass eine
Ersatzbesetzung zustande kommt, wird nicht abgegeben. Ein Anspruch auf
Rückzahlung oder Minderung des Honorars besteht nicht.

(4) Der Anspruch setzt voraus, dass der Auftraggeber das Ausscheiden innerhalb
der im Datenblatt genannten Frist ab Kenntnis in Textform meldet und den Grund
benennt.

(5) Ein Anspruch besteht nicht, wenn das Ausscheiden auf einem der folgenden
Umstände beruht: betriebsbedingte Kündigung, Umstrukturierung, Wegfall oder
wesentliche Änderung der Position, wirtschaftlich begründete Trennung,
Nichterfüllung der Pflichten des Auftraggebers aus diesem Vertrag,
Zahlungsverzug oder fehlende Mitwirkung des Auftraggebers, sowie wenn das
tatsächlich gezahlte Entgelt hinter dem zugesagten zurückbleibt.

(6) Der erneute Suchlauf umfasst die im Datenblatt genannte Zahl aktiver
Suchtage. Als aktiv gelten Tage, an denen der Auftraggeber seinen
Mitwirkungspflichten nachkommt.

(7) Der Anspruch entsteht erst nach vollständigem Ausgleich der Rechnung für
die ursprüngliche Vermittlung.

## § 4 Laufzeit und Beendigung

(1) Der Einzelauftrag endet mit der Besetzung der Position oder durch Kündigung
in Textform mit einer Frist von zwei Wochen.

(2) Der Vergütungsanspruch nach § 2 bleibt für Personen bestehen, die vor der
Beendigung vorgestellt wurden.

## § 5 Ergänzende Geltung

Im Übrigen gelten der Rahmenvertrag über Personalvermittlung und die
Allgemeinen Geschäftsbedingungen von Matchunt in der im Datenblatt genannten
Fassung.
$md$,
'a599692fd5f974624a4dcbe91ed2b570bbb1a21f6c2236059773a8664b222477',
'DE365690081', '2026-06', CURRENT_DATE
)
ON CONFLICT (doc_type, version, language) DO NOTHING;

-- Die Pruefsummen stehen als Literale und werden NICHT in SQL gerechnet:
-- digest() gehoert zu pgcrypto, und keine einzige Migration in diesem Repo
-- setzt die Erweiterung voraus. Eine Migration, die an einer fehlenden
-- Erweiterung scheitert, waere ein schlechter Tausch fuer eine Bequemlichkeit.
-- Die Werte sind SHA-256 ueber den Text zwischen den $md$-Markierungen; wer
-- den Text aendert, muss den Hash mitaendern -- und genau das ist der Zweck.

COMMIT;
