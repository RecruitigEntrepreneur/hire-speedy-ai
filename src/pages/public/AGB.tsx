import { Link } from "react-router-dom";
import { AGB_VERSION_LABEL } from '@/lib/legalVersions';
import { Navbar } from "@/components/layout/Navbar";
import { FooterSection } from "@/components/landing/FooterSection";
import { ArrowLeft } from "lucide-react";

const AGB = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-24 max-w-3xl">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück zur Startseite
        </Link>

        <h1 className="text-4xl font-bold mb-8">Allgemeine Geschäftsbedingungen</h1>

        <div className="prose prose-slate dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-4">§ 1 Geltungsbereich und Vertragspartner</h2>
            <p className="text-muted-foreground">
              (1) Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für die Nutzung der Plattform Matchunt,
              betrieben von der Bluewater &amp; Bridge GmbH, Adlzreiterstraße 2, 80337 München (nachfolgend
              „Matchunt", „wir").<br /><br />
              (2) Die Plattform richtet sich ausschließlich an Unternehmer im Sinne des § 14 BGB.
              Verbraucher im Sinne des § 13 BGB sind von der Nutzung ausgeschlossen.<br /><br />
              (3) Es gelten ausschließlich diese AGB. Abweichende oder entgegenstehende Bedingungen des
              Nutzers werden nicht Vertragsbestandteil, es sei denn, wir stimmen ihrer Geltung ausdrücklich
              schriftlich zu. Individuelle Vereinbarungen haben Vorrang vor diesen AGB.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">§ 2 Begriffsbestimmungen</h2>
            <p className="text-muted-foreground">
              <strong>Unternehmen</strong> sind Nutzer, die offene Stellen ausschreiben und Kandidaten suchen.
              <strong> Recruiter</strong> sind verifizierte Nutzer, die Unternehmen Kandidatinnen und
              Kandidaten vorschlagen. <strong>Kandidat</strong> ist eine natürliche Person, deren Profil über
              die Plattform verarbeitet wird. <strong>Mandat</strong> ist eine konkrete, von einem Unternehmen
              ausgeschriebene Stelle. <strong>Vermittlung</strong> ist das durch einen Vorschlag über die
              Plattform veranlasste Zustandekommen eines Anstellungs- oder Dienstverhältnisses.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">§ 3 Vertragsgegenstand und Rolle von Matchunt</h2>
            <p className="text-muted-foreground">
              (1) Matchunt betreibt eine Online-Plattform, über die Unternehmen Stellen ausschreiben und
              verifizierte Recruiter passende Kandidatinnen und Kandidaten vorschlagen können. Matchunt stellt
              die technische Infrastruktur einschließlich Kommunikations-, Bewertungs- und
              Zahlungsabwicklungsfunktionen bereit und vermittelt den Kontakt zwischen den Nutzern.<br /><br />
              (2) Matchunt wird nicht selbst als Personalvermittler tätig und betreibt keine
              Arbeitnehmerüberlassung im Sinne des AÜG. Der Vermittlungs- bzw. Mäklervertrag kommt zwischen
              Unternehmen und Recruiter unter Einbeziehung von Matchunt als Plattform zustande.<br /><br />
              (3) Matchunt schuldet die Bereitstellung der Plattform, nicht den Vermittlungserfolg. Ein
              Anspruch auf das Zustandekommen einer Vermittlung besteht nicht.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">§ 4 Registrierung, Verifizierung und Nutzerkonto</h2>
            <p className="text-muted-foreground">
              (1) Die Nutzung setzt eine Registrierung und die Einrichtung eines Nutzerkontos voraus. Die bei
              der Registrierung anzugebenden Daten müssen vollständig und richtig sein und sind aktuell zu
              halten.<br /><br />
              (2) Recruiter durchlaufen vor Freischaltung einen Verifizierungsprozess. Ein Anspruch auf
              Freischaltung besteht nicht.<br /><br />
              (3) Zugangsdaten sind vertraulich zu behandeln und vor dem Zugriff Dritter zu schützen. Bei
              Verdacht auf Missbrauch ist Matchunt unverzüglich zu informieren.<br /><br />
              (4) Matchunt kann Konten bei Verstößen gegen diese AGB oder bei begründetem Missbrauchsverdacht
              vorübergehend sperren oder dauerhaft schließen.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">§ 5 Pflichten der Unternehmen</h2>
            <p className="text-muted-foreground">
              Unternehmen sichern zu, dass ausgeschriebene Stellen real und rechtmäßig sind und dass die im
              Auswahlprozess verarbeiteten Bewerberdaten ausschließlich für den jeweiligen Besetzungsprozess
              verwendet werden. Unternehmen treffen ihre Auswahl- und Einstellungsentscheidungen
              eigenverantwortlich und beachten die geltenden arbeits- und gleichbehandlungsrechtlichen
              Vorgaben (insbesondere AGG).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">§ 6 Pflichten der Recruiter</h2>
            <p className="text-muted-foreground">
              Recruiter sichern zu, dass sie zur Verarbeitung und Weitergabe der von ihnen eingestellten
              Kandidatendaten berechtigt sind, die betroffenen Kandidatinnen und Kandidaten über die
              Verarbeitung auf Matchunt informiert und die erforderlichen Rechtsgrundlagen (insbesondere
              Einwilligungen) eingeholt haben. Eingestellte Daten müssen richtig und aktuell sein. Die
              Einstellung rechtswidrig beschaffter Daten ist untersagt.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">§ 7 Triple-Blind-Verfahren und Identitätsfreigabe</h2>
            <p className="text-muted-foreground">
              Kandidatenprofile werden gegenüber Unternehmen durch technische und organisatorische Maßnahmen
              grundsätzlich zunächst maskiert bzw. pseudonymisiert dargestellt. Identifizierende Daten sollen
              erst nach gültiger Einwilligung der betroffenen Kandidatin bzw. des betroffenen Kandidaten
              offengelegt werden. Nutzer dürfen vorgesehene Schutzmechanismen des Triple-Blind-Verfahrens
              nicht umgehen und offengelegte Identitätsdaten ausschließlich für den jeweiligen
              Besetzungsprozess verwenden.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">§ 8 KI-gestützte Funktionen</h2>
            <p className="text-muted-foreground">
              Die Plattform stellt KI-gestützte Funktionen bereit (z. B. Auswertung von Lebensläufen und
              Eignungsbewertungen). Diese dienen ausschließlich der Entscheidungsunterstützung. Die
              abschließende Auswahl- und Einstellungsentscheidung trifft stets der jeweilige Nutzer. Matchunt
              übernimmt keine Gewähr für die Richtigkeit, Vollständigkeit oder Eignung KI-gestützter
              Auswertungen. Die näheren Bestimmungen zur Nutzung der KI-gestützten Funktionen – insbesondere
              die Rollen nach der KI-Verordnung (EU) 2024/1689, die Pflichten des Nutzers als Betreiber, die
              zulässige Nutzung sowie Haftung und Freistellung – ergeben sich aus §§ 8a bis 8f.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">§ 8a Rollen nach der KI-Verordnung (EU) 2024/1689</h2>
            <p className="text-muted-foreground">
              (1) Die in § 8 beschriebenen KI-gestützten Funktionen – insbesondere die Eignungs- bzw.
              Fit-Bewertung, das Ranking und die Filterung von Kandidatinnen und Kandidaten gegen
              Stellenanforderungen – können ein KI-System darstellen, das nach Anhang III Nr. 4 lit. a und b
              der Verordnung (EU) 2024/1689 („KI-Verordnung" / „AI Act") als Hochrisiko-KI-System im Bereich
              Beschäftigung und Personalauswahl einzuordnen ist.<br /><br />
              (2) Im Verhältnis der Vertragsparteien gilt – vorbehaltlich einer abweichenden gesetzlichen
              Einordnung –: Matchunt stellt das KI-System bereit und nimmt insoweit die Rolle des Anbieters
              (Art. 3 Nr. 3 KI-Verordnung) ein. Der Nutzer, der die Funktionen im Rahmen seiner beruflichen
              Tätigkeit zur Bewertung, Vorauswahl oder Einstellung einsetzt, nimmt die Rolle des Betreibers
              (Art. 3 Nr. 4 KI-Verordnung) ein.<br /><br />
              (3) Die zugrunde liegenden KI-Basismodelle (General-Purpose-AI-Modelle, z. B. von Google)
              werden von Matchunt lediglich über Schnittstellen Dritter genutzt. Matchunt ist nicht Anbieter
              dieser Basismodelle; die Verantwortlichkeit nach Kapitel V der KI-Verordnung trifft insoweit die
              jeweiligen Modellanbieter.<br /><br />
              (4) Diese Rollenzuordnung gilt vorbehaltlich des § 8d und lässt die datenschutzrechtliche
              Verantwortlichkeit (§ 14) unberührt.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">§ 8b Betreiberpflichten des Nutzers (Art. 26 KI-Verordnung)</h2>
            <p className="text-muted-foreground">
              Der Nutzer, der die KI-gestützten Funktionen einsetzt, hat in seiner Rolle als Betreiber
              insbesondere folgende Pflichten:<br /><br />
              (1) <strong>Bestimmungsgemäße Nutzung.</strong> Der Nutzer setzt die Funktionen ausschließlich
              entsprechend der von Matchunt – soweit bereitgestellt – zur Verfügung gestellten
              Gebrauchsanweisung und Hinweise sowie im Rahmen des vorgesehenen Zwecks (Unterstützung der
              Kandidatenauswahl im konkreten Besetzungsprozess) ein.<br /><br />
              (2) <strong>Menschliche Aufsicht.</strong> Der Nutzer stellt sicher, dass die Nutzung durch
              natürliche Personen überwacht wird, die hierfür die erforderliche Kompetenz, Schulung und
              Befugnis besitzen (Art. 26 Abs. 2 i. V. m. Art. 14 KI-Verordnung). Jede Auswahl-, Einladungs-
              und Einstellungsentscheidung trifft der Nutzer eigenverantwortlich durch einen Menschen;
              KI-Ausgaben werden nicht ungeprüft übernommen.<br /><br />
              (3) <strong>Eingabedaten.</strong> Soweit der Nutzer die Eingabedaten kontrolliert, stellt er
              sicher, dass diese im Hinblick auf den Zweck relevant und hinreichend repräsentativ sind
              (Art. 26 Abs. 4 KI-Verordnung).<br /><br />
              (4) <strong>Überwachung und Meldung.</strong> Der Nutzer überwacht den Betrieb anhand der
              bereitgestellten Hinweise. Stellt er ein Risiko im Sinne von Art. 79 Abs. 1 KI-Verordnung oder
              einen schwerwiegenden Vorfall fest, setzt er die Nutzung erforderlichenfalls aus und informiert
              unverzüglich Matchunt sowie, soweit ihn eine eigene gesetzliche Pflicht trifft, die zuständige
              Behörde.<br /><br />
              (5) <strong>Information betroffener Personen.</strong> Trifft oder unterstützt der Nutzer auf
              Grundlage der Funktionen Entscheidungen über natürliche Personen, informiert er – soweit er
              Arbeitgeber ist, auch die betroffenen Beschäftigten bzw. deren Vertretung – darüber, dass ein
              Hochrisiko-KI-System zum Einsatz kommt (Art. 26 Abs. 7 KI-Verordnung). Diese Pflicht besteht
              zusätzlich zu den datenschutzrechtlichen Informationspflichten (Art. 13, 14 DSGVO).<br /><br />
              (6) <strong>Protokollierung.</strong> Soweit der Nutzer von Matchunt bereitgestellte automatisch
              erzeugte Protokolle kontrolliert, bewahrt er diese für einen angemessenen Zeitraum, mindestens
              jedoch sechs Monate, auf, soweit nicht gesetzlich anderes bestimmt ist (Art. 26 Abs. 6
              KI-Verordnung).<br /><br />
              (7) <strong>Mitwirkung.</strong> Der Nutzer wirkt an Maßnahmen mit, die Matchunt zur Erfüllung
              eigener Anbieterpflichten trifft, und stellt die hierfür erforderlichen Informationen aus seinem
              Verantwortungsbereich bereit.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">§ 8c Zulässige Nutzung und Verbot untersagter KI-Praktiken (Art. 5 KI-Verordnung)</h2>
            <p className="text-muted-foreground">
              (1) <strong>Verbotene Praktiken.</strong> Der Nutzer setzt die Funktionen nicht für nach Art. 5
              KI-Verordnung verbotene Praktiken ein, insbesondere nicht<br />
              – zur Ableitung oder Erkennung von Emotionen im Beschäftigungskontext (Art. 5 Abs. 1 lit. f);<br />
              – zur biometrischen Kategorisierung zur Ableitung sensibler Merkmale (Art. 5 Abs. 1 lit. g);<br />
              – zu Social Scoring natürlicher Personen (Art. 5 Abs. 1 lit. c);<br />
              – für manipulative oder eine Schutzbedürftigkeit ausnutzende Praktiken (Art. 5 Abs. 1 lit. a und
              b).<br /><br />
              (2) <strong>Diskriminierungsverbot.</strong> Der Nutzer setzt die Funktionen nicht ein, um
              Kandidatinnen und Kandidaten unter Verstoß gegen das Allgemeine Gleichbehandlungsgesetz (AGG)
              oder sonstiges Antidiskriminierungsrecht zu benachteiligen. Die Verantwortung für die
              Diskriminierungsfreiheit der Auswahlentscheidung verbleibt beim Nutzer (§ 5).<br /><br />
              (3) <strong>Zweckbindung.</strong> Der Nutzer verwendet die KI-Ausgaben und die zugrunde
              liegenden Kandidatendaten ausschließlich für den jeweiligen Besetzungsprozess. Eine Nutzung zu
              anderen Zwecken ist untersagt.<br /><br />
              (4) <strong>Keine Umgehung.</strong> Der Nutzer umgeht oder deaktiviert keine vorgesehenen
              Schutz-, Sicherheits- oder Kontrollmechanismen einschließlich der Mechanismen zur Wahrung der
              menschlichen Aufsicht.<br /><br />
              (5) <strong>Entscheidungsunterstützung.</strong> Die KI-Ausgaben sind ausschließlich Hilfsmittel
              zur Entscheidungsunterstützung. Sie stellen keine Empfehlung zur Ablehnung oder Einstellung dar
              und ersetzen keine eigenständige sachliche Prüfung. Eine ausschließlich automatisierte
              Entscheidung mit rechtlicher Wirkung oder ähnlich erheblicher Beeinträchtigung (Art. 22 DSGVO)
              hat der Nutzer zu unterlassen.<br /><br />
              (6) Bei einem Verstoß gegen diesen Paragraphen ist Matchunt berechtigt, den Nutzer abzumahnen
              und ihm eine angemessene Frist zur Abhilfe zu setzen; bei erheblichen, wiederholten oder
              fortdauernden Verstößen kann Matchunt den Zugang zu den KI-gestützten Funktionen oder zur
              Plattform nach Maßgabe von § 4 Abs. 4 verhältnismäßig beschränken oder sperren. Das Recht zur
              außerordentlichen Kündigung bleibt unberührt.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">§ 8d Rollenwechsel des Nutzers zum Anbieter (Art. 25 KI-Verordnung)</h2>
            <p className="text-muted-foreground">
              (1) Der Nutzer wird nach Art. 25 Abs. 1 KI-Verordnung selbst zum Anbieter des
              Hochrisiko-KI-Systems mit den entsprechenden Pflichten, wenn einer der dort genannten Umstände
              eintritt, insbesondere wenn er<br />
              – die Funktionen oder deren Ergebnisse unter eigenem Namen oder eigener Marke bereitstellt;<br />
              – eine wesentliche Veränderung vornimmt, die deren Hochrisiko-Eigenschaft betrifft; oder<br />
              – die Zweckbestimmung so ändert, dass das System dadurch zu einem Hochrisiko-KI-System
              wird.<br /><br />
              (2) Diese Rechtsfolge tritt kraft Gesetzes ein. Unabhängig davon ist der Nutzer vertraglich
              verpflichtet, Maßnahmen nach Absatz 1 vorab gegenüber Matchunt anzuzeigen; ohne gesonderte
              schriftliche Zustimmung von Matchunt ist er hierzu nicht berechtigt.<br /><br />
              (3) Der Nutzer stellt Matchunt nach Maßgabe von § 8e von Ansprüchen, Verpflichtungen,
              Sanktionen und Aufwendungen frei, die darauf beruhen, dass der Nutzer nach Absatz 1 zum Anbieter
              geworden ist.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">§ 8e Freistellung bei Verstoß gegen Betreiber- und Nutzungspflichten</h2>
            <p className="text-muted-foreground">
              (1) Der Nutzer stellt Matchunt von sämtlichen Ansprüchen Dritter – einschließlich Ansprüchen
              betroffener Bewerberinnen und Bewerber sowie der angemessenen Kosten der Rechtsverteidigung –
              frei, die darauf beruhen, dass der Nutzer<br />
              – seine Betreiberpflichten nach § 8b verletzt, insbesondere die Pflicht zur menschlichen
              Aufsicht oder zur Information betroffener Personen;<br />
              – gegen § 8c verstößt, insbesondere gegen das Verbot untersagter Praktiken (Art. 5
              KI-Verordnung) oder gegen das AGG; oder<br />
              – nach § 8d zum Anbieter geworden ist.<br /><br />
              (2) Von behördlichen Bußgeldern und Sanktionen stellt der Nutzer Matchunt frei, soweit diese auf
              einer schuldhaften Pflichtverletzung des Nutzers aus seinem eigenen Verantwortungsbereich
              beruhen; Sanktionen, die gegen Matchunt wegen einer eigenen Pflichtverletzung verhängt werden,
              sind hiervon nicht erfasst.<br /><br />
              (3) Die Freistellung setzt voraus, dass der Verstoß aus dem Verantwortungsbereich des Nutzers
              stammt. Soweit ein Verursachungs- oder Verschuldensbeitrag von Matchunt mitgewirkt hat, ist die
              Freistellung entsprechend § 254 BGB anteilig nach dem Verursachungsanteil begrenzt.<br /><br />
              (4) Matchunt informiert den Nutzer über eine Inanspruchnahme unverzüglich, ermöglicht ihm –
              soweit rechtlich zulässig – die Verteidigung und gibt keine Anerkenntnisse ohne vorherige
              Abstimmung ab.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">§ 8f Haftung für KI-Ergebnisse und Gewährleistungsausschluss</h2>
            <p className="text-muted-foreground">
              (1) Die KI-gestützten Funktionen liefern wahrscheinlichkeitsbasierte Einschätzungen, die
              unvollständig, ungenau oder im Einzelfall unzutreffend sein können. Matchunt übernimmt keine
              Gewähr für die Richtigkeit, Vollständigkeit, Aktualität oder Eignung der KI-Ausgaben und schuldet
              kein bestimmtes Bewertungs- oder Auswahlergebnis. Die Verantwortung für eine
              diskriminierungsfreie Auswahlentscheidung trägt der Nutzer (§ 5, § 8c Abs. 2).<br /><br />
              (2) Die KI-Ausgaben dienen ausschließlich der Entscheidungsunterstützung. Die Verantwortung für
              die Prüfung, Bewertung und Verwendung der Ergebnisse sowie für die hierauf gestützte Auswahl-
              und Einstellungsentscheidung trifft allein der Nutzer (menschliche Letztentscheidung).<br /><br />
              (3) Matchunt haftet nicht für Schäden, die darauf beruhen, dass der Nutzer KI-Ausgaben
              ungeprüft übernimmt, seine Pflicht zur menschlichen Aufsicht (§ 8b Abs. 2) verletzt oder die
              Funktionen entgegen § 8b und § 8c einsetzt, es sei denn, Matchunt trifft ein eigener
              Verursachungs- oder Verschuldensbeitrag; in diesem Fall gilt § 254 BGB.<br /><br />
              (4) Im Übrigen richtet sich die Haftung nach § 16. Die Haftung für Vorsatz und grobe
              Fahrlässigkeit, für die Verletzung von Leben, Körper und Gesundheit, nach dem
              Produkthaftungsgesetz sowie aus zwingenden gesetzlichen Haftungstatbeständen – einschließlich
              etwaiger zwingender Anbieterhaftung nach der KI-Verordnung – bleibt unberührt. Bei einfacher
              Fahrlässigkeit haftet Matchunt nur für die Verletzung wesentlicher Vertragspflichten
              (Kardinalpflichten) und der Höhe nach begrenzt auf den vertragstypischen, vorhersehbaren
              Schaden.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">§ 9 Vergütung der Unternehmen</h2>
            <p className="text-muted-foreground">
              Das Ausschreiben von Stellen ist kostenlos. Eine Vergütung (Vermittlungsprovision) fällt
              ausschließlich im Erfolgsfall an, d. h. bei Zustandekommen eines Anstellungs- oder
              Dienstverhältnisses mit einer über die Plattform vorgeschlagenen Kandidatin bzw. einem
              Kandidaten. Die konkrete Höhe und das Modell der Provision werden mandatsbezogen vereinbart und
              vor Beginn des jeweiligen Vermittlungsprozesses transparent in der Plattform ausgewiesen.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">§ 10 Vergütung der Recruiter</h2>
            <p className="text-muted-foreground">
              Recruiter erhalten Zugang zu ausgeschriebenen Mandaten und schlagen Kandidatinnen und Kandidaten
              vor. Im Erfolgsfall erhält der Recruiter den vereinbarten Anteil an der Vermittlungsprovision.
              Der Anteil wird vor Annahme eines Mandats in der Plattform ausgewiesen. Die Auszahlung erfolgt
              nach den vereinbarten Bedingungen über die Zahlungsabwicklung gemäß § 12.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">§ 11 Umgehungsverbot</h2>
            <p className="text-muted-foreground">
              Unternehmen ist es untersagt, über die Plattform vorgeschlagene Kandidatinnen und Kandidaten
              unter Umgehung von Matchunt einzustellen, um die Vermittlungsprovision zu vermeiden. Kommt
              innerhalb von zwölf (12) Monaten nach dem Vorschlag ein Anstellungs- oder Dienstverhältnis mit
              einer vorgeschlagenen Person zustande, gilt die Vermittlung als über die Plattform erfolgt und
              die vereinbarte Provision wird fällig. Gleiches gilt bei Weitergabe vorgeschlagener Profile an
              verbundene Unternehmen.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">§ 12 Zahlungsabwicklung</h2>
            <p className="text-muted-foreground">
              (1) Die Zahlungsabwicklung erfolgt über einen externen Zahlungsdienstleister; zur Absicherung
              der Beteiligten kann ein Treuhand-/Escrow-Verfahren eingesetzt werden.<br /><br />
              (2) Die Provision wird mit Zustandekommen der Vermittlung (Vertragsunterzeichnung) fällig. Soweit
              nicht abweichend vereinbart, sind Rechnungen innerhalb von vierzehn (14) Tagen ab Zugang ohne
              Abzug zahlbar.<br /><br />
              (3) Alle Preise verstehen sich zuzüglich der jeweils geltenden gesetzlichen Umsatzsteuer.<br /><br />
              (4) Etwaige Rückerstattungs- oder Probezeitregelungen richten sich nach der mandatsbezogenen
              Vereinbarung.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">§ 13 Verfügbarkeit und Änderungen der Plattform</h2>
            <p className="text-muted-foreground">
              Matchunt bemüht sich um eine möglichst unterbrechungsfreie Verfügbarkeit der Plattform, schuldet
              jedoch keine bestimmte Verfügbarkeit. Wartungs-, Sicherheits- und Weiterentwicklungsmaßnahmen
              können zu vorübergehenden Einschränkungen führen. Matchunt darf den Funktionsumfang der Plattform
              weiterentwickeln, sofern der vertragliche Kernzweck gewahrt bleibt.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">§ 14 Datenschutz, Vertraulichkeit und Verantwortlichkeit</h2>
            <p className="text-muted-foreground">
              (1) Die Verarbeitung personenbezogener Daten richtet sich nach unserer{" "}
              <Link to="/datenschutz" className="text-foreground underline hover:no-underline">
                Datenschutzerklärung
              </Link>
              .<br /><br />
              (2) Für die von ihnen eingestellten Kandidatendaten sind die jeweiligen Recruiter bzw.
              Unternehmen datenschutzrechtlich verantwortlich; Matchunt verarbeitet diese Daten im Rahmen der
              Plattformfunktionen. Soweit eine Auftragsverarbeitung vorliegt, wird ein gesonderter Vertrag zur
              Auftragsverarbeitung nach Art. 28 DSGVO geschlossen.<br /><br />
              (3) Die Parteien behandeln alle über die Plattform erlangten, nicht offenkundigen Informationen
              vertraulich, insbesondere Kandidatendaten und Konditionen.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">§ 15 Freistellung</h2>
            <p className="text-muted-foreground">
              Nutzer stellen Matchunt von sämtlichen Ansprüchen Dritter frei, die auf einer rechtswidrigen
              Verarbeitung oder Einstellung von Daten, einer Verletzung von Schutzrechten Dritter oder einem
              sonstigen Verstoß des Nutzers gegen diese AGB oder geltendes Recht beruhen, einschließlich
              angemessener Kosten der Rechtsverteidigung. Die KI-spezifische Freistellung nach § 8e bleibt
              unberührt. Soweit ein Verursachungs- oder Verschuldensbeitrag von Matchunt mitgewirkt hat, ist
              die Freistellung entsprechend § 254 BGB anteilig begrenzt.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">§ 16 Haftung</h2>
            <p className="text-muted-foreground">
              Matchunt haftet unbeschränkt für Vorsatz und grobe Fahrlässigkeit sowie bei Verletzung von
              Leben, Körper und Gesundheit und nach dem Produkthaftungsgesetz. Bei einfacher Fahrlässigkeit
              haftet Matchunt nur für die Verletzung wesentlicher Vertragspflichten (Kardinalpflichten),
              begrenzt auf den vertragstypischen, vorhersehbaren Schaden. Im Übrigen ist die Haftung
              ausgeschlossen. Die ergänzende Regelung zur Haftung für KI-Ergebnisse (§ 8f) bleibt unberührt.
              Matchunt übernimmt keine Gewähr für das Zustandekommen von Vermittlungen, die Eignung
              vorgeschlagener Kandidaten oder die Richtigkeit nutzerseitig eingestellter Daten.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">§ 17 Laufzeit und Kündigung</h2>
            <p className="text-muted-foreground">
              Der Nutzungsvertrag läuft auf unbestimmte Zeit und kann von beiden Seiten jederzeit ohne
              Einhaltung einer Frist gekündigt werden. Das Recht zur außerordentlichen Kündigung aus wichtigem
              Grund bleibt unberührt. Bereits entstandene Provisionsansprüche sowie das Umgehungsverbot
              (§ 11) bleiben von einer Kündigung unberührt.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">§ 18 Änderungen dieser AGB</h2>
            <p className="text-muted-foreground">
              Matchunt kann diese AGB mit Wirkung für die Zukunft ändern, soweit dies aus triftigem Grund
              (z. B. geänderte Rechtslage oder erweiterter Funktionsumfang) erforderlich ist und der Nutzer
              hierdurch nicht unangemessen benachteiligt wird. Über Änderungen werden Nutzer rechtzeitig
              informiert. Widerspricht der Nutzer nicht innerhalb der mitgeteilten Frist, gelten die
              Änderungen als angenommen; hierauf werden Nutzer gesondert hingewiesen.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">§ 19 Schlussbestimmungen</h2>
            <p className="text-muted-foreground">
              Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts.
              Ausschließlicher Gerichtsstand für alle Streitigkeiten aus oder im Zusammenhang mit diesem
              Vertrag ist, soweit gesetzlich zulässig, der Sitz der Bluewater &amp; Bridge GmbH (München).
              Sollten einzelne Bestimmungen dieser AGB unwirksam sein oder werden, bleibt die Wirksamkeit der
              übrigen Bestimmungen unberührt.<br /><br />
              {AGB_VERSION_LABEL}
            </p>
          </section>
        </div>
      </main>

      <FooterSection />
    </div>
  );
};

export default AGB;
