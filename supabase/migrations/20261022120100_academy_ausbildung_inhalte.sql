-- ============================================================================
-- Matchunt Akademie — Inhalte der Ausbildung (8 Module, 24 Themen, Fragenpool)
-- Erzeugt aus den Inhalts-Dateien; feste IDs, erneutes Ausführen ändert nichts.
-- Setzt 20261022120000_academy_ausbildung.sql voraus.
-- ============================================================================

INSERT INTO public.academy_courses (id, slug, title, description, level, is_premium, published, sort_order) VALUES
  ('9f553b3f-110b-4db5-8226-e348fe4a582a', 'ausbildung', 'Ausbildung zum Headhunter',
   'Acht Module vom Spielfeld bis zur Selbstständigkeit: lernen, abfragen, testen. Wer am Ende die Zulassung besteht, arbeitet an echten Stellen auf Matchunt.',
   'beginner', false, true, 0)
ON CONFLICT (id) DO NOTHING;


-- Modul 1: Das Spielfeld
INSERT INTO public.academy_modules (id, course_id, title, sort_order, description, test_question_count, test_pass_pct, test_retry_minutes) VALUES
  ('72a409a6-b158-401b-8267-7edcf7f8e59d', '9f553b3f-110b-4db5-8226-e348fe4a582a', 'Das Spielfeld', 1, 'Nach diesem Modul kannst du erklären, wie ein Headhunter auf Matchunt Geld verdient, wer im Ablauf was sieht und wie du deine Arbeitswoche planst und misst.', 15, 80, 120)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_lessons (id, module_id, title, content_type, body, duration_min, is_premium, sort_order, learning_goal, vorlage_title, vorlage_body, quiz_question_count) VALUES
  ('f4d47600-d5fc-4ebe-8b2a-9c36df346f61', '72a409a6-b158-401b-8267-7edcf7f8e59d', 'So verdienen Headhunter Geld – und warum die meisten scheitern', 'text', 'Als Headhunter wirst du für ein Ergebnis bezahlt: Eine Firma stellt die Person ein, die du vorgestellt hast. Dann zahlt die Firma ein Honorar. Kommt keine Einstellung zustande, gibt es kein Geld, egal wie viel Arbeit in der Suche steckt.

## Wie das Honorar entsteht

- In Deutschland, Österreich und der Schweiz liegt das Honorar meist bei 20 bis 30 Prozent des ersten Jahresbruttos der eingestellten Person.
- Eine Branchenstudie des BDU nennt im Schnitt 26 Prozent des Zieleinkommens (Zahlen von 2019). Bei Führungspositionen liegt das Honorar oft über 30 Prozent.
- Das Honorar zahlt immer die Firma. Auf Matchunt gilt: Von der Kandidatin nimmst du nie Geld. Und der Arbeitgeber darf die Provision auch nicht auf sie abwälzen, das hat das Bundesarbeitsgericht entschieden.

Matchunt vereinbart das Honorar mit dem Kunden und stellt die Rechnung. Welcher Anteil dir zusteht, regelt dein Rahmenvertrag. Du bekommst ihn, nachdem der Kunde bezahlt hat.

## Warum das erste Geld spät kommt

Zwischen deinem ersten Anruf und dem Geld liegen viele Schritte: Suche, Ansprache, Kandidateninterview, Interviews beim Kunden, Angebot, Vertrag. Danach kommt die Kündigungsfrist der Kandidatin. Gesetzlich sind es vier Wochen, üblich sind drei Monate, bei Führungskräften drei bis sechs Monate. Rechne deshalb mit Monaten, nicht mit Wochen, bis aus deiner Arbeit Geld wird. Plane diese Zeit vor dem Start ehrlich durch.

## Warum die meisten scheitern

Eine Auswertung von rund 2.100 Vermittlungsfirmen (Recruiterflow) zeigt einen typischen Trichter: 213 gefundene Personen, 7 Einreichungen, 1 Vermittlung. Die besten 25 Prozent kommen auf gut 5 Vermittlungen im Jahr, der Rest auf knapp 1,4.

Der Unterschied liegt nicht im Fleiß, sondern in der Trefferquote:
- Die Besten machen aus ihrer Vorauswahl häufiger eine Einreichung: 50 statt 36 Prozent.
- Sie besetzen öfter aus ihrem eigenen Bestand.
- Bis zur ersten Einreichung brauchen sie sogar länger: knapp 20 statt gut 15 Tage. Gründlichkeit schlägt Tempo.

Typische Gründe fürs Scheitern sind zu viele Stellen gleichzeitig, Masse statt Auswahl bei den Einreichungen, kein klares Wechselargument und Aufgeben, wenn die ersten Monate ohne Einnahmen vergehen.

## Beispiel

Jonas Brandt, früher Vertriebsingenieur, startet als Headhunter für Technik. In seinen ersten Wochen klickt er bei acht Stellen „Ich suche“ und reicht 25 Profile ein. Zwei davon lädt ein Kunde zum Interview ein. Seine Kollegin Mira Yilmaz konzentriert sich auf drei Stellen in ihrer Branche. Sie reicht sieben Profile ein, fünf werden eingeladen. Mira hat weniger eingereicht, aber besser getroffen. Genau das merken sich Kunden.

## Das Wichtigste

- Geld gibt es nur für eine Einstellung. Das Honorar zahlt die Firma, nie die Kandidatin.
- Rechne mit Monaten bis zur ersten Zahlung: Suche, Prozess und Kündigungsfrist brauchen Zeit.
- Erfolg kommt aus Trefferquote: wenige passende Einreichungen statt vieler schneller.', 8, false, 1, 'Nach diesem Thema kannst du erklären, wie ein Erfolgshonorar entsteht, warum das erste Geld spät kommt und warum Trefferquote wichtiger ist als Fleiß.', 'Zeitstrahl: Von der Stelle bis zu deinem Anteil', '## Die Schritte bis zu deinem Anteil

- Stelle lesen und „Ich suche“ klicken
- Markt kartieren, Menschen finden und ansprechen
- Kandidateninterview führen, mit Einwilligung einreichen
- Interviews beim Kunden, Angebot, Vertrag
- Kündigungsfrist der Kandidatin: meist drei Monate, bei Führungskräften bis zu sechs
- Kunde zahlt das Honorar, danach bekommst du deinen Anteil laut Rahmenvertrag

## Deine ehrliche Rechnung vor dem Start

- Wie viele Monate kann ich ohne Einnahmen aus Besetzungen überbrücken?
- In welchem Fachbereich kenne ich Firmen und Menschen?
- Wie viele Stunden pro Woche plane ich fest ein?
- Wer gibt mir ehrliche Rückmeldung, wenn es zäh wird?

## Merksatz

Wenige passende Einreichungen schlagen viele schnelle.', 5)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('319bedf4-decd-4663-8a7f-42c437ae1759', 'f4d47600-d5fc-4ebe-8b2a-9c36df346f61', 'single', 'Ein Kunde ist von deiner Kandidatin begeistert, findet das Honorar aber hoch. Er schlägt vor, einen Teil davon mit ihrem ersten Gehalt zu verrechnen.', 'Was antwortest du?', '[{"id":"a","text":"Das ist in Ordnung, wenn die Kandidatin vorher schriftlich zustimmt."},{"id":"b","text":"Das ist in Ordnung, wenn der Abzug höchstens ein Monatsgehalt beträgt."},{"id":"c","text":"Das geht nicht, denn die Firma darf das Honorar nicht auf sie abwälzen."}]'::jsonb, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('319bedf4-decd-4663-8a7f-42c437ae1759', '"c"'::jsonb, 'Das Honorar zahlt immer die Firma. Der Arbeitgeber darf die Provision nicht auf die eingestellte Person abwälzen, und auf Matchunt nimmst du von Kandidaten nie Geld.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('326b8274-3bfe-4715-8611-3f713d336229', 'f4d47600-d5fc-4ebe-8b2a-9c36df346f61', 'single', 'Die fiktive Weserland Energie sucht eine Projektleiterin. Das geplante Jahresbrutto liegt bei 80.000 Euro.', 'Welche Honorarspanne ist dafür in Deutschland üblich?', '[{"id":"a","text":"16.000 bis 24.000 Euro"},{"id":"b","text":"4.000 bis 8.000 Euro"},{"id":"c","text":"40.000 bis 48.000 Euro"}]'::jsonb, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('326b8274-3bfe-4715-8611-3f713d336229', '"a"'::jsonb, 'Üblich sind 20 bis 30 Prozent des ersten Jahresbruttos. Bei 80.000 Euro sind das 16.000 bis 24.000 Euro.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('32d6467c-ea53-4203-8897-75b43498a15b', 'f4d47600-d5fc-4ebe-8b2a-9c36df346f61', 'single', 'Jonas hat in seinem ersten Monat 25 Profile auf acht Stellen eingereicht. Zwei davon wurden zum Kundeninterview eingeladen.', 'Was ist sein wichtigster Hebel?', '[{"id":"a","text":"Er nimmt weitere Stellen an, damit mehr Chancen entstehen."},{"id":"b","text":"Er reicht schneller ein, um vor anderen beim Kunden zu sein."},{"id":"c","text":"Er reicht weniger, aber gründlicher geprüfte Profile ein."}]'::jsonb, 3) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('32d6467c-ea53-4203-8897-75b43498a15b', '"c"'::jsonb, 'Die Besten unterscheiden sich durch Trefferquote, nicht durch Aktivität. Sie brauchen bis zur ersten Einreichung sogar länger, treffen aber besser.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('c19e3187-a063-4ebc-89b5-0e1f24cc6b21', 'f4d47600-d5fc-4ebe-8b2a-9c36df346f61', 'multi', NULL, 'Welche Gründe führen häufig zum Scheitern als Headhunter? (Mehrere Antworten richtig)', '[{"id":"a","text":"Zu viele Stellen gleichzeitig angenommen"},{"id":"b","text":"Konzentration auf einen einzigen Fachbereich"},{"id":"c","text":"Masse statt Auswahl bei den Einreichungen"},{"id":"d","text":"Aufgeben, wenn erste Monate ohne Einnahme vergehen"}]'::jsonb, 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('c19e3187-a063-4ebc-89b5-0e1f24cc6b21', '["a","c","d"]'::jsonb, 'Zu viele Stellen, Masse statt Auswahl und Aufgeben in der Durststrecke sind typische Gründe. Die Konzentration auf einen Fachbereich erhöht dagegen die Trefferquote.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('12737c4e-f3dc-4013-839b-6247af2490df', 'f4d47600-d5fc-4ebe-8b2a-9c36df346f61', 'order', NULL, 'Bring die Schritte von der Suche bis zu deinem Anteil am Honorar in die richtige Reihenfolge.', '[{"id":"49c42dc6","text":"Kandidatin finden und ansprechen"},{"id":"fb976079","text":"Mit ihrer Einwilligung einreichen"},{"id":"1b4c2cb0","text":"Einstellung beim Kunden"},{"id":"8786b6ff","text":"Kunde zahlt das Honorar"},{"id":"7cf2ec73","text":"Du bekommst deinen Anteil laut Rahmenvertrag"}]'::jsonb, 5) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('12737c4e-f3dc-4013-839b-6247af2490df', '["49c42dc6","fb976079","1b4c2cb0","8786b6ff","7cf2ec73"]'::jsonb, 'Erst nach der Einstellung stellt Matchunt das Honorar in Rechnung. Deinen Anteil bekommst du, nachdem der Kunde bezahlt hat.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('57e74fb4-09a1-4db5-81ff-1cb8cce73d73', 'f4d47600-d5fc-4ebe-8b2a-9c36df346f61', 'single', 'Miras Kandidatin unterschreibt am 10. Februar ihren Arbeitsvertrag beim Kunden. Ihre Kündigungsfrist beträgt drei Monate.', 'Wie plant Mira ihre Einnahmen realistisch?', '[{"id":"a","text":"Ihr Anteil kommt in derselben Woche wie die Unterschrift."},{"id":"b","text":"Bis aus der Besetzung Geld wird, rechnet sie eher mit Monaten."},{"id":"c","text":"Matchunt zahlt ihren Anteil vorab, sobald der Vertrag steht."}]'::jsonb, 6) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('57e74fb4-09a1-4db5-81ff-1cb8cce73d73', '"b"'::jsonb, 'Zwischen den Schritten liegen oft Monate, allein die Kündigungsfrist dauert meist drei. Deinen Anteil bekommst du erst, nachdem der Kunde gezahlt hat.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_lessons (id, module_id, title, content_type, body, duration_min, is_premium, sort_order, learning_goal, vorlage_title, vorlage_body, quiz_question_count) VALUES
  ('c29076c6-840b-4771-8fb0-9921b57a1f63', '72a409a6-b158-401b-8267-7edcf7f8e59d', 'So funktioniert Matchunt: Niemand sieht mehr, als er muss', 'text', 'Auf Matchunt arbeiten drei Seiten zusammen: der Kunde, der eine Stelle besetzen will, du als Headhunter und die Kandidatin oder der Kandidat. Matchunt steht in der Mitte und sorgt dafür, dass jede Seite genau das sieht, was sie für den nächsten Schritt braucht. Wir nennen das Triple-Blind: Niemand sieht mehr, als er muss.

## Der Ablauf

- Aufnahme: Der Kunde beschreibt seine Stelle in der Aufnahme. Daraus entsteht dein Briefing.
- Ich suche: Du klickst bei einer passenden Stelle „Ich suche“. Ab jetzt sieht der Kunde, wer für ihn sucht.
- Bestandskunden-Frage: Direkt danach fragt Matchunt, ob du die Firma schon kennst. Ist sie bereits dein Kunde, belegst du das mit einem unterschriebenen Vertrag von vor deinem „Ich suche“. Ohne Beleg zählt die Angabe nicht.
- Suchen und ansprechen: Unter „Anzeige & Ansprache“ findest du eine anonyme Stellenanzeige und Texte für die Ansprache. Fragen an den Kunden stellst du über „Kunden fragen“.
- Kandidateninterview: Vor jeder Einreichung führst du ein Gespräch und erfasst die Mindestangaben: Gesprächsdatum, Gesprächsart, Warum wechseln, Warum jetzt, Wunschgehalt, Kündigungsfrist bzw. Verfügbarkeit.
- Einreichen: Nur mit Einwilligung der Kandidatin. Dazu schreibst du deine Einschätzung als Text: Passung, Lücken, Motivation, Konditionen. Einen Punktwert gibt es nicht.
- Einstellung: Matchunt stellt dem Kunden das Honorar in Rechnung. Nach seiner Zahlung bekommst du deinen Anteil laut Vertrag.

## Wer sieht was

- Der Kunde sieht, wer für ihn sucht, und die eingereichten Profile zuerst anonym, mit deiner Einschätzung. Name und Kontaktdaten sieht er erst, wenn die Kandidatin zustimmt.
- Die Kandidatin sieht zuerst eine anonyme Anzeige ohne Firmennamen.
- Du siehst das Briefing mit Firma und vertraulichen Angaben. Was mit „nur für dich“ markiert ist, gehört nie in Anzeige oder Ansprache.
- Belege zur Bestandskunden-Frage sieht nur Matchunt. Der Kunde erfährt nichts davon.

## Kundenschutz

Mit Firmen, die du über Matchunt kennenlernst, arbeitest du nur über Matchunt. Eine Stelle an Matchunt vorbei direkt mit dem Kunden zu besetzen, ist Umgehung und verstößt gegen deinen Vertrag. Kunden können einen Direktkontakt bei Matchunt melden.

## Was dir die Plattform abnimmt

Kundenakquise, Verträge, Rechnungen und Termine übernimmt Matchunt. Du konzentrierst dich auf das Handwerk der Besetzung. Die Partnerstufen Partner, Silber und Gold sind reine Ansehens-Stufen: Sie zeigen Kunden, wie erfolgreich du arbeitest.

## Beispiel

Die Personalleiterin der fiktiven Nordstahl Systems gibt eine Stelle für eine Teamleitung Instandhaltung ein. Headhunterin Selin Aksoy klickt „Ich suche“ und beantwortet die Bestandskunden-Frage mit „Nein“. Über die anonyme Anzeige spricht sie einen Instandhaltungsmeister an, führt das Kandidateninterview und holt seine Einwilligung ein. Nordstahl liest Selins Einschätzung, ohne seinen Namen zu kennen, und möchte ihn kennenlernen. Name und Kontaktdaten werden sichtbar, nachdem er zugestimmt hat.

## Das Wichtigste

- Jede Seite sieht nur, was sie für den nächsten Schritt braucht. Die Kandidatin bleibt anonym, bis sie zustimmt.
- Vor jeder Einreichung: Kandidateninterview mit Mindestangaben und Einwilligung.
- Firmen, die du über Matchunt kennenlernst, betreust du nur über Matchunt.', 9, false, 2, 'Nach diesem Thema kannst du den Ablauf auf Matchunt vom „Ich suche“ bis zur Einstellung erklären und sagen, wer wann was sieht.', 'Checkliste vor dem Einreichen', '## Kandidateninterview

- Gesprächsdatum und Gesprächsart eingetragen
- Warum wechseln und Warum jetzt in den eigenen Worten der Kandidatin festgehalten
- Wunschgehalt und Kündigungsfrist bzw. Verfügbarkeit erfasst

## Einwilligung

- Die Kandidatin hat der Vorstellung bei genau dieser Stelle zugestimmt
- Sie weiß, dass der Kunde sie zuerst anonym sieht

## Einschätzung

- Als Text: Passung, Lücken, Motivation, Konditionen
- Keine Merkmale, an denen der Kunde die Person erkennt
- Kein Punktwert, keine Adjektive ohne Beleg

## Plattform-Regeln

- Bestandskunden-Frage beantwortet, Beleg innerhalb der Frist hochgeladen
- Nichts aus „nur für dich“ in Texten an die Kandidatin
- Kein Kontakt zum Kunden an Matchunt vorbei', 5)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('6cd12583-038e-4179-81e4-1adc1b6f797b', 'c29076c6-840b-4771-8fb0-9921b57a1f63', 'single', 'Du klickst bei einer Stelle der Firma Weber Logistik „Ich suche“. Mit Weber hast du seit zwei Jahren einen unterschriebenen Rahmenvertrag. Diese Stelle kennst du aber nur von Matchunt.', 'Wie beantwortest du die Bestandskunden-Frage?', '[{"id":"a","text":"„Ja, ist mein Kunde“ wählen und den Vertrag als Beleg hochladen."},{"id":"b","text":"„Nein“ wählen, damit die Suche ohne Prüfung sofort startet."},{"id":"c","text":"Weber direkt anrufen und die Stelle außerhalb von Matchunt besetzen."}]'::jsonb, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('6cd12583-038e-4179-81e4-1adc1b6f797b', '"a"'::jsonb, 'Weber ist mit unterschriebenem Vertrag von vor deinem „Ich suche“ dein Kunde. Das gibst du an und belegst es. Nur Matchunt sieht den Beleg.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('d5efb4fd-e38f-485c-84a4-a593b2980102', 'c29076c6-840b-4771-8fb0-9921b57a1f63', 'single', 'Ein Kunde, den du über Matchunt kennengelernt hast, ruft dich an. Er schlägt vor, seine nächste Stelle direkt mit dir zu besetzen, ohne Matchunt.', 'Wie reagierst du?', '[{"id":"a","text":"Du nimmst an, weil es eine andere Stelle ist als die auf Matchunt."},{"id":"b","text":"Du nimmst an und informierst Matchunt nach der Besetzung."},{"id":"c","text":"Du lehnst ab, weil du diese Firma nur über Matchunt betreust."}]'::jsonb, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('d5efb4fd-e38f-485c-84a4-a593b2980102', '"c"'::jsonb, 'Mit Firmen, die du über Matchunt kennenlernst, arbeitest du nur über Matchunt. Alles andere ist Umgehung und verstößt gegen deinen Vertrag.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('4f3ba63b-d0b3-46ff-80ff-7a1840845d04', 'c29076c6-840b-4771-8fb0-9921b57a1f63', 'single', 'Ein Kunde liest deine Einreichung und bittet dich per Telefon um Namen und LinkedIn-Profil des Kandidaten. Der Kandidat hat dazu noch nicht zugestimmt.', 'Was tust du?', '[{"id":"a","text":"Du schickst den Namen, weil der Kunde ernsthaft interessiert ist."},{"id":"b","text":"Du holst erst die Zustimmung des Kandidaten ein, bis dahin bleibt er anonym."},{"id":"c","text":"Du nennst den Namen, hältst aber den Link zum Profil zurück."}]'::jsonb, 3) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('4f3ba63b-d0b3-46ff-80ff-7a1840845d04', '"b"'::jsonb, 'Der Kunde sieht Profile zuerst anonym. Name und Kontaktdaten werden erst sichtbar, wenn der Kandidat zustimmt.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('84f9e93a-13be-4bc2-863e-cc07f450cda8', 'c29076c6-840b-4771-8fb0-9921b57a1f63', 'multi', NULL, 'Welche Angaben gehören zu den Mindestangaben des Kandidateninterviews vor dem Einreichen? (Mehrere Antworten richtig)', '[{"id":"a","text":"Bisheriges Gehalt"},{"id":"b","text":"Warum wechseln"},{"id":"c","text":"Gesprächsart"},{"id":"d","text":"Verfügbarkeit"}]'::jsonb, 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('84f9e93a-13be-4bc2-863e-cc07f450cda8', '["b","c","d"]'::jsonb, 'Die Mindestangaben sind Gesprächsdatum, Gesprächsart, Warum wechseln, Warum jetzt, Wunschgehalt und Kündigungsfrist bzw. Verfügbarkeit. Gefragt wird nach dem Wunschgehalt, nicht nach dem bisherigen Gehalt.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('a384a68c-c1e7-4816-8698-e9218f5c7ca8', 'c29076c6-840b-4771-8fb0-9921b57a1f63', 'match', NULL, 'Ordne zu: Wer sieht was?', '{"left":[{"id":"8f6946b3","text":"Kunde"},{"id":"e1f214ab","text":"Kandidatin"},{"id":"238dda1c","text":"Headhunter"},{"id":"08ca7bf4","text":"Matchunt"}],"right":[{"id":"d6825ac2","text":"Wer für ihn sucht und anonyme Profile mit Einschätzung"},{"id":"ce8ea2df","text":"Zuerst eine anonyme Anzeige ohne Firmennamen"},{"id":"e4b88612","text":"Das Briefing mit Firma und vertraulichen Angaben"},{"id":"5491e8f4","text":"Den Beleg zur Bestandskunden-Frage"}]}'::jsonb, 5) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('a384a68c-c1e7-4816-8698-e9218f5c7ca8', '{"8f6946b3":"d6825ac2","e1f214ab":"ce8ea2df","238dda1c":"e4b88612","08ca7bf4":"5491e8f4"}'::jsonb, 'Triple-Blind heißt: Jede Seite sieht nur, was sie für den nächsten Schritt braucht.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('5b31f862-573b-40a9-8284-012f62362bcc', 'c29076c6-840b-4771-8fb0-9921b57a1f63', 'single', NULL, 'Was bekommt der Kunde mit deiner Einreichung zu sehen?', '[{"id":"a","text":"Deine Einschätzung als Text: Passung, Lücken, Motivation, Konditionen."},{"id":"b","text":"Einen Punktwert von 0 bis 100 für die Passung der Kandidatin."},{"id":"c","text":"Eine Rangliste aller Profile, die zu seiner Stelle eingereicht wurden."}]'::jsonb, 6) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('5b31f862-573b-40a9-8284-012f62362bcc', '"a"'::jsonb, 'Auf Matchunt gibt es keinen Punktwert. Der Kunde liest deine Einschätzung als Text und entscheidet selbst.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_lessons (id, module_id, title, content_type, body, duration_min, is_premium, sort_order, learning_goal, vorlage_title, vorlage_body, quiz_question_count) VALUES
  ('835c563b-28ff-4c73-8f59-ca49ee6b7e27', '72a409a6-b158-401b-8267-7edcf7f8e59d', 'Dein Arbeitstag als Headhunter', 'text', 'Auf Matchunt bist du selbstständig. Niemand schreibt dir Arbeitszeiten vor. Gerade deshalb brauchst du einen festen Rhythmus. Wer nur arbeitet, wenn gerade etwas anliegt, lässt Kandidaten warten. In einer Stepstone-Befragung nannten 23 Prozent der Bewerber unklare Kommunikation oder lange Wartezeiten als Grund für einen Abbruch.

## Zeitblöcke statt Zufall

Deine Arbeit besteht aus vier Tätigkeiten, die unterschiedliche Tageszeiten brauchen:
- Suchen und Recherche: am besten vormittags, in einem Block ohne Telefon.
- Ansprechen und Nachfassen: Nachrichten schreiben und kurze Anrufe. Ein Anruf am Arbeitsplatz ist erlaubt, aber nur kurz: Name und Zweck nennen, Interesse klären, das eigentliche Gespräch nach Feierabend vereinbaren.
- Kandidateninterviews: oft am frühen Abend, weil viele Menschen tagsüber nicht offen sprechen können.
- Dokumentieren: noch am selben Tag in Matchunt, nicht in Excel oder WhatsApp. Was heute ansteht, zeigt dir Matchunt unter „Heute“.

## Ein Wochenrhythmus, der trägt

- Montag: Briefings lesen, offene Punkte über „Kunden fragen“ klären, Wochenziel festlegen.
- Dienstag bis Donnerstag: vormittags suchen, mittags ansprechen und nachfassen, abends Gespräche führen.
- Freitag: Zahlen ansehen, letzte Nachfass-Kontakte, nächste Woche planen.

Plane das Nachfassen fest ein. Eine große Auswertung des Anbieters Pin zeigt: 93 Prozent aller Antworten kommen bis zum dritten Kontakt. Wer nach einer Nachricht aufgibt, verschenkt die meisten Antworten.

## Die vier Zahlen, die du kennen musst

- Ansprachen: Wie viele passende Menschen hast du diese Woche erstmals kontaktiert?
- Antwortquote: Wie viele davon haben geantwortet? Zur Orientierung: Pin misst bei LinkedIn-Nachrichten rund 17 Prozent.
- Kandidateninterviews: Wie viele Gespräche hast du geführt und erfasst?
- Interviewquote: Wie viele deiner Einreichungen lädt der Kunde zum Interview ein? In der Auswertung von Recruiterflow waren es rund 46 Prozent. Diese Zahl ist deine Trefferquote, und sie zählt beim Kunden am meisten.

Die Vergleichswerte stammen überwiegend aus den USA. Sie sind Orientierung, keine Vorgabe. Deine eigenen Zahlen zeigen dir, wo es hakt: Wenige Antworten deuten auf die Nachricht. Wenige Kunden-Interviews deuten auf die Auswahl.

## Beispiel

Tobias Lenz sucht Fachkräfte für Logistik und arbeitet an drei Stellen. Am Freitag notiert er: 40 Ansprachen, 5 Antworten, 3 Gespräche, 2 Einreichungen, noch keine Einladung. Seine Antwortquote liegt mit gut 12 Prozent unter der Orientierung. Er nimmt sich vor, die erste Nachricht kürzer und persönlicher zu schreiben und jeden Kontakt zweimal nachzufassen. Bei den Einreichungen wartet er die Rückmeldung des Kunden ab und fragt nach, was gefehlt hat.

## Das Wichtigste

- Feste Zeitblöcke: Suche vormittags, Ansprache und Nachfassen, Gespräche am Abend, Dokumentation am selben Tag.
- Nachfassen gehört in den Plan: Fast alle Antworten kommen bis zum dritten Kontakt.
- Vier Zahlen zeigen dir, wo es hakt: Ansprachen, Antwortquote, Kandidateninterviews, Interviewquote.', 7, false, 3, 'Nach diesem Thema kannst du eine Arbeitswoche mit festen Zeitblöcken planen und an vier Zahlen ablesen, wo es hakt.', 'Wochenplan und Zahlen-Check', '## Feste Blöcke

- Montag: Briefings lesen, offene Punkte über „Kunden fragen“, Wochenziel festlegen
- Dienstag bis Donnerstag, vormittags: Suchblock ohne Telefon
- Dienstag bis Donnerstag, mittags: Ansprache und Nachfassen
- Dienstag bis Donnerstag, ab dem frühen Abend: Kandidateninterviews
- Jeden Tag: Gespräche noch am selben Tag in Matchunt erfassen
- Freitag: Zahlen-Check, Nachfassen, Planung

## Zahlen-Check am Freitag

- Ansprachen diese Woche: ___
- Antworten: ___ · Antwortquote: ___ %
- Kandidateninterviews geführt und erfasst: ___
- Einreichungen: ___ · davon Kunden-Interviews: ___ · Interviewquote: ___ %

## Eine Frage an dich

Wo hakt es gerade am meisten, und was änderst du nächste Woche genau?', 5)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('ca5fc1a8-0a9d-407c-8d05-164233f0c1e6', '835c563b-28ff-4c73-8f59-ca49ee6b7e27', 'single', 'Du erreichst einen Kandidaten über seine Durchwahl im Büro. Er klingt interessiert und fragt, ob ihr gleich ausführlich sprechen wollt.', 'Wie gehst du vor?', '[{"id":"a","text":"Du führst das ausführliche Gespräch gleich, solange er Zeit hat."},{"id":"b","text":"Du legst auf und schickst ihm eine ausführliche E-Mail ins Büro."},{"id":"c","text":"Du klärst kurz das Interesse und vereinbarst einen Termin nach Feierabend."}]'::jsonb, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('ca5fc1a8-0a9d-407c-8d05-164233f0c1e6', '"c"'::jsonb, 'Ein Anruf am Arbeitsplatz ist erlaubt, aber nur kurz: Name und Zweck nennen, Interesse klären, das eigentliche Gespräch außerhalb der Arbeitszeit führen.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('de55d816-e526-43ae-84f9-f2cb553556c8', '835c563b-28ff-4c73-8f59-ca49ee6b7e27', 'single', 'Tobias notiert am Freitag: 40 Ansprachen, 18 Antworten, 8 Gespräche, 6 Einreichungen, 0 Kunden-Interviews.', 'Wo setzt Tobias zuerst an?', '[{"id":"a","text":"Bei der Auswahl: mit dem Kunden klären, was gefehlt hat, und gezielter einreichen."},{"id":"b","text":"Bei der Menge: in der nächsten Woche deutlich mehr Menschen ansprechen."},{"id":"c","text":"Bei der Nachricht: Seine Antwortquote ist zu niedrig für gute Gespräche."}]'::jsonb, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('de55d816-e526-43ae-84f9-f2cb553556c8', '"a"'::jsonb, 'Seine Antwortquote liegt bei 45 Prozent und ist gut. Keine Einladung trotz sechs Einreichungen deutet auf die Auswahl, also auf die Trefferquote.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('7c69ab1e-f22c-45b7-82cd-e3bbcde0a3be', '835c563b-28ff-4c73-8f59-ca49ee6b7e27', 'single', 'Eine Kandidatin hat dir um 20 Uhr im Gespräch ihren Wechselgrund, ihr Wunschgehalt und ihre Kündigungsfrist genannt.', 'Wann erfasst du das Gespräch?', '[{"id":"a","text":"Am Freitag, gesammelt mit allen anderen Gesprächen der Woche."},{"id":"b","text":"Noch am selben Abend in Matchunt, solange alles frisch ist."},{"id":"c","text":"Erst wenn sie einer Einreichung bei diesem Kunden zugestimmt hat."}]'::jsonb, 3) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('7c69ab1e-f22c-45b7-82cd-e3bbcde0a3be', '"b"'::jsonb, 'Dokumentiert wird noch am selben Tag in Matchunt, nicht in Excel oder WhatsApp. So geht nichts verloren und die Pflichtangaben stehen fürs Einreichen bereit.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('a5bdabcd-35fa-4890-8c83-bdc1b2cf99b3', '835c563b-28ff-4c73-8f59-ca49ee6b7e27', 'multi', NULL, 'Welche Zahlen gehören zu den vier Zahlen, die du jede Woche kennen solltest? (Mehrere Antworten richtig)', '[{"id":"a","text":"Antwortquote auf deine Ansprachen"},{"id":"b","text":"Interviewquote deiner Einreichungen"},{"id":"c","text":"Anzahl deiner LinkedIn-Kontakte"},{"id":"d","text":"Geführte Kandidateninterviews"}]'::jsonb, 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('a5bdabcd-35fa-4890-8c83-bdc1b2cf99b3', '["a","b","d"]'::jsonb, 'Die vier Zahlen sind Ansprachen, Antwortquote, Kandidateninterviews und Interviewquote. Die Größe deines Netzwerks sagt nichts darüber, wo es hakt.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('52edaaf4-ac78-4dcc-8472-8a0bce51f07e', '835c563b-28ff-4c73-8f59-ca49ee6b7e27', 'match', NULL, 'Ordne jede Tätigkeit dem passenden Zeitblock zu.', '{"left":[{"id":"e215eacf","text":"Suchen und Recherche"},{"id":"3586bfdf","text":"Kandidateninterviews"},{"id":"68045cc8","text":"Briefings lesen und Rückfragen stellen"},{"id":"1c32dce4","text":"Zahlen ansehen und nächste Woche planen"}],"right":[{"id":"08addfd9","text":"Vormittags, in einem Block ohne Telefon"},{"id":"8d019b12","text":"Am frühen Abend, nach Feierabend der Kandidaten"},{"id":"3f851087","text":"Montag zum Wochenstart"},{"id":"9d851963","text":"Freitag zum Wochenende"}]}'::jsonb, 5) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('52edaaf4-ac78-4dcc-8472-8a0bce51f07e', '{"e215eacf":"08addfd9","3586bfdf":"8d019b12","68045cc8":"3f851087","1c32dce4":"9d851963"}'::jsonb, 'Feste Blöcke sorgen dafür, dass jede Tätigkeit dann passiert, wenn sie am besten gelingt.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('d3314021-4f23-4164-86d4-650c78ab189f', '835c563b-28ff-4c73-8f59-ca49ee6b7e27', 'single', NULL, 'Warum planst du das Nachfassen fest in deine Woche ein?', '[{"id":"a","text":"Weil Matchunt eine feste Zahl an Nachrichten je Woche verlangt."},{"id":"b","text":"Weil die erste Nachricht auf LinkedIn meist nicht zugestellt wird."},{"id":"c","text":"Weil fast alle Antworten bis zum dritten Kontakt eingehen."}]'::jsonb, 6) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('d3314021-4f23-4164-86d4-650c78ab189f', '"c"'::jsonb, 'Laut Pin kommen 93 Prozent aller Antworten bis zum dritten Kontakt. Wer nach einer Nachricht aufgibt, verschenkt die meisten Antworten.') ON CONFLICT (question_id) DO NOTHING;

-- Modul 2: Die Stelle verstehen
INSERT INTO public.academy_modules (id, course_id, title, sort_order, description, test_question_count, test_pass_pct, test_retry_minutes) VALUES
  ('ff4a1e15-0555-4352-8539-203ef7f85e75', '9f553b3f-110b-4db5-8226-e348fe4a582a', 'Die Stelle verstehen', 2, 'Nach diesem Modul kannst du ein Briefing in eine klare Suchstrategie übersetzen, drei überzeugende Wechselgründe formulieren und mit präzisen Rückfragen beim Kunden nachschärfen.', 15, 80, 120)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_lessons (id, module_id, title, content_type, body, duration_min, is_premium, sort_order, learning_goal, vorlage_title, vorlage_body, quiz_question_count) VALUES
  ('e6afb55e-a2bf-40a8-8ef4-dffb374ed72c', 'ff4a1e15-0555-4352-8539-203ef7f85e75', 'Das Briefing lesen wie ein Profi', 'text', 'Das Briefing ist dein Auftrag. Es entsteht aus der Aufnahme, in der der Kunde seine Stelle beschreibt. Anfänger überfliegen es und suchen den Jobtitel. Profis lesen es wie einen Vertrag: Was wird genau gesucht, was ist verhandelbar, was schließt jemanden aus, und was fehlt noch?

## Fünf Fragen, in denen du das Briefing liest

Matchunt ordnet das Briefing nach deinen Arbeitsschritten:
- Lohnt sich der Auftrag? Gehalt, Arbeitsort, Level, warum die Stelle offen ist und wie dringend sie ist.
- Wen suche ich, und wo? Muss-Kriterien, Erlernbares, was von Vorteil ist, wen du nicht schicken sollst, aus welchen Firmen gute Kandidaten kommen und wo du nicht abwerben darfst.
- Womit überzeuge ich? Entwicklung, Team, Alltag, Kultur und Vorteile der Stelle.
- Was kläre ich im ersten Gespräch? Längste mögliche Kündigungsfrist, Arbeitserlaubnis, Punkte, die Kandidaten kritisch sehen.
- Wie bringe ich es ins Ziel? Interviewablauf, wer entscheidet, wie schnell der Vertrag kommt.

Angaben mit dem Schloss „nur für dich“ sind vertraulich: zum Beispiel der Gehaltsspielraum, wen du nicht schicken sollst, bisherige Absagegründe oder was Kandidaten kritisch sehen. Sie helfen dir bei der Auswahl, gehören aber nie in Anzeige oder Ansprache. Die Gehaltsspanne darfst du nennen, den Spielraum darüber behältst du für dich.

## Muss, von Vorteil, erlernbar

Deine wichtigste Arbeit: höchstens fünf Muss-Kriterien. Ein Muss ist etwas, ohne das die Person die Stelle nicht ausfüllen kann. Alles andere ist von Vorteil oder erlernbar. Stehen im Briefing zwölf Muss-Punkte, sucht der Kunde eine Person, die es kaum gibt. Dann sortierst du und klärst die Reihenfolge mit dem Kunden.

Die Prüffrage für jedes Muss lautet: Würde der Kunde eine Kandidatin absagen, die alles andere mitbringt, nur diesen einen Punkt nicht? Wenn nein, ist es kein Muss.

## Ausschlüsse und Lücken

Lies „Nicht schicken“ und „Nicht abwerben bei“ besonders genau. Wer das übersieht, verspielt beim Kunden Vertrauen. Was im Briefing fehlt, zeigt Matchunt je Schritt als „Offen“. Diese Lücken klärst du früh, bevor du viele Menschen ansprichst.

## Beispiel

Die fiktive Elbtal Pharma sucht eine Qualitätsmanagerin. Im Briefing stehen neun Muss-Punkte, darunter SAP-Kenntnisse, verhandlungssicheres Englisch und Führungserfahrung. Headhunter Malte Ohlsen stellt bei jedem Punkt die Prüffrage. Übrig bleiben vier echte Muss: Erfahrung in der Pharmaproduktion, Erfahrung mit Audits, Englisch im Berufsalltag und ein Wohnort im Pendelbereich. SAP wird erlernbar, Führungserfahrung ist von Vorteil. Unter „Offen“ steht der Interviewablauf. Malte fragt ihn über „Kunden fragen“ nach und schreibt seine Sortierung der Muss-Kriterien als Frage dazu.

## Das Wichtigste

- Lies das Briefing entlang der fünf Fragen und notiere, was offen ist.
- Höchstens fünf Muss-Kriterien, alles andere ist von Vorteil oder erlernbar.
- Vertrauliches und Ausschlüsse steuern deine Auswahl, gehören aber nie in Anzeige oder Ansprache.', 9, false, 1, 'Nach diesem Thema kannst du aus einem Briefing höchstens fünf Muss-Kriterien, die Ausschlüsse und die offenen Lücken herausarbeiten.', 'Checkliste Briefing lesen', '## Die Stelle in einem Satz

Wer wird gesucht, für welches Team, mit welchem Ergebnis nach einem Jahr?

## Lohnt sich der Auftrag?

- Gehaltsspanne brutto im Jahr, fix und variabel
- Spielraum (nur für dich)
- Warum offen, wie dringend?

## Wen suche ich, und wo?

- Muss-Kriterien, höchstens 5, jedes mit der Prüffrage „Absage ohne das?“
- Von Vorteil: ___
- Erlernbar: ___
- Nicht schicken: ___
- Gute Kandidaten kommen aus: ___
- Nicht abwerben bei: ___

## Für das erste Gespräch und den Abschluss

- Längste mögliche Kündigungsfrist, Arbeitserlaubnis
- Interviewablauf und wer entscheidet

## Lücken und Grenzen

- Alles unter „Offen“ gesammelt, Frage über „Kunden fragen“ vorbereitet
- Markiert, was „nur für dich“ ist und nie in Anzeige oder Ansprache gehört', 5)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('d2f05817-43f5-4dd0-8d32-84af398ee520', 'e6afb55e-a2bf-40a8-8ef4-dffb374ed72c', 'single', 'Im Briefing einer Stelle für eine Controllerin stehen elf Muss-Kriterien, darunter Power BI, SAP und Erfahrung im Konzern.', 'Was tust du zuerst?', '[{"id":"a","text":"Du suchst nach Profilen, die alle elf Punkte erfüllen."},{"id":"b","text":"Du prüfst jeden Punkt mit der Prüffrage und klärst die Reihenfolge mit dem Kunden."},{"id":"c","text":"Du streichst die Hälfte der Punkte und sagst dem Kunden nichts davon."}]'::jsonb, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('d2f05817-43f5-4dd0-8d32-84af398ee520', '"b"'::jsonb, 'Höchstens fünf Kriterien sind echte Muss. Die Prüffrage „Würde der Kunde ohne diesen Punkt absagen?“ trennt Muss von Kann. Die Reihenfolge klärst du offen mit dem Kunden.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('e26766ed-63dd-4749-8e07-8a4c963f1810', 'e6afb55e-a2bf-40a8-8ef4-dffb374ed72c', 'single', 'Im Briefing steht als Gehalt 70.000 bis 78.000 Euro, dazu mit Schloss „nur für dich“: Spielraum bis 85.000 Euro. Eine Kandidatin fragt im ersten Telefonat, was die Stelle zahlt.', 'Was antwortest du?', '[{"id":"a","text":"Du nennst den Spielraum bis 85.000 Euro, damit sie nicht abspringt."},{"id":"b","text":"Du nennst keine Zahl, bis der Kunde sie zum Interview eingeladen hat."},{"id":"c","text":"Du nennst die Spanne aus dem Briefing und behältst den Spielraum für dich."}]'::jsonb, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('e26766ed-63dd-4749-8e07-8a4c963f1810', '"c"'::jsonb, 'Die Gehaltsspanne darfst du nennen. Der Spielraum ist mit „nur für dich“ markiert und gehört nie in eine Ansprache.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('eda3a992-4b4c-49db-8b32-e19a9fa14e5b', 'e6afb55e-a2bf-40a8-8ef4-dffb374ed72c', 'single', 'Unter „Nicht abwerben bei“ steht im Briefing die Firma Kessler Antriebe. Genau dort arbeitet eine Kandidatin, die perfekt passen würde.', 'Was ist richtig?', '[{"id":"a","text":"Du sprichst dort für diese Stelle niemanden an."},{"id":"b","text":"Du sprichst sie an, wenn sie ohnehin wechseln will."},{"id":"c","text":"Du sprichst sie an und erwähnst ihren Arbeitgeber erst später."}]'::jsonb, 3) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('eda3a992-4b4c-49db-8b32-e19a9fa14e5b', '"a"'::jsonb, '„Nicht abwerben bei“ ist ein klarer Ausschluss des Kunden. Wer ihn übersieht, verspielt Vertrauen, egal wie gut die Kandidatin passt.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('9dc75a6a-0bef-4254-80ca-bee2582d2390', 'e6afb55e-a2bf-40a8-8ef4-dffb374ed72c', 'multi', NULL, 'Welche Angaben aus dem Briefing gehören nie in Anzeige oder Ansprache? (Mehrere Antworten richtig)', '[{"id":"a","text":"Der Gehaltsspielraum mit Schloss „nur für dich“"},{"id":"b","text":"Bisherige Absagegründe von Kandidaten"},{"id":"c","text":"Der Arbeitsort und die Tage im Homeoffice"},{"id":"d","text":"Was Kandidaten an der Stelle kritisch sehen"}]'::jsonb, 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('9dc75a6a-0bef-4254-80ca-bee2582d2390', '["a","b","d"]'::jsonb, 'Vertrauliche Angaben wie Spielraum, Absagegründe oder kritische Punkte helfen dir bei der Auswahl und im Gespräch. In Anzeige und Ansprache haben sie nichts zu suchen. Arbeitsort und Homeoffice gehören in jede Anzeige.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('6ad0999b-30ba-42b9-8f0f-989a0afe2688', 'e6afb55e-a2bf-40a8-8ef4-dffb374ed72c', 'match', NULL, 'Ordne jede Angabe der Frage im Briefing zu, unter der du sie findest.', '{"left":[{"id":"c4a27d33","text":"Warum die Stelle offen ist"},{"id":"c47c229d","text":"Nicht abwerben bei"},{"id":"36aa6aa3","text":"Team und Entwicklung"},{"id":"fa6f94eb","text":"Interviewablauf und wer entscheidet"}],"right":[{"id":"c7ca5cd7","text":"Lohnt sich der Auftrag?"},{"id":"507ecb59","text":"Wen suche ich, und wo?"},{"id":"b95284bf","text":"Womit überzeuge ich?"},{"id":"0bdcdf1d","text":"Wie bringe ich es ins Ziel?"}]}'::jsonb, 5) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('6ad0999b-30ba-42b9-8f0f-989a0afe2688', '{"c4a27d33":"c7ca5cd7","c47c229d":"507ecb59","36aa6aa3":"b95284bf","fa6f94eb":"0bdcdf1d"}'::jsonb, 'Das Briefing folgt deinen Arbeitsschritten. So findest du jede Angabe dort, wo du sie brauchst.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('1e76c1c3-1f04-4cac-8ab2-d80452c739a5', 'e6afb55e-a2bf-40a8-8ef4-dffb374ed72c', 'single', NULL, 'Woran erkennst du ein echtes Muss-Kriterium?', '[{"id":"a","text":"Der Kunde hat es im Briefing als Erstes genannt."},{"id":"b","text":"Es steht in den meisten Anzeigen für solche Stellen."},{"id":"c","text":"Der Kunde würde ohne diesen Punkt absagen, auch wenn alles andere passt."}]'::jsonb, 6) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('1e76c1c3-1f04-4cac-8ab2-d80452c739a5', '"c"'::jsonb, 'Ein Muss ist etwas, ohne das die Person die Stelle nicht ausfüllen kann. Reihenfolge im Briefing oder Gewohnheit anderer Anzeigen sagen darüber nichts.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_lessons (id, module_id, title, content_type, body, duration_min, is_premium, sort_order, learning_goal, vorlage_title, vorlage_body, quiz_question_count) VALUES
  ('41505681-007f-4971-8615-c932eda6e8e1', 'ff4a1e15-0555-4352-8539-203ef7f85e75', 'Das Wechselargument', 'text', 'Fast alle Menschen, die du ansprichst, suchen gerade keinen Job. 94 Prozent der Suchen deutscher Personalberatungen laufen über Direktansprache (BDU). Du rufst also Menschen an, denen es heute gut geht. Die entscheidende Frage lautet deshalb nicht „Was bietet die Stelle?“, sondern: Warum sollte jemand wechseln, dem es heute gut geht?

## Drei Gründe statt einer Liste

Eine Liste mit Vorteilen wie Obstkorb, Jobrad und flachen Hierarchien überzeugt niemanden. Ein Wechselargument ist ein Grund, der für deine Zielgruppe zählt und den ihre heutige Firma meist nicht bietet. Du brauchst drei davon.

So gehst du vor:
- Zuerst beschreibst du die Zielgruppe in einem Satz: wer, aus welchen Firmen, in welcher Lage.
- Dann sammelst du alle Vorteile aus dem Briefing, vor allem unter „Womit überzeuge ich?“.
- Danach prüfst du jeden Vorteil: Ist er besonders, oder bietet ihn fast jede Firma? Zählt er für genau diese Zielgruppe? Kannst du ihn mit einem Beispiel oder einer Zahl vom Kunden belegen?
- Zum Schluss wählst du drei Gründe aus und formulierst daraus einen Satz für die Ansprache, ohne Firmennamen.

Starke Gründe liegen oft in der Aufgabe (Aufbau statt Verwaltung, mehr Verantwortung), in der Entwicklung (ein echter nächster Schritt, belegt mit einem Beispiel aus dem Team) und im Rahmen (kürzerer Arbeitsweg, Tage im Homeoffice, verlässliche Arbeitszeit).

## Gehalt muss stimmen, trägt aber selten allein

In Deutschland brachen laut Stepstone 44 Prozent der Bewerber mindestens einen Bewerbungsprozess ab. Häufige Gründe waren die Erwartungen (34 Prozent) und das Gehalt (33 Prozent). Das Gehalt muss also marktfähig sein. Als einziges Argument ist es trotzdem schwach: Wer nur wegen Geld wechselt, ist anfällig für ein Gegenangebot seines Chefs.

## Ist das Gehaltsband marktfähig?

Gesprochen wird über das Bruttojahresgehalt: fix, variabel, Dienstwagen. Prüfe das Band im Briefing früh gegen dein Wissen aus dem Fachbereich und gegen die Erwartungen aus deinen ersten Gesprächen. Frag Kandidaten nach Erwartung und Untergrenze, nicht nach dem bisherigen Gehalt. Die EU-Entgelttransparenzrichtlinie verbietet Arbeitgebern diese Frage, das deutsche Gesetz dazu wird für 2027 erwartet. Liegen die Erwartungen deutlich über dem Band, meldest du das dem Kunden mit Zahlen, ohne Namen. Diese Marktberatung erwartet der Kunde von dir.

## Beispiel

Die fiktive Brenner Fördertechnik in Bielefeld sucht einen Konstrukteur: 62.000 bis 68.000 Euro, Team von sechs Leuten, neue Produktlinie ab Januar. Headhunterin Aylin Demir findet drei Gründe: Er gestaltet eine Produktlinie von Anfang an, statt alte Zeichnungen zu ändern. Er arbeitet direkt mit dem Entwicklungsleiter. Das Werk liegt für viele Konstrukteure der Region näher als die großen Arbeitgeber in der Nachbarstadt. Nach fünf Gesprächen liegen vier Erwartungen über 70.000 Euro. Aylin meldet das dem Kunden und fragt, ob das Band steigen kann oder ob auch Kandidaten mit weniger Erfahrung passen.

## Das Wichtigste

- Frag immer: Warum sollte jemand wechseln, dem es heute gut geht? Finde drei belegbare Gründe für deine Zielgruppe.
- Das Gehalt muss marktfähig sein, trägt aber selten allein.
- Frag nach Erwartung und Untergrenze, nie nach dem bisherigen Gehalt, und melde dem Kunden die Marktrealität.', 8, false, 2, 'Nach diesem Thema kannst du drei belegbare Gründe formulieren, warum eine zufriedene Person wechseln sollte, und prüfen, ob das Gehaltsband dafür reicht.', 'Wechselargument in drei Gründen', '## Für wen?

Zielgruppe in einem Satz: wer genau, aus welchen Firmen, in welcher Lage?

## Drei Gründe

- Grund 1, Aufgabe: ___ · Beleg aus dem Briefing: ___
- Grund 2, Entwicklung oder Team: ___ · Beleg: ___
- Grund 3, Rahmen wie Weg, Zeit oder Stabilität: ___ · Beleg: ___

## Prüfung je Grund

- Bietet das fast jede Firma? Dann streichen.
- Zählt das für genau diese Zielgruppe?
- Kann ich es mit einem Beispiel oder einer Zahl belegen?

## Gehaltsband

- Band laut Briefing, brutto im Jahr, fix und variabel: ___
- Erwartungen aus den ersten Gesprächen: ___
- Passt das nicht, Rückmeldung an den Kunden mit Zahlen, ohne Namen

## Der Satz für die Ansprache

„Ich melde mich, weil …“ (ohne Firmennamen)', 5)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('116cd1ba-c29c-4085-8aae-b2371a830847', '41505681-007f-4971-8615-c932eda6e8e1', 'single', 'Die Stelle bietet: Obstkorb, Jobrad, 30 Urlaubstage, den Aufbau eines neuen Werks und Teamleitung nach einem Jahr. Für die Teamleitung nennt der Kunde ein Beispiel aus dem Team.', 'Welche Kombination taugt als Wechselargument?', '[{"id":"a","text":"Aufbau des neuen Werks und Teamleitung, belegt mit einem Beispiel"},{"id":"b","text":"Obstkorb, Jobrad und 30 Urlaubstage als starkes Gesamtpaket"},{"id":"c","text":"30 Urlaubstage und Jobrad, weil das jeder sofort versteht"}]'::jsonb, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('116cd1ba-c29c-4085-8aae-b2371a830847', '"a"'::jsonb, 'Starke Gründe sind besonders, zählen für die Zielgruppe und sind belegbar. Obstkorb, Jobrad und Urlaubstage bietet fast jede Firma.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('9ba2fb8b-1f04-4a10-8341-58cbadb4c20a', '41505681-007f-4971-8615-c932eda6e8e1', 'single', 'Im ersten Gespräch willst du herausfinden, ob das Gehaltsband zu einem Kandidaten passt.', 'Welche Frage stellst du?', '[{"id":"a","text":"„Was verdienen Sie heute, fix und variabel?“"},{"id":"b","text":"„Wie viel mehr als heute müsste es mindestens sein?“"},{"id":"c","text":"„Was erwarten Sie, und wo liegt Ihre Untergrenze, brutto im Jahr?“"}]'::jsonb, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('9ba2fb8b-1f04-4a10-8341-58cbadb4c20a', '"c"'::jsonb, 'Du fragst nach Erwartung und Untergrenze, nicht nach dem bisherigen Gehalt. Die Frage „Wie viel mehr als heute?“ zielt ebenfalls auf das bisherige Gehalt.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('7d800864-c080-4ff7-8325-1e4712e19b96', '41505681-007f-4971-8615-c932eda6e8e1', 'single', 'Nach fünf Gesprächen liegen vier Gehaltserwartungen deutlich über dem Band im Briefing.', 'Was tust du?', '[{"id":"a","text":"Du suchst weiter, bis jemand ins Band passt, und belastest den Kunden nicht."},{"id":"b","text":"Du meldest dem Kunden die Zahlen ohne Namen und besprichst Band oder Profil."},{"id":"c","text":"Du sagst den Kandidaten, dass der Kunde am Ende sicher mehr zahlt."}]'::jsonb, 3) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('7d800864-c080-4ff7-8325-1e4712e19b96', '"b"'::jsonb, 'Marktberatung gehört zu deiner Arbeit. Mit Zahlen aus echten Gesprächen kann der Kunde entscheiden, ob er das Band anhebt oder das Profil öffnet.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('529d530d-f381-46b4-8422-679aa49134c1', '41505681-007f-4971-8615-c932eda6e8e1', 'multi', NULL, 'Woran erkennst du einen starken Wechselgrund? (Mehrere Antworten richtig)', '[{"id":"a","text":"Fast jede Firma der Branche bietet ihn auch an."},{"id":"b","text":"Er zählt für genau die gesuchte Zielgruppe."},{"id":"c","text":"Du kannst ihn mit einem Beispiel oder einer Zahl belegen."},{"id":"d","text":"Die heutige Firma der Zielgruppe bietet ihn meist nicht."}]'::jsonb, 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('529d530d-f381-46b4-8422-679aa49134c1', '["b","c","d"]'::jsonb, 'Ein Wechselargument muss für die Zielgruppe zählen, belegbar sein und sich vom heutigen Arbeitgeber abheben. Was jede Firma bietet, bewegt niemanden zum Wechsel.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('1e589102-83bc-40d4-817a-0715a583fba6', '41505681-007f-4971-8615-c932eda6e8e1', 'order', NULL, 'Bring die Arbeit am Wechselargument in die richtige Reihenfolge.', '[{"id":"d1f3bb2d","text":"Zielgruppe in einem Satz beschreiben"},{"id":"8ab668d7","text":"Alle Vorteile aus dem Briefing sammeln"},{"id":"fa983b07","text":"Jeden Vorteil prüfen: besonders, passend, belegbar?"},{"id":"5e1785d3","text":"Drei Gründe auswählen und als Satz für die Ansprache formulieren"}]'::jsonb, 5) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('1e589102-83bc-40d4-817a-0715a583fba6', '["d1f3bb2d","8ab668d7","fa983b07","5e1785d3"]'::jsonb, 'Erst wenn klar ist, für wen du suchst, kannst du beurteilen, welche Vorteile für diese Menschen zählen.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('04b04f7e-eef6-4fc8-812d-6c472858e6e4', '41505681-007f-4971-8615-c932eda6e8e1', 'single', NULL, 'Warum reicht ein höheres Gehalt als einziges Wechselargument selten?', '[{"id":"a","text":"Es muss stimmen, aber wer nur wegen Geld wechselt, bleibt anfällig für ein Gegenangebot."},{"id":"b","text":"Gehaltsangaben sind in einer Ansprache an Kandidaten grundsätzlich verboten."},{"id":"c","text":"Kandidaten in Deutschland sprechen mit Headhuntern nicht über ihr Gehalt."}]'::jsonb, 6) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('04b04f7e-eef6-4fc8-812d-6c472858e6e4', '"a"'::jsonb, 'Ein marktfähiges Gehalt ist Voraussetzung. Als einziger Grund trägt es aber kaum, weil der heutige Arbeitgeber mit Geld nachziehen kann.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_lessons (id, module_id, title, content_type, body, duration_min, is_premium, sort_order, learning_goal, vorlage_title, vorlage_body, quiz_question_count) VALUES
  ('8e6d1686-fc05-42c5-8317-b5f251a939c6', 'ff4a1e15-0555-4352-8539-203ef7f85e75', 'Rückfragen und Kalibrieren', 'text', 'Kein Briefing ist vollständig. Gute Headhunter merken das früh und fragen nach. Andere suchen drei Wochen in die falsche Richtung und wundern sich über Absagen.

## Die Bestandskunden-Frage beim „Ich suche“

Direkt nach deinem Klick auf „Ich suche“ fragt Matchunt: „Kennst du die Firma schon?“ Kunde heißt dabei: Du hast mit der Firma einen unterschriebenen Rahmen- oder Einzelvertrag von vor deinem ersten „Ich suche“. Ein Kennenlerngespräch reicht nicht. Du hast drei Antworten:
- Nein, kenne ich nicht: Deine Suche läuft normal.
- Ja, ist mein Kunde, diese Stelle läuft über Matchunt: Du lädst den Vertrag als Beleg hoch, Frist 5 Werktage. Beträge und Konditionen darfst du schwärzen. Nur Matchunt sieht den Beleg, deine Suche läuft normal weiter.
- Ja, und genau diese Stelle habe ich schon direkt: Du belegst Vertrag und Beauftragung. Matchunt fragt den Kunden, bis dahin ruht deine Suche.

Antworte ehrlich. Eine Angabe ohne Beleg zählt nicht.

## Gute Rückfragen über „Kunden fragen“

Was im Briefing fehlt, steht dort als „Offen“. Über „Kunden fragen“ wählst du diese Fragen aus und schreibst einen Satz dazu. Matchunt schickt sie an das Kundenteam, höchstens einmal in sieben Tagen je Stelle. Deshalb gilt: erst sammeln, dann einmal gut fragen. Die Antworten stehen danach in deinem Briefing.

Eine gute Rückfrage:
- betrifft etwas, das deine Suche ändert,
- ist konkret statt allgemein: „Ist Erfahrung mit Medizinprodukten ein Muss oder von Vorteil?“ statt „Was ist Ihnen wichtig?“,
- bietet eine Wahl an, wo das möglich ist,
- nennt kurz den Grund.

## Kalibrieren nach den ersten Einreichungen

Was eine Stelle wirklich verlangt, zeigt sich oft erst an der Reaktion des Kunden auf echte Profile. Kalibriere deshalb nach den ersten Einreichungen, spätestens nach fünf bis zehn Profilen: Was hat dem Kunden gefallen? Was hat gefehlt? Welches Muss war in Wahrheit keins? Ein Software-Anbieter berichtet, dass kalibrierte Stellen 22 Prozent schneller besetzt werden. Das ist eine Anbieterangabe, die Richtung deckt sich aber mit der Praxis. Melde dem Kunden dabei auch die Marktrealität: Wie viele passende Menschen gibt es, und was erwarten sie?

## Beispiel

Headhunter Felix Lorenz sucht für die fiktive Kanzlei Hoffmann & Partner eine Steuerfachangestellte. Unter „Offen“ stehen das Arbeitszeitmodell und der Interviewablauf. Er wählt beide Fragen aus und schreibt dazu: „Ist DATEV-Erfahrung ein Muss? Zwei starke Kandidatinnen arbeiten mit einer anderen Software.“ Nach drei Einreichungen lädt die Kanzlei nur eine Kandidatin ein. Felix fragt nach: Den beiden anderen fehlte Erfahrung mit Jahresabschlüssen. Das stand nirgends als Muss. Felix klärt mit der Kanzlei, dass es ein Muss ist, und passt Suche und Auswahl an.

## Das Wichtigste

- Bestandskunde nur mit Beleg: unterschriebener Vertrag von vor deinem ersten „Ich suche“.
- Sammle offene Punkte und frag über „Kunden fragen“ einmal präzise, höchstens einmal in sieben Tagen je Stelle.
- Kalibriere nach den ersten Einreichungen und melde dem Kunden die Marktrealität.', 8, false, 3, 'Nach diesem Thema kannst du die Bestandskunden-Frage richtig beantworten, präzise Rückfragen an den Kunden stellen und nach den ersten Einreichungen nachjustieren.', 'Rückfragen-Check und Kalibrieren', '## Vor dem Senden über „Kunden fragen“

- Ändert die Antwort meine Suche? Wenn nein, weglassen.
- Konkret statt allgemein formuliert?
- Eine Wahl angeboten, zum Beispiel Muss oder von Vorteil?
- Den Grund in einem Satz genannt?
- Alle offenen Punkte gesammelt? Gesendet wird höchstens einmal in sieben Tagen je Stelle.

## Nach den ersten Einreichungen

- Was hat dem Kunden an der Person gefallen, die er einlädt?
- Was hat bei den anderen gefehlt? Stand das im Briefing als Muss?
- Welches Muss ist in Wahrheit erlernbar oder von Vorteil?
- Passt das Gehaltsband zu den Erwartungen, die du hörst?
- Was ändere ich ab heute an Marktkarte, Suche und Auswahl?

## Rückmeldung an den Kunden

- Wie viele passende Menschen habe ich gefunden und gesprochen?
- Was erwarten sie, und was hält sie vom Wechsel ab?', 5)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('1561c9c3-59bd-4044-8232-10353fa996ac', '8e6d1686-fc05-42c5-8317-b5f251a939c6', 'single', 'Du klickst „Ich suche“ bei der Firma Rotor Medizintechnik. Vor einem Jahr hattest du dort ein Kennenlerngespräch mit der Personalleitung. Einen Vertrag habt ihr nie geschlossen.', 'Wie beantwortest du die Bestandskunden-Frage?', '[{"id":"a","text":"„Ja, ist mein Kunde“, weil das Gespräch eine Beziehung belegt."},{"id":"b","text":"„Ja, und genau diese Stelle habe ich schon direkt“."},{"id":"c","text":"„Nein“, weil es keinen unterschriebenen Vertrag gibt."}]'::jsonb, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('1561c9c3-59bd-4044-8232-10353fa996ac', '"c"'::jsonb, 'Kunde heißt auf Matchunt: ein unterschriebener Rahmen- oder Einzelvertrag von vor deinem ersten „Ich suche“. Ein Kennenlerngespräch reicht nicht.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('fa67420a-a6ed-42be-861b-4fb138d9d6ac', '8e6d1686-fc05-42c5-8317-b5f251a939c6', 'single', 'Du hast die Stelle „Leitung Einkauf“ bei deinem Bestandskunden Hahn Bau seit drei Wochen direkt im Auftrag, mit unterschriebenem Suchauftrag. Jetzt erscheint sie auch auf Matchunt.', 'Was passiert, wenn du „Ja, und genau diese Stelle habe ich schon direkt“ wählst?', '[{"id":"a","text":"Du belegst Vertrag und Beauftragung, Matchunt fragt den Kunden, bis dahin ruht deine Suche."},{"id":"b","text":"Deine Suche läuft normal weiter, und der Kunde erfährt nichts von deiner Angabe."},{"id":"c","text":"Matchunt beendet die Stelle sofort für alle anderen Headhunter auf der Plattform."}]'::jsonb, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('fa67420a-a6ed-42be-861b-4fb138d9d6ac', '"a"'::jsonb, 'Bei dieser Antwort brauchst du zwei Belege. Matchunt fragt beim Kunden nach, ob das stimmt. Bis dahin reichst du für diese Stelle nichts ein.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('25af9149-50ad-4884-832c-cf117c116b58', '8e6d1686-fc05-42c5-8317-b5f251a939c6', 'single', 'Im Briefing stehen unter „Offen“ drei Punkte. Dir fällt heute eine Frage ein, morgen vielleicht noch eine zweite.', 'Wie gehst du vor?', '[{"id":"a","text":"Du sendest heute die erste Frage und morgen die nächste hinterher."},{"id":"b","text":"Du sammelst alle offenen Punkte und fragst einmal gebündelt und präzise."},{"id":"c","text":"Du fragst gar nicht und füllst die Lücken mit eigenen Annahmen."}]'::jsonb, 3) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('25af9149-50ad-4884-832c-cf117c116b58', '"b"'::jsonb, '„Kunden fragen“ sendet höchstens einmal in sieben Tagen je Stelle. Deshalb sammelst du erst und fragst dann einmal gut.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('a0c0f303-c7be-44a6-8f7b-4a3f14fceaf9', '8e6d1686-fc05-42c5-8317-b5f251a939c6', 'multi', NULL, 'Woran erkennst du eine gute Rückfrage an den Kunden? (Mehrere Antworten richtig)', '[{"id":"a","text":"Die Antwort ändert deine Suche."},{"id":"b","text":"Sie ist offen gehalten, etwa „Was ist Ihnen wichtig?“"},{"id":"c","text":"Sie bietet eine Wahl an, etwa Muss oder von Vorteil."},{"id":"d","text":"Sie nennt kurz, warum du fragst."}]'::jsonb, 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('a0c0f303-c7be-44a6-8f7b-4a3f14fceaf9', '["a","c","d"]'::jsonb, 'Gute Rückfragen sind konkret, entscheidungsrelevant, bieten eine Wahl und nennen den Grund. Offene Allgemeinfragen liefern selten eine brauchbare Antwort.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('c28dd621-0c70-42e4-87e9-7ef7f41cba15', '8e6d1686-fc05-42c5-8317-b5f251a939c6', 'order', NULL, 'Bring die Schritte vom „Ich suche“ bis zur kalibrierten Suche in die richtige Reihenfolge.', '[{"id":"fd6984c7","text":"„Ich suche“ klicken"},{"id":"8a989d0e","text":"Bestandskunden-Frage beantworten"},{"id":"457cf743","text":"Offene Punkte über „Kunden fragen“ klären"},{"id":"d6a1b435","text":"Erste Kandidaten einreichen"},{"id":"0eff8d7d","text":"Mit den Rückmeldungen des Kunden kalibrieren"}]'::jsonb, 5) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('c28dd621-0c70-42e4-87e9-7ef7f41cba15', '["fd6984c7","8a989d0e","457cf743","d6a1b435","0eff8d7d"]'::jsonb, 'Die Bestandskunden-Frage kommt direkt nach dem „Ich suche“. Lücken klärst du früh, kalibrieren kannst du erst, wenn der Kunde auf echte Profile reagiert hat.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('47bd36fd-f1cc-405f-8c3e-36cc4c690c4c', '8e6d1686-fc05-42c5-8317-b5f251a939c6', 'single', 'Nach drei Einreichungen lädt der Kunde nur eine Kandidatin ein. Den anderen fehlte Erfahrung mit Jahresabschlüssen, die im Briefing nicht als Muss stand.', 'Was ist der beste nächste Schritt?', '[{"id":"a","text":"Du reichst die nächsten Profile genauso ein, denn das Briefing gilt."},{"id":"b","text":"Du klärst den Punkt mit dem Kunden als Muss und passt Suche und Auswahl an."},{"id":"c","text":"Du beendest deine Suche, weil der Kunde sich nicht an sein Briefing hält."}]'::jsonb, 6) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('47bd36fd-f1cc-405f-8c3e-36cc4c690c4c', '"b"'::jsonb, 'Genau das ist Kalibrieren: Die Reaktion des Kunden auf echte Profile zeigt, was die Stelle wirklich verlangt. Das klärst du und suchst danach gezielter.') ON CONFLICT (question_id) DO NOTHING;

-- Modul 3: Markt kartieren und finden
INSERT INTO public.academy_modules (id, course_id, title, sort_order, description, test_question_count, test_pass_pct, test_retry_minutes) VALUES
  ('109479f0-677d-45d7-82db-0e97a20826f8', '9f553b3f-110b-4db5-8226-e348fe4a582a', 'Markt kartieren und finden', 3, 'Nach diesem Modul kannst du eine Marktkarte mit 30 Zielfirmen anlegen, mit Boolean, X-Ray und KI-Suche passende Menschen finden und dabei die Datenschutz-Regeln einhalten.', 15, 80, 120)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_lessons (id, module_id, title, content_type, body, duration_min, is_premium, sort_order, learning_goal, vorlage_title, vorlage_body, quiz_question_count) VALUES
  ('bcb922b6-da3a-46a6-8bb7-72321598cf06', '109479f0-677d-45d7-82db-0e97a20826f8', 'Die Marktkarte: 30 Zielfirmen', 'text', 'Anfänger suchen nach Jobtiteln und finden immer dieselben Profile. Wer nur nach Titeln sucht, verpasst alle, die dieselbe Arbeit unter einem anderen Titel machen. Profis überlegen zuerst, wo die gesuchten Menschen heute arbeiten. Das Ergebnis ist die Marktkarte: mindestens 30 Zielfirmen, jede mit Begründung.

## Woher die 30 Firmen kommen

Denk in drei Ringen:
- Wettbewerber: Firmen, die dasselbe herstellen oder dieselbe Leistung anbieten.
- Nachbarbranchen: Firmen, in denen dieselbe Arbeit in einem anderen Umfeld gemacht wird. Wer Verpackungsmaschinen konstruiert, kennt oft ähnliche Technik wie in der Abfüll- oder Fördertechnik.
- Region: Arbeitgeber im Pendelbereich, auch aus anderen Branchen, wenn die Aufgabe ähnlich ist.

Startpunkte liefert das Briefing: Unter „Gute Kandidaten kommen aus“ nennt der Kunde oft schon Firmen. Weitere findest du über Verbandslisten, Ausstellerlisten von Messen, Branchenportale, Firmenwebseiten und Stellenanzeigen der Wettbewerber.

## Was in jede Zeile gehört

- Firma und Standort
- Ring: Wettbewerber, Nachbarbranche oder Region
- Begründung in einem Satz: Warum arbeiten dort passende Menschen?
- Typische Jobtitel dort, als Stichworte für deine Suche
- Status: frei oder gesperrt, mit Grund

## Der Abgleich vor der ersten Ansprache

Bevor du jemanden ansprichst, gleichst du jede Firma ab:
- „Nicht abwerben bei“ im Briefing: Dort sprichst du für diese Stelle niemanden an.
- Der Kunde selbst: Bei ihm wirbst du nie ab.
- Firmen, für die du selbst gerade suchst: Auch dort wirbst du nicht ab. Wer bei den eigenen Kunden abwirbt, verliert ihr Vertrauen.

Eine einzige gesperrte Firma auf der Liste kann das Vertrauen des Kunden kosten. In der Prüfung darf keine einzige auf deiner Karte stehen.

## Die Karte als Beratung

Die Marktkarte hilft auch dem Kunden. Gibt es im Pendelbereich nur zwölf passende Firmen, ist das eine wichtige Nachricht: Vielleicht braucht es Tage im Homeoffice, Hilfe beim Umzug oder ein breiteres Profil. Die Karte macht diese Marktrealität sichtbar, bevor Wochen vergehen.

## Beispiel

Für die fiktive Sauer Verpackungstechnik in Fulda sucht Headhunterin Nina Becker eine Elektrokonstrukteurin. Sie listet 11 Wettbewerber aus dem Verpackungsmaschinenbau, 10 Firmen aus Nachbarbranchen wie Abfüll- und Fördertechnik und 12 Arbeitgeber mit Elektrokonstruktion im Pendelbereich. Beim Abgleich fällt eine Firma heraus, weil sie unter „Nicht abwerben bei“ steht. Es bleiben 32 freie Zielfirmen, jede mit Begründung.

## Das Wichtigste

- Erst die Firmen, dann die Menschen: mindestens 30 Zielfirmen aus Wettbewerb, Nachbarbranchen und Region.
- Jede Zeile mit Begründung und Status.
- Vor der ersten Ansprache abgleichen: „Nicht abwerben bei“, der Kunde selbst, deine eigenen Kunden.', 8, false, 1, 'Nach diesem Thema kannst du eine Marktkarte mit mindestens 30 begründeten Zielfirmen erstellen und sie gegen gesperrte Firmen abgleichen.', 'Vorlage Marktkarte', '## Kopf

Stelle: ___ · Region und Pendelbereich: ___ · Stand vom: ___

## Spalten je Zeile

- Firma und Standort
- Ring: Wettbewerber, Nachbarbranche oder Region
- Begründung in einem Satz
- Typische Jobtitel dort
- Quelle: Briefing, Verband, Messe, Webseite
- Status: frei oder gesperrt, mit Grund

## Ziel

- Mindestens 30 freie Zielfirmen
- Als Richtwert etwa ein Drittel je Ring

## Abgleich vor der ersten Ansprache

- „Nicht abwerben bei“ im Briefing geprüft
- Den Kunden selbst ausgeschlossen
- Firmen ausgeschlossen, für die du selbst gerade suchst

## Rückmeldung an den Kunden

- Wie viele passende Firmen gibt es im Pendelbereich?
- Was heißt das für Profil, Homeoffice oder Gehalt?', 5)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('d543fdb1-b7e1-45ef-80f4-43ac33783609', 'bcb922b6-da3a-46a6-8bb7-72321598cf06', 'single', 'Du suchst eine Lohnbuchhalterin für einen Kunden in Kassel. Auf deiner Marktkarte stehen bisher acht Steuerkanzleien aus Kassel.', 'Was fehlt deiner Liste am meisten?', '[{"id":"a","text":"Nichts, Steuerkanzleien sind für diese Stelle die einzige sinnvolle Quelle."},{"id":"b","text":"Nachbarbranchen und Region: Lohnbüros, Dienstleister und Firmen mit eigener Lohnabrechnung."},{"id":"c","text":"Kanzleien in ganz Deutschland, die gerade eine ähnliche Anzeige geschaltet haben."}]'::jsonb, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('d543fdb1-b7e1-45ef-80f4-43ac33783609', '"b"'::jsonb, 'Eine Marktkarte denkt in drei Ringen. Dieselbe Arbeit wird auch in Nachbarbranchen und bei Arbeitgebern im Pendelbereich gemacht.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('d3c247a2-25dc-4baa-8c08-0bca16a726e3', 'bcb922b6-da3a-46a6-8bb7-72321598cf06', 'single', 'Beim Abgleich siehst du: Eine deiner besten Zielfirmen steht im Briefing unter „Nicht abwerben bei“. Dort arbeitet eine Kandidatin, die du von früher kennst.', 'Was tust du?', '[{"id":"a","text":"Du setzt die Firma auf „gesperrt“ und sprichst dort für diese Stelle niemanden an."},{"id":"b","text":"Du sprichst die Kandidatin an, weil du sie von früher persönlich kennst."},{"id":"c","text":"Du sprichst sie an und informierst den Kunden, falls er sie einlädt."}]'::jsonb, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('d3c247a2-25dc-4baa-8c08-0bca16a726e3', '"a"'::jsonb, '„Nicht abwerben bei“ gilt ohne Ausnahme. Eine gesperrte Firma auf der Liste kostet das Vertrauen des Kunden.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('53a4322e-6bb7-4adc-8884-293849d0b171', 'bcb922b6-da3a-46a6-8bb7-72321598cf06', 'single', 'Deine Marktkarte zeigt nur 12 passende Firmen im Pendelbereich. Der Kunde erwartet die volle Arbeitszeit vor Ort.', 'Was ist der beste nächste Schritt?', '[{"id":"a","text":"Du suchst weiter und sagst dem Kunden erst etwas, wenn die Liste voll ist."},{"id":"b","text":"Du füllst die Liste mit weit entfernten Firmen auf und erwähnst das nicht."},{"id":"c","text":"Du meldest dem Kunden die Marktrealität und sprichst Homeoffice, Umzug oder Profil an."}]'::jsonb, 3) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('53a4322e-6bb7-4adc-8884-293849d0b171', '"c"'::jsonb, 'Die Marktkarte ist auch Beratung. Wenn der Markt klein ist, braucht der Kunde diese Nachricht früh, bevor Wochen vergehen.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('21c29611-a0a8-49a2-8d6a-a33495566514', 'bcb922b6-da3a-46a6-8bb7-72321598cf06', 'multi', NULL, 'Was gehört in jede Zeile der Marktkarte? (Mehrere Antworten richtig)', '[{"id":"a","text":"Eine Begründung in einem Satz"},{"id":"b","text":"Die Durchwahl der Personalabteilung"},{"id":"c","text":"Der Status frei oder gesperrt"},{"id":"d","text":"Der Ring: Wettbewerber, Nachbarbranche oder Region"}]'::jsonb, 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('21c29611-a0a8-49a2-8d6a-a33495566514', '["a","c","d"]'::jsonb, 'Jede Zeile braucht Firma, Ring, Begründung, typische Jobtitel und Status. Kontaktdaten der Personalabteilung brauchst du für die Karte nicht.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('da7eaceb-38f6-4577-855a-5276513ca4b1', 'bcb922b6-da3a-46a6-8bb7-72321598cf06', 'match', NULL, 'Ordne jede Firma zu. Gesucht wird eine Elektrokonstrukteurin für Verpackungsmaschinen in Fulda.', '{"left":[{"id":"f562869c","text":"Ein anderer Hersteller von Verpackungsmaschinen"},{"id":"cd1f764f","text":"Ein Hersteller von Abfüllanlagen"},{"id":"6d7e8f10","text":"Ein Aufzughersteller mit Elektrokonstruktion 30 Kilometer entfernt"},{"id":"1343c86b","text":"Eine Firma unter „Nicht abwerben bei“"}],"right":[{"id":"8d113fd3","text":"Wettbewerber"},{"id":"c6929d2d","text":"Nachbarbranche"},{"id":"61c40ed3","text":"Region"},{"id":"41b7b75f","text":"Gesperrt"}]}'::jsonb, 5) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('da7eaceb-38f6-4577-855a-5276513ca4b1', '{"f562869c":"8d113fd3","cd1f764f":"c6929d2d","6d7e8f10":"61c40ed3","1343c86b":"41b7b75f"}'::jsonb, 'Wettbewerber machen dasselbe, Nachbarbranchen ähnliche Arbeit in anderem Umfeld, die Region bringt Arbeitgeber im Pendelbereich. Gesperrte Firmen fallen raus.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('9c0c54ff-554e-4c15-8fe4-b539b4f01999', 'bcb922b6-da3a-46a6-8bb7-72321598cf06', 'single', NULL, 'Warum beginnt die Suche mit Firmen statt mit Jobtiteln?', '[{"id":"a","text":"Du findest auch Menschen, die dieselbe Arbeit unter einem anderen Titel machen."},{"id":"b","text":"Jobtitel lassen sich auf LinkedIn und XING grundsätzlich nicht durchsuchen."},{"id":"c","text":"Matchunt erlaubt Suchen nach Jobtiteln erst nach der ersten Einreichung."}]'::jsonb, 6) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('9c0c54ff-554e-4c15-8fe4-b539b4f01999', '"a"'::jsonb, 'Wer nur nach Titeln sucht, findet immer dieselben Profile. Die Marktkarte deckt den Markt systematisch ab.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_lessons (id, module_id, title, content_type, body, duration_min, is_premium, sort_order, learning_goal, vorlage_title, vorlage_body, quiz_question_count) VALUES
  ('22984f5a-4d8b-4a79-80ae-370e475f889b', '109479f0-677d-45d7-82db-0e97a20826f8', 'Suchen 2026: Boolean, X-Ray, KI-Suche', 'text', 'Mit der Marktkarte weißt du, wo du suchst. Jetzt geht es um das Wie. 2026 nutzt du drei Werkzeuge nebeneinander: Boolean-Suche, X-Ray-Suche und KI-Suche in Alltagssprache. Für die Übungen in der Akademie suchst du im Übungsmarkt mit erfundenen Profilen, nicht an echten Personen.

## Boolean: präzise und nachvollziehbar

Boolean-Suche verknüpft Begriffe nach festen Regeln. Auf LinkedIn gilt:
- AND: Beide Begriffe müssen vorkommen.
- OR: Einer der Begriffe reicht. Damit fasst du Synonyme, weibliche Formen und englische Titel zusammen.
- NOT: schließt einen Begriff aus.
- Anführungszeichen: suchen eine genaue Wortgruppe.
- Klammern: fassen OR-Gruppen zusammen.

Schreib die Operatoren groß. Ein Beispiel:

("Elektrokonstrukteur" OR "Elektrokonstrukteurin" OR "Electrical Design Engineer") AND (EPLAN OR "E-CAD") NOT Vertrieb

Such nicht nur nach Titeln. Nimm Werkzeuge, Normen und Verfahren dazu, die zur Stelle gehören.

## X-Ray: Google durchsucht öffentliche Profile

Mit X-Ray durchsuchst du über Google öffentliche Profile in den Netzwerken:
- site:linkedin.com/in ("Elektrokonstrukteur" OR "Elektrokonstrukteurin") EPLAN Fulda
- site:xing.com/profile Elektrokonstrukteur EPLAN Fulda

Bei Google trennst du Synonyme mit OR. Ausschließen geht mit einem Minus direkt vor dem Wort, zum Beispiel -Praktikum. Google findet nur, was öffentlich ist. X-Ray lohnt sich besonders für XING, das bei Ingenieuren, in der Produktion, im Gesundheitswesen und im regionalen Mittelstand stärker ist als LinkedIn. XING ergänzt LinkedIn, ersetzt es aber nicht.

## KI-Suche: schnell, aber nie ungeprüft

Bei der KI-Suche beschreibst du in Alltagssprache, wen du suchst, etwa im Hiring Assistant von LinkedIn. Den gibt es seit Juni 2026 auf Deutsch als Zusatzmodul. LinkedIn gibt an, dass Nutzer damit 81 Prozent weniger Profile sichten. Ein guter Suchauftrag nennt Rolle und Level, die Muss-Kriterien, die Region, Zielfirmen aus deiner Marktkarte und die Ausschlüsse.

Prüfe KI-Ergebnisse immer mit einer Boolean-Suche gegen: Fehlen Profile, die eindeutig passen? Sind Treffer dabei, die ein Muss nicht erfüllen? Die KI macht Vorschläge, die Auswahl triffst du.

Für Suchstrings hilft ein KI-Assistent wie ChatGPT oder Claude im Business-Tarif: Synonyme, englische Titel, Schreibweisen. Gib dabei nie Personendaten ein, also keine Namen, Profile oder Lebensläufe.

## Beispiel

Nina Becker sucht die Elektrokonstrukteurin für Sauer Verpackungstechnik. Ihr KI-Suchauftrag liefert 60 Profile. Ihre Boolean-Gegenprobe mit erweiterten Titeln findet zwölf weitere, die sich „Ingenieurin Steuerungstechnik“ nennen. Gleichzeitig sortiert sie acht KI-Treffer aus, die EPLAN nur aus dem Vertrieb kennen. Per X-Ray auf XING findet sie fünf Profile aus regionalen Mittelständlern, die auf LinkedIn fehlen.

## Das Wichtigste

- Boolean für Präzision, X-Ray für öffentliche Profile, besonders auf XING, KI-Suche für Tempo.
- KI-Ergebnisse immer mit Boolean gegenprüfen, die Auswahl triffst du.
- KI-Assistenten nur für Suchbegriffe nutzen, nie mit Personendaten.', 9, false, 2, 'Nach diesem Thema kannst du einen Boolean-String, eine X-Ray-Suche und einen KI-Suchauftrag schreiben und die Ergebnisse gegenprüfen.', 'Such-Spickzettel: Boolean, X-Ray, KI-Auftrag', '## Boolean auf LinkedIn

- Titel-Gruppe: ("Titel A" OR "Titel B" OR "englischer Titel")
- Können-Gruppe: (Werkzeug OR Norm OR Verfahren)
- Ausschluss: NOT Begriff
- Operatoren groß schreiben, Wortgruppen in Anführungszeichen

## X-Ray über Google

- site:linkedin.com/in ("Titel A" OR "Titel B") Können Ort
- site:xing.com/profile Titel Können Ort
- Ausschluss mit Minus direkt vor dem Wort, etwa -Praktikum

## KI-Suchauftrag

- Wen: Rolle und Level
- Muss: höchstens 5 Kriterien
- Wo: Region, Pendelbereich, Zielfirmen aus der Marktkarte
- Nicht: Ausschlüsse und gesperrte Firmen

## Gegenprobe

- Boolean-Suche zum selben Profil laufen lassen
- Fehlende passende Profile ergänzen
- Treffer ohne Muss aussortieren
- Keine Personendaten in KI-Assistenten', 5)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('5afdbee0-e5c8-4d2f-8f3f-7910ce69e6dd', '22984f5a-4d8b-4a79-80ae-370e475f889b', 'single', 'Du suchst Controller und Controllerinnen. Du willst auch Profile mit dem englischen Titel „Financial Controller“ finden, aber keine Praktika.', 'Welcher LinkedIn-String passt?', '[{"id":"a","text":"Controller AND Controllerin AND \"Financial Controller\" AND Praktikum"},{"id":"b","text":"(Controller OR Controllerin OR \"Financial Controller\") NOT Praktikum"},{"id":"c","text":"(Controller AND \"Financial Controller\") OR Controllerin OR Praktikum"}]'::jsonb, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('5afdbee0-e5c8-4d2f-8f3f-7910ce69e6dd', '"b"'::jsonb, 'OR fasst Synonyme und englische Titel in Klammern zusammen, NOT schließt Praktika aus. Mit AND zwischen den Titeln müssten alle gleichzeitig im Profil stehen.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('66a764c5-cb35-4705-80a4-d33f3e3a05f4', '22984f5a-4d8b-4a79-80ae-370e475f889b', 'single', 'Du willst über Google öffentliche XING-Profile von Bauleitern in Leipzig finden. Praktikanten sollen nicht dabei sein.', 'Welche Google-Suche passt?', '[{"id":"a","text":"site:xing.com/profile Bauleiter Leipzig -Praktikum"},{"id":"b","text":"xing Bauleiter AND Leipzig NOT Praktikum"},{"id":"c","text":"site:xing.com Bauleiter OR Leipzig OR Praktikum"}]'::jsonb, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('66a764c5-cb35-4705-80a4-d33f3e3a05f4', '"a"'::jsonb, 'X-Ray beginnt mit site: und dem Profilpfad. Bei Google schließt du mit einem Minus aus, nicht mit NOT. OR zwischen allen Begriffen würde viel zu breit suchen.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('3f46f00a-0dcf-447a-80ed-bf56bd5e0e60', '22984f5a-4d8b-4a79-80ae-370e475f889b', 'single', 'Der Hiring Assistant liefert dir 50 Treffer für deine Stelle als Instandhaltungsleiter.', 'Wie gehst du weiter vor?', '[{"id":"a","text":"Du sprichst alle 50 Treffer direkt an, die KI hat sie bereits geprüft."},{"id":"b","text":"Du verwirfst die KI-Treffer und suchst stattdessen ausschließlich mit X-Ray."},{"id":"c","text":"Du prüfst mit Boolean gegen, ergänzt Fehlendes und sortierst Treffer ohne Muss aus."}]'::jsonb, 3) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('3f46f00a-0dcf-447a-80ed-bf56bd5e0e60', '"c"'::jsonb, 'Die KI macht Vorschläge. Eine Boolean-Gegenprobe zeigt, was fehlt und was nicht passt. Die Auswahl triffst du.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('1d807c47-ab44-4d72-824f-a74477e012aa', '22984f5a-4d8b-4a79-80ae-370e475f889b', 'multi', NULL, 'Wofür darfst du einen KI-Assistenten im Business-Tarif nutzen? (Mehrere Antworten richtig)', '[{"id":"a","text":"Den Lebenslauf einer Kandidatin mit Namen zusammenfassen lassen"},{"id":"b","text":"Synonyme und englische Titel für „Instandhaltungsleiter“ finden"},{"id":"c","text":"Einen Boolean-String erweitern lassen"},{"id":"d","text":"Aus den Muss-Kriterien der Stelle Suchbegriffe ableiten"}]'::jsonb, 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('1d807c47-ab44-4d72-824f-a74477e012aa', '["b","c","d"]'::jsonb, 'KI-Assistenten helfen bei Suchbegriffen und Strings. Personendaten wie Namen, Profile oder Lebensläufe gibst du dort nie ein.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('bbc5dadb-dccc-4d53-8688-214c5ed0189b', '22984f5a-4d8b-4a79-80ae-370e475f889b', 'match', NULL, 'Ordne jedes Zeichen seiner Wirkung zu.', '{"left":[{"id":"f56756c9","text":"OR"},{"id":"2d973f0a","text":"AND"},{"id":"85ecb7dc","text":"Anführungszeichen"},{"id":"0dd30231","text":"Minus vor einem Wort bei Google"}],"right":[{"id":"8adac1cf","text":"Einer der Begriffe reicht"},{"id":"69a03479","text":"Beide Begriffe müssen vorkommen"},{"id":"fbdb77c9","text":"Genaue Wortgruppe"},{"id":"ae62bc88","text":"Begriff ausschließen"}]}'::jsonb, 5) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('bbc5dadb-dccc-4d53-8688-214c5ed0189b', '{"f56756c9":"8adac1cf","2d973f0a":"69a03479","85ecb7dc":"fbdb77c9","0dd30231":"ae62bc88"}'::jsonb, 'Mit diesen Zeichen steuerst du, wie breit oder eng deine Suche ist.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('34c6fd2f-1b22-4ad2-82bf-3979aca8050e', '22984f5a-4d8b-4a79-80ae-370e475f889b', 'single', NULL, 'Für welche Zielgruppen ist XING eine wichtige Ergänzung zu LinkedIn?', '[{"id":"a","text":"Vor allem für Gründer und Fachleute aus internationalen Tech-Startups"},{"id":"b","text":"Für Ingenieure, Produktion, Gesundheitswesen und regionalen Mittelstand"},{"id":"c","text":"Vor allem für Berufseinsteiger, die aus dem Ausland nach Deutschland kommen"}]'::jsonb, 6) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('34c6fd2f-1b22-4ad2-82bf-3979aca8050e', '"b"'::jsonb, 'XING ist in diesen Bereichen stärker als LinkedIn. Es ergänzt LinkedIn, ersetzt es aber nicht.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_lessons (id, module_id, title, content_type, body, duration_min, is_premium, sort_order, learning_goal, vorlage_title, vorlage_body, quiz_question_count) VALUES
  ('10b6115a-f010-42a9-8472-4e6c4036e199', '109479f0-677d-45d7-82db-0e97a20826f8', 'Die unterschätzten Quellen und die Datenschutz-Regeln', 'text', 'Viele Anfänger stürzen sich sofort auf LinkedIn. Die Besten fangen woanders an. In der Auswertung von Recruiterflow stammen 71 Prozent der Vermittlungen von Kandidaten, die vorher schon im eigenen System waren. Bei den besten 25 Prozent sind es 74 Prozent, beim Rest 59 Prozent.

## Die Reihenfolge der Quellen

- Dein Bestand zuerst: Menschen, mit denen du schon gesprochen hast und die in deiner Akte auf Matchunt stehen. Sie kennen dich und antworten schneller.
- Empfehlungen: Beende jedes Gespräch mit „Wen kennen Sie, der dafür in Frage kommt?“. Auch ein Nein zur Stelle kann so zu einem Namen führen. Über LinkedIn braucht es laut derselben Auswertung 283 Kandidaten je Vermittlung, über Empfehlungen 20.
- Verbände und Fachgruppen: Vorstände, Referenten und Arbeitskreise zeigen dir, wer sich in einem Thema auskennt.
- Messen und Konferenzen: Rednerlisten, Fachvorträge und Gespräche am Stand.
- Danach die Suche in LinkedIn und XING, wie in Thema 3.2.

## Die Datenschutz-Regeln

Sobald du Daten über eine Person nutzt, die sie dir nicht selbst gegeben hat, gilt die DSGVO:
- Informieren nach Art. 14 DSGVO: Die Person erfährt, wer du bist, woher du ihre Daten hast, wofür du sie nutzt und welche Rechte sie hat. Das muss spätestens bei der ersten Kontaktaufnahme passieren, in jedem Fall innerhalb eines Monats. Am sichersten steht ein kurzer Hinweis gleich in deiner ersten Nachricht. Fehlt er, drohen Schadensersatz und Bußgeld.
- Nur berufliche Quellen: LinkedIn, XING, Firmenwebseiten, Verbände, Fachveröffentlichungen. Private Netzwerke wie Facebook oder Instagram sind für die Recherche tabu.
- Keine Browser-Erweiterungen, die LinkedIn-Profile auslesen. Der Anbieter Kaspr musste dafür in Frankreich 240.000 Euro Bußgeld zahlen. Kontaktdaten holst du, wenn überhaupt, sparsam über Anbieter wie Dropcontact oder Cognism.
- Keine automatisierten Nachrichtenfolgen auf LinkedIn. Sie verstoßen gegen die Nutzungsbedingungen und können dein Konto kosten.
- Talentpool nur mit Einwilligung: Wer nicht zur aktuellen Stelle passt, bleibt nur in deinem Bestand, wenn er zustimmt, und nur befristet.
- Keine Lebensläufe mit Klarnamen in private KI-Konten.

## Beispiel

Kemal Arslan sucht eine Hygienefachkraft für eine fiktive Klinik in Münster. Zuerst schaut er in seine Akte: Zwei Hygienefachkräfte hat er im Frühjahr gesprochen. Die eine ist offen für Neues. Die andere will nicht wechseln, nennt ihm aber eine frühere Kollegin. Auf der Webseite eines Fachverbands findet er außerdem eine Referentin aus der Region. In seiner ersten Nachricht an sie steht ein kurzer Datenschutz-Hinweis. Ihr privates Instagram-Profil, auf das er zufällig stößt, nutzt er nicht.

## Das Wichtigste

- Erst Bestand, dann Empfehlungen, dann Verbände und Messen, dann die Netzwerke. Jedes Gespräch endet mit „Wen kennen Sie?“.
- Art. 14 DSGVO: spätestens beim ersten Kontakt informieren, in jedem Fall innerhalb eines Monats.
- Tabu sind private Netzwerke, Auslese-Erweiterungen und automatisierte Folgen. Talentpool nur mit Einwilligung und befristet.', 8, false, 3, 'Nach diesem Thema kannst du Bestand, Empfehlungen, Verbände und Messen als Quellen nutzen und dabei die Datenschutz-Regeln einhalten.', 'Datenschutz-Hinweis für die erste Nachricht', '## Kurzfassung für die erste Nachricht

„Ihren Namen und Ihre beruflichen Angaben habe ich aus Ihrem öffentlichen Profil auf [Quelle]. Ich nutze sie, um Ihnen eine berufliche Möglichkeit vorzustellen. Sie können dem jederzeit widersprechen, dann lösche ich Ihre Daten. Mehr dazu: [Link zur Datenschutzinformation].“

## Was die vollständige Information hinter dem Link enthält

- Wer die Daten verarbeitet, mit Kontakt
- Zweck: Vorstellung einer beruflichen Möglichkeit
- Rechtsgrundlage: berechtigtes Interesse nach Art. 6 Abs. 1 lit. f DSGVO
- Quelle und Art der Daten: Name, beruflicher Werdegang
- Wie lange die Daten gespeichert werden
- Rechte: Auskunft, Berichtigung, Löschung, Widerspruch, Beschwerde bei der Aufsichtsbehörde

## Vor dem Senden prüfen

- Quelle beruflich, nicht privat?
- Hinweis in der ersten Nachricht enthalten?
- Kein Name des Kunden in der Nachricht?', 5)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('8fa11630-73f9-49dc-8ace-2973db23ac74', '10b6115a-f010-42a9-8472-4e6c4036e199', 'single', 'Du sprichst mit einem erfahrenen Instandhalter. Er passt nicht ganz zur Stelle und will auch nicht wechseln.', 'Wie beendest du das Gespräch am besten?', '[{"id":"a","text":"Mit Dank und dem Versprechen, dich bei Gelegenheit wieder zu melden."},{"id":"b","text":"Mit der Frage, wen er kennt, der für die Stelle in Frage kommt."},{"id":"c","text":"Mit der Bitte, ihn ohne Frist in deinen Talentpool aufnehmen zu dürfen."}]'::jsonb, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('8fa11630-73f9-49dc-8ace-2973db23ac74', '"b"'::jsonb, 'Jedes Gespräch endet mit „Wen kennen Sie?“. Über Empfehlungen braucht es weit weniger Kontakte je Vermittlung als über LinkedIn. Ein Talentpool ohne Frist ist nicht erlaubt.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('83cfc9fd-2a0b-4b54-8fb0-40ff2c570228', '10b6115a-f010-42a9-8472-4e6c4036e199', 'single', 'Beim Recherchieren stößt du auf das öffentliche Facebook-Profil einer Kandidatin. Dort schreibt sie, dass sie mit ihrem Arbeitgeber unzufrieden ist.', 'Was tust du?', '[{"id":"a","text":"Du nutzt den Hinweis, um deine Ansprache persönlicher zu machen."},{"id":"b","text":"Du sprichst den Hinweis erst im Kandidateninterview vorsichtig an."},{"id":"c","text":"Du nutzt den Hinweis nicht, private Netzwerke sind für die Recherche tabu."}]'::jsonb, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('83cfc9fd-2a0b-4b54-8fb0-40ff2c570228', '"c"'::jsonb, 'Für die Recherche nutzt du nur berufliche Quellen. Private Netzwerke wie Facebook oder Instagram sind tabu, auch wenn du dort zufällig etwas findest.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('13400f93-ba86-4646-887a-47c4faa0fdd2', '10b6115a-f010-42a9-8472-4e6c4036e199', 'single', 'Du hast eine Bauleiterin über ihr öffentliches XING-Profil gefunden und willst sie anschreiben.', 'Wann informierst du sie nach Art. 14 DSGVO?', '[{"id":"a","text":"Spätestens mit deiner ersten Nachricht an sie."},{"id":"b","text":"Erst wenn sie einer Einreichung zugestimmt hat."},{"id":"c","text":"Innerhalb eines Jahres nach der ersten Speicherung."}]'::jsonb, 3) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('13400f93-ba86-4646-887a-47c4faa0fdd2', '"a"'::jsonb, 'Werden die Daten für die Kontaktaufnahme genutzt, informierst du spätestens beim ersten Kontakt, in jedem Fall innerhalb eines Monats. Am sichersten steht der Hinweis gleich in der ersten Nachricht.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('281c7fc3-6205-4c75-8376-74aff1630cb4', '10b6115a-f010-42a9-8472-4e6c4036e199', 'multi', NULL, 'Was ist bei der Suche tabu? (Mehrere Antworten richtig)', '[{"id":"a","text":"Browser-Erweiterungen, die LinkedIn-Profile auslesen"},{"id":"b","text":"Automatisierte Nachrichtenfolgen auf LinkedIn"},{"id":"c","text":"Eine X-Ray-Suche über Google nach öffentlichen Profilen"},{"id":"d","text":"Lebensläufe mit Klarnamen in ein privates KI-Konto laden"}]'::jsonb, 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('281c7fc3-6205-4c75-8376-74aff1630cb4', '["a","b","d"]'::jsonb, 'Auslese-Erweiterungen, automatisierte Folgen und Klarnamen in privaten KI-Konten verstoßen gegen Datenschutz oder Nutzungsbedingungen. X-Ray über öffentliche Profile ist ein normales Werkzeug.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('44942add-e228-43b3-82ed-8715d0ab9372', '10b6115a-f010-42a9-8472-4e6c4036e199', 'match', NULL, 'Ordne jede Quelle dem passenden Vorgehen zu.', '{"left":[{"id":"a36a7027","text":"Eigener Bestand"},{"id":"1e519e0a","text":"Empfehlungen"},{"id":"9a5c7261","text":"Verbände"},{"id":"d843d726","text":"Messen"}],"right":[{"id":"f6d254a4","text":"In der Akte nachsehen, wer schon im Gespräch war und offen ist"},{"id":"96ab065c","text":"Jedes Gespräch mit „Wen kennen Sie?“ beenden"},{"id":"64fee5ba","text":"Vorstände, Referenten und Arbeitskreise ansehen"},{"id":"7d749ca2","text":"Rednerlisten nutzen und am Stand ins Gespräch kommen"}]}'::jsonb, 5) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('44942add-e228-43b3-82ed-8715d0ab9372', '{"a36a7027":"f6d254a4","1e519e0a":"96ab065c","9a5c7261":"64fee5ba","d843d726":"7d749ca2"}'::jsonb, 'Jede Quelle hat ihr eigenes Vorgehen. Der eigene Bestand und Empfehlungen kommen zuerst, weil sie am schnellsten zu passenden Menschen führen.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('8f3c704a-54cb-4056-8c26-2fa9c3d330d5', '10b6115a-f010-42a9-8472-4e6c4036e199', 'single', 'Ein Kandidat passt nicht zur aktuellen Stelle, wäre aber für spätere Stellen interessant.', 'Was ist richtig?', '[{"id":"a","text":"Du speicherst ihn im Talentpool, weil er dir seine Daten im Gespräch gegeben hat."},{"id":"b","text":"Du fragst ihn um seine Einwilligung und speicherst seine Daten nur befristet."},{"id":"c","text":"Du speicherst ihn ohne Frist, solange er nicht ausdrücklich widerspricht."}]'::jsonb, 6) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('8f3c704a-54cb-4056-8c26-2fa9c3d330d5', '"b"'::jsonb, 'In einen Talentpool kommt nur, wer eingewilligt hat, und das nur befristet. Das Gespräch für eine bestimmte Stelle reicht dafür nicht.') ON CONFLICT (question_id) DO NOTHING;

-- Modul 4: Ansprechen
INSERT INTO public.academy_modules (id, course_id, title, sort_order, description, test_question_count, test_pass_pct, test_retry_minutes) VALUES
  ('1640df10-b201-4eb1-8794-ce48f28e5b63', '9f553b3f-110b-4db5-8226-e348fe4a582a', 'Ansprechen', 4, 'Nach diesem Modul kannst du passive Kandidaten persönlich, kurz und rechtssicher ansprechen: mit einer Nachricht unter 400 Zeichen, einer Folge aus drei Kontakten und einem kurzen Erstanruf.', 15, 80, 120)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_lessons (id, module_id, title, content_type, body, duration_min, is_premium, sort_order, learning_goal, vorlage_title, vorlage_body, quiz_question_count) VALUES
  ('aa294720-b61a-4066-8807-806ac03b3270', '1640df10-b201-4eb1-8794-ce48f28e5b63', 'Die Nachricht, die beantwortet wird', 'text', 'Passive Kandidaten bekommen viele Nachrichten. Sie lesen die ersten zwei Zeilen und entscheiden in Sekunden, ob sie antworten. Deine Nachricht muss dort zeigen: Hier hat jemand mein Profil wirklich gelesen.

## Drei Bausteine, unter 400 Zeichen

- Warum gerade du: ein konkreter Punkt aus dem Profil, etwa ein Projekt, eine Station oder ein Spezialgebiet. Nicht „Ihr beeindruckendes Profil“.
- Warum diese Stelle: ein Wechselargument aus dem Briefing, das für diese Person zählt, zum Beispiel mehr Verantwortung, eine neue Technik oder kürzere Wege.
- Eine kleine Frage: leicht zu beantworten, ohne Druck. „Wäre das grundsätzlich ein Thema für Sie?“

Kurz lohnt sich: Laut einer LinkedIn-Auswertung bekommen Nachrichten unter 400 Zeichen rund 22 % mehr Antworten als der Durchschnitt. Kurz heißt: keine Firmengeschichte, keine Liste mit Vorteilen, keine vollständige Stellenbeschreibung.

## Die Firma beschreiben, nicht nennen

Den Firmennamen nennst du in der ersten Nachricht nicht, auch wenn du ihn kennst. Die Suche ist vertraulich, und wer den Namen kennt, kann sich am Headhunter vorbei direkt bewerben. Auf Matchunt bleiben beide Seiten anonym, bis die Firma ein Interview anfragt und der Kandidat zustimmt. Beschreibe stattdessen Branche, Größe und Region. Die anonyme Anzeige aus „Anzeige & Ansprache“ liefert dir diese Eckdaten und fertige Kurztexte als Ausgangspunkt.

## Du oder Sie

Dazu gibt es keine Studie, aber eine bewährte Praxisregel: „Sie“ ist der Standard, besonders im Mittelstand, in der Industrie und bei erfahrenen Fachleuten. „Du“ passt in Tech und bei Startups, wenn sich die Person selbst so präsentiert. Im Zweifel siezt du und überlässt den Wechsel dem Kandidaten.

## Der Datenschutz-Hinweis

Wenn du jemanden direkt ansprichst, musst du ihn nach Art. 14 DSGVO informieren, woher du seine Daten hast und was du damit tust, spätestens beim ersten Kontakt. Praktisch heißt das: ein kurzer Satz mit Link zu deinen Datenschutzhinweisen am Ende der Nachricht.

## KI als Entwurf, nicht als Absender

In einer Auswertung aus dem Vertrieb bekamen reine KI-Texte 4,1 % Antworten, selbst geschriebene 10,4 % und KI-Entwurf plus eigene Überarbeitung 14,7 %. Nutze KI oder die Matchunt-Texte als Gerüst. Die persönliche Begründung schreibst du selbst.

## Beispiel

Jana Keller sucht eine Leitung Instandhaltung für einen Maschinenbauer. Im Profil von Herrn Demir fällt ihr ein Projekt zur vorausschauenden Wartung auf. Sie schreibt:

„Guten Tag Herr Demir, Ihr Projekt zur vorausschauenden Wartung hat mich neugierig gemacht. Ein Maschinenbauer aus Ostwestfalen mit rund 600 Beschäftigten baut genau das gerade auf und sucht dafür eine Leitung Instandhaltung mit eigenem Budget. Wäre das grundsätzlich ein Thema für Sie? Viele Grüße, Jana Keller (Datenschutzhinweise: Link)“

Das sind gut 330 Zeichen: persönlicher Grund, Wechselargument, kleine Frage. Kein Firmenname.

## Das Wichtigste

- Unter 400 Zeichen: warum du, warum diese Stelle, eine kleine Frage.
- Firma beschreiben statt nennen, Datenschutz-Hinweis beim ersten Kontakt.
- Im Zweifel „Sie“. KI liefert den Entwurf, die Begründung kommt von dir.', 8, false, 1, 'Nach diesem Thema kannst du eine Erstnachricht unter 400 Zeichen schreiben, die persönlich begründet ist, keinen Firmennamen verrät und die passende Anrede trifft.', 'Baukasten Erstnachricht', '## Aufbau (unter 400 Zeichen)

- Anrede: „Guten Tag Frau/Herr [Nachname]“ oder „Hallo [Vorname]“, wenn die Person sich im Profil selbst duzt
- Warum Sie: „Mir ist [konkretes Projekt, Station oder Spezialgebiet] aufgefallen.“
- Warum diese Stelle: „Ein [Branche] aus [Region] mit [Größe] sucht [Rolle] mit [ein Wechselargument].“
- Kleine Frage: „Wäre das grundsätzlich ein Thema für Sie?“
- Gruß: dein Name und Link zu deinen Datenschutzhinweisen

## Vor dem Senden prüfen

- Unter 400 Zeichen?
- Kein Firmenname und kein Detail, an dem man die Firma erkennt?
- Passt die Begründung nur auf diese eine Person?
- Anrede passend zu Branche und Profil, im Zweifel „Sie“?
- KI-Entwurf selbst überarbeitet, keine Personendaten in die KI gegeben?', 5)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('cf2808aa-e0fd-4337-8331-7a876a9a5b2e', 'aa294720-b61a-4066-8807-806ac03b3270', 'single', 'Headhunter Paul schreibt einem Vertriebsleiter: „Ihr beeindruckendes Profil hat mich überzeugt. Unser Kunde, die Weber Antriebstechnik GmbH, sucht einen Head of Sales. Haben Sie Zeit für ein Telefonat?“', 'Was ist das größte Problem dieser Nachricht?', '[{"id":"a","text":"Sie ist zu kurz, um bei einem Vertriebsleiter Vertrauen aufzubauen."},{"id":"b","text":"Sie nennt die Firma zu früh und begründet nicht, warum gerade er gemeint ist."},{"id":"c","text":"Sie endet mit einer Frage, statt gleich einen festen Termin vorzuschlagen."}]'::jsonb, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('cf2808aa-e0fd-4337-8331-7a876a9a5b2e', '"b"'::jsonb, 'Der Firmenname gehört nicht in die erste Nachricht, und „beeindruckendes Profil“ ist keine persönliche Begründung. Kurz zu sein und mit einer kleinen Frage zu enden ist dagegen richtig.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('7a7e61df-7f90-4b5e-83ad-efee36e0a69f', 'aa294720-b61a-4066-8807-806ac03b3270', 'single', 'Mia ist Senior-Entwicklerin bei einem Berliner Startup. In ihrem Profil steht: „Hi, ich bin Mia – sag gern Du.“', 'Welche Anrede wählst du in deiner ersten Nachricht?', '[{"id":"a","text":"„Du“, weil sie in Tech arbeitet und sich selbst so präsentiert."},{"id":"b","text":"„Sie“, weil die erste Nachricht immer gesiezt werden muss."},{"id":"c","text":"Erst „Sie“ im Gruß, dann „Du“ im Text, um beides abzudecken."}]'::jsonb, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('7a7e61df-7f90-4b5e-83ad-efee36e0a69f', '"a"'::jsonb, 'Die Praxisregel: „Du“ in Tech und bei Startups, wenn sich die Person selbst so präsentiert. „Sie“ ist nur im Zweifel die sichere Wahl.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('8980d53e-d25f-490a-870b-778cf1fcb18f', 'aa294720-b61a-4066-8807-806ac03b3270', 'single', 'Du suchst eine Projektleitung für den Bau von Rechenzentren. Im Profil eines Kandidaten steht: „Neubau Rechenzentrum, Bauherrenvertretung“.', 'Welcher Satz begründet am besten, warum gerade er gemeint ist?', '[{"id":"a","text":"Ihr Profil passt hervorragend zu einer spannenden Position bei uns."},{"id":"b","text":"Mit Ihrer langjährigen Erfahrung sind Sie für viele Firmen interessant."},{"id":"c","text":"Ihr Rechenzentrumsprojekt als Bauherrenvertreter passt genau zu dieser Aufgabe."}]'::jsonb, 3) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('8980d53e-d25f-490a-870b-778cf1fcb18f', '"c"'::jsonb, 'Nur dieser Satz greift einen konkreten Punkt aus seinem Profil auf. Die anderen beiden passen auf jeden und wirken wie Massenware.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('cb24e935-8491-4c30-8802-9f318ee65dc0', 'aa294720-b61a-4066-8807-806ac03b3270', 'multi', NULL, 'Was gehört in eine gute Erstnachricht? (Mehrere Antworten richtig)', '[{"id":"a","text":"Der Name der Firma, damit die Nachricht seriös wirkt"},{"id":"b","text":"Ein konkreter Grund, warum gerade diese Person gemeint ist"},{"id":"c","text":"Eine vollständige Liste aller Vorteile und Zusatzleistungen"},{"id":"d","text":"Ein kurzer Satz mit Link zu deinen Datenschutzhinweisen"}]'::jsonb, 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('cb24e935-8491-4c30-8802-9f318ee65dc0', '["b","d"]'::jsonb, 'Die persönliche Begründung macht die Nachricht lesenswert, und der Datenschutz-Hinweis ist nach Art. 14 DSGVO spätestens beim ersten Kontakt fällig. Firmenname und lange Listen gehören nicht hinein.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('cff8c41b-53b6-4c58-8423-5cce0c57ffb7', 'aa294720-b61a-4066-8807-806ac03b3270', 'single', 'Tom lässt eine KI 50 Erstnachrichten schreiben und verschickt sie unverändert, um Zeit zu sparen.', 'Was zeigt die Auswertung aus dem Vertrieb zu diesem Vorgehen?', '[{"id":"a","text":"Reine KI-Texte bekommen die meisten Antworten, weil sie fehlerfrei sind."},{"id":"b","text":"KI-Entwurf mit eigener Überarbeitung bekommt deutlich mehr Antworten."},{"id":"c","text":"Zwischen KI-Texten und eigenen Texten gibt es keinen messbaren Unterschied."}]'::jsonb, 5) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('cff8c41b-53b6-4c58-8423-5cce0c57ffb7', '"b"'::jsonb, 'Reine KI-Texte kamen auf 4,1 % Antworten, KI-Entwurf plus eigene Überarbeitung auf 14,7 %. Die persönliche Begründung macht den Unterschied.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('cd9825e3-6026-45ce-8328-a40e6e427f21', 'aa294720-b61a-4066-8807-806ac03b3270', 'order', NULL, 'Bring die Bausteine einer Erstnachricht in die richtige Reihenfolge.', '[{"id":"3c0a0f8d","text":"Anrede passend zu Branche und Profil"},{"id":"19d7d952","text":"Warum gerade Sie: ein konkreter Punkt aus dem Profil"},{"id":"87df533a","text":"Warum diese Stelle: Firma beschreiben, ein Wechselargument"},{"id":"62d2a800","text":"Eine kleine Frage, die leicht zu beantworten ist"},{"id":"242616ca","text":"Gruß mit Link zu den Datenschutzhinweisen"}]'::jsonb, 6) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('cd9825e3-6026-45ce-8328-a40e6e427f21', '["3c0a0f8d","19d7d952","87df533a","62d2a800","242616ca"]'::jsonb, 'Erst zeigst du, dass du die Person meinst, dann was die Stelle ihr bietet. Die kleine Frage macht das Antworten leicht, der Datenschutz-Hinweis schließt die Nachricht ab.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_lessons (id, module_id, title, content_type, body, duration_min, is_premium, sort_order, learning_goal, vorlage_title, vorlage_body, quiz_question_count) VALUES
  ('56c7a6db-966c-4da0-8c65-9cbf2d3aadd5', '1640df10-b201-4eb1-8794-ce48f28e5b63', 'Drei Kontakte, zwei Kanäle, zehn Tage', 'text', 'Viele Anfänger schreiben eine Nachricht und warten. Doch keine Antwort heißt selten „Nein“. Meistens heißt es „nicht gesehen“ oder „gerade keine Zeit“. Deshalb planst du die Ansprache als Folge: drei Kontakte, zwei Kanäle, zehn Tage.

## Was die Zahlen sagen

Die Werte stammen überwiegend aus den USA. Sie sind Orientierung, keine Norm:

- Auf eine Netzwerk-Nachricht antwortet im Schnitt etwa jede sechste Person (17,1 %).
- Wer zwei Kanäle kombiniert, bekommt etwa doppelt so oft eine Antwort wie mit einem Kanal.
- Rund 93 % aller Antworten kommen bis zum dritten Kontakt. Ein vierter oder fünfter Kontakt bringt kaum noch Antworten, kostet aber Ansehen.

## Die Folge

- Tag 1: Netzwerk-Nachricht über LinkedIn oder XING, unter 400 Zeichen, mit Datenschutz-Hinweis.
- Tag 4: kurzer Anruf nach den Regeln aus Thema 4.3. Erreichst du die Person nicht, hinterlässt du keine Stellendetails bei Kollegen oder auf der Mailbox.
- Tag 10: zweite Netzwerk-Nachricht mit einem neuen Aspekt und einem freundlichen Ausstieg: „Wenn das Thema gerade nicht passt, ist das völlig in Ordnung.“

Kommt bis dahin keine Reaktion, ist Schluss. Jeder Kontakt bringt etwas Neues, denn „Haben Sie meine Nachricht gesehen?“ ist kein Inhalt. Verschicke von Hand: Automatisierte Folgen verstoßen gegen die Nutzungsbedingungen von LinkedIn und können dein Konto sperren lassen.

## Warum die E-Mail nicht dazugehört

Das deutsche Wettbewerbsrecht ist bei Werbe-E-Mails streng: Ohne Einwilligung sind sie unzulässig (§ 7 UWG). Wo genau die Grenze bei Mails an Kandidaten liegt, ist nicht abschließend geklärt. Deshalb gilt auf Matchunt: E-Mail erst, wenn der Kandidat geantwortet oder eingewilligt hat, etwa mit „Schicken Sie mir gern etwas“. Auch wenn du eine Adresse findest, schreibst du vorher keine Mail. Die E-Mail-Vorlage aus „Anzeige & Ansprache“ nutzt du also erst nach der ersten Antwort.

## Die anonyme Anzeige richtig teilen

Die anonyme Anzeige aus „Anzeige & Ansprache“ ist ein guter neuer Aspekt für Kontakt 3 und die beste Unterlage nach einer Antwort. Ergänzt du eigenen Text, prüfe: Steht dort etwas, an dem man die Firma erkennt? „Marktführer für Dosierpumpen aus Bad Kreuznach“ verrät den Kunden auch ohne Namen.

## Beispiel

Malte schreibt Frau Brandt, Controllerin bei einem Logistiker, am Montag über XING an. Keine Antwort. Am Donnerstag ruft er kurz an. Sie sagt: „Gerade schlecht, schicken Sie mir etwas.“ Malte fragt: „Gern. An welche Adresse darf ich es schicken?“ Sie nennt ihre private E-Mail-Adresse. Damit hat sie eingewilligt, und Malte schickt am selben Abend die anonyme Anzeige mit zwei Terminvorschlägen.

## Das Wichtigste

- Drei Kontakte in zehn Tagen, jeder mit neuem Inhalt, dann Schluss.
- Zwei Kanäle: Netzwerk-Nachricht und Anruf, von Hand verschickt.
- E-Mail erst nach Antwort oder Einwilligung.', 8, false, 2, 'Nach diesem Thema kannst du eine Ansprache-Folge aus drei Kontakten über zwei Kanäle in zehn Tagen planen, ohne gegen Wettbewerbsrecht oder Diskretion zu verstoßen.', 'Ansprache-Folge in zehn Tagen', '## Tag 1: Netzwerk-Nachricht

- Unter 400 Zeichen, persönliche Begründung, kleine Frage
- Link zu deinen Datenschutzhinweisen

## Tag 4: kurzer Anruf

- Name, Zweck, Interesse klären, Termin außerhalb der Arbeitszeit (siehe Leitfaden Erstanruf)
- Nicht erreicht: keine Stellendetails bei Kollegen oder auf der Mailbox

## Tag 10: zweite Netzwerk-Nachricht

- Neuer Aspekt, zum Beispiel ein Auszug aus der anonymen Anzeige
- Freundlicher Ausstieg: „Wenn das Thema gerade nicht passt, ist das völlig in Ordnung. Dann melde ich mich nicht weiter.“

## Danach

- Keine Reaktion: Ansprache beenden und notieren
- Antwort oder Einwilligung: jetzt E-Mail mit anonymer Anzeige und zwei Terminvorschlägen
- Jeden Schritt von Hand, keine automatisierten Folgen
- Vor dem Teilen der Anzeige prüfen: kein Detail, an dem man die Firma erkennt', 5)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('a5cfb3b0-4972-4395-8013-ad3a64188b87', '56c7a6db-966c-4da0-8c65-9cbf2d3aadd5', 'single', 'Malte hat am Montag eine Netzwerk-Nachricht geschickt. Bis Mittwoch kam keine Antwort.', 'Was ist jetzt der beste nächste Schritt?', '[{"id":"a","text":"Den Kandidaten streichen, denn keine Antwort heißt Nein."},{"id":"b","text":"Täglich kurz nachfragen, ob die Nachricht gelesen wurde."},{"id":"c","text":"Die Folge fortsetzen: am Donnerstag kurz anrufen, später nachfassen."}]'::jsonb, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('a5cfb3b0-4972-4395-8013-ad3a64188b87', '"c"'::jsonb, 'Keine Antwort heißt meistens „nicht gesehen“. Die geplante Folge mit Anruf und zweiter Nachricht holt die meisten Antworten, tägliches Nachfragen nervt nur.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('3f0f4b97-3bec-422b-826d-860de44d8fba', '56c7a6db-966c-4da0-8c65-9cbf2d3aadd5', 'single', 'Frau Brandt hat noch nicht reagiert. Malte findet ihre E-Mail-Adresse über ein Kontaktdaten-Werkzeug.', 'Darf er ihr die Stelle jetzt per E-Mail schicken?', '[{"id":"a","text":"Ja, weil die Adresse öffentlich auffindbar und damit freigegeben ist."},{"id":"b","text":"Nein, eine E-Mail kommt erst nach einer Antwort oder Einwilligung."},{"id":"c","text":"Ja, wenn er im Betreff deutlich „vertraulich“ vermerkt."}]'::jsonb, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('3f0f4b97-3bec-422b-826d-860de44d8fba', '"b"'::jsonb, 'Das Wettbewerbsrecht ist bei Werbe-E-Mails streng (§ 7 UWG). Auf Matchunt gilt deshalb: E-Mail erst nach Antwort oder Einwilligung, egal wie die Adresse gefunden wurde.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('f5d8f85f-79ab-42e3-8e38-62b21a66d679', '56c7a6db-966c-4da0-8c65-9cbf2d3aadd5', 'single', 'Nach Nachricht, Anruf und zweiter Nachricht hat ein Kandidat in zehn Tagen nicht reagiert.', 'Was tust du?', '[{"id":"a","text":"Die Ansprache beenden, denn fast alle Antworten kommen bis zum dritten Kontakt."},{"id":"b","text":"Zwei weitere Nachrichten schicken, damit er dich nicht vergisst."},{"id":"c","text":"Auf E-Mail wechseln, weil dieser Kanal noch nicht genutzt wurde."}]'::jsonb, 3) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('f5d8f85f-79ab-42e3-8e38-62b21a66d679', '"a"'::jsonb, 'Rund 93 % der Antworten kommen bis zum dritten Kontakt. Weitere Nachrichten bringen kaum etwas und schaden deinem Ruf, und E-Mail ist ohne Antwort oder Einwilligung tabu.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('568441c3-21c9-45e9-8964-4397c776d819', '56c7a6db-966c-4da0-8c65-9cbf2d3aadd5', 'multi', NULL, 'Was macht eine gute Ansprache-Folge aus? (Mehrere Antworten richtig)', '[{"id":"a","text":"Jeder Kontakt bringt einen neuen Inhalt statt einer bloßen Erinnerung"},{"id":"b","text":"Eine automatisierte LinkedIn-Folge, damit kein Kontakt vergessen wird"},{"id":"c","text":"Im dritten Kontakt den Firmennamen nennen, um Spannung zu erzeugen"},{"id":"d","text":"Netzwerk-Nachricht und Anruf werden miteinander kombiniert"}]'::jsonb, 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('568441c3-21c9-45e9-8964-4397c776d819', '["a","d"]'::jsonb, 'Zwei Kanäle verdoppeln etwa die Antworten, und jeder Kontakt braucht einen neuen Grund. Automatisierung kann das Konto sperren lassen, der Firmenname bleibt vertraulich.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('ed4667d3-0f97-45e7-83aa-defbcafc4adc', '56c7a6db-966c-4da0-8c65-9cbf2d3aadd5', 'order', NULL, 'Bring die Ansprache-Folge in die richtige Reihenfolge.', '[{"id":"4c602b19","text":"Netzwerk-Nachricht unter 400 Zeichen mit Datenschutz-Hinweis"},{"id":"54911489","text":"Kurzer Anruf: Name, Zweck, Interesse klären"},{"id":"dd8cf7f4","text":"Zweite Netzwerk-Nachricht mit neuem Aspekt und freundlichem Ausstieg"},{"id":"44086be1","text":"Nach Antwort oder Einwilligung: E-Mail mit Anzeige und Terminvorschlägen"}]'::jsonb, 5) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('ed4667d3-0f97-45e7-83aa-defbcafc4adc', '["4c602b19","54911489","dd8cf7f4","44086be1"]'::jsonb, 'Tag 1 Nachricht, Tag 4 Anruf, Tag 10 zweite Nachricht. Die E-Mail kommt erst, wenn der Kandidat geantwortet oder eingewilligt hat.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('34789fad-0c67-4f49-8416-c345c4ffa1f0', '56c7a6db-966c-4da0-8c65-9cbf2d3aadd5', 'single', 'Malte setzt vor die anonyme Anzeige eine eigene Einleitung: „Der größte Arbeitgeber in Weilheim, Hersteller von Kühlregalen, sucht …“', 'Was ist daran problematisch?', '[{"id":"a","text":"Nichts, solange der Firmenname selbst nicht genannt wird."},{"id":"b","text":"Eigene Einleitungen sind bei anonymen Anzeigen grundsätzlich verboten."},{"id":"c","text":"Größe, Branche und Ort verraten die Firma auch ohne Namen."}]'::jsonb, 6) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('34789fad-0c67-4f49-8416-c345c4ffa1f0', '"c"'::jsonb, 'Anonym heißt nicht erkennbar. Eine so genaue Beschreibung führt direkt zur Firma, auch ohne Namen. Eigene Ergänzungen sind erlaubt, wenn sie nichts verraten.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_lessons (id, module_id, title, content_type, body, duration_min, is_premium, sort_order, learning_goal, vorlage_title, vorlage_body, quiz_question_count) VALUES
  ('56586a80-e094-4c1c-8a02-356e3f73fbe7', '1640df10-b201-4eb1-8794-ce48f28e5b63', 'Der erste Anruf: 60 Sekunden, die erlaubt sind', 'text', 'Der Anruf ist der stärkste Kanal und der mit den meisten Regeln. Der Bundesgerichtshof hat entschieden (I ZR 221/01, I ZR 73/02): Ein Headhunter darf jemanden zur ersten Kontaktaufnahme am Arbeitsplatz anrufen, aber nur kurz. Der Arbeitgeber soll nicht hinnehmen müssen, dass seine Leute während der Arbeitszeit ausführlich abgeworben werden.

## Was erlaubt ist

- Dich mit Namen vorstellen und den Zweck nennen
- Die Stelle knapp umreißen
- Klären, ob grundsätzlich Interesse besteht
- Bei Interesse einen Termin außerhalb der Arbeitszeit vereinbaren

Nicht erlaubt: das Gespräch ausdehnen, überreden, nach einem Nein weiterbohren, wiederholt am Arbeitsplatz anrufen. Eine feste Minutengrenze steht in keinem Gesetz, der Maßstab heißt „kurz“. Plane deshalb für etwa 60 Sekunden. Nach spätestens drei Minuten ist Schluss, so wird es auch in der Zulassung geprüft.

## Der Ablauf

- Einstieg: Name, „ich bin Headhunterin“ und „Passt es für eine Minute?“
- Zweck: ein Satz zur Stelle und ein Satz, warum gerade diese Person.
- Frage: „Wäre das grundsätzlich ein Thema für Sie?“
- Bei Ja: Termin außerhalb der Arbeitszeit und Nummer klären. Details erst dann.
- Bei Nein: danken, beenden, notieren, damit niemand erneut anruft.

## Drei Einwände

- „Kein Interesse.“ Antwort: „Danke für die klare Antwort. Einen guten Tag noch.“ Kein Nachhaken. Das schützt dich rechtlich und deinen Ruf.
- „Schicken Sie mir was.“ Oft ein höflicher Ausstieg, manchmal echtes Interesse. Antwort: „Gern. An welche Adresse darf ich es schicken?“ Nennt die Person eine Adresse, hast du ihre Einwilligung für die E-Mail.
- „Wer ist der Kunde?“ Antwort: „Den Namen nenne ich am Telefon nicht, genauso wenig, wie ich Ihren Namen ohne Ihre Zustimmung weitergebe. Ich kann Ihnen sagen: Maschinenbau, rund 600 Beschäftigte, Ostwestfalen.“

## Beispiel

Jana ruft Herrn Demir vier Tage nach ihrer Nachricht an.

„Guten Tag Herr Demir, Jana Keller, ich bin Headhunterin. Passt es für eine Minute?“ – „Ich sitze im Büro, aber kurz geht.“ – „Ich hatte Ihnen wegen Ihres Wartungsprojekts geschrieben. Ein Maschinenbauer sucht eine Leitung Instandhaltung, die genau so etwas aufbaut. Wäre das grundsätzlich ein Thema?“ – „Klingt interessant. Was zahlen die denn?“ – „Das besprechen wir gern in Ruhe. Passt Ihnen Donnerstag um 18:30 Uhr, und unter welcher Nummer erreiche ich Sie privat?“ – „Ja, unter dieser hier.“ – „Dann bis Donnerstag.“

Das Gespräch dauert gut eine Minute. Die Gehaltsfrage beantwortet Jana bewusst nicht am Arbeitsplatz, sondern im Termin am Abend.

## Das Wichtigste

- Erlaubt ist kurz: Name, Zweck, Interesse klären, Termin außerhalb der Arbeitszeit.
- Ein Nein beendet das Gespräch. Kein Überreden, kein wiederholter Anruf am Arbeitsplatz.
- Den Firmennamen nennst du am Telefon nicht. Du beschreibst die Firma.', 9, false, 3, 'Nach diesem Thema kannst du einen Erstanruf am Arbeitsplatz kurz und rechtssicher führen und die häufigsten Einwände ruhig beantworten.', 'Leitfaden Erstanruf', '## Einstieg (etwa 15 Sekunden)

- „Guten Tag Frau/Herr [Nachname], [dein Name], ich bin Headhunter/in. Passt es für eine Minute?“

## Zweck (etwa 20 Sekunden)

- „Ein [Branche] aus [Region] sucht [Rolle]. Mir ist [konkreter Punkt aus dem Profil] aufgefallen, deshalb rufe ich an.“

## Interesse klären (etwa 10 Sekunden)

- „Wäre das grundsätzlich ein Thema für Sie?“

## Bei Ja (etwa 15 Sekunden)

- „Dann sprechen wir lieber in Ruhe außerhalb der Arbeitszeit. Passt [Tag] um [Uhrzeit]? Unter welcher Nummer erreiche ich Sie?“

## Bei Nein

- „Danke für die klare Antwort. Einen guten Tag noch.“ Beenden und notieren.

## Einwände

- „Schicken Sie mir was“: „Gern. An welche Adresse darf ich es schicken?“
- „Wer ist der Kunde?“: „Den Namen nenne ich am Telefon nicht. Ich kann Ihnen sagen: [Branche, Größe, Region].“

## Grenze

- Spätestens nach drei Minuten Schluss, kein Überreden, kein zweiter Anruf am Arbeitsplatz', 5)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('2d9975c1-0b58-4583-854d-735e62985261', '56586a80-e094-4c1c-8a02-356e3f73fbe7', 'single', 'Nach 30 Sekunden sagt die Kandidatin: „Kein Interesse, danke.“', 'Wie reagierst du?', '[{"id":"a","text":"Du nennst noch schnell das Gehaltsband, vielleicht ändert das ihre Meinung."},{"id":"b","text":"Du bedankst dich für die klare Antwort und beendest das Gespräch."},{"id":"c","text":"Du fragst, ob du sie nächste Woche noch einmal im Büro anrufen darfst."}]'::jsonb, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('2d9975c1-0b58-4583-854d-735e62985261', '"b"'::jsonb, 'Bei Desinteresse ist das Gespräch zu Ende. Nachhaken und wiederholte Anrufe am Arbeitsplatz sind nach den BGH-Regeln unzulässig und schaden deinem Ruf.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('a9d2d7d9-f2a4-40cd-8a31-c493a3dcff73', '56586a80-e094-4c1c-8a02-356e3f73fbe7', 'single', 'Der Kandidat ist interessiert und fragt am Arbeitsplatz nach Aufgaben, Team und Gehalt. Ihr sprecht schon zwei Minuten.', 'Was tust du?', '[{"id":"a","text":"Du schlägst einen Termin nach Feierabend vor und besprichst die Details dann."},{"id":"b","text":"Du beantwortest alle Fragen sofort, weil er sie selbst gestellt hat."},{"id":"c","text":"Du bittest ihn, in einen ruhigen Raum zu gehen, und machst dort weiter."}]'::jsonb, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('a9d2d7d9-f2a4-40cd-8a31-c493a3dcff73', '"a"'::jsonb, 'Am Arbeitsplatz ist nur ein kurzes Gespräch erlaubt. Sobald Interesse da ist, gehören die Details in einen Termin außerhalb der Arbeitszeit.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('aa9cfe23-f8f5-4e53-8095-1deffe692c6d', '56586a80-e094-4c1c-8a02-356e3f73fbe7', 'single', 'Am Telefon fragt der Kandidat: „Für welche Firma suchen Sie denn?“', 'Welche Antwort ist richtig?', '[{"id":"a","text":"Du nennst den Namen, weil er sonst wahrscheinlich auflegt."},{"id":"b","text":"Du sagst „Darf ich nicht sagen“ und gehst zur nächsten Frage."},{"id":"c","text":"Du beschreibst Branche, Größe und Region und hältst den Namen vertraulich."}]'::jsonb, 3) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('aa9cfe23-f8f5-4e53-8095-1deffe692c6d', '"c"'::jsonb, 'Der Firmenname bleibt vertraulich. Mit Branche, Größe und Region gibst du trotzdem genug, damit der Kandidat das Interesse einschätzen kann.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('118de7d5-91ba-4445-8bf6-54346f330598', '56586a80-e094-4c1c-8a02-356e3f73fbe7', 'multi', NULL, 'Was ist beim Erstanruf am Arbeitsplatz erlaubt? (Mehrere Antworten richtig)', '[{"id":"a","text":"Dich mit Namen vorstellen und den Zweck nennen"},{"id":"b","text":"Bei Zögern mehrfach nachhaken, bis ein Ja kommt"},{"id":"c","text":"Klären, ob grundsätzlich Interesse besteht"},{"id":"d","text":"Ausführlich über Gehalt, Team und Aufgaben sprechen"}]'::jsonb, 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('118de7d5-91ba-4445-8bf6-54346f330598', '["a","c"]'::jsonb, 'Erlaubt sind Name, Zweck, eine knappe Beschreibung, die Frage nach dem Interesse und ein Termin außerhalb der Arbeitszeit. Überreden und lange Gespräche am Arbeitsplatz sind es nicht.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('7e891ef6-6b5b-49ac-805b-7ecf8ac489e5', '56586a80-e094-4c1c-8a02-356e3f73fbe7', 'match', NULL, 'Ordne jedem Satz des Kandidaten die passende Reaktion zu.', '{"left":[{"id":"78367a2d","text":"„Kein Interesse.“"},{"id":"14530014","text":"„Schicken Sie mir was.“"},{"id":"847cfbc6","text":"„Wer ist der Kunde?“"},{"id":"bab77fc5","text":"„Klingt interessant, erzählen Sie mehr.“"}],"right":[{"id":"d6240433","text":"„Danke für die klare Antwort. Einen guten Tag noch.“"},{"id":"c4f21577","text":"„Gern. An welche Adresse darf ich es schicken?“"},{"id":"52ab3207","text":"„Den Namen nenne ich nicht. Maschinenbau, rund 600 Beschäftigte, Ostwestfalen.“"},{"id":"1fa9a28c","text":"„Gern in Ruhe. Passt Ihnen heute Abend um 18:30 Uhr?“"}]}'::jsonb, 5) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('7e891ef6-6b5b-49ac-805b-7ecf8ac489e5', '{"14530014":"c4f21577","78367a2d":"d6240433","847cfbc6":"52ab3207","bab77fc5":"1fa9a28c"}'::jsonb, 'Ein Nein beendet das Gespräch. Die Adresse ist die Einwilligung für die E-Mail. Die Firma beschreibst du, statt sie zu nennen. Interesse führt zum Termin außerhalb der Arbeitszeit.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('9648fdb6-c259-4777-8216-6031ad47bfca', '56586a80-e094-4c1c-8a02-356e3f73fbe7', 'single', 'Ein Kollege sagt: „Der BGH erlaubt beim Erstanruf genau 60 Sekunden.“', 'Stimmt das?', '[{"id":"a","text":"Ja, der BGH hat 60 Sekunden als feste Obergrenze festgelegt."},{"id":"b","text":"Nein, eine feste Zeit steht nirgends. Der Maßstab heißt „kurz“."},{"id":"c","text":"Nein, die Dauer ist egal, solange der Kandidat Interesse zeigt."}]'::jsonb, 6) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('9648fdb6-c259-4777-8216-6031ad47bfca', '"b"'::jsonb, 'Kein Gesetz und kein Urteil nennt eine Minutenzahl. Der Maßstab ist „kurz“. Deshalb planst du für etwa 60 Sekunden und hörst spätestens nach drei Minuten auf.') ON CONFLICT (question_id) DO NOTHING;

-- Modul 5: Das Kandidatengespräch
INSERT INTO public.academy_modules (id, course_id, title, sort_order, description, test_question_count, test_pass_pct, test_retry_minutes) VALUES
  ('f7247ef9-d27c-49f3-82b0-7b5651e14d7e', '9f553b3f-110b-4db5-8226-e348fe4a582a', 'Das Kandidatengespräch', 5, 'Nach diesem Modul kannst du ein Kandidatengespräch führen, das Motivation, Können und harte Fakten belastbar klärt und mit einer sauberen Zustimmung zur Vorstellung endet.', 15, 80, 120)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_lessons (id, module_id, title, content_type, body, duration_min, is_premium, sort_order, learning_goal, vorlage_title, vorlage_body, quiz_question_count) VALUES
  ('d5ca3e94-a7df-4231-8655-5688fb39cf85', 'f7247ef9-d27c-49f3-82b0-7b5651e14d7e', 'Warum wechseln, warum jetzt', 'text', 'Ein Lebenslauf zeigt, was jemand kann. Ob er wechselt, zeigt er nicht. Ein typischer Anfängerfehler: Die Motivation wird unterstellt statt geprüft. Das rächt sich spät, im Kundeninterview oder beim Angebot. In einer Stepstone-Befragung hatten 44 % der Bewerber in Deutschland mindestens einen Prozess abgebrochen, vor allem wegen Erwartungen (34 %) und Gehalt (33 %).

## Drei Fragen, die alles tragen

- Weg von: Was stört heute? „Was müsste sich bei Ihrem jetzigen Arbeitgeber ändern, damit Sie bleiben?“
- Hin zu: Was soll besser werden? „Woran merken Sie nach einem Jahr, dass der Wechsel richtig war?“
- Was müsste passieren: Welche Bedingung muss ein Angebot erfüllen? „Was muss auf dem Tisch liegen, damit Sie unterschreiben?“

Wer nur „weg von“ nennt, hat Frust, und Frust verfliegt, sobald der Chef nachbessert. Wer nur „hin zu“ nennt, ist neugierig, aber nicht in Bewegung. Stark ist beides zusammen.

## Warum jetzt?

Die zweite Schlüsselfrage heißt: „Was ist der Anlass, dass Sie gerade jetzt offen sind?“ Echte Wechsler haben einen Auslöser: einen neuen Chef, eine Umstrukturierung, ein Projektende, einen Umzug. Ohne Anlass bleibt es oft bei „irgendwann“. „Warum wechseln“ und „Warum jetzt“ sind in Matchunt Pflichtangaben vor dem Einreichen.

## Was fehlt zur 10?

Frag zum Schluss: „Auf einer Skala von 1 bis 10: Wie interessant ist diese Stelle für Sie?“ Egal, welche Zahl kommt, die nächste Frage lautet: „Was fehlt zur 10?“ Die Antwort ist deine Arbeitsliste: offene Fragen an den Kunden, Bedenken, Bedingungen. Eine niedrige Zahl ist keine Niederlage, sondern eine ehrliche Auskunft. Stell die Frage nach jedem Schritt im Prozess erneut.

## Zuhören statt verkaufen

Frag offen und hake nach: „Was genau meinen Sie?“, „Woran merken Sie das?“ Notiere die Gründe in den Worten des Kandidaten. Du brauchst sie zweimal: für die Einschätzung an den Kunden und später, wenn ein Gegenangebot kommt. Dann erinnerst du ihn an seine eigenen Gründe, nicht an deine.

## Beispiel

Sabine Roth leitet ein Buchhaltungsteam bei einem Großhändler. Im Gespräch sagt sie:

- Weg von: „Seit der Übernahme entscheidet die Zentrale alles.“
- Hin zu: „Ich will den Monatsabschluss wieder selbst gestalten.“
- Warum jetzt: „Im Januar wird mein Bereich zusammengelegt.“
- Skala: 7. Was fehlt zur 10? „Ich weiß nicht, ob zwei Tage Homeoffice drin sind.“

Ihr Headhunter stellt die Homeoffice-Frage noch am selben Tag über „Kunden fragen“ an die Firma. Kommt ein Ja, fragt er wieder nach der Zahl.

## Das Wichtigste

- Weg von, hin zu, was müsste passieren: in den Worten des Kandidaten notieren.
- „Warum jetzt?“ trennt Wechsler von Neugierigen.
- Skala 1 bis 10 und „Was fehlt zur 10?“ machen Bedenken sichtbar.', 9, false, 1, 'Nach diesem Thema kannst du die echte Wechselmotivation eines Kandidaten herausarbeiten und einschätzen, wie ernst sein Interesse ist.', 'Leitfaden Motivation', '## Weg von

- „Was läuft heute gut, was nicht?“
- „Was müsste sich bei Ihrem Arbeitgeber ändern, damit Sie bleiben?“

## Hin zu

- „Was soll in Ihrer nächsten Stelle anders sein?“
- „Woran merken Sie nach einem Jahr, dass der Wechsel richtig war?“

## Was müsste passieren

- „Was muss ein Angebot enthalten, damit Sie unterschreiben?“

## Warum jetzt

- „Was ist der Anlass, dass Sie gerade jetzt offen sind?“

## Skala

- „Von 1 bis 10: Wie interessant ist diese Stelle für Sie?“
- „Was fehlt zur 10?“ Antwort als Arbeitsliste notieren, offene Punkte über „Kunden fragen“ klären

## Notieren

- Antworten in den Worten des Kandidaten in die Interview-Erfassung übernehmen
- Warnzeichen: nur Geld als Grund, kein Anlass, nur „weg von“ ohne „hin zu“', 5)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('82b67701-d254-4e1a-824e-0d2d06d8f875', 'd5ca3e94-a7df-4231-8655-5688fb39cf85', 'single', 'Ein Kandidat nennt als einzigen Grund: „Ich verdiene zu wenig.“ Was ihn an der neuen Stelle reizt, kann er nicht sagen.', 'Welches Risiko siehst du vor allem?', '[{"id":"a","text":"Ein Gegenangebot: Mehr Geld vom jetzigen Arbeitgeber löst sein Problem."},{"id":"b","text":"Er ist für die Stelle wahrscheinlich überqualifiziert und langweilt sich."},{"id":"c","text":"Er wird im Kundeninterview zu hohe Ansprüche an das Team stellen."}]'::jsonb, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('82b67701-d254-4e1a-824e-0d2d06d8f875', '"a"'::jsonb, 'Wer nur „weg von“ nennt und als Grund allein das Geld, ist leicht zu halten. Ein Gehaltsplus beim jetzigen Arbeitgeber nimmt ihm den einzigen Wechselgrund.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('ea001dd6-9458-432b-8400-21072a38457b', 'd5ca3e94-a7df-4231-8655-5688fb39cf85', 'single', 'Eine Kandidatin bewertet die Stelle mit 6 von 10.', 'Was ist die beste nächste Frage?', '[{"id":"a","text":"„Dann passt es wohl nicht. Sollen wir es lieber lassen?“"},{"id":"b","text":"„Glauben Sie mir, diese Stelle ist eine echte 10.“"},{"id":"c","text":"„Was fehlt aus Ihrer Sicht noch zur 10?“"}]'::jsonb, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('ea001dd6-9458-432b-8400-21072a38457b', '"c"'::jsonb, 'Die Zahl selbst ist nur der Einstieg. Erst „Was fehlt zur 10?“ macht Bedenken sichtbar, die du klären kannst. Überreden oder Aufgeben verschenkt diese Information.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('808c9aae-7783-4039-8e82-67a514011d8d', 'd5ca3e94-a7df-4231-8655-5688fb39cf85', 'single', 'Auf die Frage „Warum jetzt?“ antwortet ein Kandidat: „Ich schaue mich eigentlich immer ein bisschen um.“', 'Was schließt du daraus?', '[{"id":"a","text":"Er ist besonders wechselbereit, weil er den Markt ständig beobachtet."},{"id":"b","text":"Ein Anlass fehlt. Du hakst nach, sonst bleibt es wohl bei Neugier."},{"id":"c","text":"Die Frage war unpassend, weil „Warum jetzt“ zu persönlich ist."}]'::jsonb, 3) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('808c9aae-7783-4039-8e82-67a514011d8d', '"b"'::jsonb, 'Echte Wechsler haben einen Auslöser. Ohne Anlass bleibt es oft bei „irgendwann“. Deshalb fragst du nach, statt Wechselbereitschaft zu unterstellen.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('88b4b456-21d6-4531-83bd-86ff4841f8e4', 'd5ca3e94-a7df-4231-8655-5688fb39cf85', 'match', NULL, 'Ordne jede Aussage der passenden Frage zu.', '{"left":[{"id":"c551164d","text":"„Mein neuer Chef lässt mich keine Entscheidung mehr treffen.“"},{"id":"27452b96","text":"„Ich möchte endlich ein eigenes Team aufbauen.“"},{"id":"e2033440","text":"„Im März endet mein Projekt, danach ist offen, was kommt.“"},{"id":"994b1470","text":"„Mit 30 Tagen Urlaub und Gleitzeit würde ich unterschreiben.“"}],"right":[{"id":"49ae4b9b","text":"Weg von"},{"id":"dcae3b35","text":"Hin zu"},{"id":"dca9554b","text":"Warum jetzt"},{"id":"a61a4a62","text":"Was müsste passieren"}]}'::jsonb, 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('88b4b456-21d6-4531-83bd-86ff4841f8e4', '{"c551164d":"49ae4b9b","27452b96":"dcae3b35","e2033440":"dca9554b","994b1470":"a61a4a62"}'::jsonb, 'Weg von beschreibt, was heute stört, hin zu, was besser werden soll. Der Anlass erklärt den Zeitpunkt, die Bedingung zeigt, was ein Angebot enthalten muss.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('477f48dd-a35d-428d-80b3-32462cfa5e56', 'd5ca3e94-a7df-4231-8655-5688fb39cf85', 'multi', NULL, 'Woran erkennst du eine starke Wechselmotivation? (Mehrere Antworten richtig)', '[{"id":"a","text":"Der Kandidat nennt ausschließlich das Gehalt als Grund"},{"id":"b","text":"Weg von und hin zu sind beide klar benannt"},{"id":"c","text":"Es gibt einen konkreten Anlass, warum gerade jetzt"},{"id":"d","text":"„Eigentlich bin ich zufrieden, aber erzählen Sie mal“"}]'::jsonb, 5) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('477f48dd-a35d-428d-80b3-32462cfa5e56', '["b","c"]'::jsonb, 'Stark ist die Motivation, wenn beides da ist, Frust und Ziel, und dazu ein Anlass. Nur Geld oder reine Neugier sind Warnzeichen.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('d4591e6d-2568-4890-8d10-d8a188b83fb7', 'd5ca3e94-a7df-4231-8655-5688fb39cf85', 'single', 'Du hast die Wechselgründe einer Kandidatin mitgeschrieben. Ein Kollege meint, Stichworte in deinen eigenen Worten reichen völlig.', 'Warum notierst du die Gründe besser in ihren eigenen Worten?', '[{"id":"a","text":"Weil der Kunde nur wörtliche Zitate als Beleg anerkennt."},{"id":"b","text":"Weil du sie für die Einschätzung und bei einem Gegenangebot brauchst."},{"id":"c","text":"Weil Matchunt ohne wörtliche Zitate keine Einreichung zulässt."}]'::jsonb, 6) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('d4591e6d-2568-4890-8d10-d8a188b83fb7', '"b"'::jsonb, 'Die eigenen Worte des Kandidaten tragen die Motivation in der Einschätzung. Kommt ein Gegenangebot, erinnerst du ihn an seine Gründe, nicht an deine.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_lessons (id, module_id, title, content_type, body, duration_min, is_premium, sort_order, learning_goal, vorlage_title, vorlage_body, quiz_question_count) VALUES
  ('e71d6537-0118-4c83-891d-fa7ff26f4881', 'f7247ef9-d27c-49f3-82b0-7b5651e14d7e', 'Können prüfen statt glauben', 'text', '„Ich bin sehr erfahren in der Inbetriebnahme.“ Das ist eine Behauptung, kein Beleg. Der Kunde bezahlt dich dafür, dass du prüfst, nicht dafür, dass du weitergibst. Prüfen heißt: nach konkreten Beispielen fragen, und zwar gezielt zu den Muss-Kriterien der Stelle.

## Von den Muss-Kriterien aus fragen

Nimm die höchstens fünf Muss-Kriterien aus dem Briefing. Zu jedem stellst du mindestens eine Beispielfrage. Kann-Kriterien kommen dran, wenn Zeit bleibt. So wird das Gespräch kein Nacherzählen des Lebenslaufs.

## Die Beispiel-Methode

Bitte um ein konkretes Erlebnis und führe durch vier Schritte:

- Situation: Wann und wo war das?
- Aufgabe: Was war Ihre Rolle, was war das Ziel?
- Handlung: Was haben Sie selbst getan?
- Ergebnis: Was kam heraus, und woran lässt sich das messen?

Achte auf „wir“. Spricht jemand nur von „wir“, frag: „Was war Ihr eigener Teil?“ Gute Nachfragen sind auch: „Wie groß war das Team?“ und „Was würden Sie heute anders machen?“

## Belege statt Adjektive

Schreib mit, was jemand getan hat, nicht wie er sich beschreibt:

- Adjektiv: „führungsstark“. Beleg: „führt seit 2023 ein Team von acht Personen, hat zwei Stellen selbst besetzt“.
- Adjektiv: „kommunikationsstark“. Beleg: „stellt monatlich die Zahlen in der Geschäftsführung vor“.

Am Ende bekommt jedes Muss-Kriterium ein Urteil: erfüllt, teilweise erfüllt oder nicht erfüllt, jeweils mit einem Satz Beleg.

## Identität prüfen

Gefälschte Profile nehmen zu. Das Analysehaus Gartner erwartet, dass bis 2028 jedes vierte Kandidatenprofil gefälscht ist. Prüfe deshalb:

- Führe mindestens ein Gespräch per Video mit Kamera.
- Gleiche Stationen und Zeiträume in Lebenslauf, Netzwerk-Profil und Gespräch ab.
- Frag nach Projektdetails, die nur kennt, wer dabei war.

Unstimmigkeiten sprichst du offen an. Oft gibt es eine harmlose Erklärung. Fehlt sie, reichst du nicht ein.

## Fair fragen

Frag nur, was mit der Stelle zu tun hat. Fragen zu Alter, Herkunft, Religion, Gesundheit, Familienstand oder Familienplanung sind tabu, auch wenn der Kunde „jemanden fürs junge Team“ sucht. Das Allgemeine Gleichbehandlungsgesetz (AGG) schützt unter anderem vor Benachteiligung wegen Alter, Herkunft, Religion und Behinderung.

## Beispiel

Muss-Kriterium: Inbetriebnahme von Schaltanlagen. Kandidat Lukas Berger erzählt von einer Umspannwerk-Erweiterung im Jahr 2025. Aufgabe: Bauleitung vor Ort. Handlung: drei Subunternehmer koordiniert, Zeitplan gesteuert. Ergebnis: zwei Wochen vor Plan übergeben. Auf die Frage „Haben Sie die Prüfungen selbst gemacht?“ sagt er: „Nein, das hat ein Kollege übernommen.“ Urteil: teilweise erfüllt. Beleg: koordiniert Inbetriebnahmen, prüft aber nicht selbst.

## Das Wichtigste

- Jedes Muss-Kriterium mit einem konkreten Beispiel prüfen: Situation, Aufgabe, Handlung, Ergebnis.
- Belege notieren statt Adjektive, und auf „ich“ statt „wir“ achten.
- Identität absichern: Video, Angaben abgleichen, Details nachfragen.', 9, false, 2, 'Nach diesem Thema kannst du die Muss-Kriterien mit Fragen nach konkreten Beispielen prüfen, Belege von Behauptungen unterscheiden und die Identität eines Kandidaten absichern.', 'Prüfbogen Muss-Kriterien', '## Je Muss-Kriterium (höchstens fünf)

- Kriterium: [aus dem Briefing]
- Einstiegsfrage: „Erzählen Sie von einer Situation, in der Sie [Kriterium] selbst verantwortet haben.“
- Situation: Wann und wo?
- Aufgabe: Rolle und Ziel?
- Handlung: Was hat die Person selbst getan?
- Ergebnis: Zahl, Zeit, Wirkung?
- Urteil: erfüllt / teilweise erfüllt / nicht erfüllt
- Beleg in einem Satz: …

## Identität

- Gespräch per Video mit Kamera geführt? ja / nein
- Stationen und Zeiträume in Lebenslauf und Profil stimmig? ja / nein
- Projektdetails glaubwürdig geschildert? ja / nein
- Unstimmigkeit angesprochen und geklärt? ja / nein

## Nicht fragen

- Alter, Herkunft, Religion, Gesundheit, Familienstand, Familienplanung', 5)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('d64a9de9-e7c1-4a91-8d9d-f8b58fc4fa55', 'e71d6537-0118-4c83-891d-fa7ff26f4881', 'single', 'Eine Kandidatin sagt: „Ich bin sehr stark in Verhandlungen mit Lieferanten.“ Das ist ein Muss-Kriterium der Stelle.', 'Was fragst du als Nächstes?', '[{"id":"a","text":"„Wie würden Sie Ihre Verhandlungsstärke von 1 bis 10 einschätzen?“"},{"id":"b","text":"„Erzählen Sie von Ihrer letzten Verhandlung: Was haben Sie erreicht?“"},{"id":"c","text":"„Gut. Und was würden Sie als Ihre größte Schwäche bezeichnen?“"}]'::jsonb, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('d64a9de9-e7c1-4a91-8d9d-f8b58fc4fa55', '"b"'::jsonb, 'Eine Selbsteinschätzung bleibt ein Adjektiv. Erst ein konkretes Beispiel mit Situation, Handlung und Ergebnis liefert einen Beleg für das Muss-Kriterium.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('6382f012-bbb5-41e9-82de-accc3804fd50', 'e71d6537-0118-4c83-891d-fa7ff26f4881', 'single', 'Ein Kandidat beschreibt ein Projekt ausführlich, spricht aber durchgehend von „wir haben …“.', 'Wie gehst du vor?', '[{"id":"a","text":"Du wertest das Projekt als Beleg, weil er offensichtlich dabei war."},{"id":"b","text":"Du notierst „teamfähig“, weil er so oft das Team erwähnt."},{"id":"c","text":"Du fragst nach: „Was war dabei Ihr eigener Teil?“"}]'::jsonb, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('6382f012-bbb5-41e9-82de-accc3804fd50', '"c"'::jsonb, 'Bei „wir“ bleibt offen, was die Person selbst getan hat. Erst die Nachfrage nach dem eigenen Teil macht aus der Erzählung einen Beleg.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('ab643960-b0cf-4ebf-870a-6eef49092928', 'e71d6537-0118-4c83-891d-fa7ff26f4881', 'single', 'Im Lebenslauf steht „2019–2024 bei Firma A“, im Netzwerk-Profil „2021–2024“. Ein Videogespräch lehnt der Kandidat ab, er will nur telefonieren.', 'Was tust du?', '[{"id":"a","text":"Du sprichst die Abweichung offen an und vereinbarst vor dem Einreichen ein Videogespräch."},{"id":"b","text":"Du übergehst das, weil Daten in Profilen oft nachlässig gepflegt sind."},{"id":"c","text":"Du brichst den Kontakt sofort ab und meldest ihn als Betrüger."}]'::jsonb, 3) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('ab643960-b0cf-4ebf-870a-6eef49092928', '"a"'::jsonb, 'Unstimmige Daten und kein Video sind Warnzeichen. Oft gibt es eine harmlose Erklärung, deshalb fragst du offen nach. Ohne Klärung reichst du nicht ein.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('79b974f9-8ebd-454f-8c2a-91a95893eb7f', 'e71d6537-0118-4c83-891d-fa7ff26f4881', 'multi', NULL, 'Welche Notizen sind Belege? (Mehrere Antworten richtig)', '[{"id":"a","text":"Führt seit 2023 ein Team von acht Personen"},{"id":"b","text":"Wirkt kompetent und sehr sympathisch"},{"id":"c","text":"Hat 2025 eine ERP-Umstellung im Werk geleitet, Start nach neun Monaten"},{"id":"d","text":"Sehr erfahren und hoch motiviert"}]'::jsonb, 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('79b974f9-8ebd-454f-8c2a-91a95893eb7f', '["a","c"]'::jsonb, 'Belege beschreiben, was jemand getan hat, mit Zahl, Zeit oder Ergebnis. Adjektive und Eindrücke kann der Kunde nicht prüfen.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('a197da2b-97e5-41f5-8b6b-8ba80c6c3632', 'e71d6537-0118-4c83-891d-fa7ff26f4881', 'order', NULL, 'Bring die Fragen der Beispiel-Methode in die richtige Reihenfolge.', '[{"id":"608b21e7","text":"„Wann und wo war das?“"},{"id":"11982914","text":"„Was war Ihre Rolle, und was war das Ziel?“"},{"id":"1dad6c93","text":"„Was haben Sie selbst getan?“"},{"id":"ccf33ef6","text":"„Was kam heraus, und woran lässt sich das messen?“"}]'::jsonb, 5) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('a197da2b-97e5-41f5-8b6b-8ba80c6c3632', '["608b21e7","11982914","1dad6c93","ccf33ef6"]'::jsonb, 'Erst die Situation, dann Aufgabe, eigene Handlung und Ergebnis. So entsteht ein vollständiges Beispiel, das sich gegen das Muss-Kriterium prüfen lässt.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('6d4508c2-6e17-4e47-8767-057f995925dc', 'e71d6537-0118-4c83-891d-fa7ff26f4881', 'single', 'Die Firma wünscht sich „jemanden, der ins junge Team passt“. Du überlegst, im Gespräch nach dem Alter zu fragen.', 'Was ist richtig?', '[{"id":"a","text":"Du fragst nach dem Alter, weil die Firma es ausdrücklich wünscht."},{"id":"b","text":"Du leitest das Alter aus dem Abschlussjahr ab und gibst es weiter."},{"id":"c","text":"Du fragst nicht nach dem Alter und prüfst stattdessen die Muss-Kriterien."}]'::jsonb, 6) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('6d4508c2-6e17-4e47-8767-057f995925dc', '"c"'::jsonb, 'Alter ist ein Merkmal, das das AGG schützt. Auch auf Wunsch des Kunden fragst du nicht danach und leitest es nicht ab. Maßstab sind die Muss-Kriterien.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_lessons (id, module_id, title, content_type, body, duration_min, is_premium, sort_order, learning_goal, vorlage_title, vorlage_body, quiz_question_count) VALUES
  ('09c542d1-9c56-4d32-84a6-617e82adb3aa', 'f7247ef9-d27c-49f3-82b0-7b5651e14d7e', 'Die harten Fakten und die Zustimmung', 'text', 'Motivation und Können sind geklärt. Jetzt kommen die Fakten, an denen Prozesse später scheitern: Geld, Zeit und andere Angebote. Frag früh und genau.

## Gehalt: Erwartung und Untergrenze

Frag nach dem, was kommen soll, nicht nach dem, was war:

- „Welches Bruttojahresgehalt erwarten Sie für diese Stelle, fix und variabel?“
- „Unter welchem Betrag würden Sie nicht wechseln?“
- Extras: Dienstwagen, Bonus, Homeoffice, Urlaub.

Nach dem bisherigen Gehalt fragst du nicht. Die EU-Entgelttransparenzrichtlinie verbietet Arbeitgebern diese Frage. Deutschland hat die Umsetzungsfrist im Juni 2026 verpasst, das Gesetz wird für 2027 erwartet. Auf Matchunt arbeiten wir schon heute so. Liegt die Untergrenze über dem Gehaltsband der Stelle, klärst du das vor dem Einreichen.

## Kündigungsfrist und Verfügbarkeit

Gesetzlich gelten vier Wochen. Üblich sind drei Monate, bei Führungskräften drei bis sechs Monate zum Quartalsende. Frag genau: „Wie lang ist Ihre Kündigungsfrist laut Vertrag, und zu welchem Termin?“ Daraus ergibt sich der früheste Starttermin.

## Laufende Prozesse

„Sprechen Sie gerade mit anderen Firmen oder Headhuntern? In welchem Stadium?“ Die Antwort zeigt dir, wie viel Tempo nötig ist, und schützt vor einer doppelten Vorstellung.

## Gegenangebots-Risiko

„Was machen Sie, wenn Ihr Chef Ihnen mehr Geld bietet?“ In einer britischen Umfrage nahm gut die Hälfte ihr letztes Gegenangebot an, drei Viertel davon waren nach einem Jahr trotzdem weg. Notiere die Antwort und die Wechselgründe dazu.

## Die Zustimmung

Ohne Zustimmung keine Vorstellung. Erkläre die Stelle mit ihren Eckdaten und wie Matchunt vorstellt: zuerst anonym. Den Namen erfährt die Firma erst, wenn sie ein Interview anfragt und der Kandidat zustimmt. Frag dann ausdrücklich: „Darf ich Sie für diese Stelle vorstellen?“ Die Zustimmung gilt für diese eine Stelle. Beim Einreichen bestätigst du sie mit einem Haken.

## Noch am selben Tag erfassen

Vor dem Einreichen ist in Matchunt ein abgeschlossenes Interview Pflicht. Mindestangaben in der Interview-Erfassung der Kandidatenakte: Gesprächsdatum, Gesprächsart, Warum wechseln, Warum jetzt, Wunschgehalt und Kündigungsfrist bzw. Verfügbarkeit. Mitschreiben ist gut. Aufnehmen darfst du nur mit ausdrücklicher Einwilligung, heimliche Aufnahmen sind strafbar (§ 201 StGB).

## Beispiel

Sabine Roth erwartet 72.000 Euro fix plus bis zu 8.000 Euro Bonus, ihre Untergrenze liegt bei 68.000 Euro. Kündigungsfrist: drei Monate zum Quartalsende. Kündigt sie bis Ende Dezember, kann sie am 1. April starten. Sie ist in einem weiteren Prozess in der zweiten Runde. Zum Gegenangebot sagt sie: „Geld hält mich nicht, die Zusammenlegung bleibt ja.“ Sie stimmt der Vorstellung für diese Stelle zu. Ihr Headhunter erfasst alles am selben Abend.

## Das Wichtigste

- Gehalt als Erwartung und Untergrenze, nie das bisherige Gehalt.
- Kündigungsfrist, laufende Prozesse und Gegenangebots-Risiko immer klären.
- Zustimmung für genau diese Stelle einholen und noch am selben Tag erfassen.', 9, false, 3, 'Nach diesem Thema kannst du Gehaltserwartung, Kündigungsfrist, laufende Prozesse und Gegenangebots-Risiko richtig erfragen, die Zustimmung zur Vorstellung einholen und alles in Matchunt erfassen.', 'Checkliste harte Fakten', '## Gehalt

- Erwartung brutto pro Jahr: fix …, variabel …, Extras …
- Untergrenze: …
- Nicht fragen: bisheriges Gehalt
- Liegt die Untergrenze über dem Band? Dann vor dem Einreichen klären

## Verfügbarkeit

- Kündigungsfrist laut Vertrag: … zum …
- Frühester Start: …

## Laufende Prozesse

- Andere Gespräche, Stadium, Tempo: …

## Gegenangebot

- „Was machen Sie, wenn Ihr Chef Ihnen mehr bietet?“ Antwort: …

## Zustimmung

- Stelle mit Eckdaten und anonyme Vorstellung erklärt
- „Darf ich Sie für diese Stelle vorstellen?“ Zustimmung am: …

## Am selben Tag in Matchunt erfassen

- Gesprächsdatum, Gesprächsart, Warum wechseln, Warum jetzt, Wunschgehalt, Kündigungsfrist bzw. Verfügbarkeit
- Interview abschließen', 5)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('579aa72f-3349-4943-884f-a9f854e45948', '09c542d1-9c56-4d32-84a6-617e82adb3aa', 'single', 'Du willst im Gespräch das Thema Gehalt klären.', 'Welche Frage stellst du?', '[{"id":"a","text":"„Was verdienen Sie aktuell, damit ich Sie besser einschätzen kann?“"},{"id":"b","text":"„Was erwarten Sie brutto im Jahr, und wo liegt Ihre Untergrenze?“"},{"id":"c","text":"„Wie viel Prozent mehr als heute möchten Sie gern verdienen?“"}]'::jsonb, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('579aa72f-3349-4943-884f-a9f854e45948', '"b"'::jsonb, 'Gefragt wird nach Erwartung und Untergrenze. Die EU-Entgelttransparenzrichtlinie verbietet die Frage nach dem bisherigen Gehalt, und auch „Prozent mehr als heute“ zielt darauf.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('1a781746-5ad0-4d67-8fc1-eb111fd272fe', '09c542d1-9c56-4d32-84a6-617e82adb3aa', 'single', 'Ein Kandidat hat drei Monate Kündigungsfrist zum Quartalsende. Er unterschreibt Mitte November und kündigt Ende November.', 'Wann kann er frühestens starten?', '[{"id":"a","text":"Am 1. Januar"},{"id":"b","text":"Am 1. März"},{"id":"c","text":"Am 1. April"}]'::jsonb, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('1a781746-5ad0-4d67-8fc1-eb111fd272fe', '"c"'::jsonb, 'Drei Monate ab Ende November reichen bis Ende Februar. Weil die Frist zum Quartalsende läuft, endet das Arbeitsverhältnis am 31. März. Start ist damit der 1. April.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('71591753-5fe3-4004-89ad-9df703a95d3a', '09c542d1-9c56-4d32-84a6-617e82adb3aa', 'single', 'Auf die Frage nach einem Gegenangebot sagt ein Kandidat: „Wenn mein Chef zehn Prozent drauflegt, bleibe ich wahrscheinlich.“', 'Wie gehst du damit um?', '[{"id":"a","text":"Du wertest das als hohes Risiko und klärst seine Gründe vor dem Einreichen."},{"id":"b","text":"Du reichst sofort ein, denn ob er bleibt, ist am Ende seine Sache."},{"id":"c","text":"Du rätst ihm, mit seinem Chef gar nicht erst darüber zu sprechen."}]'::jsonb, 3) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('71591753-5fe3-4004-89ad-9df703a95d3a', '"a"'::jsonb, 'Gut die Hälfte nimmt ein Gegenangebot an. Wer es selbst schon ankündigt, ist ein hohes Risiko. Du prüfst seine Wechselgründe, bevor du ihn vorstellst.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('5e8dafc2-20b1-4fcb-8480-eddf313d45f2', '09c542d1-9c56-4d32-84a6-617e82adb3aa', 'multi', NULL, 'Welche Angaben braucht ein abgeschlossenes Interview in Matchunt mindestens? (Mehrere Antworten richtig)', '[{"id":"a","text":"Gesprächsdatum und Gesprächsart"},{"id":"b","text":"Das bisherige Gehalt"},{"id":"c","text":"Warum wechseln und Warum jetzt"},{"id":"d","text":"Wunschgehalt und Kündigungsfrist bzw. Verfügbarkeit"}]'::jsonb, 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('5e8dafc2-20b1-4fcb-8480-eddf313d45f2', '["a","c","d"]'::jsonb, 'Die Mindestangaben sind Gesprächsdatum, Gesprächsart, Warum wechseln, Warum jetzt, Wunschgehalt und Kündigungsfrist bzw. Verfügbarkeit. Nach dem bisherigen Gehalt wird nicht gefragt.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('74068045-0df8-4768-8680-c0885731753e', '09c542d1-9c56-4d32-84a6-617e82adb3aa', 'order', NULL, 'Bring die Schritte vom Gespräch bis zur Einreichung in die richtige Reihenfolge.', '[{"id":"0d3fac2e","text":"Harte Fakten klären: Gehalt, Kündigungsfrist, Prozesse, Gegenangebot"},{"id":"14ef32bd","text":"Stelle und anonyme Vorstellung erklären"},{"id":"854e391d","text":"Ausdrückliche Zustimmung für diese Stelle einholen"},{"id":"32506daa","text":"Noch am selben Tag in der Interview-Erfassung festhalten und abschließen"},{"id":"b59db727","text":"Einreichen und die Zustimmung mit dem Haken bestätigen"}]'::jsonb, 5) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('74068045-0df8-4768-8680-c0885731753e', '["0d3fac2e","14ef32bd","854e391d","32506daa","b59db727"]'::jsonb, 'Zustimmen kann der Kandidat erst, wenn er weiß, wofür. Die Erfassung kommt am selben Tag, und ohne abgeschlossenes Interview lässt Matchunt kein Einreichen zu.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('b7c7185e-df71-4616-8e88-edd42bb09691', '09c542d1-9c56-4d32-84a6-617e82adb3aa', 'single', 'Du möchtest das Gespräch mit einer App aufnehmen, um später nichts zu vergessen.', 'Was gilt?', '[{"id":"a","text":"Erlaubt, solange die Aufnahme nur für dich bestimmt ist."},{"id":"b","text":"Nur mit ausdrücklicher Einwilligung, heimlich aufzunehmen ist strafbar."},{"id":"c","text":"Erlaubt, wenn du die Aufnahme nach einer Woche löschst."}]'::jsonb, 6) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('b7c7185e-df71-4616-8e88-edd42bb09691', '"b"'::jsonb, 'Wer das nicht öffentlich gesprochene Wort heimlich aufnimmt, macht sich strafbar (§ 201 StGB), egal wofür. Mitschreiben ist jederzeit möglich.') ON CONFLICT (question_id) DO NOTHING;

-- Modul 6: Vorstellen, das überzeugt
INSERT INTO public.academy_modules (id, course_id, title, sort_order, description, test_question_count, test_pass_pct, test_retry_minutes) VALUES
  ('170fc78f-ab09-43f0-8858-3c47ddce7515', '9f553b3f-110b-4db5-8226-e348fe4a582a', 'Vorstellen, das überzeugt', 6, 'Nach diesem Modul kannst du entscheiden, wen du einreichst, eine anonyme und faire Einschätzung schreiben und KI so nutzen, dass Datenschutz und dein eigenes Urteil gewahrt bleiben.', 15, 80, 120)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_lessons (id, module_id, title, content_type, body, duration_min, is_premium, sort_order, learning_goal, vorlage_title, vorlage_body, quiz_question_count) VALUES
  ('243b116d-95e8-49dd-82ec-bcde1dc6af1c', '170fc78f-ab09-43f0-8858-3c47ddce7515', 'Wann du einreichst – und wann nicht', 'text', 'Jede Einreichung ist eine Aussage über dein Urteil. Der Kunde merkt sich nicht, wie viele Profile du geschickt hast, sondern wie viele gepasst haben. Zwei bis vier starke Kandidaten je Stelle sind das Ziel, nicht zehn mittelmäßige.

## Was die Zahlen zeigen

Orientierungswerte aus Agenturdaten, überwiegend aus den USA:

- Im Schnitt führt bei Agenturen knapp jede zweite Einreichung zu einem Interview (ca. 46 %).
- Die besten Headhunter unterscheiden sich durch Trefferquote, nicht durch Aktivität. Bis zur ersten Einreichung brauchen sie sogar länger als der Rest: knapp 20 statt gut 15 Tage. Gründlichkeit schlägt Tempo.
- Üblich sind drei bis vier Einreichungen je Besetzung, die Besten kommen mit einer bis zwei aus (ältere Daten von 2018).

Auch in der Matchunt Liga zählt Treffsicherheit mehr als Menge.

## Die Einreich-Prüfung

Bevor du einreichst, beantwortest du vier Fragen:

- Muss-Kriterien: Sind alle erfüllt, jeweils mit Beleg? Ein „teilweise“ geht nur, wenn du es offen benennst.
- Motivation: Sind Wechselgrund und Anlass klar?
- Konditionen: Passen Gehaltserwartung und Untergrenze zum Band? Ist die Verfügbarkeit bekannt?
- Zustimmung: Hat der Kandidat der Vorstellung für genau diese Stelle zugestimmt?

Ein Nein heißt: nicht einreichen oder erst klären. Liegt das Gehalt über dem Band, fragst du über „Kunden fragen“ nach, ob Spielraum besteht.

## Wann du nicht einreichst

- Ein Muss-Kriterium ist nicht erfüllt. „Vielleicht sieht der Kunde das anders“ ist kein Grund.
- Der Kandidat ist neugierig, hat aber keinen Anlass.
- Es gibt nur eine pauschale Zustimmung wie „Stellen Sie mich überall vor“.

## Was Matchunt dabei übernimmt

Matchunt lässt dich erst einreichen, wenn das Interview abgeschlossen ist. Beim Einreichen gleicht der Passungs-Check unter anderem Budget, Arbeitsmodell, Ort und Sprachen mit der Stelle ab, und du bestätigst die Einwilligung des Kandidaten mit einem Haken. Danach sieht der Kunde ein anonymes Profil. Fragt er ein Interview an, entscheidet der Kandidat, ob er seine Identität freigibt. Der Passungs-Check ist eine Hilfe, entscheiden musst du.

## Beispiel

Malte hat für eine Leitung Controlling sechs Gespräche geführt. Zwei Kandidaten erfüllen alle Muss-Kriterien mit Beleg und haben einen klaren Anlass. Eine Kandidatin passt fachlich, erwartet aber deutlich mehr als das Band. Drei haben Lücken bei Muss-Kriterien. Malte reicht zwei ein, fragt für die dritte über „Kunden fragen“ nach dem Budget und lässt die übrigen drei weg. Der Kunde lädt beide Eingereichten zum Interview ein.

## Das Wichtigste

- Zwei bis vier starke Kandidaten statt Masse. Deine Trefferquote ist dein Ruf.
- Einreichen nur, wenn Muss-Kriterien, Motivation, Konditionen und Zustimmung stimmen.
- Matchunt prüft mit, die Entscheidung triffst du.', 8, false, 1, 'Nach diesem Thema kannst du anhand von Muss-Kriterien, Motivation, Konditionen und Zustimmung entscheiden, ob du einen Kandidaten einreichst.', 'Einreich-Check', '## Muss-Kriterien

- Jedes Muss-Kriterium mit Beleg erfüllt? ja / teilweise (offen benannt) / nein
- Ein Nein bei einem Muss-Kriterium: nicht einreichen

## Motivation

- Weg von, hin zu und Anlass klar?
- Skala und „Was fehlt zur 10?“ notiert?

## Konditionen

- Gehaltserwartung und Untergrenze im Band? Sonst erst über „Kunden fragen“ klären
- Verfügbarkeit und Kündigungsfrist notiert?
- Laufende Prozesse und Gegenangebots-Risiko bekannt?

## Zustimmung und Erfassung

- Zustimmung zur Vorstellung für genau diese Stelle eingeholt?
- Interview in Matchunt abgeschlossen, alle Pflichtangaben vollständig?

## Auswahl

- Gehört dieser Kandidat zu meinen zwei bis vier stärksten für diese Stelle?
- Würde ich ihn auch einreichen, wenn der Kunde nur ein einziges Profil sehen dürfte?', 5)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('d420ac6a-554e-4bf3-8b21-75c47dc1cb6a', '243b116d-95e8-49dd-82ec-bcde1dc6af1c', 'single', 'Du hast acht Gespräche geführt. Drei Kandidaten erfüllen alle Muss-Kriterien mit Beleg, fünf nur teilweise. Ein Kollege rät: „Reich alle acht ein, der Kunde soll entscheiden.“', 'Was tust du?', '[{"id":"a","text":"Du reichst alle acht ein, weil mehr Profile mehr Chancen bedeuten."},{"id":"b","text":"Du reichst die drei starken ein und lässt die anderen fünf weg."},{"id":"c","text":"Du reichst alle acht ein und markierst die drei besten als Favoriten."}]'::jsonb, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('d420ac6a-554e-4bf3-8b21-75c47dc1cb6a', '"b"'::jsonb, 'Zwei bis vier starke Kandidaten schlagen Masse. Wer schwache Profile mitschickt, senkt seine Trefferquote und damit seinen Ruf beim Kunden.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('221e2897-013f-451d-84ac-e55a13083e66', '243b116d-95e8-49dd-82ec-bcde1dc6af1c', 'single', 'Eine Kandidatin erfüllt alle Muss-Kriterien. Ihre Untergrenze liegt aber 15 % über dem Gehaltsband der Stelle.', 'Was ist der richtige Schritt?', '[{"id":"a","text":"Du klärst über „Kunden fragen“, ob es Spielraum gibt, bevor du einreichst."},{"id":"b","text":"Du reichst ein und sprichst das Gehalt erst an, wenn der Kunde fragt."},{"id":"c","text":"Du trägst eine niedrigere Erwartung ein, damit sie ins Band passt."}]'::jsonb, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('221e2897-013f-451d-84ac-e55a13083e66', '"a"'::jsonb, 'Passen die Konditionen nicht, klärst du das vor dem Einreichen. Verschweigen kostet Vertrauen, und falsche Angaben sind ausgeschlossen.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('534f2415-5be8-44f1-87ff-26a5cb06e84a', '243b116d-95e8-49dd-82ec-bcde1dc6af1c', 'single', 'Ein Kandidat sagt am Ende des Gesprächs: „Stellen Sie mich gern überall vor, wo es passt.“', 'Reicht das als Zustimmung für die Einreichung?', '[{"id":"a","text":"Ja, eine allgemeine Zustimmung gilt für alle passenden Stellen."},{"id":"b","text":"Ja, sofern du die Aussage in der Kandidatenakte notierst."},{"id":"c","text":"Nein, du holst die Zustimmung für genau diese Stelle ein."}]'::jsonb, 3) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('534f2415-5be8-44f1-87ff-26a5cb06e84a', '"c"'::jsonb, 'Die Zustimmung zur Vorstellung gilt für eine bestimmte Stelle. Eine pauschale Erlaubnis ersetzt sie nicht, auch nicht mit Notiz.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('232d5d19-a33d-43f0-81f1-1f1ae1c14297', '243b116d-95e8-49dd-82ec-bcde1dc6af1c', 'multi', NULL, 'Was spricht gegen eine Einreichung? (Mehrere Antworten richtig)', '[{"id":"a","text":"Ein Muss-Kriterium ist nicht erfüllt"},{"id":"b","text":"Dem Kandidaten fehlt ein Kann-Kriterium"},{"id":"c","text":"Das Interview in Matchunt ist noch nicht abgeschlossen"},{"id":"d","text":"Der Kandidat hat einen klaren Anlass für den Wechsel"}]'::jsonb, 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('232d5d19-a33d-43f0-81f1-1f1ae1c14297', '["a","c"]'::jsonb, 'Ein nicht erfülltes Muss-Kriterium ist ein klares Nein, und ohne abgeschlossenes Interview lässt Matchunt kein Einreichen zu. Ein fehlendes Kann-Kriterium ist kein Ausschlussgrund.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('c1553d93-92c1-4b6f-8066-9fe93512fa36', '243b116d-95e8-49dd-82ec-bcde1dc6af1c', 'order', NULL, 'Bring den Ablauf auf Matchunt in die richtige Reihenfolge.', '[{"id":"85b3920e","text":"Interview mit allen Pflichtangaben abschließen"},{"id":"8d4bbbf2","text":"Einreichen mit Passungs-Check und Einwilligungs-Haken"},{"id":"29144387","text":"Kunde sieht das anonyme Profil und fragt ein Interview an"},{"id":"ee33e003","text":"Kandidat gibt seine Identität frei"}]'::jsonb, 5) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('c1553d93-92c1-4b6f-8066-9fe93512fa36', '["85b3920e","8d4bbbf2","29144387","ee33e003"]'::jsonb, 'Erst das abgeschlossene Interview, dann die Einreichung. Der Kunde sieht zunächst nur ein anonymes Profil. Die Identität gibt der Kandidat erst frei, wenn ein Interview angefragt ist.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('2107c8e3-3fab-4db0-8a55-b5c9f6fe495b', '243b116d-95e8-49dd-82ec-bcde1dc6af1c', 'single', 'In einem Quartal hat Lea 30 Kandidaten eingereicht, drei wurden zum Interview eingeladen. Ben hat acht eingereicht, fünf wurden eingeladen.', 'Wer arbeitet nach dem Maßstab dieses Themas besser?', '[{"id":"a","text":"Lea, weil sie deutlich aktiver war und mehr Profile geliefert hat."},{"id":"b","text":"Ben, weil seine Trefferquote viel höher ist."},{"id":"c","text":"Beide gleich, weil am Ende nur die Kundeninterviews zählen."}]'::jsonb, 6) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('2107c8e3-3fab-4db0-8a55-b5c9f6fe495b', '"b"'::jsonb, 'Ben kommt auf fünf von acht, Lea auf drei von dreißig. Gute Headhunter unterscheiden sich durch Trefferquote, nicht durch Aktivität, das gilt auch in der Matchunt Liga.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_lessons (id, module_id, title, content_type, body, duration_min, is_premium, sort_order, learning_goal, vorlage_title, vorlage_body, quiz_question_count) VALUES
  ('58544f45-a2a4-49b6-80fc-7320ff884d8e', '170fc78f-ab09-43f0-8858-3c47ddce7515', 'Die Einschätzung schreiben', 'text', 'Der Kunde entscheidet über eine Einladung vor allem nach deinem Gespräch. Deine Einschätzung ist das, was er davon sieht. Sie muss in zwei Minuten verständlich sein, und sie muss ehrlich sein.

## Die vier Teile

- Passung: jedes Muss-Kriterium einzeln, mit einem Satz Beleg.
- Lücken: was fehlt oder nur teilweise erfüllt ist, mit Einordnung. Verschwiegene Lücken kommen im Interview heraus und kosten dich Vertrauen.
- Motivation: weg von, hin zu, warum jetzt, möglichst in den Worten des Kandidaten.
- Konditionen: Gehaltserwartung und Untergrenze, Verfügbarkeit, laufende Prozesse, Gegenangebots-Risiko.

## Anonym heißt: nicht erkennbar

Den Namen wegzulassen reicht nicht. Erkennbar machen auch der genaue Arbeitgeber, ein seltener Titel mit Ort, ein Preis, ein Projekt mit Namen oder ein Ehrenamt. Schreib „mittelständischer Automobilzulieferer, Süddeutschland“ statt Firma und Stadt. Auf Matchunt sieht der Kunde die Identität erst, wenn er ein Interview anfragt und der Kandidat zustimmt.

## Was nicht hineingehört

- Kein Wort zu Alter, Herkunft, Religion, Behinderung oder sexueller Identität und keine Bewertung nach dem Geschlecht. Diese Merkmale schützt das AGG.
- Nichts zu Gesundheit, Familienstand, Kindern oder Familienplanung.
- Auch nicht versteckt: Schreib „Deutsch verhandlungssicher“ statt „Muttersprachler“ und „passt fachlich ins Team“ statt „passt ins junge Team“.
- Kein Punktwert, keine Prozentzahl, keine Sterne. Eine Zahl täuscht Genauigkeit vor und lädt dazu ein, Menschen nach einer Zahl auszusortieren. Auf Matchunt gilt deshalb: Einschätzung in Worten.

Erzählt dir jemand im Gespräch etwas Privates, etwa zu Gesundheit oder Familie, bleibt es bei dir.

## Beispiel

Einschätzung für eine Leitung Buchhaltung:

- Passung: Verantwortet seit 2021 den Monatsabschluss nach HGB für vier Gesellschaften, fertig bis zum fünften Arbeitstag. Führt ein Team von sechs Personen. Arbeitet täglich mit SAP S/4HANA.
- Lücken: Keine Erfahrung mit IFRS (Kann-Kriterium). Hat eine Systemumstellung begleitet, aber nicht geleitet.
- Motivation: Entscheidungen wurden in eine Zentrale verlagert. Wunsch: den Abschluss „wieder selbst gestalten“. Anlass: Der eigene Bereich wird im Januar zusammengelegt.
- Konditionen: Erwartung 72.000 Euro fix plus bis zu 8.000 Euro variabel, Untergrenze 68.000 Euro. Kündigungsfrist drei Monate zum Quartalsende. Ein weiterer Prozess in Runde zwei. Gegenangebot nach eigener Aussage unwahrscheinlich.

Kein Name, kein Arbeitgeber, keine Stadt, kein Punktwert.

## Das Wichtigste

- Gliedern nach Passung, Lücken, Motivation und Konditionen, mit Belegen.
- Anonym heißt nicht erkennbar: Branche und Region statt Firma und Details.
- Kein Punktwert und nichts zu AGG-Merkmalen, Gesundheit oder Familienstand.', 9, false, 2, 'Nach diesem Thema kannst du eine anonyme Einschätzung nach Passung, Lücken, Motivation und Konditionen schreiben, die ein Kunde in zwei Minuten versteht.', 'Gerüst Einschätzung', '## Passung

- [Muss-Kriterium 1]: [Beleg in einem Satz]
- [Muss-Kriterium 2]: [Beleg in einem Satz]

## Lücken

- [Was fehlt oder nur teilweise erfüllt ist]: [Einordnung, zum Beispiel Kann-Kriterium oder ausgleichbar durch …]

## Motivation

- Weg von: …
- Hin zu: …
- Warum jetzt: …

## Konditionen

- Gehaltserwartung brutto pro Jahr: fix …, variabel …, Untergrenze …
- Verfügbarkeit: Kündigungsfrist … zum …
- Laufende Prozesse: …
- Gegenangebots-Risiko: …

## Vor dem Absenden prüfen

- Kein Name, kein Arbeitgeber, kein Detail, an dem man die Person erkennt
- Nichts zu Alter, Herkunft, Religion, Behinderung, Gesundheit, Familienstand
- Kein Punktwert, keine Prozentzahl
- In zwei Minuten lesbar?', 5)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('cb82a7d9-a3db-4f7e-8165-6de6991a36fc', '58544f45-a2a4-49b6-80fc-7320ff884d8e', 'single', 'In einer Einschätzung steht: „Leiter Qualität bei einem Automobilzulieferer in Wolfsburg-Nord, Träger des regionalen Innovationspreises 2025.“', 'Was ist das Problem?', '[{"id":"a","text":"Der Satz ist zu lang für eine Einschätzung, die schnell lesbar sein soll."},{"id":"b","text":"Ort, Titel und Preis machen die Person erkennbar, obwohl kein Name fällt."},{"id":"c","text":"Ein Preis ist kein Beleg für ein Muss-Kriterium und gehört zu den Lücken."}]'::jsonb, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('cb82a7d9-a3db-4f7e-8165-6de6991a36fc', '"b"'::jsonb, 'Anonym heißt nicht erkennbar. Die Kombination aus genauem Ort, Titel und Preis führt direkt zur Person. Schreib Branche und Region statt solcher Details.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('42c9d260-d7aa-4a19-8d8e-863d9b70b2cf', '58544f45-a2a4-49b6-80fc-7320ff884d8e', 'single', 'Ein Kunde bittet dich: „Geben Sie mir bitte für jede Kandidatin eine Punktzahl von 1 bis 100.“', 'Wie reagierst du?', '[{"id":"a","text":"Du lieferst die Punktzahl, damit der Kunde schneller vergleichen kann."},{"id":"b","text":"Du gibst statt Punkten Prozentwerte an, das wirkt weniger streng."},{"id":"c","text":"Du bleibst bei einer Einschätzung in Worten, gegliedert und mit Belegen."}]'::jsonb, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('42c9d260-d7aa-4a19-8d8e-863d9b70b2cf', '"c"'::jsonb, 'Eine Zahl täuscht Genauigkeit vor und lädt zum Aussortieren nach Zahl ein. Prozentwerte sind dasselbe in anderer Form. Auf Matchunt gibt es die Einschätzung in Worten.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('0c2c1fe8-6db2-4dce-80db-7ee91ff64622', '58544f45-a2a4-49b6-80fc-7320ff884d8e', 'single', 'Ein Kandidat erzählt im Gespräch, dass er nach einer längeren Krankheit seit einem Jahr wieder voll arbeitet.', 'Was schreibst du dazu in die Einschätzung?', '[{"id":"a","text":"Nichts. Angaben zur Gesundheit gehören nicht in die Einschätzung."},{"id":"b","text":"Einen kurzen Hinweis, damit der Kunde später nicht überrascht wird."},{"id":"c","text":"Einen Vermerk bei den Lücken, ohne die Krankheit genau zu nennen."}]'::jsonb, 3) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('0c2c1fe8-6db2-4dce-80db-7ee91ff64622', '"a"'::jsonb, 'Was dir jemand zur Gesundheit erzählt, bleibt bei dir. Es hat mit den Muss-Kriterien nichts zu tun und kann zu Benachteiligung führen, auch als versteckter Vermerk.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('92238635-897c-437e-8924-63b0955b4815', '58544f45-a2a4-49b6-80fc-7320ff884d8e', 'multi', NULL, 'Was gehört in eine Einschätzung? (Mehrere Antworten richtig)', '[{"id":"a","text":"Eine Gesamtnote wie 8 von 10"},{"id":"b","text":"Muss-Kriterien mit je einem Satz Beleg"},{"id":"c","text":"Der Familienstand, weil er für einen Umzug wichtig sein kann"},{"id":"d","text":"Offene Lücken mit einer kurzen Einordnung"}]'::jsonb, 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('92238635-897c-437e-8924-63b0955b4815', '["b","d"]'::jsonb, 'Passung mit Belegen und offen benannte Lücken machen die Einschätzung glaubwürdig. Punktwerte und Familienstand gehören nicht hinein.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('9a7e6e90-59b0-4bb7-83d0-f5a81a8960fc', '58544f45-a2a4-49b6-80fc-7320ff884d8e', 'match', NULL, 'Ordne jede Notiz dem richtigen Teil der Einschätzung zu.', '{"left":[{"id":"7df46a16","text":"„Hat drei Werke auf ein neues Prüfsystem umgestellt.“"},{"id":"b40b9586","text":"„Noch keine Führung mit eigener Budgetverantwortung.“"},{"id":"290a57a9","text":"„Will raus aus dem Konzern, näher an die Entscheidungen.“"},{"id":"0cb2105b","text":"„Erwartet 85.000 Euro fix, Untergrenze 80.000 Euro.“"}],"right":[{"id":"4c7e4e30","text":"Passung"},{"id":"1db8d00d","text":"Lücken"},{"id":"b1197030","text":"Motivation"},{"id":"861c2d68","text":"Konditionen"}]}'::jsonb, 5) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('9a7e6e90-59b0-4bb7-83d0-f5a81a8960fc', '{"7df46a16":"4c7e4e30","b40b9586":"1db8d00d","290a57a9":"b1197030","0cb2105b":"861c2d68"}'::jsonb, 'Belege zu Muss-Kriterien zeigen die Passung, Fehlendes gehört zu den Lücken. Gründe für den Wechsel sind Motivation, Geld und Zeit sind Konditionen.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('fc640610-e6c9-46ac-8212-5a66f30cc028', '58544f45-a2a4-49b6-80fc-7320ff884d8e', 'single', 'Die Stelle verlangt sehr gutes Deutsch. Der Kandidat ist in Polen aufgewachsen und führt seit acht Jahren Kundenverhandlungen auf Deutsch.', 'Wie formulierst du das in der Einschätzung?', '[{"id":"a","text":"„Kein Muttersprachler, Deutsch aber trotzdem recht gut.“"},{"id":"b","text":"„Deutsch verhandlungssicher, führt seit acht Jahren Verhandlungen auf Deutsch.“"},{"id":"c","text":"„Aufgewachsen in Polen, spricht inzwischen gut Deutsch.“"}]'::jsonb, 6) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('fc640610-e6c9-46ac-8212-5a66f30cc028', '"b"'::jsonb, 'Maßstab ist das Sprachniveau für die Aufgabe, belegt mit dem, was die Person tut. Herkunft und Muttersprache gehören nicht hinein, auch nicht nebenbei.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_lessons (id, module_id, title, content_type, body, duration_min, is_premium, sort_order, learning_goal, vorlage_title, vorlage_body, quiz_question_count) VALUES
  ('e0701ff8-5448-4a38-80ec-fc388f80fac4', '170fc78f-ab09-43f0-8858-3c47ddce7515', 'KI richtig nutzen und prüfen', 'text', 'KI spart dir Zeit. Sie hat aber eine gefährliche Eigenschaft: Sie klingt immer sicher, auch wenn sie etwas erfindet, übertreibt oder weglässt. Gute Headhunter nutzen KI als Hilfe und prüfen jedes Ergebnis.

## Wofür KI taugt

- Boolean-Strings und Suchideen
- Varianten für Ansprachetexte, die du danach selbst überarbeitest
- Gesprächsleitfäden
- In Matchunt: Matching gegen die Stelle und eine Einschätzung der Passung als Vorschlag

Die Matchunt-Einschätzung kennt nur, was in Lebenslauf, Akte und Stelle steht. Motivation, Glaubwürdigkeit und deinen Eindruck aus dem Gespräch kennt sie nicht. Ihre Hinweise sind Prüfaufträge, kein Urteil.

## Datenschutz: Namen raus

Bevor Matchunt Daten an die KI gibt, ersetzt es Namen und Kontaktdaten (Pseudonymisierung). Außerhalb von Matchunt gilt: KI nur im Business-Tarif mit Auftragsverarbeitungsvertrag und ohne Personendaten. Lebensläufe mit Klarnamen gehören in kein privates KI-Konto. Dort verlierst du die Kontrolle darüber, was mit den Daten passiert.

## Typische KI-Fehler

- Erfunden: ein Zertifikat oder Abschluss, der nirgends steht
- Falsch: Jahre, Teamgrößen, Zeiträume
- Übertrieben: Aus „Grundkenntnisse“ wird „Experte“.
- Weggelassen: eine Lücke, die Kündigungsfrist, ein Gegenangebots-Risiko
- Verboten: Rückschlüsse auf Alter oder Herkunft, etwa „passt gut ins junge Team“

So prüfst du: Halte jede Aussage gegen die Quelle, also gegen Lebenslauf und Gesprächsnotizen. Was du nicht belegen kannst, streichst du. Was fehlt, ergänzt du.

## Die Entscheidung bleibt bei dir

Nach Art. 22 DSGVO darf niemand einer ausschließlich automatisierten Entscheidung unterworfen werden, die ihn erheblich beeinträchtigt. Der Hamburger Datenschutzbeauftragte hält es grundsätzlich für unzulässig, die finale Auswahl einem Sprachmodell zu überlassen. KI in der Personalauswahl gilt nach der europäischen KI-Verordnung außerdem als Hochrisiko, die Pflichten dazu gelten ab Dezember 2027. Für dich heißt das: Du liest, prüfst, entscheidest und begründest in eigenen Worten. „Die KI sagt, passt nicht“ ist keine Begründung.

Auch eine KI-Mitschrift setzt eine Aufnahme voraus. Die ist nur mit Einwilligung erlaubt (§ 201 StGB).

## Beispiel

Die KI fasst Kandidat „K-17“ so zusammen: „Zwölf Jahre Erfahrung in der Inbetriebnahme, PMP-zertifiziert, führt ein Team von 15 Personen. Passt gut in ein junges Team.“ Im Lebenslauf stehen sieben Jahre, kein PMP-Zertifikat und ein Team von fünf. Jana findet vier Fehler: falsche Jahre, ein erfundenes Zertifikat, eine falsche Teamgröße und einen Satz, der auf das Alter zielt. Sie korrigiert die Zusammenfassung und entscheidet selbst.

## Das Wichtigste

- Keine Lebensläufe mit Klarnamen in private KI-Konten. Matchunt ersetzt Namen vor der KI.
- Jede KI-Aussage gegen die Quelle prüfen: erfunden, falsch, übertrieben, weggelassen, verboten.
- Die Auswahl triffst du, nie die KI.', 9, false, 3, 'Nach diesem Thema kannst du KI datenschutzgerecht nutzen, typische Fehler in KI-Texten finden und begründen, warum die Auswahl immer bei dir bleibt.', 'Prüfliste KI-Text', '## Vor der Nutzung

- Werkzeug: Matchunt oder KI im Business-Tarif mit Auftragsverarbeitungsvertrag?
- Keine Klarnamen, keine Kontaktdaten, kein Lebenslauf in einem privaten KI-Konto
- Gesprächsaufnahme für eine Mitschrift nur mit Einwilligung

## Jede Aussage prüfen

- Steht das so im Lebenslauf oder in meinen Gesprächsnotizen?
- Stimmen Zahlen, Zeiträume, Teamgrößen und Abschlüsse?
- Ist etwas übertrieben, etwa „Experte“ statt „Kenntnisse“?
- Fehlt etwas Wichtiges, etwa eine Lücke, die Kündigungsfrist oder die Gehaltserwartung?
- Steht etwas zu Alter, Herkunft, Geschlecht, Gesundheit oder Familienstand drin?

## Danach

- Nicht Belegtes streichen oder beim Kandidaten nachfragen
- Fehlendes ergänzen, Verbotenes entfernen
- Selbst entscheiden und in eigenen Worten begründen', 5)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('58d5d41f-1990-4f1a-87f4-ce45b82f83c8', 'e0701ff8-5448-4a38-80ec-fc388f80fac4', 'single', 'Tom will schnell eine Zusammenfassung und lädt einen Lebenslauf mit Namen und Telefonnummer in sein privates KI-Konto.', 'Wie bewertest du das?', '[{"id":"a","text":"In Ordnung, sofern er den Chat direkt danach wieder löscht."},{"id":"b","text":"In Ordnung, weil der Kandidat der Vorstellung zugestimmt hat."},{"id":"c","text":"Nicht in Ordnung, Lebensläufe mit Klarnamen gehören dort nicht hin."}]'::jsonb, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('58d5d41f-1990-4f1a-87f4-ce45b82f83c8', '"c"'::jsonb, 'In einem privaten KI-Konto verlierst du die Kontrolle über die Daten, Löschen ändert daran nichts. Die Zustimmung zur Vorstellung deckt das nicht ab. Nutze Matchunt, das Namen vorher ersetzt.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('a1830368-9576-4885-8263-d55ca90c98dd', 'e0701ff8-5448-4a38-80ec-fc388f80fac4', 'single', 'Eine KI-Zusammenfassung nennt ein „PMP-Zertifikat“. Im Lebenslauf und in deinen Notizen steht davon nichts.', 'Was tust du?', '[{"id":"a","text":"Du streichst die Angabe oder fragst beim Kandidaten nach."},{"id":"b","text":"Du übernimmst sie, die KI hat das sicher irgendwo gefunden."},{"id":"c","text":"Du übernimmst sie mit dem Zusatz „wahrscheinlich“."}]'::jsonb, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('a1830368-9576-4885-8263-d55ca90c98dd', '"a"'::jsonb, 'Was weder im Lebenslauf noch in deinen Notizen steht, ist nicht belegt. Erfundene Zertifikate sind ein typischer KI-Fehler, ein „wahrscheinlich“ macht sie nicht wahrer.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('16600abf-172a-4983-87e0-f7d7222eb108', 'e0701ff8-5448-4a38-80ec-fc388f80fac4', 'single', 'Die Matchunt-Einschätzung meldet: „Muss-Kriterium Inbetriebnahme von Schaltanlagen nicht erkennbar.“ Im Gespräch hat dir der Kandidat aber ein Projekt dazu genau und mit Belegen geschildert.', 'Wie gehst du vor?', '[{"id":"a","text":"Du folgst der KI und reichst nicht ein, weil sie objektiver urteilt."},{"id":"b","text":"Du nimmst den Hinweis als Prüfauftrag, urteilst selbst und belegst es."},{"id":"c","text":"Du formulierst den Lebenslauf um, bis die KI das Kriterium erkennt."}]'::jsonb, 3) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('16600abf-172a-4983-87e0-f7d7222eb108', '"b"'::jsonb, 'Die Matchunt-Einschätzung kennt nur den Lebenslauf, nicht dein Gespräch. Ihr Hinweis ist ein Prüfauftrag. Das Urteil triffst du und belegst es in deiner Einschätzung.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('0c769938-798e-4fc8-8dbf-f879c7d7763c', 'e0701ff8-5448-4a38-80ec-fc388f80fac4', 'multi', NULL, 'Der Lebenslauf zeigt: Bachelor (FH), sieben Jahre Berufserfahrung, Team von fünf Personen. Welche Aussagen der KI-Zusammenfassung musst du korrigieren oder streichen? (Mehrere Antworten richtig)', '[{"id":"a","text":"„Bachelor (FH) in Elektrotechnik“"},{"id":"b","text":"„Seit zwölf Jahren in der Inbetriebnahme tätig“"},{"id":"c","text":"„Führt ein Team von fünf Personen“"},{"id":"d","text":"„Passt gut in ein junges, dynamisches Team“"}]'::jsonb, 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('0c769938-798e-4fc8-8dbf-f879c7d7763c', '["b","d"]'::jsonb, 'Die zwölf Jahre widersprechen dem Lebenslauf, und der Satz zum jungen Team zielt auf das Alter. Abschluss und Teamgröße sind durch den Lebenslauf belegt.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('84f70b28-49dd-421d-8abd-1e0a81ce8b60', 'e0701ff8-5448-4a38-80ec-fc388f80fac4', 'order', NULL, 'Bring den Umgang mit einem KI-Text in die richtige Reihenfolge.', '[{"id":"aa1f9278","text":"Text in Matchunt oder einem Business-Tarif ohne Klarnamen erstellen lassen"},{"id":"5b0a08ef","text":"Jede Aussage gegen Lebenslauf und Gesprächsnotizen prüfen"},{"id":"61f524b9","text":"Nicht Belegtes streichen, Fehlendes ergänzen, Verbotenes entfernen"},{"id":"f464b9a9","text":"Selbst entscheiden und in eigenen Worten begründen"}]'::jsonb, 5) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('84f70b28-49dd-421d-8abd-1e0a81ce8b60', '["aa1f9278","5b0a08ef","61f524b9","f464b9a9"]'::jsonb, 'Datenschutz kommt vor der Nutzung, die Prüfung vor jeder Verwendung. Am Ende entscheidest du, nicht die KI.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('6aec1b6a-cc7c-4916-8892-45910127442b', 'e0701ff8-5448-4a38-80ec-fc388f80fac4', 'single', 'Ein Kunde schlägt vor: „Lassen Sie doch die KI entscheiden, wen Sie einreichen. Das geht schneller.“', 'Was antwortest du?', '[{"id":"a","text":"Nein, die Auswahl treffe ich selbst, das verlangt auch der Datenschutz."},{"id":"b","text":"Gute Idee, eine KI urteilt objektiver als ein Mensch."},{"id":"c","text":"Gern, solange ich die Ergebnisse stichprobenartig prüfe."}]'::jsonb, 6) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('6aec1b6a-cc7c-4916-8892-45910127442b', '"a"'::jsonb, 'Die finale Auswahl einem Sprachmodell zu überlassen ist nach Art. 22 DSGVO grundsätzlich unzulässig. Stichproben ändern daran nichts: Du entscheidest über jeden Kandidaten selbst.') ON CONFLICT (question_id) DO NOTHING;

-- Modul 7: Begleiten bis zum ersten Arbeitstag
INSERT INTO public.academy_modules (id, course_id, title, sort_order, description, test_question_count, test_pass_pct, test_retry_minutes) VALUES
  ('1844c3ec-824e-4f5a-87ac-3b6a3611bba3', '9f553b3f-110b-4db5-8226-e348fe4a582a', 'Begleiten bis zum ersten Arbeitstag', 7, 'Nach diesem Modul kannst du Kunde und Kandidatin durch Interviews, Angebot und Gegenangebot führen und die Person bis zum ersten Arbeitstag und durch die Probezeit begleiten.', 15, 80, 120)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_lessons (id, module_id, title, content_type, body, duration_min, is_premium, sort_order, learning_goal, vorlage_title, vorlage_body, quiz_question_count) VALUES
  ('9e103955-e9b4-4ba3-8e92-42b4517c9735', '1844c3ec-824e-4f5a-87ac-3b6a3611bba3', 'Kundengespräche vorbereiten und nachfassen', 'text', 'Im Kunden-Interview wird deine Arbeit sichtbar. Hier entscheidet sich, ob aus einer guten Einreichung eine Einstellung wird. Viele Prozesse kippen genau an dieser Stelle. Laut einer Stepstone-Befragung brechen 23 % der Bewerber ab, weil die Kommunikation unklar ist oder sie zu lange warten. Deine Aufgabe: beide Seiten vorbereiten und danach schnell nachfassen.

## Die Kandidatin vorbereiten

Eine gut vorbereitete Kandidatin wirkt sicherer und stellt bessere Fragen. Kläre vor dem Termin:

- Wer sitzt im Gespräch, welche Rolle hat die Person, wie lange dauert es, wo findet es statt?
- Was will der Kunde prüfen? Geh die Muss-Kriterien durch. Zu jedem soll sie ein konkretes Beispiel aus ihrer Arbeit nennen können.
- Warum will sie wechseln? Sie soll es in eigenen Worten sagen können.
- Welche Fragen hat sie an den Kunden?
- Gehalt: Sie nennt ihre Erwartung. Verhandelt wird über dich.

Bereite vor, aber schreib ihr keine Antworten vor. Wer auswendig gelernte Sätze aufsagt, verliert Vertrauen.

## Den Kunden vorbereiten

Auch der Kunde braucht fünf Minuten mit dir. Sag ihm, was für die Person spricht, wo Lücken sind und worauf er achten sollte. Erzähl ihm, was sie antreibt und was sie abschrecken würde. Gerade passive Kandidaten wollen im Interview auch überzeugt werden. Vereinbare gleich, wann du seine Rückmeldung bekommst: spätestens am nächsten Tag.

## Das Nachgespräch: mit beiden, innerhalb von 24 Stunden

Ruf zuerst die Kandidatin an, solange der Eindruck frisch ist. Dann den Kunden. Frag beide nach ihrem Eindruck und stell beiden dieselbe Frage: „Wie groß ist Ihr Interesse auf einer Skala von 1 bis 10?“ Bei allem unter 10 folgt: „Was fehlt zur 10?“ Die Antwort zeigt dir die echte Hürde.

Hat der Kunde Bedenken, frag nach, woran er sie festmacht. Kläre sie mit Belegen, nicht mit Beteuerungen. Gib Rückmeldungen ehrlich weiter, aber sachlich und respektvoll. Sag beiden zum Schluss, wie es weitergeht und bis wann. Halte das Nachgespräch noch am selben Tag in Matchunt fest.

## Beispiel

Headhunterin Lena Vogt hat Tobias Kern bei der Brandt Fördertechnik GmbH vorgestellt. Am Morgen nach dem Interview ruft sie Tobias an. Er sagt: „Interesse 7.“ Auf die Frage, was zur 10 fehlt, antwortet er: „Ich weiß nicht, ob ich mit dem Werksleiter klarkomme.“ Danach ruft Lena den Kunden an. Der ist angetan, zweifelt aber an Tobias’ SAP-Erfahrung. Lena fragt nach und schickt zwei konkrete Projektbeispiele nach. Außerdem schlägt sie ein kurzes Kennenlernen mit dem Werksleiter vor. Zwei Tage später steht die zweite Runde.

## Das Wichtigste

- Bereite Kandidatin und Kunde getrennt vor: Ablauf, Muss-Kriterien, Wechselgründe, offene Fragen.
- Fass mit beiden innerhalb von 24 Stunden nach, die Kandidatin zuerst.
- Frag nach dem Interesse von 1 bis 10 und immer: „Was fehlt zur 10?“', 8, false, 1, 'Nach diesem Thema kannst du Kandidatin und Kunde gezielt auf ein Interview vorbereiten und mit beiden innerhalb von 24 Stunden nachfassen.', 'Checkliste: Interview vorbereiten und nachfassen', '## Vor dem Interview: Kandidatin

- Teilnehmer, Rollen, Dauer, Ort oder Link
- Muss-Kriterien: zu jedem ein konkretes Beispiel
- Wechselgründe in eigenen Worten
- Eigene Fragen an den Kunden
- Gehalt: Erwartung nennen, Verhandlung läuft über dich

## Vor dem Interview: Kunde

- Was spricht für die Person, wo sind Lücken?
- Was treibt sie an, was würde sie abschrecken?
- Rückmeldung vereinbaren: spätestens am nächsten Tag

## Nachgespräch innerhalb von 24 Stunden

- Zuerst die Kandidatin, dann der Kunde
- „Wie groß ist Ihr Interesse auf einer Skala von 1 bis 10?“
- „Was fehlt zur 10?“
- Bei Bedenken: „Woran machen Sie das fest?“ Belege nachreichen.
- Nächsten Schritt und Termin an beide geben
- Noch am selben Tag in Matchunt festhalten', 5)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('795fefc7-ec21-4e4a-808f-bb4c990be401', '9e103955-e9b4-4ba3-8e92-42b4517c9735', 'single', 'Kandidat Jonas Weber hatte gestern um 16 Uhr sein Interview bei der Kunzel Logistik GmbH. Jetzt ist es 10 Uhr, und du hast noch mit niemandem gesprochen.', 'Was tust du jetzt?', '[{"id":"a","text":"Du wartest ab, bis sich der Kunde von selbst meldet, um ihn nicht zu drängen."},{"id":"b","text":"Du rufst zuerst Jonas an und danach den Kunden, solange der Eindruck frisch ist."},{"id":"c","text":"Du schickst Jonas eine kurze Mail und gibst dem Kunden eine Woche Zeit."}]'::jsonb, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('795fefc7-ec21-4e4a-808f-bb4c990be401', '"b"'::jsonb, 'Das Nachgespräch führst du innerhalb von 24 Stunden mit beiden Seiten. Funkstille ist einer der häufigsten Gründe, warum Bewerber abbrechen.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('ee5f1bb5-54cf-492c-8221-b4f651bdc637', '9e103955-e9b4-4ba3-8e92-42b4517c9735', 'single', 'Nach dem Interview sagt Kandidatin Mara Schulte: „Mein Interesse liegt bei 7 von 10.“', 'Welche Frage stellst du als Nächstes?', '[{"id":"a","text":"„Sieben ist ordentlich. Soll ich das so an den Kunden weitergeben?“"},{"id":"b","text":"„Sollen wir dann lieber gleich absagen und weitersuchen?“"},{"id":"c","text":"„Danke. Was fehlt Ihnen noch zur 10, was müsste passieren?“"}]'::jsonb, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('ee5f1bb5-54cf-492c-8221-b4f651bdc637', '"c"'::jsonb, '„Was fehlt zur 10?“ bringt die echte Hürde ans Licht. Erst wenn du sie kennst, kannst du sie mit Kunde und Kandidatin klären.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('e2f938ae-395f-4596-8dc8-dda730cadd87', '9e103955-e9b4-4ba3-8e92-42b4517c9735', 'single', 'Morgen hat Kandidat Sven Ott sein erstes Interview bei der Lindner Kältetechnik GmbH. Ihn selbst hast du schon vorbereitet.', 'Warum rufst du vor dem Termin auch noch den Kunden an?', '[{"id":"a","text":"Damit er weiß, was Sven antreibt und wo er genauer nachfragen sollte."},{"id":"b","text":"Damit er im Interview direkt mit Sven das Gehalt aushandeln kann."},{"id":"c","text":"Damit er Svens Unterlagen vor dem Termin nicht mehr lesen muss."}]'::jsonb, 3) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('e2f938ae-395f-4596-8dc8-dda730cadd87', '"a"'::jsonb, 'Ein vorbereiteter Kunde fragt gezielt nach und weiß, was die Person überzeugt. Über Geld verhandelt nicht der Kunde direkt mit dem Kandidaten, das läuft über dich.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('1ec36042-9be4-44c0-8cb1-998a568687a0', '9e103955-e9b4-4ba3-8e92-42b4517c9735', 'multi', NULL, 'Was gehört in die Vorbereitung der Kandidatin auf das Interview? (Mehrere Antworten richtig)', '[{"id":"a","text":"Wer im Gespräch sitzt und wie es abläuft"},{"id":"b","text":"Zu jedem Muss-Kriterium ein konkretes Beispiel aus ihrer Arbeit"},{"id":"c","text":"Fertige Antworten zum Auswendiglernen, damit nichts schiefgeht"},{"id":"d","text":"Eigene Fragen, die sie dem Kunden stellen will"}]'::jsonb, 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('1ec36042-9be4-44c0-8cb1-998a568687a0', '["a","b","d"]'::jsonb, 'Ablauf, Beispiele zu den Muss-Kriterien und eigene Fragen machen sie sicher. Auswendig gelernte Antworten wirken unecht und kosten Vertrauen.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('a7940307-3f44-4e8e-8e67-7da3c20b57d7', '9e103955-e9b4-4ba3-8e92-42b4517c9735', 'order', NULL, 'Bring die Schritte rund um ein Kunden-Interview in die richtige Reihenfolge.', '[{"id":"e898df54","text":"Kandidatin und Kunde getrennt vorbereiten"},{"id":"90539222","text":"Nach dem Interview zuerst die Kandidatin anrufen"},{"id":"a999146b","text":"Danach den Kunden anrufen und nach seinem Eindruck fragen"},{"id":"c9c9678a","text":"Beiden den nächsten Schritt nennen und alles in Matchunt festhalten"}]'::jsonb, 5) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('a7940307-3f44-4e8e-8e67-7da3c20b57d7', '["e898df54","90539222","a999146b","c9c9678a"]'::jsonb, 'Erst vorbereiten, dann innerhalb von 24 Stunden nachfassen: zuerst die Kandidatin, solange der Eindruck frisch ist, dann der Kunde. Zum Schluss wissen beide, wie es weitergeht.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('3d6554c5-f7b0-479d-82fc-8070e0186bba', '9e103955-e9b4-4ba3-8e92-42b4517c9735', 'single', 'Der Kunde meldet nach dem Interview: „Fachlich stark. Aber wir sind unsicher, ob er ein Team führen kann.“', 'Wie reagierst du?', '[{"id":"a","text":"Du leitest die Rückmeldung wörtlich an den Kandidaten weiter und wartest ab."},{"id":"b","text":"Du fragst nach, woran der Kunde das festmacht, und reichst Belege nach."},{"id":"c","text":"Du versicherst dem Kunden, dass der Kandidat ganz sicher führen kann."}]'::jsonb, 6) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('3d6554c5-f7b0-479d-82fc-8070e0186bba', '"b"'::jsonb, 'Bedenken klärst du mit Belegen, nicht mit Beteuerungen. Erst die Nachfrage zeigt, was der Kunde braucht, um sicher zu werden.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_lessons (id, module_id, title, content_type, body, duration_min, is_premium, sort_order, learning_goal, vorlage_title, vorlage_body, quiz_question_count) VALUES
  ('d1917693-a1de-433f-8369-8a6026eddc9c', '1844c3ec-824e-4f5a-87ac-3b6a3611bba3', 'Angebot, Verhandlung, Gegenangebot', 'text', 'Ein gutes Angebot überrascht niemanden, weder die Kandidatin noch den Kunden. Wird ein Angebot abgelehnt, wurde vorher meistens etwas nicht geklärt. Deshalb verhandelst du, bevor das Papier rausgeht.

## Vorab-Zusage und Mindestbedingung

Sprich über das Bruttojahresgehalt: fix, variabel, Dienstwagen. Dazu kommen Urlaub, mobiles Arbeiten, Titel und Startdatum. Dann stellst du die wichtigste Frage: „Wenn das Angebot X enthält, unterschreiben Sie dann?“ Das ist die Vorab-Zusage. Zögert die Kandidatin, kennst du die echte Hürde, bevor es zu spät ist.

Frag außerdem nach der Mindestbedingung: „Unter welchem Betrag wechseln Sie nicht?“ Die Mindestbedingung ist keine Wunschzahl. Sie ist die Grenze, unter der kein Wechsel stattfindet. Mit beiden Angaben berätst du den Kunden ehrlich.

## Das Angebot mündlich testen

Bevor der Kunde schriftlich anbietet, gehst du die Eckdaten mündlich mit der Kandidatin durch. Erst wenn sie Ja sagt, geht das schriftliche Angebot raus. Lass Kunde und Kandidatin nicht direkt über Geld verhandeln. Du kennst beide Seiten und kannst ausgleichen. Referenzen holst du nur mit Einwilligung der Kandidatin ein.

## Das Gegenangebot

Wer kündigt, bekommt oft ein Gegenangebot: mehr Geld, ein neuer Titel, endlich das Projekt. In einer Umfrage von Robert Half in Großbritannien nahm gut die Hälfte ihr letztes Gegenangebot an. Rund drei Viertel davon waren nach einem Jahr trotzdem weg. Mehr Geld ändert selten etwas an den Gründen für den Wechsel.

So gehst du vor:

- Sprich das Gegenangebot schon im ersten Gespräch an: „Was machen Sie, wenn Ihr Chef Ihnen mehr bietet?“
- Sprich es vor der Kündigung noch einmal an.
- Erinnere an die Wechselgründe, die die Kandidatin selbst genannt hat. Ihre Worte zählen, nicht deine.
- Übe das Kündigungsgespräch: kurz, mit der schriftlichen Kündigung in der Hand, ohne Verhandlungsspielraum.

Die Entscheidung trifft die Kandidatin. Druck schadet, Klarheit hilft.

## Beispiel

Controllerin Aylin Demir will von einem Großhändler zur Hollmann Haustechnik GmbH wechseln. Im Erstgespräch nennt sie zwei Gründe: keine Entwicklung und ein Chef, der alles allein entscheidet. Headhunter Jens Paulsen holt die Vorab-Zusage ein: Bei 78.000 € und zwei Tagen mobilem Arbeiten unterschreibt sie. Unter 75.000 € wechselt sie nicht. Das Angebot kommt genau so und überrascht niemanden. Vor der Kündigung fragt Jens: „Was sagen Sie, wenn Ihr Chef 15 % drauflegt?“ Aylin lacht: „Dann entscheidet er trotzdem alles allein.“ Sie übt mit Jens drei Sätze für das Gespräch und kündigt am nächsten Morgen.

## Das Wichtigste

- Hol vor dem Angebot die Vorab-Zusage ein und kenne die Mindestbedingung.
- Teste das Angebot mündlich, bevor es schriftlich rausgeht.
- Sprich das Gegenangebot früh und vor der Kündigung an und erinnere an die eigenen Wechselgründe.', 9, false, 2, 'Nach diesem Thema kannst du vor dem Angebot Vorab-Zusage und Mindestbedingung einholen und ein Gegenangebot früh entkräften.', 'Gesprächsleitfaden: Vorab-Zusage und Gegenangebot', '## Vorab-Zusage (vor dem Angebot)

- „Wenn das Angebot [Gehalt fix und variabel, mobiles Arbeiten, Startdatum] enthält, unterschreiben Sie dann?“
- „Was müsste sonst noch drinstehen?“

## Mindestbedingung

- „Unter welchem Betrag wechseln Sie nicht?“
- „Was ist Ihnen wichtig, aber kein Muss?“

## Mündlicher Test (vor dem schriftlichen Angebot)

- „Der Kunde plant folgendes Angebot: [Eckdaten]. Passt das für Sie?“

## Gegenangebot (im Erstgespräch und vor der Kündigung)

- „Was machen Sie, wenn Ihr Chef Ihnen mehr bietet?“
- „Sie haben mir gesagt, Sie wechseln wegen [Grund 1] und [Grund 2]. Ändert ein Gegenangebot daran etwas?“

## Kündigungsgespräch üben

- „Ich habe mich entschieden, das Unternehmen zu verlassen. Hier ist meine schriftliche Kündigung.“
- „Danke für Ihr Angebot. Meine Entscheidung steht.“', 5)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('a3ce0f7d-e679-4c88-8804-e5880f130bfd', 'd1917693-a1de-433f-8369-8a6026eddc9c', 'single', 'Der Kunde will morgen das schriftliche Angebot an Kandidat Felix Albrecht schicken: 82.000 € fix. Über Gehalt hast du mit Felix zuletzt im Erstgespräch gesprochen.', 'Was tust du, bevor das Angebot rausgeht?', '[{"id":"a","text":"Du gehst die Eckdaten mündlich mit Felix durch und holst seine Vorab-Zusage ein."},{"id":"b","text":"Du lässt das Angebot rausgehen, denn Felix kann danach ja noch verhandeln."},{"id":"c","text":"Du bittest den Kunden, vorsichtshalber 10 % mehr ins Angebot zu schreiben."}]'::jsonb, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('a3ce0f7d-e679-4c88-8804-e5880f130bfd', '"a"'::jsonb, 'Ein Angebot soll niemanden überraschen. Der mündliche Test zeigt vorher, ob Felix unterschreibt oder wo noch eine Hürde liegt.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('8c5772a7-ffb4-48d2-880d-a75f2044d91a', 'd1917693-a1de-433f-8369-8a6026eddc9c', 'single', 'Kandidatin Sophie Lang sagt: „Bei 80.000 € unterschreibe ich.“ Auf deine Nachfrage ergänzt sie: „Unter 76.000 € wechsle ich nicht.“', 'Was sind die 76.000 €?', '[{"id":"a","text":"Ihre Vorab-Zusage für das Angebot"},{"id":"b","text":"Ihr Wunschgehalt für die neue Stelle"},{"id":"c","text":"Ihre Mindestbedingung für den Wechsel"}]'::jsonb, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('8c5772a7-ffb4-48d2-880d-a75f2044d91a', '"c"'::jsonb, 'Die Mindestbedingung ist die Grenze, unter der sie nicht wechselt. Die Vorab-Zusage ist ihr Ja zu einem konkreten Angebot, hier bei 80.000 €.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('d3dad54e-da91-40cc-8b06-904efc882181', 'd1917693-a1de-433f-8369-8a6026eddc9c', 'single', 'Zwei Tage vor der Kündigung ruft Kandidat Timo Berger an. Sein Chef ahnt etwas und hat für morgen ein Gespräch angesetzt.', 'Was ist jetzt am hilfreichsten?', '[{"id":"a","text":"Du rätst Timo, sich das Angebot seines Chefs erst einmal anzuhören und zu vergleichen."},{"id":"b","text":"Du übst mit Timo ein kurzes Kündigungsgespräch und erinnerst ihn an seine eigenen Gründe."},{"id":"c","text":"Du bittest den Kunden, vorsorglich ein höheres Gehalt anzubieten, falls Timo wackelt."}]'::jsonb, 3) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('d3dad54e-da91-40cc-8b06-904efc882181', '"b"'::jsonb, 'Ein kurzes, geübtes Gespräch mit schriftlicher Kündigung lässt keinen Verhandlungsspielraum. Seine eigenen Wechselgründe tragen weiter als jedes Argument von dir.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('d00bd739-baca-4a3c-8898-ead74371471b', 'd1917693-a1de-433f-8369-8a6026eddc9c', 'multi', NULL, 'Was hilft gegen ein Gegenangebot? (Mehrere Antworten richtig)', '[{"id":"a","text":"Das Thema schon im ersten Gespräch ansprechen"},{"id":"b","text":"Kurz vor der Kündigung noch einmal darüber sprechen"},{"id":"c","text":"Das Thema meiden, um niemanden auf Ideen zu bringen"},{"id":"d","text":"An die Wechselgründe erinnern, die die Person selbst genannt hat"}]'::jsonb, 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('d00bd739-baca-4a3c-8898-ead74371471b', '["a","b","d"]'::jsonb, 'Wer vorbereitet ist, lässt sich nicht überrumpeln. Schweigen verhindert kein Gegenangebot, es lässt die Person nur unvorbereitet.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('5d604e83-7e37-46f1-8086-878bd22f3815', 'd1917693-a1de-433f-8369-8a6026eddc9c', 'match', NULL, 'Ordne jedem Werkzeug die passende Beschreibung zu.', '{"left":[{"id":"0762f89b","text":"Vorab-Zusage"},{"id":"f628c78f","text":"Mindestbedingung"},{"id":"09133000","text":"Mündlicher Test"},{"id":"ba0fe7ea","text":"Kündigungsgespräch"}],"right":[{"id":"05853998","text":"„Wenn das Angebot X enthält, unterschreiben Sie dann?“"},{"id":"67f7d405","text":"Die Grenze, unter der die Person nicht wechselt"},{"id":"35e9df49","text":"Eckdaten besprechen, bevor das schriftliche Angebot rausgeht"},{"id":"903f4027","text":"Kurz, schriftlich, ohne Verhandlungsspielraum"}]}'::jsonb, 5) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('5d604e83-7e37-46f1-8086-878bd22f3815', '{"0762f89b":"05853998","f628c78f":"67f7d405","09133000":"35e9df49","ba0fe7ea":"903f4027"}'::jsonb, 'Diese vier Werkzeuge sorgen dafür, dass das Angebot passt und die Kündigung hält.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('4c51e542-60e6-486b-873b-09f397ae5188', 'd1917693-a1de-433f-8369-8a6026eddc9c', 'single', 'Kandidat Erik Hansen sagt: „Wenn mein Chef 15 % drauflegt, bleibe ich halt.“ Vor drei Wochen hat er dir zwei klare Wechselgründe genannt.', 'Welche Antwort hilft ihm ehrlich weiter?', '[{"id":"a","text":"„Gegenangebote sind in Deutschland verboten. Ihr Chef darf Ihnen nichts bieten.“"},{"id":"b","text":"„Wer ein Gegenangebot annimmt, wird meist kurz danach gekündigt.“"},{"id":"c","text":"„Sie wollten wegen X und Y wechseln. Ändert ein Plus von 15 % daran etwas?“"}]'::jsonb, 6) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('4c51e542-60e6-486b-873b-09f397ae5188', '"c"'::jsonb, 'Seine eigenen Gründe sind das stärkste Argument. Laut Robert Half (UK) waren rund drei Viertel derer, die ein Gegenangebot annahmen, nach einem Jahr trotzdem weg.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_lessons (id, module_id, title, content_type, body, duration_min, is_premium, sort_order, learning_goal, vorlage_title, vorlage_body, quiz_question_count) VALUES
  ('6d7e6ff8-a7ef-4f9c-8ddd-2af93554f14e', '1844c3ec-824e-4f5a-87ac-3b6a3611bba3', 'Die lange Kündigungszeit und Continuity', 'text', 'Die Unterschrift ist nicht das Ziel. Das Ziel ist ein guter erster Arbeitstag und eine bestandene Probezeit. Dazwischen liegen in Deutschland oft Monate.

## Warum die Zeit bis zum Start heikel ist

Gesetzlich gilt eine Kündigungsfrist von 4 Wochen. Üblich sind 3 Monate, bei Führungskräften 3 bis 6 Monate zum Quartalsende. Ein Beispiel: Wer am 12. Oktober unterschreibt und 3 Monate zum Quartalsende hat, kann nicht mehr zum 31. Dezember kündigen. Er scheidet frühestens am 31. März aus und startet am 1. April. Das ist fast ein halbes Jahr.

In dieser Zeit passiert viel. Der alte Chef macht ein Gegenangebot. Ein anderer Headhunter ruft an. Zweifel kommen auf. Der neue Arbeitgeber meldet sich nicht. Wer nach der Unterschrift abtaucht, verliert Kandidaten.

## Der Plan bis zum Start: mindestens 5 Kontaktpunkte

Plane die Zeit bis zum Start wie ein Projekt. Melde dich etwa alle zwei Wochen und hol den Kunden mit ins Boot. Fünf Kontaktpunkte sind das Minimum:

- Tag der Unterschrift: Glückwunsch, Kündigungstermin festlegen, Kündigungsgespräch üben.
- Tag nach der Kündigung: Wie lief es? Gab es ein Gegenangebot?
- Nach etwa einem Monat: Der Kunde meldet sich persönlich, etwa mit einem Willkommensgruß.
- Zur Halbzeit: Der Kunde lädt ins Team ein, zum Beispiel zu einem Teamessen.
- Ein bis zwei Wochen vor dem Start: Ablauf des ersten Tages, Ansprechpartner, Ausstattung.

Achte auf Warnsignale: Die Person antwortet langsamer, klingt unsicher oder erwähnt ein anderes Gespräch. Dann rufst du an und sprichst es offen an.

## Nach dem Start

Melde dich bei beiden nach der ersten Woche, nach dem ersten Monat, nach drei Monaten und zum Ende der Probezeit. Die Probezeit dauert höchstens 6 Monate (§ 622 BGB). In dieser Zeit können beide Seiten mit kurzer Frist kündigen. Kleine Probleme, die du früh hörst, lassen sich lösen.

## Continuity

Continuity ist Matchunts Nachbesetzungs-Leistung für den Kunden. Endet die Anstellung innerhalb der vereinbarten Zeit, sucht Matchunt nach. Ob und wie lange das gilt, hängt vom Paket des Kunden ab. Für dich heißt das: Ein früher Abgang kostet Zeit und Ansehen und kann deinen Anteil betreffen. Die genauen Regeln stehen in deinem Headhunter-Vertrag. Sprich deshalb immer von Continuity oder Nachbesetzung. Versprich nie, dass eine Person bleibt. Das kann niemand.

## Beispiel

Headhunter Marc Albers hat Stefan Lorenz als Teamleiter Instandhaltung an die Rieger Antriebstechnik GmbH vermittelt. Unterschrift am 12. Oktober, Start am 1. April. Im Januar lädt Rieger ihn zum Neujahrsempfang ein. Im Februar erwähnt Stefan den Anruf eines anderen Headhunters. Marc fragt: „Wie sicher sind Sie sich, auf einer Skala von 1 bis 10?“ Stefan sagt 8. Ihm fehlt ein Gespräch über die Schichtplanung. Marc organisiert es mit dem Kunden. Stefan startet am 1. April.

## Das Wichtigste

- Plane bis zum Start mindestens 5 Kontaktpunkte und lass den Kunden ins Team einladen.
- Melde dich nach Woche 1, Monat 1, Monat 3 und zum Ende der Probezeit.
- Continuity ist Nachbesetzung, kein Versprechen, dass die Person bleibt.', 9, false, 3, 'Nach diesem Thema kannst du einen Plan mit mindestens fünf Kontaktpunkten bis zum Start aufstellen und Kandidat und Kunde durch die Probezeit begleiten.', 'Übergabeplan bis zum Start', '## Bis zum Start (Beispiel: 3 Monate Kündigungsfrist)

- Tag der Unterschrift: Glückwunsch, Kündigungstermin, Kündigungsgespräch üben
- Tag nach der Kündigung: Wie lief es? Gab es ein Gegenangebot?
- Woche 4: Willkommensgruß vom Kunden (Ansprechpartner: ___)
- Woche 8: Einladung ins Team (Termin: ___)
- 1–2 Wochen vor dem Start: erster Tag, Ansprechpartner, Ausstattung
- Dazwischen: alle zwei Wochen kurz melden

## Warnsignale

- Antwortet langsamer oder gar nicht
- Erwähnt ein anderes Gespräch oder ein Gegenangebot
- Klingt unsicher oder fragt viel zum alten Job
- Dann: sofort anrufen, offen fragen, an die eigenen Wechselgründe erinnern

## Nach dem Start (Kandidat und Kunde)

- Woche 1: ___
- Monat 1: ___
- Monat 3: ___
- Ende der Probezeit (höchstens 6 Monate): ___', 5)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('8c7aa85f-6b07-4360-8d2d-45e16a2d3c77', '6d7e6ff8-a7ef-4f9c-8ddd-2af93554f14e', 'single', 'Kandidatin Petra Engel unterschreibt am 12. Oktober. Sie hat 3 Monate Kündigungsfrist zum Quartalsende.', 'Womit planst du realistisch?', '[{"id":"a","text":"Mit einem Start am 1. Januar, also in knapp drei Monaten"},{"id":"b","text":"Mit einem Start am 1. April, also fast einem halben Jahr Begleitung"},{"id":"c","text":"Mit einem Start in vier Wochen, weil das die gesetzliche Frist ist"}]'::jsonb, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('8c7aa85f-6b07-4360-8d2d-45e16a2d3c77', '"b"'::jsonb, 'Für das Quartalsende 31. Dezember hätte sie bis Ende September kündigen müssen. Ihr Vertrag endet also frühestens am 31. März, und du begleitest fast sechs Monate.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('35322919-7ffd-45c2-8561-c6747ba9b3f8', '6d7e6ff8-a7ef-4f9c-8ddd-2af93554f14e', 'single', 'Sechs Wochen nach der Unterschrift antwortet Kandidat Paul Richter seit Tagen nicht. Zuletzt erwähnte er „ein interessantes Gespräch“.', 'Was tust du?', '[{"id":"a","text":"Du wartest ab. Er hat unterschrieben, also ist alles in trockenen Tüchern."},{"id":"b","text":"Du bittest den Kunden, Paul schriftlich mit einer Vertragsstrafe zu drohen."},{"id":"c","text":"Du rufst Paul an, fragst offen nach dem Gespräch und erinnerst an seine Gründe."}]'::jsonb, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('35322919-7ffd-45c2-8561-c6747ba9b3f8', '"c"'::jsonb, 'Langsame Antworten und ein anderes Gespräch sind Warnsignale. Ein offenes Gespräch über seine eigenen Wechselgründe hilft mehr als Druck.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('75d1effe-b881-4778-84d4-f9bef5eb2444', '6d7e6ff8-a7ef-4f9c-8ddd-2af93554f14e', 'single', 'Ein Kunde fragt dich: „Was passiert, wenn die neue Kollegin nach zwei Monaten wieder geht?“', 'Was antwortest du?', '[{"id":"a","text":"„Je nach Ihrem Paket greift Continuity. Dann sucht Matchunt nach.“"},{"id":"b","text":"„Das passiert nicht. Ich verspreche Ihnen, dass sie bleibt.“"},{"id":"c","text":"„Dann bekommen Sie immer das ganze Honorar zurück, egal bei welchem Paket.“"}]'::jsonb, 3) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('75d1effe-b881-4778-84d4-f9bef5eb2444', '"a"'::jsonb, 'Continuity ist Matchunts Nachbesetzungs-Leistung und hängt vom Paket des Kunden ab. Dass eine Person bleibt, kann niemand versprechen.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('7aaa040a-cafc-4e31-817d-0c3d07e8c391', '6d7e6ff8-a7ef-4f9c-8ddd-2af93554f14e', 'multi', NULL, 'Was gehört in deinen Plan bis zum Start? (Mehrere Antworten richtig)', '[{"id":"a","text":"Ein kurzer Anruf am Tag nach der Kündigung"},{"id":"b","text":"Eine Einladung des Kunden zu einem Teamtermin"},{"id":"c","text":"Funkstille bis zum ersten Tag, damit die Person Ruhe hat"},{"id":"d","text":"Kurz vor dem Start den Ablauf des ersten Tages klären"}]'::jsonb, 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('7aaa040a-cafc-4e31-817d-0c3d07e8c391', '["a","b","d"]'::jsonb, 'Regelmäßiger Kontakt und ein Kunde, der einlädt, halten die Entscheidung stabil. Funkstille öffnet die Tür für Gegenangebote und andere Headhunter.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('5748855a-ac9f-4d0b-8462-81f70f13f9f4', '6d7e6ff8-a7ef-4f9c-8ddd-2af93554f14e', 'order', NULL, 'Bring die Schritte von der Unterschrift bis zum Ende der Probezeit in die richtige Reihenfolge.', '[{"id":"3b1893fb","text":"Kündigungsgespräch üben"},{"id":"394edb1d","text":"Am Tag nach der Kündigung nachfragen, wie es lief"},{"id":"69391645","text":"Der Kunde lädt ins Team ein"},{"id":"413245ff","text":"Nach der ersten Arbeitswoche bei beiden melden"},{"id":"1f032641","text":"Zum Ende der Probezeit bei beiden melden"}]'::jsonb, 5) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('5748855a-ac9f-4d0b-8462-81f70f13f9f4', '["3b1893fb","394edb1d","69391645","413245ff","1f032641"]'::jsonb, 'Erst sicherst du die Kündigung ab, dann füllst du die Wartezeit gemeinsam mit dem Kunden. Nach dem Start bleibst du bis zum Ende der Probezeit dran.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('aec2bf07-e877-4856-88c1-2c3503e72437', '6d7e6ff8-a7ef-4f9c-8ddd-2af93554f14e', 'match', NULL, 'Ordne die Fristen richtig zu.', '{"left":[{"id":"b1f54023","text":"Gesetzliche Grundkündigungsfrist"},{"id":"4d83c399","text":"Übliche Kündigungsfrist"},{"id":"e76f41c2","text":"Bei Führungskräften oft"},{"id":"b6af2dea","text":"Probezeit höchstens"}],"right":[{"id":"1843d65e","text":"4 Wochen"},{"id":"c0f71645","text":"3 Monate"},{"id":"aa144146","text":"3–6 Monate zum Quartalsende"},{"id":"5e9c3b4c","text":"6 Monate"}]}'::jsonb, 6) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('aec2bf07-e877-4856-88c1-2c3503e72437', '{"b1f54023":"1843d65e","4d83c399":"c0f71645","e76f41c2":"aa144146","b6af2dea":"5e9c3b4c"}'::jsonb, 'Die übliche Frist liegt weit über der gesetzlichen. Deshalb dauert die Zeit bis zum Start oft Monate, und du brauchst einen Plan.') ON CONFLICT (question_id) DO NOTHING;

-- Modul 8: Sauber und selbstständig arbeiten
INSERT INTO public.academy_modules (id, course_id, title, sort_order, description, test_question_count, test_pass_pct, test_retry_minutes) VALUES
  ('1c355ee4-f1e0-46b0-81ce-09cc6e0de924', '9f553b3f-110b-4db5-8226-e348fe4a582a', 'Sauber und selbstständig arbeiten', 8, 'Nach diesem Modul kannst du die wichtigsten Rechtsregeln beim Suchen, Ansprechen und Vorstellen einhalten, Kundenschutz und Fairness auf Matchunt wahren und deinen Start als Selbstständiger ehrlich planen.', 10, 90, 120)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_lessons (id, module_id, title, content_type, body, duration_min, is_premium, sort_order, learning_goal, vorlage_title, vorlage_body, quiz_question_count) VALUES
  ('012d61af-250f-4df1-8a37-8716fc9e8a26', '1c355ee4-f1e0-46b0-81ce-09cc6e0de924', 'Die Regeln, die dich schützen', 'text', 'Regeln wirken oft wie Bremsen. Für dich sind sie ein Schutz. Ein Verstoß kostet Geld, Ruf und auf Matchunt deinen Zugang. Dieses Thema gibt dir den Überblick. Es ersetzt keine Rechtsberatung. Bist du unsicher, frag eine Fachanwältin oder einen Fachanwalt.

## Datenschutz beim Suchen

- Berufliche Profile, etwa auf LinkedIn oder XING, darfst du ansehen und die Person zu einer passenden Stelle ansprechen. Grundlage ist das berechtigte Interesse.
- Informiere die Person spätestens mit der ersten Nachricht, sonst binnen eines Monats: wer du bist, woher du die Daten hast, wozu und wie lange du sie nutzt und welche Rechte sie hat (Art. 14 DSGVO). Das Bundesarbeitsgericht sprach 2025 einer Person 1.000 € Schadensersatz zu, weil diese Information fehlte.
- Einen eigenen Kandidatenpool führst du nur mit Einwilligung und mit Löschfrist.
- Keine Browser-Erweiterungen, die Profile auslesen. Der Anbieter Kaspr musste dafür 240.000 € Bußgeld an die französische Datenschutzbehörde CNIL zahlen.
- Private Netzwerke wie Facebook oder Instagram sind für die Recherche tabu.

## Gleichbehandlung (AGG)

Anzeigen formulierst du neutral, mit (m/w/d). Frag nie nach Alter, Herkunft, Religion, Familienplanung oder Gesundheit. Erzählt jemand so etwas von sich aus, gibst du es nicht weiter, weder in der Einschätzung noch mündlich.

## Ansprache (UWG)

Ein Anruf am Arbeitsplatz ist erlaubt, wenn er kurz bleibt: Name, Zweck, Interesse klären, Termin nach Feierabend. Wiederholte Anrufe und Überreden sind unzulässig (BGH). Werbe-E-Mails brauchen eine Einwilligung (§ 7 UWG). Schreib die erste E-Mail deshalb erst nach einer Antwort oder Einwilligung.

## Gespräch, Vertraulichkeit, Geld

- Gespräche zeichnest du nur mit Einwilligung auf. Alles andere ist strafbar (§ 201 StGB).
- Vertraulich bleibt, was vertraulich ist: kein Kundenname zu früh, keine Kandidatendaten ohne Zustimmung, keine Einreichung ohne Einwilligung.
- Nimm nie Geld von der Kandidatin (§ 296 SGB III). Das Honorar zahlt der Kunde.
- Du vermittelst in eine Anstellung beim Kunden. Menschen selbst anstellen und an den Kunden verleihen ist Arbeitnehmerüberlassung und braucht eine Erlaubnis (AÜG).

## Was kommt: Entgelttransparenz und KI

Die EU-Richtlinie 2023/970 bringt mehr Transparenz beim Gehalt. Das deutsche Gesetz wird für 2027 erwartet. Dann gilt: Gehaltsspanne vor dem Gespräch nennen, nicht nach dem bisherigen Gehalt fragen. Gewöhn dich schon jetzt daran und frag nach Erwartung und Untergrenze.

KI darf dir helfen, zum Beispiel beim Suchstring, im Business-Tarif und ohne Personendaten. Werkzeuge, die aus Stimme oder Mimik Gefühle ablesen, sind tabu: Emotionserkennung im Arbeitsumfeld ist in der EU seit Februar 2025 verboten. Die Auswahl trifft immer ein Mensch, nie die KI.

## Beispiel

Headhunterin Sabine Roth ruft Jan Weber an seinem Arbeitsplatz an. Nach einer Minute steht ein Termin am Abend. Ihre LinkedIn-Nachricht danach enthält den Datenschutz-Hinweis. Im Gespräch erzählt Jan, dass er bald Vater wird. In ihrer Einschätzung steht davon nichts.

## Das Wichtigste

- Informiere spätestens mit der ersten Nachricht nach Art. 14 DSGVO und nutze keine Auslese-Werkzeuge.
- Frag nichts, was das AGG schützt, und zeichne nur mit Einwilligung auf.
- Nimm nie Geld von Kandidaten und lass nie die KI auswählen.', 10, false, 1, 'Nach diesem Thema kannst du die wichtigsten Regeln aus Datenschutz, Gleichbehandlung, Wettbewerbsrecht und Vermittlungsrecht in typischen Situationen richtig anwenden.', 'Datenschutz-Hinweis für die erste Nachricht', 'Muster zum Anpassen. Keine Rechtsberatung: Lass deine endgültige Fassung von einer Fachanwältin oder einem Fachanwalt prüfen.

## Kurzfassung für die erste Nachricht

- „Ich habe Ihr berufliches Profil auf [LinkedIn/XING] gefunden. Ich speichere Ihren Namen, Ihren beruflichen Werdegang und diesen Kontaktweg, um Ihnen eine passende Stelle vorzustellen.“
- „Haben Sie kein Interesse, lösche ich Ihre Daten innerhalb von [Frist].“
- „Mehr zu Ihren Rechten: [Link zu deinen Datenschutzhinweisen]“

## Was in die ausführlichen Hinweise gehört (Art. 14 DSGVO)

- Wer verantwortlich ist: [Name, Firma, Anschrift, E-Mail]
- Zweck und Rechtsgrundlage: Ansprache zu einer passenden Stelle, berechtigtes Interesse
- Welche Daten und woher sie stammen
- An wen sie gehen: an einen Kunden nur mit Ihrer Einwilligung
- Wie lange sie gespeichert werden
- Ihre Rechte: Auskunft, Berichtigung, Löschung, Widerspruch, Beschwerde bei einer Datenschutz-Aufsichtsbehörde', 5)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('d2176d71-8daa-4e2e-849e-8d950d9b7a20', '012d61af-250f-4df1-8a37-8716fc9e8a26', 'single', 'Du hast Jana Krüger auf LinkedIn gefunden. Heute schreibst du ihr zum ersten Mal wegen einer passenden Stelle.', 'Wann muss Jana erfahren, wer du bist, woher du ihre Daten hast und wozu du sie nutzt?', '[{"id":"a","text":"Erst wenn sie Interesse an der Stelle gezeigt hat"},{"id":"b","text":"Spätestens mit dieser ersten Nachricht an sie"},{"id":"c","text":"Innerhalb eines Jahres nach dem ersten Kontakt"}]'::jsonb, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('d2176d71-8daa-4e2e-849e-8d950d9b7a20', '"b"'::jsonb, 'Art. 14 DSGVO verlangt die Information spätestens beim ersten Kontakt. Fehlt sie, droht Schadensersatz, wie das BAG-Urteil von 2025 zeigt.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('b29be74a-d750-475a-8b88-ce295efab266', '012d61af-250f-4df1-8a37-8716fc9e8a26', 'single', 'Du rufst Kandidat Daniel Fuchs an seinem Arbeitsplatz an. Er sagt: „Klingt spannend, aber ich sitze gerade im Großraumbüro.“', 'Wie machst du weiter?', '[{"id":"a","text":"Du erklärst ihm die Stelle trotzdem in Ruhe, damit er sie ganz versteht."},{"id":"b","text":"Du rufst morgen und übermorgen wieder in der Firma an, bis es passt."},{"id":"c","text":"Du vereinbarst einen Termin nach Feierabend und beendest das Gespräch."}]'::jsonb, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('b29be74a-d750-475a-8b88-ce295efab266', '"c"'::jsonb, 'Am Arbeitsplatz ist nur ein kurzer Erstkontakt erlaubt: Zweck nennen, Interesse klären, Termin außerhalb der Arbeitszeit. Wiederholte Anrufe und Überreden sind unzulässig.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('b79fd745-6a81-4124-8be8-6efaafc7966f', '012d61af-250f-4df1-8a37-8716fc9e8a26', 'single', 'Im Gespräch erzählt Kandidatin Lisa Brand von sich aus, dass sie im nächsten Jahr eine Familie gründen will.', 'Was machst du mit dieser Information?', '[{"id":"a","text":"Sie bleibt draußen, schriftlich wie mündlich. Das AGG schützt sie."},{"id":"b","text":"Du schreibst sie in die Einschätzung, damit der Kunde planen kann."},{"id":"c","text":"Du deutest sie dem Kunden am Telefon an, schriftlich aber nicht."}]'::jsonb, 3) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('b79fd745-6a81-4124-8be8-6efaafc7966f', '"a"'::jsonb, 'Familienplanung ist durch das AGG geschützt. Auch wenn die Kandidatin es selbst erzählt, gibst du es nicht weiter, weder schriftlich noch mündlich.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('0490ad79-2c0a-4694-8703-d76d127dcfd3', '012d61af-250f-4df1-8a37-8716fc9e8a26', 'multi', NULL, 'Was ist erlaubt? (Mehrere Antworten richtig)', '[{"id":"a","text":"Ein berufliches XING-Profil ansehen und die Person zu einer passenden Stelle ansprechen"},{"id":"b","text":"Eine Browser-Erweiterung nutzen, die bei LinkedIn-Profilen Telefonnummern ausliest"},{"id":"c","text":"Einen KI-Assistenten im Business-Tarif für einen Suchstring ohne Personendaten nutzen"},{"id":"d","text":"Eine KI entscheiden lassen, welche Kandidaten du beim Kunden einreichst"}]'::jsonb, 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('0490ad79-2c0a-4694-8703-d76d127dcfd3', '["a","c"]'::jsonb, 'Berufliche Profile ansehen und KI als Werkzeug ohne Personendaten nutzen ist erlaubt. Auslese-Erweiterungen sind tabu (Kaspr: 240.000 € Bußgeld), und die Auswahl trifft immer ein Mensch.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('c60a08d0-31e6-4fba-85d9-258ebc006c1c', '012d61af-250f-4df1-8a37-8716fc9e8a26', 'match', NULL, 'Ordne jede Regel ihrer Rechtsgrundlage zu.', '{"left":[{"id":"94ac7138","text":"Gespräche nur mit Einwilligung aufzeichnen"},{"id":"b4b09020","text":"Werbe-E-Mails nur mit Einwilligung"},{"id":"2fbd7d23","text":"Nie Geld von der Kandidatin nehmen"},{"id":"b02cb7c6","text":"Niemanden ohne Erlaubnis an Kunden verleihen"}],"right":[{"id":"6ef6bf38","text":"§ 201 StGB"},{"id":"c5165323","text":"§ 7 UWG"},{"id":"49db0091","text":"§ 296 SGB III"},{"id":"ffd98b96","text":"AÜG"}]}'::jsonb, 5) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('c60a08d0-31e6-4fba-85d9-258ebc006c1c', '{"94ac7138":"6ef6bf38","b4b09020":"c5165323","2fbd7d23":"49db0091","b02cb7c6":"ffd98b96"}'::jsonb, 'Jede dieser Regeln hat eine eigene gesetzliche Grundlage. Wer sie kennt, erkennt heikle Situationen schneller.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('a04b08cb-4366-46ae-804d-9f985a66529d', '012d61af-250f-4df1-8a37-8716fc9e8a26', 'single', 'Ein Kunde bittet dich: „Fragen Sie die Kandidatin doch nach ihrem aktuellen Gehalt, damit wir nicht zu viel bieten.“', 'Wie gehst du vor?', '[{"id":"a","text":"Du fragst danach, denn das deutsche Gesetz dazu gilt ja noch gar nicht."},{"id":"b","text":"Du fragst nach Erwartung und Untergrenze, nicht nach dem bisherigen Gehalt."},{"id":"c","text":"Du fragst danach und gibst die Zahl weiter, ohne es ihr vorher zu sagen."}]'::jsonb, 6) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('a04b08cb-4366-46ae-804d-9f985a66529d', '"b"'::jsonb, 'Die EU-Richtlinie zur Entgelttransparenz verbietet die Frage nach dem bisherigen Gehalt, das deutsche Gesetz wird für 2027 erwartet. Erwartung und Untergrenze reichen für ein gutes Angebot.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_lessons (id, module_id, title, content_type, body, duration_min, is_premium, sort_order, learning_goal, vorlage_title, vorlage_body, quiz_question_count) VALUES
  ('76e5f864-3f90-43d1-8089-c205a1fc27ab', '1c355ee4-f1e0-46b0-81ce-09cc6e0de924', 'Kundenschutz und Fairness auf Matchunt', 'text', 'Matchunt funktioniert, weil sich alle drei Seiten aufeinander verlassen können. Niemand sieht mehr, als er muss. Die Kandidatin stimmt jeder Einreichung zu. Der Kunde sieht, wer für ihn sucht. Und du bekommst Stellen, ohne selbst Kunden gewinnen zu müssen. Das klappt nur, wenn niemand an der Plattform vorbei arbeitet.

## Bestandskunden: nur mit Beleg

Klickst du bei einer Stelle auf „Ich suche“, fragt Matchunt: Ist diese Firma schon dein Kunde? Ein Ja zählt nur mit Beleg. Der Beleg ist ein unterschriebener Vertrag mit dieser Firma aus der Zeit vor deinem „Ich suche“. Ein Handschlag, alte Telefonate oder eine Visitenkarte reichen nicht. Auch eine nachträgliche Bestätigung des Kunden ersetzt den Vertrag nicht. Den Beleg prüft Matchunt vertraulich.

Warum so streng? Ohne Beleg könnte jeder behaupten, die Firma sei schon sein Kunde, und das Geschäft an der Plattform vorbei machen.

## Keine Geschäfte an Matchunt vorbei

Umgehung heißt: Du lernst eine Firma oder einen Kandidaten über Matchunt kennen und machst das Geschäft dann direkt. Zum Beispiel suchst du die nächste Stelle des Kunden ohne Plattform. Oder du vermittelst einen über Matchunt vorgestellten Kandidaten auf eigene Rechnung. Das gilt auch, wenn der Kunde dich selbst darum bittet.

Der Kunde sieht auf Matchunt, welche Headhunter für ihn suchen und gesucht haben. Spricht ihn jemand direkt an, kann er das melden. Ein Verstoß führt nach einer Anhörung zum Ausschluss. Darüber entscheidet ein Mensch, mit Begründung.

Dieselben Regeln binden auch Kunden und die anderen Headhunter. So ist deine Arbeit geschützt.

## Fairness unter Headhuntern

- Die Plätze sind für alle gleich. Partner, Silber und Gold sind reine Ansehens-Stufen.
- Du reichst nur ein, wen du vorher interviewt hast und wer zugestimmt hat.
- Deine Einschätzung ist ehrlich. Lücken verschweigst du nicht.
- Off-Limits: Firmen, die für eine Suche gesperrt sind, sprichst du nicht an. Mitarbeitende eines Kunden, für den du suchst, wirbst du nicht ab. Die genauen Regeln stehen in deinem Vertrag.

## Beispiel

Headhunter Kai Brenner klickt bei der Stelle „Leitung Einkauf“ der Seidel Verpackungen GmbH auf „Ich suche“. Vor zwei Jahren hat er dort per Handschlag eine Stelle besetzt, einen Vertrag gibt es nicht. Er beantwortet die Frage ehrlich mit Nein und sucht über Matchunt. Drei Wochen später ruft die Personalleiterin an: „Die nächste Stelle machen wir direkt, ohne Plattform. Das spart uns beiden Geld.“ Kai lehnt freundlich ab und bittet sie, die Stelle über Matchunt anzulegen. Er weiß: Ein Direktgeschäft wäre Umgehung, und Seidel sieht ihn ohnehin als Suchenden.

## Das Wichtigste

- Bestandskunde gilt nur mit unterschriebenem Vertrag aus der Zeit vor deinem „Ich suche“.
- Kein Geschäft an Matchunt vorbei, auch nicht auf Wunsch des Kunden.
- Verstöße führen nach einer Anhörung zum Ausschluss.', 8, false, 2, 'Nach diesem Thema kannst du einen Bestandskunden richtig angeben, Umgehung erkennen und vermeiden und die Fairness-Regeln auf Matchunt einhalten.', 'Antwort auf eine direkte Anfrage des Kunden', 'Nutze diesen Text, wenn ein Kunde dich an Matchunt vorbei beauftragen will. Passe Anrede und Ton an.

Guten Tag Frau [Name],

vielen Dank für Ihr Vertrauen. Es freut mich, dass Sie mit meiner Arbeit zufrieden sind.

Für Sie arbeite ich über Matchunt, und dabei bleibt es. Das schützt auch Sie: Stellen, Kandidaten und Vereinbarungen laufen an einem Ort, vertraulich und nachvollziehbar.

Legen Sie die neue Stelle gern über Matchunt an. Sobald sie freigegeben ist, kann ich mit der Suche beginnen.

Viele Grüße
[Dein Name]

## Danach

- Notiere dir Datum und Inhalt der Anfrage.
- Bist du unsicher, frag bei Matchunt nach, bevor du antwortest.', 5)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('3bb6fc57-7ab2-4610-87b2-444c5c02b202', '76e5f864-3f90-43d1-8089-c205a1fc27ab', 'single', 'Bei der Stelle „Vertriebsleitung“ der Wagner Elektro GmbH klickst du auf „Ich suche“. Matchunt fragt, ob die Firma schon dein Kunde ist. Vor zwei Jahren hast du dort per Handschlag eine Stelle besetzt, einen Vertrag gibt es nicht.', 'Was antwortest du?', '[{"id":"a","text":"Ja, denn die Besetzung war echt und der Kunde kennt dich gut."},{"id":"b","text":"Ja, und du bittest den Kunden, das nachträglich zu bestätigen."},{"id":"c","text":"Nein, denn ohne unterschriebenen Vertrag von vorher fehlt der Beleg."}]'::jsonb, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('3bb6fc57-7ab2-4610-87b2-444c5c02b202', '"c"'::jsonb, 'Bestandskunde gilt nur mit einem unterschriebenen Vertrag aus der Zeit vor dem „Ich suche“. Eine nachträgliche Bestätigung ersetzt diesen Beleg nicht.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('4a9d9c15-b9ef-4c24-86d7-879521a5216b', '76e5f864-3f90-43d1-8089-c205a1fc27ab', 'single', 'Die Personalleiterin eines Kunden ruft dich an: „Die nächste Stelle suchen Sie doch direkt für uns, ohne Plattform. Das spart uns beiden Geld.“', 'Wie reagierst du?', '[{"id":"a","text":"Du sagst zu, weil der Kunde selbst gefragt hat und einverstanden ist."},{"id":"b","text":"Du lehnst freundlich ab und bittest sie, die Stelle über Matchunt anzulegen."},{"id":"c","text":"Du sagst zu, wartest aber, bis deine aktuelle Suche bei ihr beendet ist."}]'::jsonb, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('4a9d9c15-b9ef-4c24-86d7-879521a5216b', '"b"'::jsonb, 'Ein Direktgeschäft mit einem Kunden, den du über Matchunt kennst, ist Umgehung, auch auf Wunsch des Kunden. Die Folge kann nach einer Anhörung der Ausschluss sein.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('c73a07ad-de0a-40c2-8d0a-7accff1c2d7e', '76e5f864-3f90-43d1-8089-c205a1fc27ab', 'single', 'Ein Kunde meldet über Matchunt, dass ihn ein Headhunter direkt angesprochen hat, um an der Plattform vorbei zu arbeiten.', 'Was passiert dann?', '[{"id":"a","text":"Matchunt hört den Headhunter an. Bei einem Verstoß folgt der Ausschluss."},{"id":"b","text":"Der Headhunter wird automatisch und sofort gesperrt, ohne ein Gespräch."},{"id":"c","text":"Nichts, solange der Kunde am Ende mit dem Ergebnis zufrieden ist."}]'::jsonb, 3) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('c73a07ad-de0a-40c2-8d0a-7accff1c2d7e', '"a"'::jsonb, 'Verstöße führen zum Ausschluss, aber erst nach einer Anhörung. Entscheiden tut ein Mensch, mit Begründung.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('c36bc7c6-1e09-4f19-8ba5-d8a53f9b88d9', '76e5f864-3f90-43d1-8089-c205a1fc27ab', 'multi', NULL, 'Was gehört zur Fairness auf Matchunt? (Mehrere Antworten richtig)', '[{"id":"a","text":"Die Plätze sind für alle Headhunter gleich, egal welche Stufe."},{"id":"b","text":"Gold-Partner bekommen mehr Plätze und bessere Konditionen."},{"id":"c","text":"Der Kunde sieht, welche Headhunter für ihn suchen."},{"id":"d","text":"Eingereicht wird nur nach Interview und mit Zustimmung der Kandidatin."}]'::jsonb, 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('c36bc7c6-1e09-4f19-8ba5-d8a53f9b88d9', '["a","c","d"]'::jsonb, 'Gleiche Plätze, sichtbare Suchende und die Zustimmung der Kandidatin machen Matchunt fair. Die Stufen sind reines Ansehen, keine besseren Bedingungen.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('a8c7ff29-71d2-4a20-8801-61ffd7b7bb76', '76e5f864-3f90-43d1-8089-c205a1fc27ab', 'order', NULL, 'Bring den Ablauf bei einem möglichen Bestandskunden in die richtige Reihenfolge.', '[{"id":"00452d0e","text":"Du klickst bei der Stelle auf „Ich suche“."},{"id":"69218b28","text":"Matchunt fragt, ob die Firma schon dein Kunde ist."},{"id":"48cdf709","text":"Du antwortest mit Ja und reichst den unterschriebenen Vertrag von vorher ein."},{"id":"f46a0ce3","text":"Matchunt prüft den Beleg vertraulich."}]'::jsonb, 5) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('a8c7ff29-71d2-4a20-8801-61ffd7b7bb76', '["00452d0e","69218b28","48cdf709","f46a0ce3"]'::jsonb, 'Die Frage kommt beim „Ich suche“. Ein Ja zählt nur mit Beleg, und den prüft Matchunt vertraulich.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('34a04fca-3cb1-4919-86de-869f045c46d8', '76e5f864-3f90-43d1-8089-c205a1fc27ab', 'single', 'Du suchst gerade für die Hartmann Medizintechnik GmbH. Für eine Stelle bei einer anderen Firma findest du die perfekte Kandidatin. Sie arbeitet bei Hartmann.', 'Was tust du?', '[{"id":"a","text":"Du sprichst sie an, denn es geht ja um eine ganz andere Firma und Stelle."},{"id":"b","text":"Du sprichst sie nicht an. Beim Kunden, für den du suchst, wirbst du nicht ab."},{"id":"c","text":"Du sprichst sie an, erzählst Hartmann aber vorsichtshalber nichts davon."}]'::jsonb, 6) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('34a04fca-3cb1-4919-86de-869f045c46d8', '"b"'::jsonb, 'Mitarbeitende eines Kunden, für den du suchst, sind Off-Limits. Wer sie abwirbt, zerstört das Vertrauen, auf dem die Zusammenarbeit beruht.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_lessons (id, module_id, title, content_type, body, duration_min, is_premium, sort_order, learning_goal, vorlage_title, vorlage_body, quiz_question_count) VALUES
  ('c427b950-1e0c-4fe1-81fc-5cbd8cd16bb1', '1c355ee4-f1e0-46b0-81ce-09cc6e0de924', 'Selbstständig starten', 'text', 'Mit der Freischaltung auf Matchunt bist du selbstständig. Matchunt ist dein Vertragspartner, nicht dein Arbeitgeber. Du entscheidest selbst, wann und wie du arbeitest und für welche Stellen du suchst. Dafür kümmerst du dich selbst um Gewerbe, Steuern, Absicherung und Geld. Dieses Thema gibt dir eine Liste. Die Beratung im Einzelfall ersetzt es nicht.

## Gewerbe und Steuern

- Headhunting ist in der Regel ein Gewerbe. Melde es vor dem Start beim Gewerbeamt deiner Gemeinde an.
- Danach meldest du dich mit dem Fragebogen zur steuerlichen Erfassung beim Finanzamt.
- Sprich vorher mit einem Steuerberater. Wichtige Fragen: Kleinunternehmerregelung oder Umsatzsteuer? Wie viel jeder Zahlung legst du für Steuern zurück? Kommen Vorauszahlungen auf dich zu?

## Gutschrift statt Rechnung

Du schreibst Matchunt keine Rechnung. Matchunt rechnet per Gutschrift ab und erstellt das Dokument für dich. Damit es stimmt, müssen deine Angaben im Profil korrekt sein: Steuernummer, Umsatzsteuer ja oder nein, Bankverbindung. Prüfe jede Gutschrift und melde Fehler sofort.

## Absichern

Ein Fehler kann teuer werden, etwa Unterlagen an den falschen Empfänger. Eine Berufshaftpflicht ist deshalb sinnvoll. Lass dich zu Umfang und Kosten beraten. Kranken- und Altersvorsorge regelst du als Selbstständiger selbst. Beziehst du Arbeitslosengeld, frag die Agentur für Arbeit nach dem Gründungszuschuss. Dein Abschluss der Akademie kann beim Nachweis deiner Kenntnisse helfen.

## Partnerstatus und Liga

Mit der Freischaltung bist du Matchunt Partner. Silber gibt es nach 5 Kunden-Interviews oder 1 Einstellung, Gold nach festen Regeln. Die Matchunt Liga zeichnet die Besten einer Saison aus. Stufen und Liga sind reine Anerkennung: keine Pflicht, keine anderen Plätze, keine anderen Konditionen.

## Ein ehrlicher Finanzplan

Das erste Honorar kommt oft spät. Suche, Interviews und Angebot dauern Wochen bis Monate. Dann folgt meist eine Kündigungsfrist von 3 Monaten. In der Regel kommt dein Geld erst nach dem Start der Person. Die genauen Regeln stehen in deinem Headhunter-Vertrag.

Plane deshalb mindestens sechs Monate ohne Honorar. Rechne deine monatlichen Kosten zusammen, nimm sie mal sechs und leg eine Steuerrücklage dazu. Reicht dein Polster nicht, plane eine Überbrückung, etwa eine Teilzeitstelle. Geld von Kandidaten ist nie eine Lösung, es ist verboten.

## Beispiel

Nina Hoffmann war Vertriebsleiterin und startet am 1. Februar als Headhunterin. Mitte Januar meldet sie ihr Gewerbe an und spricht mit ihrem Steuerberater. Ihre erste Einreichung schickt sie im Februar, im März lädt der Kunde zum Interview. Mitte April unterschreibt ihr Kandidat. Er hat 3 Monate Kündigungsfrist zum Monatsende und startet am 1. August. Ihr erstes Honorar kommt danach. Nina hat vorgesorgt: Ihr Polster reicht für sieben Monate.

## Das Wichtigste

- Melde dein Gewerbe an und kläre die Steuern mit einem Steuerberater, bevor du startest.
- Matchunt rechnet per Gutschrift ab. Deine Angaben im Profil müssen stimmen.
- Plane mindestens sechs Monate ohne Honorar ein.', 9, false, 3, 'Nach diesem Thema kannst du deine ersten Schritte als Selbstständiger planen: Gewerbe, Steuern, Abrechnung, Absicherung und einen ehrlichen Finanzplan für sechs Monate.', 'Finanzplan für die ersten sechs Monate', 'Trag deine eigenen Zahlen ein und rechne lieber vorsichtig.

## Monatliche Kosten

- Lebenshaltung (Miete, Essen, Mobilität): ___ €
- Kranken- und Pflegeversicherung: ___ €
- Altersvorsorge: ___ €
- Berufshaftpflicht: ___ €
- Werkzeuge (z. B. LinkedIn, Telefon, Headset): ___ €
- Steuerberater: ___ €
- Summe pro Monat: ___ €

## Polster

- Summe pro Monat × 6: ___ €
- Rücklage für Steuern (Anteil mit dem Steuerberater klären): ___ €
- Vorhandenes Polster: ___ €
- Lücke: ___ €

## Wenn eine Lücke bleibt

- Überbrückung, z. B. Teilzeitstelle: ___
- Gründungszuschuss geprüft: ja / nein

## Erledigt vor dem Start

- Gewerbe angemeldet
- Fragebogen zur steuerlichen Erfassung abgegeben
- Steuerangaben im Matchunt-Profil eingetragen
- Berufshaftpflicht geprüft', 5)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('66928e15-e32f-42e4-8a16-ac5c4a2d8aac', 'c427b950-1e0c-4fe1-81fc-5cbd8cd16bb1', 'single', 'Du bist zugelassen und willst nächste Woche mit deiner ersten Suche auf Matchunt beginnen.', 'Was erledigst du vorher?', '[{"id":"a","text":"Nichts, denn Matchunt meldet dein Gewerbe bei der Freischaltung automatisch an."},{"id":"b","text":"Du meldest dein Gewerbe an und klärst die Steuerfragen mit einem Steuerberater."},{"id":"c","text":"Du gründest zuerst eine GmbH, weil Einzelpersonen nicht vermitteln dürfen."}]'::jsonb, 1) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('66928e15-e32f-42e4-8a16-ac5c4a2d8aac', '"b"'::jsonb, 'Als Selbstständiger meldest du dein Gewerbe selbst an. Ob Kleinunternehmerregelung oder Umsatzsteuer, klärst du mit einem Steuerberater.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('23e0b645-762d-489f-853a-bc69e75db635', 'c427b950-1e0c-4fe1-81fc-5cbd8cd16bb1', 'single', 'Dein erster Kandidat hat angefangen. Du überlegst, wie du Matchunt deine Rechnung schreibst.', 'Was ist richtig?', '[{"id":"a","text":"Du schreibst die Rechnung über dein Honorar direkt an den Kunden der Stelle."},{"id":"b","text":"Du schreibst Matchunt eine Rechnung über das ganze Honorar des Kunden."},{"id":"c","text":"Matchunt rechnet per Gutschrift ab. Du prüfst sie und pflegst deine Angaben."}]'::jsonb, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('23e0b645-762d-489f-853a-bc69e75db635', '"c"'::jsonb, 'Matchunt erstellt die Gutschrift für dich. Damit sie stimmt, müssen Steuernummer, Umsatzsteuer-Angabe und Bankverbindung in deinem Profil korrekt sein.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('4e8231d0-ed6f-47c6-8f58-8b153b4ee137', 'c427b950-1e0c-4fe1-81fc-5cbd8cd16bb1', 'single', 'Dein Kandidat unterschreibt am 15. April. Er hat 3 Monate Kündigungsfrist zum Monatsende.', 'Wann rechnest du realistisch mit deinem Geld?', '[{"id":"a","text":"Frühestens nach seinem Start am 1. August"},{"id":"b","text":"Noch im April, direkt mit seiner Unterschrift"},{"id":"c","text":"Ende Mai, wenn er beim alten Arbeitgeber gekündigt hat"}]'::jsonb, 3) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('4e8231d0-ed6f-47c6-8f58-8b153b4ee137', '"a"'::jsonb, 'In der Regel kommt dein Geld erst nach dem Start der Person. Mit 3 Monaten Kündigungsfrist zum Monatsende ist das hier frühestens im August.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('1f9fe72e-31fd-4d23-83ef-49b193581b46', 'c427b950-1e0c-4fe1-81fc-5cbd8cd16bb1', 'multi', NULL, 'Was stimmt über Partnerstatus und Liga? (Mehrere Antworten richtig)', '[{"id":"a","text":"Silber gibt es nach 5 Kunden-Interviews oder 1 Einstellung."},{"id":"b","text":"Gold-Partner bekommen mehr Plätze als andere Headhunter."},{"id":"c","text":"Die Liga ist reine Anerkennung ohne andere Konditionen."},{"id":"d","text":"Wer in der Liga hinten liegt, verliert seine Plätze."}]'::jsonb, 4) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('1f9fe72e-31fd-4d23-83ef-49b193581b46', '["a","c"]'::jsonb, 'Stufen und Liga sind reine Anerkennung. Plätze und Konditionen hängen nicht davon ab.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('08ff7b3e-16d5-4cb8-8950-bf4e3f86de97', 'c427b950-1e0c-4fe1-81fc-5cbd8cd16bb1', 'match', NULL, 'Wer hilft dir bei welcher Frage? Ordne zu.', '{"left":[{"id":"918caabd","text":"Kleinunternehmerregelung oder Umsatzsteuer?"},{"id":"9d46c21a","text":"Gewerbe anmelden"},{"id":"a2c8413e","text":"Gründungszuschuss beim Bezug von Arbeitslosengeld"},{"id":"df69bb57","text":"Steuerliche Erfassung nach der Gewerbeanmeldung"}],"right":[{"id":"2571a88e","text":"Steuerberater"},{"id":"9b7ef486","text":"Gewerbeamt deiner Gemeinde"},{"id":"f7f60481","text":"Agentur für Arbeit"},{"id":"a931ed42","text":"Finanzamt"}]}'::jsonb, 5) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('08ff7b3e-16d5-4cb8-8950-bf4e3f86de97', '{"918caabd":"2571a88e","9d46c21a":"9b7ef486","a2c8413e":"f7f60481","df69bb57":"a931ed42"}'::jsonb, 'Für jede Frage gibt es eine zuständige Stelle. Steuerfragen klärst du nie allein nach Gefühl.') ON CONFLICT (question_id) DO NOTHING;
INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES ('8af893f3-7979-48b9-869f-49fc7c6db527', 'c427b950-1e0c-4fe1-81fc-5cbd8cd16bb1', 'single', 'Lea Sommer will ihren Job kündigen und ab März als Headhunterin starten. Ihre Ersparnisse reichen für zwei Monate.', 'Was rätst du ihr?', '[{"id":"a","text":"Sofort starten, denn das erste Honorar kommt meist schon im zweiten Monat."},{"id":"b","text":"Mit mindestens sechs Monaten ohne Honorar planen und die Lücke überbrücken."},{"id":"c","text":"Die Lücke mit einer kleinen Gebühr von den ersten Kandidaten überbrücken."}]'::jsonb, 6) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES ('8af893f3-7979-48b9-869f-49fc7c6db527', '"b"'::jsonb, 'Das erste Honorar kommt oft erst nach Kündigungsfrist und Start. Geld von Kandidaten zu nehmen ist verboten (§ 296 SGB III).') ON CONFLICT (question_id) DO NOTHING;
