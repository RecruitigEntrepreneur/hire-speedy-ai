-- ============================================================================
-- Vertragswerk v4: ein Rahmenvertrag für Festanstellung und Contracting
--
-- Entscheidungen 25.09.2026:
--   * EIN Rahmenvertrag mit Modul A (Festanstellung) und Modul B (Contracting),
--     beide ab Vertragsschluss gültig; je Position nur eine Auftragsbestätigung.
--   * Fassung 2 gilt sofort für alle Neukunden. Kunden mit Fassung 1 behalten
--     sie für Festanstellung; wer zum ersten Mal Contracting beauftragt,
--     unterschreibt Fassung 2 einmal (Ablösung, supersedes_id).
--   * Contracting läuft als eigener Auftrag ohne Paket: fee_basis
--     'day_rate_all_in', 22 % Marge / 11 % Recruiter (Innenseite).
--
-- Der Vertragstext ist Dokument 1 aus VERTRAGSWERK_MATCHUNT.md ohne die
-- Juristen-Vermerke. Die Prüfsummen sind SHA-256 über den Text zwischen den
-- Dollar-Markierungen (wie in 20260902100600, ohne pgcrypto).
-- ============================================================================

BEGIN;

-- ---- 1. Vorlagen Fassung 2 ---------------------------------------------------
-- Genau eine aktive Fassung je doc_type und Sprache (contract_templates_active_idx):
-- erst die alte abschalten, dann die neue einsetzen. Fassung 1 bleibt als Zeile
-- bestehen -- Bestandskunden mit Rahmenvertrag v1 bekommen ihre Einzelaufträge
-- weiter danach (intake-submit wählt die Vorlage nach der Fassung des Vertrags).
UPDATE public.contract_templates SET is_active = false
 WHERE language = 'de' AND is_active AND doc_type IN ('framework', 'assignment') AND version < 2;

INSERT INTO public.contract_templates (
  doc_type, version, is_active, language, title, body_md, body_sha256,
  vendor_legal_name, vendor_brand, vendor_street, vendor_postal_code, vendor_city,
  vendor_country, vendor_register, vendor_court, vendor_vat_id,
  agb_version, agb_sha256, effective_from
)
SELECT 'framework', 2, true, 'de',
       'Rahmenvertrag über Personaldienstleistungen',
       $vertrag$
# Rahmenvertrag über Personaldienstleistungen

**zwischen** der im Datenblatt genannten Gesellschaft, handelnd unter der Marke Matchunt – im Folgenden „Matchunt“ –

**und** dem im Datenblatt genannten Unternehmen, vertreten durch die dort genannte Person – im Folgenden „Auftraggeber“ –

Vertragsnummer, Datum, Parteien und Paket ergeben sich aus dem Datenblatt (Anlage 1).

# Teil I – Allgemeiner Teil

## § 1 Gegenstand und Begriffe

(1) Gegenstand dieses Vertrags sind zwei Leistungen von Matchunt: die Vermittlung von Kandidatinnen und Kandidaten zur Festanstellung beim Auftraggeber (Modul A, Teil II) und die Erbringung von Leistungen durch selbstständige Spezialisten im Auftrag des Auftraggebers (Modul B, Contracting, Teil III). Beide Module gelten ab Vertragsschluss. Welches Modul für eine Position gilt, richtet sich nach der bei der Einreichung gewählten Vertragsart. Eine Arbeitnehmerüberlassung findet nicht statt.

(2) Die Zusammenarbeit läuft über die Plattform von Matchunt. Dieser Vertrag regelt die Bedingungen für alle Positionen, die der Auftraggeber während der Laufzeit über die Plattform beauftragt. Bei jeder Position wählt der Auftraggeber die Vertragsart Festanstellung oder Contracting.

(3) Aus diesem Vertrag folgt keine Pflicht des Auftraggebers, Positionen zu beauftragen, und keine Pflicht von Matchunt, eine Position anzunehmen.

(4) Begriffe in diesem Vertrag:
- **Plattform**: die von Matchunt betriebene Anwendung einschließlich des Kundenportals und der darüber versandten Mitteilungen.
- **Position**: eine vom Auftraggeber über die Plattform beauftragte Stelle oder Einsatzanforderung; **Auftrag**: der nach § 4 zustande gekommene Vertrag über eine Position.
- **Nutzer**: eine natürliche Person mit einem Nutzerkonto in der Organisation des Auftraggebers; **Portal-Administrator**: der im Datenblatt benannte oder nach § 3 Absatz 3 nachbenannte Nutzer mit der Rolle Owner oder Admin nach Anlage 2.
- **Kandidatin oder Kandidat**: eine Person, die Matchunt dem Auftraggeber anonymisiert oder mit Identität vorschlägt – für eine Festanstellung oder für einen Einsatz im Contracting.
- **Freigabe**: der in der Plattform protokollierte Zeitpunkt, zu dem die Identität einer Kandidatin oder eines Kandidaten für den Auftraggeber sichtbar wird.
- **Vorgestellte Person**: eine Kandidatin oder ein Kandidat, deren Identität nach § 6 freigegeben wurde oder die nach § 6 Absatz 1 Satz 2 oder Absatz 4 Satz 3 als vorgestellt gilt; **vermittelte Person**: eine vorgestellte Person nach ihrer Einstellung.
- **Spezialist**: eine vorgestellte Person, die im Contracting nach Teil III für den Auftraggeber tätig wird.
- **Schutzfrist**: der Zeitraum nach § 6 Absatz 2.
- **Einstellung**: der Abschluss eines Arbeits- oder Dienstvertrags über eine entgeltliche Tätigkeit zwischen dem Auftraggeber oder einem verbundenen Unternehmen und einer vorgestellten Person; **Anstellungsvertrag**: dieser Vertrag. Ein Projektauftrag nach § 12 ist keine Einstellung.
- **Projektauftrag**: der nach § 12 zustande gekommene Vertrag über einen Einsatz im Contracting; **Tagessatz**: der im Projektauftrag vereinbarte Preis je Einsatztag.
- **Bruttojahreszielgehalt**: die Bemessungsgrundlage nach § 8 Absatz 3.
- **Verbundene Unternehmen**: Unternehmen im Sinne des § 15 AktG.
- **Textform**: § 126b BGB; Einreichungen, Bestätigungen und Mitteilungen über die Plattform oder per E-Mail wahren die Textform.
- **Werktage**: Montag bis Freitag mit Ausnahme der gesetzlichen Feiertage am Sitz von Matchunt.

## § 2 Zustandekommen, Vertretung, Rangfolge

(1) Dieser Vertrag kommt zustande, wenn beide Parteien ihn elektronisch unterzeichnet haben; zunächst unterzeichnet der Auftraggeber, sodann Matchunt. Er wird mit der Gegenzeichnung durch Matchunt wirksam. Zeichnet Matchunt nicht innerhalb von 30 Tagen nach der Unterzeichnung durch den Auftraggeber gegen, ist der Auftraggeber nicht mehr gebunden. Dasselbe gilt für Nachträge.

(2) Die für den Auftraggeber unterzeichnende Person versichert, zum Abschluss dieses Vertrags vertretungsberechtigt zu sein. Matchunt darf vor der Gegenzeichnung einen Nachweis der Vertretungsberechtigung verlangen.

(3) Die Anlagen 1 bis 6 sind Bestandteil dieses Vertrags. Bei Widersprüchen gelten in dieser Reihenfolge: das Datenblatt (Anlage 1), dieser Vertragstext mit den Anlagen 2 und 4, die Auftragsbestätigung oder der Projektauftrag (Anlagen 3 und 6), die Allgemeinen Geschäftsbedingungen (Anlage 5). Abweichungen einer Auftragsbestätigung oder eines Projektauftrags von diesem Vertrag zu Lasten des Auftraggebers gelten nur, wenn der Auftraggeber sie in Textform bestätigt hat.

## § 3 Nutzerkonten und Bevollmächtigung

(1) Der Auftraggeber bevollmächtigt den Portal-Administrator, Nutzer in seine Organisation einzuladen, ihnen Rollen nach Anlage 2 zuzuweisen und sie zu entziehen. Bis der Auftraggeber eine andere Person benennt, ist die für den Auftraggeber unterzeichnende Person Portal-Administrator.

(2) Nutzer mit den Rollen Owner, Admin oder HR sind bevollmächtigt, im Namen des Auftraggebers Positionen einzureichen und zu beenden, Freigaben nach § 6 anzufordern, Projektaufträge und Nachträge zu Projektaufträgen nach § 12 zu bestätigen, Tätigkeitsnachweise nach § 13 abzunehmen und die Mitteilungen, Meldungen und Bestätigungen nach §§ 6 bis 15 abzugeben. Nutzer mit der Rolle Hiring Manager dürfen Positionen als Entwurf anlegen, für Positionen, für die sie freigeschaltet sind, am Auswahlprozess mitwirken und Tätigkeitsnachweise abnehmen; Anlage 2 regelt die Einzelheiten. Soweit die Plattform eine Rolle nach Anlage 2 noch nicht bereitstellt, handelt der Portal-Administrator; weitere Befugte benennt der Auftraggeber in Textform.

(3) Der Auftraggeber hält die Rollen aktuell und stellt sicher, dass Zugangsdaten nur dem jeweiligen Nutzer bekannt sind. Scheidet der Portal-Administrator aus, benennt der Auftraggeber unverzüglich einen Nachfolger; Matchunt richtet ihn auf Verlangen einer vertretungsberechtigten Person in Textform ein. Den Verlust oder Missbrauch von Zugangsdaten zeigt der Auftraggeber Matchunt unverzüglich an; Matchunt sperrt das betroffene Konto nach Zugang der Anzeige.

(4) Erklärungen, die ein Unbefugter über ein Nutzerkonto des Auftraggebers abgibt, muss sich der Auftraggeber zurechnen lassen, wenn er den Missbrauch zu vertreten hat oder ihn nicht unverzüglich nach Kenntnis angezeigt hat.

(5) Eine E-Mail-Adresse mit der Domain des Auftraggebers macht niemanden zum Nutzer oder Bevollmächtigten. Berechtigungen entstehen ausschließlich durch die Rollenvergabe nach Absatz 1.

## § 4 Beauftragung von Positionen

(1) Der Auftraggeber beauftragt Positionen ausschließlich über die Plattform. Die Beauftragung erfolgt in Textform, indem ein nach § 3 Absatz 2 bevollmächtigter Nutzer die Position einreicht; dabei wählt er die Vertragsart. Mit der Einreichung gibt der Auftraggeber ein Angebot auf Beauftragung der Position zu den Bedingungen dieses Vertrags ab. Er ist an das Angebot fünf Werktage ab Zugang bei Matchunt gebunden.

(2) Matchunt nimmt das Angebot durch eine Auftragsbestätigung in Textform nach Anlage 3 an. Die Annahme liegt schon früher darin, dass Matchunt die Position in der Plattform zur Bearbeitung annimmt oder dem Auftraggeber eine Person vorstellt; in diesem Fall dokumentiert die Auftragsbestätigung den bereits zustande gekommenen Auftrag. Nimmt Matchunt innerhalb der Bindefrist nicht an, erlischt das Angebot; die Position kann erneut eingereicht werden. Matchunt kann eine Position ohne Angabe von Gründen ablehnen und teilt dies in Textform mit.

(3) Die Auftragsbestätigung gibt die Einreichung und die im Datenblatt vereinbarten Konditionen wieder. Bei Festanstellung nennt sie Position, Gehaltsrahmen und variablen Anteil, Paket, Honorarsatz, Zahlungsziel, einen etwaigen Continuity-Zeitraum mit Meldefrist und aktiven Suchtagen, die einreichende Person und den Zeitpunkt der Einreichung; bei Contracting nennt sie Position, Tagessatzrahmen, Einsatzumfang und Laufzeit sowie den Hinweis, dass der Einsatz durch Projektauftrag nach § 12 zustande kommt. Erklärungen von Matchunt zu einer Position werden an die im Nutzerkonto hinterlegten E-Mail-Adressen der einreichenden Person und des Portal-Administrators versandt und zusätzlich in der Plattform unter der Position bereitgestellt; der Auftraggeber hält diese Adressen aktuell.

(4) Matchunt protokolliert zu jeder Einreichung, Bestätigung und Abnahme den handelnden Nutzer, den Zeitpunkt, die Fassung dieses Vertrags und der Allgemeinen Geschäftsbedingungen sowie die Inhalte. Die Protokolle dienen als Nachweis; der Gegenbeweis bleibt dem Auftraggeber unbenommen.

(5) Die im Datenblatt bezeichnete erste Position gilt mit Wirksamwerden dieses Vertrags als nach Absatz 1 eingereicht.

(6) Der Auftraggeber kann die Bearbeitung einer Position jederzeit über die Plattform oder in Textform beenden; Kosten entstehen dadurch nicht. Matchunt kann die Bearbeitung beenden, wenn der Auftraggeber trotz Aufforderung nicht mitwirkt, die Anforderungen wesentlich ändert oder die Position nach Einschätzung von Matchunt nicht besetzbar ist. Für bis zum Zugang der Beendigung vorgestellte Personen gelten §§ 6, 8, 10 und 15 fort; laufende Gespräche werden zu Ende geführt, sofern der Auftraggeber nichts anderes erklärt. Laufende Projektaufträge bleiben von der Beendigung der Position unberührt und enden nach § 15.

(7) Im Datenblatt benannte verbundene Unternehmen können Positionen unter diesem Vertrag beauftragen. Der Auftraggeber haftet für deren Verbindlichkeiten aus diesem Vertrag als Gesamtschuldner und stellt sicher, dass sie die Pflichten aus diesem Vertrag einhalten.

## § 5 Leistungen von Matchunt

(1) Matchunt sucht, prüft auf Plausibilität und stellt geeignete Kandidatinnen und Kandidaten vor, stellt die Plattform für den Auswahlprozess bereit und begleitet den Prozess bis zur Entscheidung des Auftraggebers. Matchunt benennt dem Auftraggeber eine Ansprechperson; der Stand jeder Position ist in der Plattform einsehbar.

(2) In Modul A schuldet Matchunt ein sorgfältiges Bemühen, nicht den Vermittlungserfolg; eine Zusicherung, dass eine Position besetzt wird, wird nicht abgegeben. In Modul B schuldet Matchunt die Leistung nach dem Projektauftrag (§ 16 Absatz 1).

(3) Matchunt kann Positionen durch selbstständige Recruiter bearbeiten lassen, die vertraglich an Matchunt gebunden sind. Vertragspartner des Auftraggebers bleibt allein Matchunt. Recruiter sind nicht bevollmächtigt, für Matchunt Erklärungen abzugeben oder Konditionen zu vereinbaren; maßgeblich sind allein die Erklärungen von Matchunt über die Plattform. Matchunt verpflichtet die eingesetzten Recruiter zur Vertraulichkeit, zum Datenschutz und zur Einhaltung dieses Vertrags und steht für sie wie für eigene Erfüllungsgehilfen ein (§ 278 BGB). Matchunt darf den mit der Position befassten Recruitern die Informationen weitergeben, die sie für die Bearbeitung brauchen, einschließlich Anforderungsprofil und Gehalts- oder Tagessatzrahmen. Die Identität des Auftraggebers erfahren Kandidatinnen und Kandidaten erst, wenn der Auftraggeber dem zugestimmt hat.

(4) Die Beauftragung ist nicht exklusiv. Der Auftraggeber darf Positionen zugleich selbst oder über Dritte besetzen; Matchunt darf Kandidatinnen und Kandidaten zugleich anderen Unternehmen vorstellen, bis ein Anstellungsvertrag oder ein Projektauftrag mit dem Auftraggeber geschlossen ist. Eine exklusive Beauftragung bedarf einer gesonderten Vereinbarung in Textform.

(5) Der Auftraggeber ist damit einverstanden, dass Matchunt auch im Interesse der Kandidatinnen und Kandidaten tätig wird, sie berät und in weitere Verfahren einbezieht; darin liegt keine vertragswidrige Doppeltätigkeit. Von Kandidatinnen und Kandidaten erhebt Matchunt für die Vermittlung keine Vergütung.

(6) Die Auswahlentscheidung sowie – in Modul A – die arbeitsrechtliche Prüfung und Gestaltung des Anstellungsvertrags obliegen allein dem Auftraggeber.

## § 6 Vorstellung, Freigabe und Schutzfrist

(1) Eine Kandidatin oder ein Kandidat gilt als von Matchunt vorgestellt, sobald die Identität in der Plattform für den Auftraggeber freigegeben wurde; maßgeblich ist der protokollierte Zeitpunkt der Freigabe. Gleiches gilt, wenn Matchunt oder ein für Positionen des Auftraggebers eingesetzter Recruiter dem Auftraggeber identifizierende Angaben in anderer Weise übermittelt hat; maßgeblich ist dann der Zeitpunkt der Übermittlung. Das gilt nicht für Angaben, die ein Recruiter, für den das Beauftragungsverbot nach § 18 Absatz 2 Satz 3 nicht gilt, dem Auftraggeber außerhalb der Plattform übermittelt, auch ohne Auftrag, wenn er die Person nicht über die Plattform für eine Position des Auftraggebers eingereicht hat. Eine Freigabe setzt die Zustimmung der Kandidatin oder des Kandidaten voraus; ein Anspruch des Auftraggebers auf Freigabe besteht nicht.

(2) Kommt es innerhalb von zwölf Monaten nach der Vorstellung (Schutzfrist) zu einer Einstellung der vorgestellten Person durch den Auftraggeber oder ein verbundenes Unternehmen oder zu einer Tätigkeit der Person für den Auftraggeber außerhalb eines Projektauftrags, wird widerleglich vermutet, dass dies auf der Vorstellung durch Matchunt beruht. Absatz 3 regelt die Widerlegung.

(3) Die Vermutung ist widerlegt, wenn der Auftraggeber nachweist, dass

- a) die Person sich innerhalb der letzten sechs Monate vor der Vorstellung aus eigenem Antrieb auf eine konkrete Vakanz des Auftraggebers beworben hat und in ein Auswahlverfahren einbezogen wurde,
- b) die Person sich bei der Vorstellung in einem noch nicht abgeschlossenen Auswahlverfahren des Auftraggebers befand,
- c) ein anderer Vermittler die Person dem Auftraggeber innerhalb der letzten zwölf Monate vor der Vorstellung für dieselbe oder eine vergleichbare Position nachweislich vorgestellt hat, oder
- d) die Person innerhalb der letzten zwölf Monate vor der Vorstellung beim Auftraggeber oder einem verbundenen Unternehmen beschäftigt oder als Selbstständige tätig war.

Der Auftraggeber zeigt dies binnen fünf Werktagen nach der Freigabe, jedenfalls vor dem ersten Gespräch, über die Plattform an und belegt es auf Verlangen mit Datum, Kanal oder Vermittler und Position. Nach Ablauf der Frist kann er die Vermutung nur mit Unterlagen widerlegen, die vor der Vorstellung entstanden sind. Die bloße Speicherung in einem Talentpool oder einer Bewerberdatenbank, ein Kontakt in beruflichen Netzwerken, eine ältere Bewerbung ohne Auswahlverfahren oder eine frühere Ansprache begründen keine Widerlegung. Nach fristgerechter Anzeige nimmt Matchunt die Person für diese Position aus dem Prozess; führt der Auftraggeber den Prozess mit der Person gleichwohl über die Plattform fort, entstehen die Vergütungsansprüche nach diesem Vertrag.

(4) Bis zur Freigabe läuft jeder Kontakt zu einer Kandidatin oder einem Kandidaten über die Plattform. Der Auftraggeber unternimmt keine Versuche, anonymisierte Profile zu identifizieren, und spricht Kandidatinnen und Kandidaten vor der Freigabe nicht außerhalb der Plattform an. Verstößt er hiergegen, gilt die Kandidatin oder der Kandidat ab dem Zeitpunkt der anonymisierten Vorstellung als vorgestellt im Sinne des Absatzes 1.

(5) Nach der Freigabe darf der Auftraggeber die vorgestellte Person im Rahmen des Auswahlprozesses direkt kontaktieren. Auskünfte beim aktuellen oder einem früheren Arbeitgeber oder Auftraggeber der Person holt er nur mit deren vorheriger Zustimmung ein. Gesprächstermine, Angebote, Absage und Rückzug hält er unverzüglich in der Plattform fest; für die Einstellung gilt § 10 Absatz 2, für den Einsatz im Contracting § 12.

## § 7 Mitwirkung des Auftraggebers

(1) Der Auftraggeber stellt die für die Suche erforderlichen Informationen vollständig und zutreffend über die Plattform bereit – insbesondere Anforderungsprofil, Aufgaben, Rahmenbedingungen und Gehalts- oder Tagessatzrahmen – und benennt je Position eine Ansprechperson. Verlangt der Auftraggeber Bestell- oder Projektnummern auf Rechnungen, hinterlegt er sie bei der Einreichung; ihr Fehlen berührt die Fälligkeit nicht.

(2) Der Auftraggeber gibt Rückmeldung über die Plattform: zu einem übermittelten Profil in der Regel binnen fünf Werktagen, zu einem Gesprächstermin binnen zehn Werktagen nach der Freigabe, zur Entscheidung binnen fünf Werktagen nach dem letzten Gespräch. Bleibt eine Rückmeldung länger aus, zählen diese Tage bei einem erneuten Suchlauf nach § 9 nicht als aktive Suchtage (§ 9 Absatz 5). Vor Abgabe eines Angebots teilt der Auftraggeber Matchunt dessen wesentliche Konditionen mit; Angebote können über die Plattform übermittelt werden.

(3) Der Auftraggeber verwendet Angaben zu vorgestellten Personen ausschließlich für das Auswahlverfahren der Positionen, für die die Person freigegeben wurde. Er gibt sie nicht an Dritte weiter. Zulässig bleibt die Weitergabe an verbundene Unternehmen, an den Betriebsrat im Rahmen seiner Beteiligungsrechte, an zur Verschwiegenheit verpflichtete Berater und – mit Zustimmung der Person – an Dienstleister für Hintergrundprüfungen. Der Auftraggeber stellt sicher, dass verbundene Unternehmen, denen er Angaben zugänglich macht, diesen Paragrafen sowie §§ 6, 10 und 15 einhalten, und verschafft sich die für § 10 erforderlichen Auskünfte. Möchte der Auftraggeber eine Person für eine weitere Position berücksichtigen, teilt er dies über die Plattform mit; die Vorstellung gilt dann auch für diese Position.

(4) Gibt der Auftraggeber entgegen Absatz 3 Angaben zu einer vorgestellten Person an einen Dritten weiter und stellt dieser die Person innerhalb der Schutzfrist ein oder setzt sie ein, schuldet der Auftraggeber pauschalierten Schadensersatz. Die Pauschale entspricht bei einer Einstellung dem Honorar, das bei einer Einstellung durch den Auftraggeber angefallen wäre (Bemessungsgrundlage: der obere Wert des zuletzt in der Plattform für die Position angegebenen Gehaltsrahmens, § 10 Absatz 3 Satz 3), bei einem Einsatz dem Betrag nach § 15 Absatz 4. Der Nachweis, dass kein oder ein wesentlich geringerer Schaden entstanden ist, bleibt dem Auftraggeber vorbehalten.

(5) Angemessene, nachgewiesene Reisekosten, die vorgestellten Personen auf Wunsch des Auftraggebers vor einer Einstellung oder einem Projektauftrag entstehen, erstattet der Auftraggeber ihnen unmittelbar nach seinen für Bewerber geltenden Regeln; Matchunt weist die Person vorab darauf hin und ist nicht Zahlstelle.

(6) Der Auftraggeber gestaltet Anforderungsprofile und Auswahlkriterien so, dass sie mit dem Allgemeinen Gleichbehandlungsgesetz vereinbar sind; Matchunt darf Vorgaben, die dagegen verstoßen, zurückweisen. Der Auftraggeber stellt Matchunt von Ansprüchen Dritter frei, die auf solchen Vorgaben oder auf seiner Auswahlentscheidung beruhen, soweit Matchunt kein eigener Verursachungsbeitrag trifft.

# Teil II – Modul A: Vermittlung zur Festanstellung

## § 8 Honorar

(1) Die Vergütung ist ein Erfolgshonorar. Es ist verdient, sobald es innerhalb der Schutzfrist zu einer Einstellung der vorgestellten Person kommt – unabhängig vom Antritt und auch für eine andere als die beauftragte Position (§ 4 Absatz 6, § 20 Absatz 2). Vor einer Einstellung entstehen gegenüber Matchunt keine Kosten; Matchunt berechnet weder Retainer noch Aufwandspauschalen. Reisekosten nach § 7 Absatz 5 bleiben unberührt.

(2) Die Höhe des Honorars ergibt sich aus dem im Datenblatt vereinbarten Paket als Prozentsatz des Bruttojahreszielgehalts: Core, Continuity 90 oder Continuity 180 mit den dort genannten Sätzen, Continuity-Zeiträumen, Meldefristen und aktiven Suchtagen. Ein Mindesthonorar wird nicht berechnet. Enthält das Datenblatt noch keine Paketwahl, gilt das Paket Core, bis der Auftraggeber bei der Einreichung seiner ersten Position mit der Vertragsart Festanstellung ein Paket wählt. Die Wahl gilt als Vereinbarung nach Absatz 10 und wird in der Auftragsbestätigung dokumentiert.

(3) Bruttojahreszielgehalt ist die Vergütung, die der Anstellungsvertrag in der bei Antritt maßgeblichen Fassung für die ersten zwölf Monate vorsieht. Dazu zählen alle festen Bezüge einschließlich vertraglich zugesagter Sonderzahlungen (etwa 13. Gehalt, Urlaubs- und Weihnachtsgeld) und die variable Vergütung mit dem Betrag bei vollständiger Zielerreichung. Ist die Höhe der variablen Vergütung im Anstellungsvertrag nicht bestimmt, gilt der in der Auftragsbestätigung genannte variable Anteil, hilfsweise zehn Prozent der festen Bezüge. Sachbezüge, Dienstwagen, Altersversorgung, Beteiligungen und einmalige Antrittszahlungen bleiben außer Betracht. Fremdwährungen werden zum Referenzkurs der Europäischen Zentralbank am Tag des Abschlusses des Anstellungsvertrags umgerechnet.

(4) Bei einem auf weniger als zwölf Monate befristeten Anstellungsvertrag wird das Bruttojahreszielgehalt auf zwölf Monate hochgerechnet. Bei Teilzeit ist die tatsächlich vereinbarte Vergütung maßgeblich; wird der Beschäftigungsumfang innerhalb der Schutzfrist erhöht, wird das Honorar auf der neuen Grundlage nachberechnet.

(5) Wird die Person auf einer anderen als der beauftragten Position oder bei einem verbundenen Unternehmen eingestellt, gilt der Honorarsatz der Position, für die sie vorgestellt wurde. Bemessungsgrundlage ist die Vergütung der tatsächlich besetzten Position. Stellt der Auftraggeber mehrere vorgestellte Personen ein, entsteht das Honorar für jede Person.

(6) Matchunt stellt das Honorar mit Abschluss des Anstellungsvertrags in Rechnung. Rechnungen werden elektronisch an die im Datenblatt genannte E-Mail-Adresse für Rechnungen übermittelt. Das Honorar ist innerhalb des im Datenblatt genannten Zahlungsziels ab Rechnungsdatum ohne Abzug durch Überweisung zahlbar; alle Beträge verstehen sich zuzüglich der gesetzlichen Umsatzsteuer. Ein späterer Antritt der Person verschiebt die Fälligkeit nicht. Mit Ablauf des Zahlungsziels tritt Verzug ein, ohne dass es einer Mahnung bedarf; es gelten die gesetzlichen Verzugszinsen und die Verzugspauschale (§ 288 Absätze 2 und 5 BGB).

(7) Der Auftraggeber kann nur mit unbestrittenen, entscheidungsreifen oder rechtskräftig festgestellten Forderungen aufrechnen und ein Zurückbehaltungsrecht nur wegen Ansprüchen aus derselben Position ausüben. Befindet sich der Auftraggeber mit einer Vergütung in Verzug, darf Matchunt die Bearbeitung aller Positionen und einen erneuten Suchlauf nach § 9 bis zum Ausgleich aussetzen.

(8) Tritt die vorgestellte Person die Position nicht an, weil sie den Anstellungsvertrag vor dem ersten Arbeitstag kündigt oder von ihm zurücktritt, und hat der Auftraggeber dies nicht zu vertreten, gilt Folgendes. Bei einem Paket ohne Continuity-Leistung erstattet Matchunt ein gezahltes Honorar binnen 14 Tagen; ein noch nicht gezahltes Honorar entfällt. Bei einem Continuity-Paket kann der Auftraggeber zwischen der Erstattung und dem erneuten Suchlauf nach § 9 wählen; § 9 Absätze 4 bis 6 gelten entsprechend, an die Stelle der Meldefrist nach § 9 Absatz 3 tritt die Frist nach diesem Absatz. Voraussetzung ist, dass der Auftraggeber den Nichtantritt innerhalb von 14 Tagen ab Kenntnis, spätestens 14 Tage nach dem vereinbarten ersten Arbeitstag, über die Plattform meldet und die Erklärung der Person vorlegt. Als vom Auftraggeber zu vertreten gelten insbesondere die in § 9 Absatz 4 Satz 2 und 3 genannten Umstände sowie eine Verschiebung der Position oder eine Verschlechterung der im Anstellungsvertrag zugesagten Bedingungen vor Antritt. Kommt es innerhalb der Schutzfrist dennoch zu einer Einstellung der Person, entsteht das Honorar erneut.

(9) Wird eine für eine Festanstellung vorgestellte Person innerhalb der Schutzfrist für den Auftraggeber oder ein verbundenes Unternehmen außerhalb eines Projektauftrags selbstständig tätig – unmittelbar oder über Dritte –, schuldet der Auftraggeber ein Honorar in Höhe von zwölf Prozent der für die ersten sechs Monate und acht Prozent der für den siebten bis zwölften Monat der Tätigkeit vereinbarten Vergütung, fällig mit Beginn der Tätigkeit und mit jeder Verlängerung. Ist die Vergütung nicht als Festbetrag vereinbart, wird sie aus dem vereinbarten Tages- oder Stundensatz und dem vereinbarten Einsatzumfang berechnet; bei unbestimmter Laufzeit oder unbestimmtem Umfang gelten 21,7 Einsatztage je Monat und acht Stunden je Tag. Geht die Tätigkeit innerhalb der Schutzfrist in eine Einstellung über, wird das Honorar nach Absatz 3 berechnet und das nach diesem Absatz gezahlte angerechnet. Der Auftraggeber kann die Tätigkeit stattdessen als Projektauftrag nach § 12 führen.

(10) Ein Wechsel des Pakets oder eine Änderung der im Datenblatt vereinbarten Konditionen bedarf der Vereinbarung in Textform und gilt für Positionen, die nach Zugang der Vereinbarung eingereicht werden; laufende Positionen bleiben unberührt.

## § 9 Continuity-Leistung

(1) Ist im Datenblatt ein Continuity-Paket mit Zeitraum vereinbart, gilt: Matchunt führt einmalig einen erneuten Suchlauf für dieselbe Position zu unveränderten Bedingungen durch, wenn innerhalb des vereinbarten Zeitraums ab dem ersten Arbeitstag der Anstellungsvertrag der vermittelten Person endet, eine Kündigung zugeht oder eine Aufhebungsvereinbarung geschlossen wird. Für den erneuten Suchlauf entsteht kein weiteres Honorar; übersteigt das Bruttojahreszielgehalt der Ersatzbesetzung das der ursprünglichen Besetzung, berechnet Matchunt das Honorar auf den Unterschiedsbetrag nach. Für die im erneuten Suchlauf vermittelte Person besteht keine weitere Continuity-Leistung.

(2) § 5 Absatz 2 Satz 1 gilt für den erneuten Suchlauf entsprechend. Ein Anspruch auf Rückzahlung oder Minderung des Honorars besteht nicht; Absatz 6 bleibt unberührt.

(3) Der Anspruch setzt voraus, dass der Auftraggeber

- a) die Beendigung innerhalb der im Datenblatt genannten Meldefrist ab Kenntnis, spätestens jedoch 14 Tage nach Ablauf des Continuity-Zeitraums, über die Plattform meldet und den Grund benennt,
- b) das Honorar vollständig gezahlt hat,
- c) seine Mitwirkungspflichten nach § 7 nicht in erheblicher Weise verletzt hat und
- d) den erneuten Suchlauf innerhalb von drei Monaten nach der Meldung abruft.

Wird die Position zwischenzeitlich anderweitig besetzt, aufgegeben oder wesentlich geändert, endet der Anspruch.

(4) Ein Anspruch besteht, wenn der Grund der Beendigung in der Person oder im Verhalten der vermittelten Person liegt, die Person selbst kündigt oder die Beendigung einvernehmlich auf Wunsch der Person erfolgt. Er besteht nicht, wenn die Beendigung auf Umständen beruht, die der Auftraggeber zu vertreten hat oder die in seiner Sphäre liegen. Dazu zählen insbesondere: betriebsbedingte Kündigung; Umstrukturierung; Wegfall, Verlegung oder wesentliche Änderung der Position; Abweichung der tatsächlichen Bedingungen (Vergütung, Aufgaben, Standort, Berichtslinie) von den im Anstellungsvertrag zugesagten; Verletzung von Pflichten des Auftraggebers gegenüber der Person oder aus diesem Vertrag. Bei einer Aufhebungsvereinbarung oder einer Kündigung ohne Angabe von Gründen benennt der Auftraggeber den Grund in Textform; bei begründeten Zweifeln kann Matchunt Nachweise verlangen.

(5) Der erneute Suchlauf beginnt, sobald der Auftraggeber die unveränderte Position über die Plattform bestätigt, und endet mit der Ersatzbesetzung, spätestens nach der im Datenblatt genannten Zahl aktiver Suchtage. Aktive Suchtage sind Werktage, an denen die Position in der Plattform zur Bearbeitung angenommen ist und keine Rückmeldung des Auftraggebers länger als die in § 7 Absatz 2 genannten Fristen aussteht. Matchunt dokumentiert die aktiven Suchtage in der Plattform.

(6) Führt der erneute Suchlauf innerhalb der aktiven Suchtage nicht zu einer Ersatzbesetzung und hat der Auftraggeber das nicht zu vertreten, erhält er eine Gutschrift in Höhe von 25 Prozent des gezahlten Honorars. Die Gutschrift kann er innerhalb von zwölf Monaten auf eine Vergütung nach diesem Vertrag anrechnen. Eine Auszahlung erfolgt nicht.

## § 10 Melde- und Auskunftspflichten

(1) Der Auftraggeber informiert Matchunt unverzüglich über Umstände, die die Bearbeitung einer Position betreffen – insbesondere Änderung, Verschiebung oder Wegfall der Position sowie interne oder anderweitige Besetzung.

(2) Der Auftraggeber meldet jede Einstellung einer vorgestellten Person über die Plattform oder in Textform, und zwar unverzüglich, spätestens 14 Tage nach Abschluss des Anstellungsvertrags. Das gilt auch für Einstellungen durch ein verbundenes Unternehmen, für andere Positionen und für die Übernahme eines Spezialisten nach § 15 Absatz 3. Mit der Meldung teilt er das Bruttojahreszielgehalt nach § 8 Absatz 3 und den vereinbarten ersten Arbeitstag mit. Auf Verlangen legt er die für die Berechnung maßgeblichen Vertragsteile vor; übrige Inhalte darf er schwärzen. Verschiebt sich der erste Arbeitstag oder ändert sich der Anstellungsvertrag vor Antritt, meldet er dies ebenso.

(3) Auf Anfrage teilt der Auftraggeber binnen zehn Werktagen in Textform mit, ob mit einer vorgestellten Person ein Anstellungsvertrag geschlossen wurde oder sie außerhalb eines Projektauftrags für ihn tätig ist. Matchunt darf dies bis drei Monate nach Ablauf der Schutzfrist erfragen, auch bei der Person selbst. Kommt der Auftraggeber der Melde- oder Auskunftspflicht trotz Erinnerung nicht innerhalb von zehn Werktagen nach, darf Matchunt das Honorar vorläufig berechnen und in Rechnung stellen; Grundlage ist der obere Wert des Gehalts- oder Tagessatzrahmens, der zuletzt in der Plattform für die Position angegeben war. Bei Einstellung auf einer anderen Position gilt der Rahmen der Position, für die die Person vorgestellt wurde. Weist der Auftraggeber eine geringere Vergütung nach, wird die Rechnung berichtigt.

# Teil III – Modul B: Contracting

## § 11 Geltung und Grundsätze

(1) Dieses Modul gilt für alle Positionen mit der Vertragsart Contracting.

(2) Im Contracting erbringt Matchunt Leistungen für den Auftraggeber durch selbstständige Spezialisten, die Matchunt als Subunternehmer einsetzt. Der Vertrag über den Einsatz (Projektauftrag) kommt zwischen dem Auftraggeber und Matchunt zustande; der Spezialist wird nicht Vertragspartner des Auftraggebers.

(3) Matchunt überlässt keine Arbeitnehmer. Der Spezialist erbringt seine Leistung selbstständig, eigenverantwortlich und frei von Weisungen des Auftraggebers zu Art, Zeit und Ort der Leistung, soweit nicht die Natur der Leistung fachliche Abstimmungen erfordert; er wird nicht in die Arbeitsorganisation des Auftraggebers eingegliedert und unterliegt nicht dessen Arbeitszeit-, Urlaubs- und Verhaltensregeln für Beschäftigte. Der Auftraggeber gestaltet den Einsatz entsprechend.

(4) Für Positionen mit der Vertragsart Contracting gelten §§ 4 bis 7 mit den Maßgaben dieses Moduls. §§ 8 bis 10 gelten nur, soweit §§ 14 und 15 auf sie verweisen.

## § 12 Projektauftrag

(1) Will der Auftraggeber eine vorgestellte Person als Spezialisten einsetzen, erstellt Matchunt aus den Angaben der Position und den mit dem Auftraggeber abgestimmten Konditionen einen Projektauftrag nach Anlage 6: Leistungsgegenstand und erwartete Ergebnisse, Einsatzort und Arbeitsmodell, Laufzeit, Einsatzumfang, Tagessatz, Regeln für Tätigkeitsnachweis und Abnahme, Kündigungsfrist, Ansprechpersonen beider Seiten, Bestell- oder Projektnummer.

(2) Der Projektauftrag kommt zustande, wenn ein nach § 3 Absatz 2 bevollmächtigter Nutzer ihn über die Plattform oder in Textform bestätigt und Matchunt die Bestätigung in Textform annimmt. Vor dem Zustandekommen beginnt kein Einsatz.

(3) Verlängerung, Änderung des Einsatzumfangs oder des Tagessatzes werden als Nachtrag zum Projektauftrag auf demselben Weg vereinbart. Setzt der Auftraggeber den Spezialisten über das Ende der Laufzeit hinaus ein, gilt der Projektauftrag zu unveränderten Bedingungen als verlängert, bis er nach § 15 Absatz 1 gekündigt wird.

(4) Der Tagessatz ist der Preis, den der Auftraggeber an Matchunt zahlt; er enthält die Vergütung des Spezialisten und die Vergütung von Matchunt. Ein gesondertes Vermittlungshonorar entsteht im Contracting nicht.

## § 13 Leistungserbringung, Tätigkeitsnachweis, Abnahme

(1) Der Spezialist erfasst die Einsatztage monatlich in der Plattform oder übermittelt sie in Textform (Tätigkeitsnachweis). Ein nach § 3 Absatz 2 berechtigter Nutzer prüft den Nachweis und nimmt ihn innerhalb von fünf Werktagen nach Vorlage ab oder nennt konkrete Einwände; ohne Einwände innerhalb der Frist gilt der Nachweis als abgenommen. Einwände klären die Parteien binnen fünf Werktagen; unstreitige Tage werden abgerechnet.

(2) Der Auftraggeber stellt dem Spezialisten die für die Leistung erforderlichen Informationen, Zugänge und Ansprechpersonen bereit und beachtet § 11 Absatz 3. Er setzt den Spezialisten nicht für andere als die im Projektauftrag beschriebenen Leistungen ein; ein Wechsel des Leistungsgegenstands bedarf eines Nachtrags.

(3) Matchunt kann den Spezialisten aus wichtigem Grund austauschen (insbesondere Ausfall, Krankheit, Beendigung des Subunternehmervertrags) und stellt in diesem Fall unverzüglich einen gleichwertigen Ersatz vor; der Auftraggeber darf den Ersatz aus sachlichem Grund ablehnen. Der Auftraggeber kann den Austausch aus Gründen verlangen, die in der Person oder Leistung des Spezialisten liegen; § 15 Absatz 2 gilt.

(4) Matchunt stellt sicher, dass der Spezialist zur Vertraulichkeit, zum Datenschutz und zur Einhaltung der im Projektauftrag genannten Sicherheits- und Verhaltensregeln des Auftraggebers verpflichtet ist.

## § 14 Vergütung und Abrechnung

(1) Der Auftraggeber zahlt Matchunt den im Projektauftrag vereinbarten Tagessatz je abgenommenem Einsatztag. Bei Stundensätzen wird je Stunde abgerechnet; ein Tag entspricht acht Stunden. Vereinbarte Personentage oder Tage je Woche begrenzen den Einsatzumfang; Mehrleistungen bedürfen der Freigabe des Auftraggebers.

(2) Reise- und Nebenkosten des Spezialisten trägt der Auftraggeber nur, wenn sie im Projektauftrag vereinbart oder vorab freigegeben sind; Matchunt reicht sie ohne Aufschlag weiter.

(3) Matchunt rechnet monatlich nachschüssig auf Grundlage der abgenommenen Tätigkeitsnachweise ab und stellt die Rechnung, sobald der Nachweis abgenommen ist oder als abgenommen gilt. Rechnungen werden elektronisch an die im Datenblatt genannte E-Mail-Adresse für Rechnungen übermittelt und sind innerhalb des im Datenblatt genannten Zahlungsziels (Standard 14 Tage) ab Rechnungsdatum ohne Abzug zahlbar; alle Beträge verstehen sich zuzüglich der gesetzlichen Umsatzsteuer. § 8 Absatz 6 Satz 5 (Verzug) und Absatz 7 (Aufrechnung, Zurückbehaltung) gelten entsprechend.

(4) Gerät der Auftraggeber mit einer Rechnung mehr als 14 Tage in Verzug, darf Matchunt den Einsatz nach Ankündigung mit einer Frist von fünf Werktagen aussetzen; die Aussetzung berührt die Laufzeit des Projektauftrags nicht.

## § 15 Beendigung des Einsatzes, Ersatz, Übernahme, Umgehung

(1) Jede Partei kann einen Projektauftrag mit einer Frist von zwei Wochen zum Monatsende in Textform kündigen, im ersten Einsatzmonat mit einer Frist von einer Woche. Das Recht zur Kündigung aus wichtigem Grund bleibt unberührt. Abgenommene Einsatztage werden vergütet; für die Zeit nach der Beendigung entsteht keine Vergütung.

(2) Endet der Einsatz innerhalb der ersten 20 Einsatztage aus Gründen in der Person oder Leistung des Spezialisten, bemüht sich Matchunt unverzüglich um einen gleichwertigen Ersatz. Abgenommene Einsatztage des ausgeschiedenen Spezialisten bleiben vergütungspflichtig.

(3) Übernahme. Schließt der Auftraggeber oder ein verbundenes Unternehmen mit einem Spezialisten, der im Contracting für ihn tätig ist oder innerhalb der letzten zwölf Monate tätig war, einen Anstellungsvertrag, gilt § 8 mit der Maßgabe, dass der Honorarsatz des Pakets Core gilt, eine Continuity-Leistung nach § 9 nicht geschuldet ist und das Honorar mit dem Faktor (1 - vergütete Einsatzmonate ÷ 12) multipliziert wird; nach zwölf vergüteten Einsatzmonaten entsteht kein Honorar. Angefangene Monate zählen anteilig nach Einsatztagen; 21,7 Einsatztage entsprechen einem Monat. Der Auftraggeber meldet die Übernahme nach § 10 Absatz 2.

(4) Umgehung. Beauftragt der Auftraggeber oder ein verbundenes Unternehmen einen Spezialisten, der im Contracting für ihn tätig ist oder innerhalb der letzten zwölf Monate tätig war, unmittelbar oder über Dritte außerhalb eines Projektauftrags, zahlt der Auftraggeber pauschalierten Schadensersatz in Höhe von 22 Prozent des zuletzt vereinbarten Tagessatzes je Einsatztag der Tätigkeit, mindestens für 130 Einsatztage. Der Nachweis eines geringeren oder höheren Schadens bleibt beiden Parteien vorbehalten.

## § 16 Haftung, Rechte an Ergebnissen, Versicherung im Contracting

(1) Matchunt schuldet die Leistung des Spezialisten nach dem Projektauftrag als Dienstleistung; ein bestimmter Erfolg ist nur geschuldet, wenn der Projektauftrag ihn ausdrücklich als Werk mit Abnahme bezeichnet. Matchunt steht für den Spezialisten wie für einen Erfüllungsgehilfen ein (§ 278 BGB).

(2) § 19 gilt mit der Maßgabe, dass die Haftung von Matchunt aus einem Projektauftrag – außer in den Fällen des § 19 Absatz 1 – der Höhe nach auf die unter diesem Projektauftrag in den letzten zwölf Monaten gezahlte Vergütung begrenzt ist.

(3) Arbeitsergebnisse, die der Spezialist im Einsatz erstellt, stehen dem Auftraggeber mit Zahlung der Vergütung zur ausschließlichen Nutzung zu; Matchunt verschafft sich die dafür erforderlichen Rechte vom Spezialisten. An vorbestehenden Werkzeugen, Methoden und Bibliotheken des Spezialisten erhält der Auftraggeber ein einfaches, zeitlich unbegrenztes Nutzungsrecht, soweit es für die Nutzung der Ergebnisse erforderlich ist.

(4) Der Auftraggeber stellt Matchunt von Ansprüchen und Kosten frei, die daraus entstehen, dass er den Spezialisten entgegen § 11 Absatz 3 eingliedert oder ihm Weisungen erteilt.

# Teil IV – Gemeinsame Bestimmungen

## § 17 Vertraulichkeit und Datenschutz

(1) Die Parteien behandeln alle im Rahmen der Zusammenarbeit erlangten Informationen vertraulich und verwenden sie nur für die Zwecke dieses Vertrags. Die Pflicht gilt fünf Jahre über das Vertragsende hinaus. Sie gilt nicht für Informationen, die öffentlich bekannt sind oder werden, ohne dass die empfangende Partei dies zu vertreten hat, oder die aufgrund gesetzlicher Pflicht offenzulegen sind. Matchunt verpflichtet eingesetzte Recruiter und Spezialisten entsprechend.

(2) Für die Verarbeitung personenbezogener Daten der Kandidatinnen und Kandidaten sind Matchunt und der Auftraggeber jeweils eigenständig Verantwortliche (Art. 4 Nr. 7 DSGVO). Matchunt verantwortet Suche, Prüfung, Matching und Freigabe der Identität; der Auftraggeber verantwortet sein Auswahlverfahren ab Erhalt der Daten. Mit der Freigabe übermittelt Matchunt die Daten auf Grundlage der Zustimmung der Kandidatin oder des Kandidaten. Der Auftraggeber verarbeitet die Daten auf eigener Rechtsgrundlage, erfüllt seine Informationspflichten nach Art. 13 und 14 DSGVO und beantwortet Betroffenenanfragen für seinen Bereich selbst. Entscheidungen über Kandidatinnen und Kandidaten trifft der Auftraggeber; KI-gestützte Auswertungen in der Plattform bereiten Entscheidungen vor und ersetzen sie nicht.

(3) Der Auftraggeber löscht die Daten vorgestellter Personen spätestens sechs Monate nach Abschluss des Auswahlverfahrens. Das gilt nicht, soweit eine gesetzliche Aufbewahrungspflicht besteht, ein berechtigtes Interesse an der Aufbewahrung besteht (insbesondere zur Abwehr von Ansprüchen) oder die Person einer längeren Speicherung zugestimmt hat. Daten eines Spezialisten darf der Auftraggeber für die Dauer des Projektauftrags und die gesetzlichen Aufbewahrungsfristen verarbeiten.

(4) Daten, die der Auftraggeber selbst in der Plattform erfasst und die Matchunt für ihn speichert (etwa Bewertungen, Gesprächsnotizen, Entscheidungen, Tätigkeitsnachweise), unterliegen der Vereinbarung in Anlage 4. Sie regelt nach Maßgabe der dort beschriebenen Datenflüsse, ob Auftragsverarbeitung (Art. 28 DSGVO) oder gemeinsame Verantwortlichkeit (Art. 26 DSGVO) vorliegt, und enthält die technischen und organisatorischen Maßnahmen, die Liste der Unterauftragsverarbeiter und die Fristen für die Meldung von Sicherheitsvorfällen.

(5) Nach der ersten Einstellung oder dem ersten Projektauftrag darf Matchunt den Auftraggeber mit Name und Logo als Referenzkunden nennen – ohne Angaben zu Positionen, Personen oder Konditionen. Der Auftraggeber kann dem jederzeit in Textform widersprechen; Matchunt entfernt die Nennung binnen zehn Werktagen aus digitalen Medien, gedruckte Unterlagen dürfen aufgebraucht werden.

## § 18 Off-Limits und Umgehungsschutz

(1) Matchunt spricht während der Laufzeit dieses Vertrags und zwölf Monate danach Beschäftigte des Auftraggebers, die Matchunt als solche bekannt sind, nicht aktiv für Positionen Dritter an; von Matchunt vermittelte Personen 24 Monate ab Antritt. Registrieren sich Beschäftigte des Auftraggebers aus eigenem Antrieb auf der Plattform, bleibt das unberührt; Matchunt stellt sie in diesem Zeitraum nicht aktiv Dritten vor. Ein weitergehender Schutz, insbesondere für verbundene Unternehmen, bedarf einer gesonderten Vereinbarung.

(2) Recruiter, die für Matchunt an Positionen des Auftraggebers tätig waren, beauftragt der Auftraggeber während der Laufzeit dieses Vertrags und zwölf Monate danach, längstens bis zwölf Monate nach dem Ende des Vertrags zwischen Matchunt und dem Recruiter, nicht außerhalb der Plattform mit Personalsuche; er stellt sie in diesem Zeitraum auch nicht ein. Gleiches gilt für Beschäftigte von Matchunt, mit denen er im Rahmen der Zusammenarbeit Kontakt hatte. Hatte der Auftraggeber einen Recruiter, das Unternehmen, für das dieser tätig ist, ein mit diesem verbundenes Unternehmen oder deren Rechtsvorgänger vor der ersten Aktivierung, Einreichung oder Empfehlung dieses Unternehmens für den Auftraggeber mit Personalsuche beauftragt, gilt das Beauftragungsverbot nach Satz 1 für dieses Unternehmen und alle für es tätigen Recruiter nicht. Als Auftrag zählt ein Suchauftrag, ein Rahmenvertrag, auch ein von einem verbundenen Unternehmen ausdrücklich für den Auftraggeber geschlossener, oder ein Einzelvertrag über einen Einsatz, jeweils in Textform oder mündlich mit Bestätigung oder Rechnung in Textform; Personalsuche ist die Suche, Auswahl und Vorstellung von Personen zur Einstellung, ihr Einsatz als Selbstständige und die Arbeitnehmerüberlassung. Die Schutzfrist für vorgestellte Personen bleibt unberührt. Bewerbungen auf öffentlich ausgeschriebene Stellen ohne aktive Ansprache bleiben frei.

(3) Verstößt eine Partei gegen Absatz 1 oder 2, zahlt sie für jede Vermittlung oder Einstellung, die unter Umgehung dieses Vertrags zustande kommt, pauschalierten Schadensersatz. Die Pauschale entspricht dem Honorar, das nach dem im Datenblatt vereinbarten Honorarsatz des Moduls A auf das Bruttojahreszielgehalt der betroffenen Person entfiele. Der Nachweis eines geringeren oder höheren Schadens bleibt beiden Parteien vorbehalten. Für Spezialisten gilt § 15 Absätze 3 und 4.

## § 19 Haftung

(1) Matchunt haftet unbeschränkt für Vorsatz und grobe Fahrlässigkeit sowie für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit.

(2) Bei einfacher Fahrlässigkeit haftet Matchunt nur für die Verletzung einer wesentlichen Vertragspflicht. Wesentlich ist eine Pflicht, deren Erfüllung die ordnungsgemäße Durchführung des Vertrags überhaupt erst ermöglicht und auf deren Einhaltung der Auftraggeber regelmäßig vertrauen darf. Die Haftung ist in diesem Fall auf den vertragstypischen, bei Abschluss dieses Vertrags vorhersehbaren Schaden begrenzt. Die Haftung nach dem Produkthaftungsgesetz, wegen arglistigen Verschweigens und aus einer übernommenen Garantie bleibt unberührt.

(3) In Modul A beruhen Angaben zu Kandidatinnen und Kandidaten auf deren eigenen Auskünften und Unterlagen. Matchunt prüft sie auf Plausibilität; eine Verifizierung von Zeugnissen, Abschlüssen, Referenzen, Arbeitserlaubnissen oder sonstigen Nachweisen schuldet Matchunt nicht. Für Eignung, Leistung und Verbleib vermittelter Personen steht Matchunt in Modul A nicht ein. Für Modul B gilt § 16. Die Absätze 1 und 2 bleiben unberührt.

(4) Die Absätze 1 bis 3 gelten auch für die persönliche Haftung der Beschäftigten, Erfüllungsgehilfen, Recruiter und Spezialisten von Matchunt.

## § 20 Laufzeit und Kündigung

(1) Der Vertrag läuft auf unbestimmte Zeit. Beide Parteien können ihn mit einer Frist von vier Wochen zum Monatsende in Textform kündigen. Das Recht zur Kündigung aus wichtigem Grund bleibt unberührt. Modul B kann gesondert mit derselben Frist gekündigt werden.

(2) Bereits beauftragte Positionen bleiben von einer Kündigung unberührt und werden nach diesem Vertrag abgewickelt, sofern sie nicht nach § 4 Absatz 6 beendet werden; laufende Projektaufträge enden nach § 15 Absatz 1. §§ 6, 8, 10 und 15 gelten für vorgestellte Personen und Spezialisten über das Vertragsende hinaus.

## § 21 Schlussbestimmungen

(1) Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts.

(2) Ist der Auftraggeber Kaufmann, juristische Person des öffentlichen Rechts oder öffentlich-rechtliches Sondervermögen oder hat er keinen allgemeinen Gerichtsstand in Deutschland, ist ausschließlicher Gerichtsstand München. Matchunt darf den Auftraggeber auch an dessen allgemeinem Gerichtsstand verklagen.

(3) Änderungen und Ergänzungen dieses Vertrags bedürfen der Textform. Individuelle Vertragsabreden haben Vorrang (§ 305b BGB).

(4) Ergänzend gelten die Allgemeinen Geschäftsbedingungen von Matchunt in der im Datenblatt genannten und unter https://matchunt.ai/agb abrufbaren Fassung (Anlage 5), soweit sie die Nutzung der Plattform betreffen. Für das Vertragsverhältnis der Parteien – insbesondere Rolle und Leistungen von Matchunt, Vergütung, Schutzfrist, Datenschutz, Haftung, Laufzeit und Kündigung – gilt ausschließlich dieser Vertrag. Spätere Änderungen der Allgemeinen Geschäftsbedingungen lassen diesen Vertrag unberührt.

(5) Geschäftsbedingungen des Auftraggebers werden nicht Vertragsbestandteil, auch wenn der Auftraggeber in Bestellungen, Bestellnummern, Rechnungsvorgaben oder sonstigen Erklärungen auf sie verweist und Matchunt dem nicht widerspricht oder in Kenntnis solcher Bedingungen leistet.

(6) Dieser Vertrag mit seinen Anlagen gibt die Vereinbarungen der Parteien bei Vertragsschluss vollständig wieder. Sollte eine Bestimmung unwirksam sein oder werden, bleibt der Vertrag im Übrigen wirksam; an die Stelle der unwirksamen Bestimmung tritt die gesetzliche Regelung. Dasselbe gilt für Lücken.

(7) Vertragssprache ist Deutsch. Eine englische Übersetzung dient nur der Lesbarkeit; im Zweifel gilt die deutsche Fassung.

(8) Hat der Auftraggeber Fassung 1 des Rahmenvertrags über Personalvermittlung geschlossen, gilt diese Fassung für alle Positionen, die nach seiner Zustimmung in Textform eingereicht werden. Zuvor unterzeichnete Einzelaufträge werden nach ihrer bisherigen Fassung abgewickelt.

---

## Anlage 1 – Datenblatt

Das Datenblatt ist diesem Vertrag vorangestellt. Es nennt Vertragsnummer, Fassung und Prüfsumme des Vertragstexts, Fassung der Allgemeinen Geschäftsbedingungen, die Parteien und ihre Vertretung, den Portal-Administrator, das Paket für Festanstellung, die Zahlungsziele beider Module und die erste Position.

## Anlage 2 – Berechtigungskonzept der Plattform

| Rolle | Positionen anlegen | Positionen einreichen und beenden, Projektaufträge bestätigen | Freigaben anfordern, Kandidatinnen und Kandidaten bewerten, Gespräche | Tätigkeitsnachweise abnehmen | Verträge und Rechnungen |
|---|---|---|---|---|---|
| Owner/Admin (darunter der Portal-Administrator) | ja | ja | ja | ja | ja |
| HR | ja | ja | ja | ja | nein |
| Hiring Manager | ja, nur als Entwurf | nein | ja, für freigeschaltete Positionen; Freigaben nur mit Bestätigung durch Owner/Admin/HR | ja, für eigene Projektaufträge | nein |
| Viewer | nein | nein | lesend, für zugeordnete Positionen | nein | nein |
| Finance | nein | nein | nein | nein | ja, lesend |

Vor jeder Freigabe weist die Plattform darauf hin, dass die Kandidatin oder der Kandidat mit der Freigabe als vorgestellt gilt (§ 6). Soweit die Plattform eine Rolle noch nicht bereitstellt, gilt § 3 Absatz 2 letzter Satz.

## Anlage 3 – Auftragsbestätigung (Muster, je Position)

Kopf mit Logo · **Auftragsbestätigung** · Positionsnummer · Rahmenvertrag RV-… (Fassung, Prüfsumme) · Datum

- Auftraggeber (Firmierung) · eingereicht durch (Name, Funktion, Nutzerkonto) am (Zeitpunkt) · Bestell- oder Projektnummer, falls hinterlegt
- Vertragsart: Festanstellung oder Contracting
- Position: Titel, Standort, Arbeitsmodell; bei Festanstellung Gehaltsrahmen und variabler Anteil, Paket, Honorarsatz, Zahlungsziel, Continuity-Zeitraum, Meldefrist, aktive Suchtage; bei Contracting Tagessatzrahmen, Einsatzumfang, Laufzeit und der Hinweis „Der Einsatz kommt durch Projektauftrag nach § 12 zustande.“
- Satz: „Mit dieser Bestätigung ist die Position nach § 4 des Rahmenvertrags RV-… beauftragt. Es gelten die Bedingungen des Rahmenvertrags; diese Bestätigung gibt die Einreichung und das Datenblatt wieder.“
- Fußzeile: Protokollreferenz (Nutzer-ID, Zeitstempel, Prüfsumme der Einreichung), Ansprechperson

Versand: E-Mail mit PDF an die einreichende Person und den Portal-Administrator; zusätzlich in der Plattform unter der Position abrufbar.

## Anlage 4 – Datenschutz

1. **Rollen je Datenkategorie.** (a) Kandidatendaten: Matchunt und der Auftraggeber sind jeweils eigenständig Verantwortliche (§ 17 Absatz 2); Matchunt verantwortet Suche, Prüfung, Matching und Freigabe, der Auftraggeber sein Auswahlverfahren ab Erhalt der Daten. (b) Nutzerkonten der Beschäftigten des Auftraggebers (Name, geschäftliche E-Mail-Adresse, Rolle, Anmeldedaten) und Tätigkeitsnachweise verarbeitet Matchunt als eigener Verantwortlicher zur Durchführung dieses Vertrags und zur Abrechnung. (c) Daten, die der Auftraggeber in der Plattform ausschließlich für sich erfasst (interne Notizen sowie Bewertungen und Gesprächsnotizen, soweit sie nur für den Auftraggeber sichtbar sind), speichert Matchunt im Auftrag und nach Weisung des Auftraggebers; hierfür gilt diese Anlage als Vereinbarung nach Art. 28 DSGVO.

2. **Gegenstand, Dauer, Art und Zweck.** Gegenstand ist die Bereitstellung der Plattform für Beauftragung, Auswahl und Abrechnung von Positionen; Dauer ist die Laufzeit dieses Vertrags. Betroffen sind Beschäftigte des Auftraggebers, Kandidatinnen und Kandidaten sowie Spezialisten. Verarbeitet werden Kontakt- und Kontodaten, Bewerbungs- und Profildaten, Termin- und Entscheidungsdaten sowie Tätigkeitsnachweise.

3. **Technische und organisatorische Maßnahmen.** Verschlüsselte Übertragung (TLS); Mandantentrennung auf Datenbankebene durch Zeilenrechte und rollenbasierte Zugriffe; anonymisierte Kandidatenprofile bis zur Freigabe der Identität (etwa Region statt Ort, Bänder statt exakter Werte); Passwörter, Zugangslinks und Bestätigungscodes werden nur als Prüfwert gespeichert; IP-Adressen werden zum Schutz vor Missbrauch nur als Prüfwert gespeichert und nach zwei Tagen gelöscht; Protokollierung von Einreichungen, Zustimmungen und Freigaben; begonnene Aufnahmen ohne Aktivität werden 30 Tage nach der letzten Änderung gelöscht.

4. **Unterauftragsverarbeiter.** Supabase (Datenbank, Anmeldung, Dateispeicher; Serverstandort Schweiz, Zürich), Lovable (Hosting, KI-Gateway), Google (Sprachmodell Gemini, Google Maps), OpenRouter (KI-Gateway für einzelne Funktionen), Firecrawl (Recherche öffentlicher Unternehmensseiten), Resend (E-Mail-Versand), DocuSign (elektronische Signatur), Stripe (Zahlungen), OpenRouteService und OpenStreetMap/Nominatim (Geokodierung). Matchunt informiert den Auftraggeber mindestens 30 Tage vor dem Einsatz eines neuen Unterauftragsverarbeiters in Textform; der Auftraggeber kann binnen 14 Tagen aus wichtigem Grund widersprechen.

5. **Drittlandübermittlungen.** Einzelne Anbieter verarbeiten Daten auch außerhalb der Europäischen Union, insbesondere in den USA, auch bei KI-gestützten Auswertungen. Die Datenbank wird in der Schweiz betrieben, für die ein Angemessenheitsbeschluss der EU-Kommission besteht (Art. 45 DSGVO). Übrige Übermittlungen stützen sich auf die Standardvertragsklauseln der EU-Kommission (Art. 46 DSGVO) und, soweit der Anbieter zertifiziert ist, auf das EU-US Data Privacy Framework (Art. 45 DSGVO). Eine Kopie der Garantien stellt Matchunt auf Anfrage zur Verfügung.

6. **Sicherheitsvorfälle.** Matchunt unterrichtet den Auftraggeber unverzüglich nach Kenntnis über eine Verletzung des Schutzes personenbezogener Daten, die seine Daten betrifft, so dass er seine Pflichten nach Art. 33 DSGVO erfüllen kann; soweit bekannt, mit Art des Vorfalls, betroffenen Kategorien, wahrscheinlichen Folgen und ergriffenen Maßnahmen.

7. **Betroffenenrechte.** Jede Partei beantwortet Anfragen betroffener Personen für ihren Verantwortungsbereich selbst und leitet an sie gerichtete, aber die andere Partei betreffende Anfragen unverzüglich weiter. Für Daten nach Ziffer 1 (c) unterstützt Matchunt den Auftraggeber mit den Export- und Löschfunktionen der Plattform.

8. **KI-gestützte Auswertungen.** Die Plattform setzt ein Sprachmodell (derzeit Google Gemini über ein KI-Gateway) ein, um Profile auszuwerten, die Passung zu einer Position einzuschätzen und Unternehmensangaben zu prüfen. Die Ergebnisse bereiten Entscheidungen vor; die Entscheidung über Kandidatinnen und Kandidaten trifft stets ein Mensch beim Auftraggeber. Eine ausschließlich automatisierte Entscheidung im Sinne von Art. 22 DSGVO findet nicht statt. Die Ergebnisse sind in der Plattform bei der jeweiligen Position dokumentiert.

9. **Löschung und Rückgabe bei Vertragsende.** Nach Vertragsende löscht Matchunt die Daten nach Ziffer 1 (c) binnen 90 Tagen, sofern keine gesetzliche Aufbewahrungspflicht besteht; auf Verlangen des Auftraggebers gibt Matchunt sie vorher in einem gängigen Format heraus.

10. **Kontrollrechte.** Matchunt weist die Einhaltung dieser Anlage auf Anfrage durch geeignete Unterlagen und Auskünfte nach. Eine Prüfung vor Ort ist nach Anmeldung mit mindestens vier Wochen Vorlauf höchstens einmal im Kalenderjahr während der üblichen Geschäftszeiten möglich; die Kosten trägt der Auftraggeber.

## Anlage 5 – Allgemeine Geschäftsbedingungen von Matchunt

Fassung laut Datenblatt, abrufbar unter https://matchunt.ai/agb.

## Anlage 6 – Projektauftrag (Muster, je Einsatz im Contracting)

Kopf mit Logo · **Projektauftrag** · Nummer · Rahmenvertrag RV-… · Position · Datum

- Auftraggeber (Firmierung), Bestell- oder Projektnummer, Ansprechperson des Auftraggebers
- Spezialist (Name, Gesellschaft, falls vorhanden), Ansprechperson bei Matchunt
- Leistungsgegenstand und erwartete Ergebnisse (eigenverantwortliche Leistungserbringung, § 11 Absatz 3)
- Einsatzort und Arbeitsmodell (remote, hybrid, vor Ort; Zugänge und Betriebsmittel)
- Laufzeit (Beginn, Ende oder unbestimmt), Einsatzumfang (Tage je Woche oder Personentage), Verlängerungsoption
- Tagessatz in Euro netto je Einsatztag (bei Stundensatz: je Stunde, acht Stunden je Tag); Reise- und Nebenkosten: nicht vereinbart / nach Freigabe
- Tätigkeitsnachweis monatlich in der Plattform; Abnahme binnen fünf Werktagen (§ 13)
- Rechnung monatlich nachschüssig nach Abnahme des Tätigkeitsnachweises, Zahlungsziel laut Datenblatt, Standard 14 Tage (§ 14)
- Kündigung: zwei Wochen zum Monatsende, im ersten Einsatzmonat eine Woche (§ 15)
- Werk mit Abnahme: nein / ja (dann Leistungsbeschreibung und Abnahmekriterien)
- Bestätigung durch (Name, Funktion, Nutzerkonto) am (Zeitpunkt) · Annahme durch Matchunt am (Zeitpunkt) · Protokollreferenz
$vertrag$,
       'e8ce8e02950ac62f9dc7a7f6ddcb87b01df1c3101dbdd47edcb5fc8f0e3772fd',
       v1.vendor_legal_name, v1.vendor_brand, v1.vendor_street, v1.vendor_postal_code, v1.vendor_city,
       v1.vendor_country, v1.vendor_register, v1.vendor_court, v1.vendor_vat_id,
       v1.agb_version, v1.agb_sha256, CURRENT_DATE
  FROM public.contract_templates v1
 WHERE v1.doc_type = 'framework' AND v1.version = 1 AND v1.language = 'de'
ON CONFLICT (doc_type, version, language) DO NOTHING;

INSERT INTO public.contract_templates (
  doc_type, version, is_active, language, title, body_md, body_sha256,
  vendor_legal_name, vendor_brand, vendor_street, vendor_postal_code, vendor_city,
  vendor_country, vendor_register, vendor_court, vendor_vat_id,
  agb_version, agb_sha256, effective_from
)
SELECT 'assignment', 2, true, 'de',
       'Auftragsbestätigung',
       $vertrag$
Mit dieser Bestätigung ist die Position nach § 4 des Rahmenvertrags beauftragt. Es gelten die Bedingungen des Rahmenvertrags; diese Bestätigung gibt die Einreichung und das Datenblatt wieder.
$vertrag$,
       '1c60eed9cb40617a547a0c47c8bed7c82a558bb9c276694eeae7a53806220a8a',
       v1.vendor_legal_name, v1.vendor_brand, v1.vendor_street, v1.vendor_postal_code, v1.vendor_city,
       v1.vendor_country, v1.vendor_register, v1.vendor_court, v1.vendor_vat_id,
       v1.agb_version, v1.agb_sha256, CURRENT_DATE
  FROM public.contract_templates v1
 WHERE v1.doc_type = 'assignment' AND v1.version = 1 AND v1.language = 'de'
ON CONFLICT (doc_type, version, language) DO NOTHING;

-- ---- 2. Contracting-Auftrag ohne Paket ---------------------------------------
-- Ein bestätigter Auftrag braucht einen Preis-Snapshot. Bei Festanstellung ist
-- das das Paket; bei Contracting die eine Kondition (Tagessatz all-in, Fassung
-- der Konditionen) -- ein Paket gibt es dort nicht.
ALTER TABLE public.commercial_mandates
  DROP CONSTRAINT IF EXISTS commercial_mandates_confirmed_needs_package;
ALTER TABLE public.commercial_mandates
  ADD CONSTRAINT commercial_mandates_confirmed_needs_package
  CHECK (client_confirmed_at IS NULL
         OR (pricing_snapshot IS NOT NULL
             AND pricing_snapshot_sha256 IS NOT NULL
             AND (fee_basis = 'day_rate_all_in'
                  OR (package_key IS NOT NULL AND package_version IS NOT NULL))));

ALTER TABLE public.commercial_mandates
  DROP CONSTRAINT IF EXISTS commercial_mandates_day_rate_without_package;
ALTER TABLE public.commercial_mandates
  ADD CONSTRAINT commercial_mandates_day_rate_without_package
  CHECK (fee_basis <> 'day_rate_all_in' OR package_key IS NULL);

COMMENT ON CONSTRAINT commercial_mandates_confirmed_needs_package ON public.commercial_mandates IS
  'Ein bestätigter Auftrag braucht einen Preis-Snapshot: bei Festanstellung das '
  'Paket, bei Contracting (fee_basis day_rate_all_in) die Contracting-Kondition.';

-- ---- 3. Freigabesperre: Contracting ------------------------------------------
-- Unverändert aus 20260903100000, bis auf den Preis-Check: ein Contracting-
-- Auftrag hat kein Paket, sondern die Contracting-Kondition -- und er braucht
-- einen Rahmenvertrag ab Fassung 2, denn Fassung 1 kennt kein Contracting.
CREATE OR REPLACE FUNCTION public.jobs_guard_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_is_admin   boolean;
  v_is_service boolean;
  m            public.commercial_mandates%ROWTYPE;
  rv           public.client_framework_agreements%ROWTYPE;
BEGIN
  v_is_service := auth.uid() IS NULL;             -- Service-Role / Migration / psql
  v_is_admin   := NOT v_is_service AND public.has_role(auth.uid(), 'admin');

  -- ---- a) Privilegierte Spalten gegen den Kunden schuetzen -----------------
  IF NOT v_is_admin AND NOT v_is_service THEN
    NEW.client_id                := OLD.client_id;
    IF OLD.organization_id IS NOT NULL THEN
      NEW.organization_id := OLD.organization_id;
    END IF;
    NEW.fee_percentage           := OLD.fee_percentage;
    NEW.recruiter_fee_percentage := OLD.recruiter_fee_percentage;
    NEW.approved_by              := OLD.approved_by;
    NEW.approved_at              := OLD.approved_at;
    NEW.mandate_id               := OLD.mandate_id;
    NEW.intake_draft_id          := OLD.intake_draft_id;
    NEW.intake_link_id           := OLD.intake_link_id;
    NEW.owner_user_id            := OLD.owner_user_id;
    NEW.source                   := OLD.source;

    IF NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status = 'published'
       AND OLD.status <> 'paused' THEN
      RAISE EXCEPTION
        'Eine Stelle wird ausschliesslich durch Matchunt veroeffentlicht (Wechsel % nach %).',
        OLD.status, NEW.status
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  -- ---- b) Freigabe-Gate: gilt fuer alle, auch fuer Admins ------------------
  IF NEW.status = 'published' AND OLD.status IS DISTINCT FROM 'published' THEN
    IF NEW.mandate_id IS NOT NULL THEN
      SELECT * INTO m FROM public.commercial_mandates WHERE id = NEW.mandate_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Auftrag % nicht gefunden.', NEW.mandate_id
          USING ERRCODE = 'foreign_key_violation';
      END IF;

      IF m.status <> 'accepted' THEN
        RAISE EXCEPTION
          'Stelle nicht freigebbar: Auftrag % steht auf "%" statt "accepted".',
          m.mandate_number, m.status USING ERRCODE = 'check_violation';
      END IF;

      -- Ein Auftrag ohne Preis ist nicht freigebbar: Festanstellung braucht
      -- das Paket, Contracting die Contracting-Kondition.
      IF m.pricing_snapshot IS NULL
         OR (m.fee_basis <> 'day_rate_all_in' AND m.package_key IS NULL) THEN
        RAISE EXCEPTION
          'Stelle nicht freigebbar: Auftrag % hat keinen Preis-Snapshot.',
          m.mandate_number USING ERRCODE = 'check_violation';
      END IF;

      -- Der Rahmenvertrag darunter ist in beiden Modellen Pflicht.
      IF m.framework_agreement_id IS NULL THEN
        RAISE EXCEPTION
          'Stelle nicht freigebbar: Auftrag % haengt an keinem Rahmenvertrag.',
          m.mandate_number USING ERRCODE = 'check_violation';
      END IF;
      SELECT * INTO rv FROM public.client_framework_agreements
       WHERE id = m.framework_agreement_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Rahmenvertrag % nicht gefunden.', m.framework_agreement_id
          USING ERRCODE = 'foreign_key_violation';
      END IF;
      IF rv.status <> 'active' THEN
        RAISE EXCEPTION
          'Stelle nicht freigebbar: Rahmenvertrag % steht auf "%" statt "active".',
          rv.agreement_number, rv.status USING ERRCODE = 'check_violation';
      END IF;
      IF m.fee_basis = 'day_rate_all_in' AND rv.template_version < 2 THEN
        RAISE EXCEPTION
          'Stelle nicht freigebbar: Rahmenvertrag % (Fassung %) regelt kein Contracting.',
          rv.agreement_number, rv.template_version USING ERRCODE = 'check_violation';
      END IF;

      -- Ab hier trennen sich die beiden Modelle.
      IF m.ordered_at IS NOT NULL THEN
        IF m.ordered_by_email IS NULL THEN
          RAISE EXCEPTION
            'Stelle nicht freigebbar: Auftrag % hat keinen Besteller.',
            m.mandate_number USING ERRCODE = 'check_violation';
        END IF;
      ELSE
        IF m.customer_signed_at IS NULL THEN
          RAISE EXCEPTION
            'Stelle nicht freigebbar: Auftrag % ist weder beauftragt noch vom Kunden unterzeichnet.',
            m.mandate_number USING ERRCODE = 'check_violation';
        END IF;
        IF m.countersigned_at IS NULL THEN
          RAISE EXCEPTION
            'Stelle nicht freigebbar: Auftrag % ist von Matchunt nicht gegengezeichnet.',
            m.mandate_number USING ERRCODE = 'check_violation';
        END IF;
      END IF;

    ELSIF NEW.intake_draft_id IS NOT NULL THEN
      RAISE EXCEPTION
        'Stelle stammt aus einer Beauftragungsanfrage, hat aber keinen Auftrag.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION public.jobs_guard_privileged_columns() IS
  'Schuetzt privilegierte Spalten gegen den Kunden und haelt die '
  'Veroeffentlichungssperre. Festanstellung: Auftrag mit Paket; Contracting '
  '(fee_basis day_rate_all_in): Auftrag mit Contracting-Kondition unter einem '
  'Rahmenvertrag ab Fassung 2. In beiden Faellen muss der Rahmenvertrag wirksam '
  'sein und der Auftrag bestellt oder beidseitig unterschrieben.';

COMMIT;
