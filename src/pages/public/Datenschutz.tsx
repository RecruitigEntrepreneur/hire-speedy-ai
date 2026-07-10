import { Link } from "react-router-dom";
import { Navbar } from "@/components/layout/Navbar";
import { FooterSection } from "@/components/landing/FooterSection";
import { ArrowLeft } from "lucide-react";

const Datenschutz = () => {
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

        <h1 className="text-4xl font-bold mb-8">Datenschutzerklärung</h1>

        <div className="prose prose-slate dark:prose-invert max-w-none space-y-8">
          <section>
            <p className="text-muted-foreground">
              Mit dieser Datenschutzerklärung informieren wir Sie über die Verarbeitung personenbezogener
              Daten im Rahmen der Recruiting-Plattform <strong>Matchunt</strong> (nachfolgend „Plattform")
              sowie auf unserer Website. Sie gilt für Website-Besucherinnen und -Besucher, für registrierte
              Nutzerinnen und Nutzer (Unternehmen und Recruiter), für Kandidatinnen und Kandidaten, deren
              Daten über die Plattform verarbeitet werden, sowie für Ansprechpersonen von Unternehmen, die
              wir im Rahmen unserer Geschäftsanbahnung (Outreach) kontaktieren.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">1. Verantwortlicher</h2>
            <p className="text-muted-foreground">
              Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:<br /><br />
              Bluewater &amp; Bridge GmbH<br />
              Adlzreiterstraße 2<br />
              80337 München<br />
              Deutschland<br /><br />
              Vertreten durch den Geschäftsführer: Marko Benko<br />
              Telefon: 089 380 30 73 0<br />
              E-Mail: info@bluewater-bridge.de
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">2. Datenschutzkontakt</h2>
            <p className="text-muted-foreground">
              Für Fragen zum Datenschutz und zur Ausübung Ihrer Betroffenenrechte erreichen Sie uns unter{" "}
              <strong>info@bluewater-bridge.de</strong>.<br /><br />
              Einen Datenschutzbeauftragten im Sinne der Art. 37 ff. DSGVO benennen wir derzeit. Nach Abschluss
              der Bestellung veröffentlichen wir dessen Kontaktdaten an dieser Stelle:<br /><br />
              [Name des/der Datenschutzbeauftragten]<br />
              c/o Bluewater &amp; Bridge GmbH, Adlzreiterstraße 2, 80337 München<br />
              [E-Mail, z. B. datenschutz@bluewater-bridge.de]
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">3. Betroffene Personengruppen und Datenkategorien</h2>
            <p className="text-muted-foreground">
              Je nachdem, wie Sie mit uns in Kontakt stehen, verarbeiten wir unterschiedliche Kategorien
              personenbezogener Daten:
            </p>
            <ul className="text-muted-foreground list-disc pl-6 mt-4 space-y-2">
              <li>
                <strong>Website-Besucher:</strong> Nutzungs- und Metadaten (z. B. IP-Adresse, Browsertyp,
                Zugriffszeitpunkt), Cookie- und Einwilligungsdaten.
              </li>
              <li>
                <strong>Registrierte Nutzer (Unternehmen &amp; Recruiter):</strong> Bestandsdaten (Name,
                E-Mail-Adresse, Telefonnummer, Unternehmen, Rolle), Zugangsdaten (verschlüsseltes Passwort),
                Vertrags- und Abrechnungsdaten, Aktivitäts- und Protokolldaten, ggf. Zugangsdaten verbundener
                Drittsysteme (CRM-Integrationen).
              </li>
              <li>
                <strong>Kandidatinnen und Kandidaten:</strong> Stammdaten (Name, Kontaktdaten, ggf. Anschrift,
                LinkedIn-/Portfolio-Links), Lebenslaufdaten (Volltext und strukturiert: Berufserfahrung,
                Ausbildung, Sprachen, Qualifikationen, Skills), berufliche Präferenzen, Gehaltsangaben und
                -vorstellungen, Verfügbarkeit, Mobilitäts- und Pendeldaten sowie KI-gestützte Bewertungen
                (siehe Ziffer 12). Angaben wie Staatsangehörigkeit, Aufenthalts- bzw. Arbeitserlaubnisstatus
                können je nach Stelle verarbeitet werden.
              </li>
              <li>
                <strong>Geschäftliche Ansprechpartner (Outreach-Leads):</strong> berufliche Kontaktdaten
                (Name, Funktion, geschäftliche E-Mail/Telefon, berufliches Netzwerkprofil) sowie öffentlich
                verfügbare Unternehmensinformationen (siehe Ziffer 13).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">4. Rechtsgrundlagen der Verarbeitung</h2>
            <p className="text-muted-foreground">
              Wir verarbeiten personenbezogene Daten auf folgenden Rechtsgrundlagen:
            </p>
            <ul className="text-muted-foreground list-disc pl-6 mt-4 space-y-2">
              <li><strong>Art. 6 Abs. 1 lit. b DSGVO</strong> – Erfüllung des Nutzungsvertrags und
                vorvertragliche Maßnahmen (Bereitstellung von Konto und Plattformfunktionen).</li>
              <li><strong>Art. 6 Abs. 1 lit. f DSGVO</strong> – berechtigte Interessen (z. B. sicherer und
                stabiler Betrieb der Plattform, Missbrauchsprävention, B2B-Geschäftsanbahnung,
                Direktwerbung gegenüber Unternehmen).</li>
              <li><strong>Art. 6 Abs. 1 lit. a / Art. 9 Abs. 2 lit. a DSGVO</strong> – Einwilligung (z. B.
                für nicht notwendige Cookies, für die Offenlegung der Kandidatenidentität gegenüber
                Unternehmen sowie ggf. für besondere Datenkategorien).</li>
              <li><strong>Art. 6 Abs. 1 lit. c DSGVO</strong> – Erfüllung rechtlicher Verpflichtungen
                (z. B. handels- und steuerrechtliche Aufbewahrung).</li>
              <li><strong>Art. 88 DSGVO i. V. m. § 26 BDSG</strong>, soweit Daten im Beschäftigungs- bzw.
                Bewerbungskontext verarbeitet werden.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">5. Empfänger und Auftragsverarbeiter</h2>
            <p className="text-muted-foreground">
              Zur Bereitstellung der Plattform setzen wir sorgfältig ausgewählte Dienstleister ein, die Daten
              ausschließlich nach unserer Weisung verarbeiten. Mit diesen bestehen Verträge zur
              Auftragsverarbeitung gemäß Art. 28 DSGVO. Eingesetzt werden insbesondere:
            </p>
            <ul className="text-muted-foreground list-disc pl-6 mt-4 space-y-2">
              <li><strong>Supabase</strong> – Datenbank, Authentifizierung und Dateispeicher (u. a.
                Lebenslauf-Dateien).</li>
              <li><strong>Lovable</strong> – Hosting der Anwendung sowie KI-Gateway für die Anbindung der
                Sprachmodelle.</li>
              <li><strong>Google (Gemini)</strong> – KI-Sprachmodell (u. a. zur Lebenslauf-Auswertung und
                Eignungsbewertung), eingebunden über das KI-Gateway; sowie Google Maps für die Berechnung
                von Pendelzeiten.</li>
              <li><strong>OpenRouter</strong> – KI-Gateway zur Anbindung von Sprachmodellen (für einzelne
                Funktionen).</li>
              <li><strong>Firecrawl</strong> – automatisierte Recherche öffentlich verfügbarer
                Unternehmens- und Karriereseiteninformationen.</li>
              <li><strong>Resend</strong> – Versand von Transaktions- und Outreach-E-Mails einschließlich
                Zustell- und Interaktionsstatistik.</li>
              <li><strong>Stripe</strong> – Zahlungsabwicklung und Auszahlungen.</li>
              <li><strong>OpenRouteService, OpenStreetMap/Nominatim</strong> – Geokodierung und
                Routenberechnung (Pendelzeiten).</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              Darüber hinaus geben wir Daten an Empfänger weiter, soweit dies zur Vertragserfüllung
              erforderlich ist (z. B. Übermittlung freigegebener Kandidatenprofile an das ausschreibende
              Unternehmen) oder eine gesetzliche Verpflichtung besteht (z. B. Steuerberatung, Behörden).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">6. Vom Nutzer aktivierte Drittanbieter-Integrationen</h2>
            <p className="text-muted-foreground">
              Recruiter können optional eigene Drittsysteme anbinden, etwa CRM- und Bewerbermanagement-Systeme
              (z. B. HubSpot, Salesforce, Lever, Bullhorn). Diese Verbindung wird ausschließlich auf aktive
              Veranlassung des jeweiligen Nutzers über ein Autorisierungsverfahren (OAuth) hergestellt. Dabei
              werden Daten zwischen Matchunt und dem verbundenen System ausgetauscht (z. B. Import von
              Kontakt-/Kandidatendaten). Für die in seinem Drittsystem gespeicherten Daten und die
              Rechtmäßigkeit des Imports ist der jeweilige Nutzer verantwortlich.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">7. Datenübermittlung in Drittländer</h2>
            <p className="text-muted-foreground">
              Einige der eingesetzten Dienstleister verarbeiten Daten ganz oder teilweise außerhalb der
              Europäischen Union, insbesondere in den USA. Dies betrifft auch die KI-gestützte Verarbeitung
              (Ziffer 12), bei der Eingabedaten an das KI-Gateway und das Sprachmodell übermittelt werden.
              Soweit ein Drittland kein durch die EU-Kommission festgestelltes angemessenes Datenschutzniveau
              aufweist, stützen wir die Übermittlung auf geeignete Garantien im Sinne von Art. 46 DSGVO,
              insbesondere die Standardvertragsklauseln der EU-Kommission, und – soweit der Anbieter
              zertifiziert ist – auf das EU-US Data Privacy Framework (Art. 45 DSGVO). Eine Kopie der
              Garantien stellen wir auf Anfrage zur Verfügung.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">8. Hosting, Infrastruktur und Server-Logfiles</h2>
            <p className="text-muted-foreground">
              Beim Aufruf unserer Website und Plattform werden technisch erforderliche Verbindungsdaten
              verarbeitet (z. B. IP-Adresse, Datum und Uhrzeit, abgerufene Ressource, übertragene Datenmenge,
              Browser- und Betriebssysteminformationen). Diese Verarbeitung ist für die Bereitstellung, die
              Stabilität und die Sicherheit des Dienstes erforderlich (Art. 6 Abs. 1 lit. f DSGVO). Unsere
              Daten werden in Rechenzentren betrieben, die nach unserer Auswahl innerhalb der Europäischen
              Union liegen sollen; ergänzend gilt Ziffer 7.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">9. Cookies und Einwilligungen</h2>
            <p className="text-muted-foreground">
              Wir verwenden technisch notwendige Cookies, die für den Betrieb erforderlich sind (z. B. zur
              Aufrechterhaltung der Login-Sitzung). Nicht notwendige Cookies und vergleichbare Technologien
              (z. B. zur Reichweitenmessung) setzen wir nur mit Ihrer Einwilligung gemäß § 25 Abs. 1 TDDDG
              und Art. 6 Abs. 1 lit. a DSGVO ein, die Sie über unseren Cookie-Banner erteilen. Ihre Auswahl
              können Sie jederzeit mit Wirkung für die Zukunft über die Cookie-Einstellungen ändern oder
              widerrufen.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">10. Registrierung und Nutzerkonto</h2>
            <p className="text-muted-foreground">
              Für die Nutzung der Plattform ist ein Nutzerkonto erforderlich. Bei der Registrierung
              verarbeiten wir insbesondere Name, E-Mail-Adresse, Passwort (verschlüsselt gespeichert),
              Telefonnummer und Unternehmen sowie die gewählte Rolle (Unternehmen oder Recruiter). Recruiter
              durchlaufen vor Freischaltung einen Verifizierungsprozess. Zur Sicherheit, Nachvollziehbarkeit
              und Missbrauchsprävention protokollieren wir sicherheits- und vertragsrelevante Aktivitäten im
              Konto. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b und lit. f DSGVO.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">11. Kandidatendaten, Datenquellen und Triple-Blind-Verfahren</h2>
            <p className="text-muted-foreground">
              Im Zentrum der Plattform steht die Verarbeitung von Kandidatendaten. Diese stammen aus folgenden
              Quellen: (a) direkter Eingabe durch Recruiter, (b) Hochladen und automatisierter Auswertung von
              Lebenslauf-Dokumenten, (c) Import aus verbundenen Dritt-/CRM-Systemen sowie (d) Angaben der
              Kandidatinnen und Kandidaten selbst. Beim Hochladen eines Lebenslaufs speichern wir sowohl den
              extrahierten Volltext als auch die daraus strukturiert gewonnenen Daten und eine KI-gestützte
              Zusammenfassung.
            </p>
            <p className="text-muted-foreground mt-4">
              <strong>Triple-Blind-Prinzip:</strong> Gegenüber Unternehmen werden Kandidatenprofile durch
              technische und organisatorische Maßnahmen maskiert bzw. pseudonymisiert dargestellt (z. B.
              Region statt Ort, Erfahrungs- und Gehaltsbänder statt exakter Werte). Identifizierende Daten
              (insbesondere Name, Kontaktdaten, Lebenslauf-Datei) werden gegenüber dem Unternehmen
              grundsätzlich erst offengelegt, wenn hierfür eine Einwilligung der betroffenen Kandidatin bzw.
              des betroffenen Kandidaten vorliegt; die Freigabe wird protokolliert.
            </p>
            <p className="text-muted-foreground mt-4">
              <strong>Verantwortlichkeit der Recruiter:</strong> Recruiter, die Kandidatendaten auf der
              Plattform einstellen, sind verpflichtet, die betroffenen Personen transparent über die
              Verarbeitung auf Matchunt zu informieren, die erforderliche Rechtsgrundlage (insbesondere
              Einwilligung) sicherzustellen und nur Daten einzustellen, zu deren Weitergabe sie berechtigt
              sind. Soweit besondere Kategorien personenbezogener Daten (Art. 9 DSGVO) verarbeitet werden,
              bedarf es einer ausdrücklichen Einwilligung oder einer anderen Ausnahme nach Art. 9 Abs. 2
              DSGVO.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">12. KI-gestützte Bewerberbewertung, Profiling und automatisierte Entscheidungen (EU-KI-Verordnung)</h2>
            <p className="text-muted-foreground">
              <strong>(1) Einsatz und Pflichtinformation.</strong> Wir setzen im Rahmen der Plattform ein
              KI-System ein, das Kandidatinnen und Kandidaten im Hinblick auf eine konkrete Stelle bewertet
              und einordnet („Fit-Bewertung"). Soweit dieses System zur Bewertung von Personen im
              Beschäftigungs- und Auswahlkontext eingesetzt wird, gehen wir davon aus, dass es als
              Hochrisiko-KI-System im Sinne der Verordnung (EU) 2024/1689 (KI-Verordnung / „AI Act"),
              Anhang III Nr. 4 lit. a und b, einzuordnen ist. Wir informieren Sie hiermit zugleich nach
              Art. 13 und Art. 14 DSGVO sowie im Sinne von Art. 50 KI-Verordnung über Einsatz, Funktionsweise
              und Tragweite.
            </p>
            <p className="text-muted-foreground mt-4">
              <strong>(2) Funktionsweise und Ergebnisse.</strong> Das System gleicht die zu Ihrer Person
              vorliegenden Angaben (insbesondere Lebenslauf-Volltext und strukturierte Lebenslaufdaten,
              Berufserfahrung einschließlich Arbeitgeber, Qualifikationen, Skills, Sprachen, Gehalts- und
              Standortangaben, Präferenzen sowie ggf. Interviewnotizen) mit den Anforderungen der jeweiligen
              Stelle ab. Es erzeugt eine strukturierte Einschätzung, die u. a. eine Gesamteinordnung (von
              „strong fit" bis „no fit"), einen Gesamtpunktwert (0–100), kriterienbezogene Teilbewertungen,
              eine Lücken- und Werdegangsanalyse, eine Einschätzung zur Wechselmotivation sowie bei geringer
              Passung eine Begründung umfassen kann.
            </p>
            <p className="text-muted-foreground mt-4">
              <strong>(3) Eingesetzte Technik und Datenübermittlung.</strong> Die Bewertung beruht auf einem
              großen Sprachmodell (derzeit Google Gemini 2.5 Flash), das wir über ein KI-Gateway (derzeit
              Lovable AI Gateway) ansteuern. Zur Erstellung der Bewertung werden die für die Beurteilung
              erforderlichen Profil- und Lebenslaufdaten an das KI-Gateway und das Sprachmodell übermittelt
              und dort zur Erzeugung des Ergebnisses verarbeitet. Je nach Anbieter und Serverstandort kann
              hierbei eine Übermittlung in ein Drittland erfolgen; in diesem Fall bestehen geeignete Garantien
              nach Art. 46 DSGVO (siehe Ziffer 7).
            </p>
            <p className="text-muted-foreground mt-4">
              <strong>(4) Profiling.</strong> Die Bewertung stellt ein Profiling im Sinne von Art. 4 Nr. 4
              DSGVO dar, da persönliche Aspekte (insbesondere berufliche Eignung, Werdegang und Motivation)
              automatisiert analysiert und bewertet werden.
            </p>
            <p className="text-muted-foreground mt-4">
              <strong>(5) Entscheidungsunterstützung und menschliche Letztentscheidung.</strong> Die Bewertung
              dient ausschließlich als Entscheidungsunterstützung und unterstützt die am Auswahlprozess
              Beteiligten bei der Einordnung. Die abschließende Entscheidung über Einbeziehung, Einladung,
              Ablehnung oder Einstellung trifft stets ein Mensch beim jeweiligen Recruiter bzw. Unternehmen,
              das das System insoweit als Betreiber im Sinne von Art. 26 Abs. 2 KI-Verordnung in eigener
              Verantwortung und unter menschlicher Aufsicht nutzt. Eine ausschließlich auf automatisierter
              Verarbeitung – einschließlich Profiling – beruhende Entscheidung mit rechtlicher Wirkung oder
              ähnlich erheblicher Beeinträchtigung im Sinne von Art. 22 Abs. 1 DSGVO ist nicht vorgesehen.
            </p>
            <p className="text-muted-foreground mt-4">
              <strong>(6) Kein Modelltraining mit Ihren Daten.</strong> Ihre personenbezogenen Daten werden
              ausschließlich zur Erzeugung der jeweiligen Auswertung übermittelt. Wir trainieren mit Ihren
              personenbezogenen Daten kein eigenes KI-Modell. Wir setzen die Modelle und Gateways so ein, dass
              nach den Bedingungen der jeweiligen Anbieter eine Nutzung Ihrer Eingaben zum Training der
              Modelle nicht erfolgt; soweit dies von Zusagen der Anbieter abhängt, wirken wir vertraglich
              darauf hin.
            </p>
            <p className="text-muted-foreground mt-4">
              <strong>(7) Ihre Rechte und menschliches Eingreifen.</strong> Sie haben das Recht, klare
              Informationen über den Einsatz des Systems sowie eine Erläuterung der Rolle der Bewertung im Sie
              betreffenden Auswahlprozess zu verlangen, Ihren Standpunkt darzulegen, die Bewertung
              anzufechten und ein Eingreifen einer natürlichen Person zu erwirken (Art. 22 Abs. 3 DSGVO,
              Art. 86 KI-Verordnung). Da die Bewertung im konkreten Auswahlprozess durch Recruiter und
              Unternehmen als Betreiber genutzt wird, können diese zusätzlich Adressaten Ihrer Rechte sein;
              wir unterstützen Sie bei der Weiterleitung Ihres Anliegens. Eine Mitteilung an
              info@bluewater-bridge.de genügt.
            </p>
            <p className="text-muted-foreground mt-4">
              <strong>(8) Sensible Daten und Rechtsgrundlage.</strong> Das System ist nicht darauf ausgelegt,
              besondere Kategorien personenbezogener Daten (Art. 9 DSGVO) auszuwerten; solche Daten sollen
              nicht zu Bewertungszwecken eingestellt werden. Rechtsgrundlage der Verarbeitung ist Art. 6
              Abs. 1 lit. b und lit. f DSGVO sowie, soweit erforderlich, Ihre Einwilligung (Art. 6 Abs. 1
              lit. a, Art. 9 Abs. 2 lit. a DSGVO) bzw. Art. 88 DSGVO i. V. m. § 26 BDSG.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">12a. KI-Governance, Rollen nach der KI-Verordnung und KI-Kompetenz</h2>
            <p className="text-muted-foreground">
              <strong>(1) Rollen.</strong> Soweit das KI-System als Hochrisiko-KI-System einzuordnen ist,
              gehen wir davon aus, dass die Bluewater &amp; Bridge GmbH dessen Anbieterin (Art. 3 Nr. 3
              KI-Verordnung) ist und Recruiter bzw. Unternehmen, die die Bewertungen in ihren
              Auswahlprozessen nutzen, dessen Betreiber (Art. 3 Nr. 4, Art. 26 KI-Verordnung). Das genutzte
              allgemeine KI-Basismodell wird von dessen jeweiligem Anbieter bereitgestellt; insoweit sind wir
              nicht Anbieter dieses Basismodells.
            </p>
            <p className="text-muted-foreground mt-4">
              <strong>(2) Governance-Maßnahmen.</strong> Wir treffen organisatorische und technische
              Maßnahmen für einen verantwortungsvollen Einsatz, insbesondere die Festlegung des
              Verwendungszwecks, evidenzbasierte Bewertungsvorgaben (Bewertung nur anhand vorliegender Daten;
              fehlende Angaben werden als unzureichend und nicht als negatives Signal gekennzeichnet), die
              Versionierung der eingesetzten Modelle und Vorgaben, die Protokollierung der Erstellung von
              Bewertungen sowie die fortlaufende Anpassung an den Stand der Technik und die Rechtslage.
            </p>
            <p className="text-muted-foreground mt-4">
              <strong>(3) KI-Kompetenz (Art. 4 KI-Verordnung).</strong> Wir wirken darauf hin, dass die mit
              dem System befassten Personen über angemessene KI-Kompetenz verfügen, und weisen Recruiter und
              Unternehmen als Betreiber auf ihre entsprechende eigene Pflicht hin.
            </p>
            <p className="text-muted-foreground mt-4">
              <strong>(4) Kontakt.</strong> Anliegen zum Einsatz des KI-Systems können Sie an
              info@bluewater-bridge.de richten; ergänzend können Sie sich an die zuständige
              Datenschutz-Aufsichtsbehörde (Ziffer 21) wenden.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">13. Geschäftsanbahnung, Outreach und Web-Recherche (B2B)</h2>
            <p className="text-muted-foreground">
              Zur Anbahnung von Geschäftsbeziehungen verarbeiten wir berufliche Kontaktdaten von
              Ansprechpartnern potenzieller Kundenunternehmen sowie öffentlich verfügbare
              Unternehmensinformationen. Diese stammen aus von uns importierten Listen sowie aus der
              automatisierten Auswertung öffentlich zugänglicher Quellen (z. B. Unternehmens-, Karriere- und
              Teamseiten, berufliche Netzwerke, Bewertungs- und Wirtschaftsportale). Rechtsgrundlage ist unser
              berechtigtes Interesse an der Direktansprache von Unternehmen (Art. 6 Abs. 1 lit. f DSGVO).
            </p>
            <p className="text-muted-foreground mt-4">
              Werden Daten nicht bei der betroffenen Person selbst erhoben, informieren wir gemäß Art. 14
              DSGVO. Soweit Outreach-Texte mit KI-Unterstützung erstellt werden, beachten wir die
              einschlägigen Transparenzanforderungen. Sie können der Verarbeitung Ihrer Daten zu Zwecken der
              Direktansprache jederzeit widersprechen (Art. 21 DSGVO); wir stellen die Verarbeitung zu diesem
              Zweck dann ein.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">14. E-Mail-Kommunikation und Reichweitenmessung</h2>
            <p className="text-muted-foreground">
              Über die Plattform versenden wir E-Mails (z. B. Interview-Einladungen, Statusmitteilungen,
              Outreach-Nachrichten). Hierbei können Zustell-, Öffnungs- und Klickinformationen erfasst werden,
              um die technische Zustellung sicherzustellen und die Kommunikation auszuwerten. Rechtsgrundlage
              ist Art. 6 Abs. 1 lit. b bzw. lit. f DSGVO und – soweit erforderlich – Ihre Einwilligung. Einer
              werblichen Ansprache können Sie jederzeit widersprechen.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">15. Zahlungsabwicklung</h2>
            <p className="text-muted-foreground">
              Zur Abwicklung von Zahlungen und Auszahlungen nutzen wir einen externen Zahlungsdienstleister
              (Stripe). Die zur Zahlungsabwicklung erforderlichen Daten (z. B. Rechnungs- und Transaktionsdaten)
              werden an diesen übermittelt und dort eigenverantwortlich nach dessen Datenschutzbestimmungen
              verarbeitet. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) sowie Art. 6
              Abs. 1 lit. c DSGVO (gesetzliche Aufbewahrungspflichten).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">16. Kontaktaufnahme</h2>
            <p className="text-muted-foreground">
              Wenn Sie uns über das Kontaktformular, per E-Mail oder telefonisch kontaktieren, verarbeiten wir
              Ihre Angaben zur Bearbeitung der Anfrage und für etwaige Anschlussfragen (Art. 6 Abs. 1 lit. b
              bzw. lit. f DSGVO). Die Daten werden gelöscht, sobald sie nicht mehr erforderlich sind und keine
              Aufbewahrungspflichten entgegenstehen.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">17. Speicherdauer und Löschung</h2>
            <p className="text-muted-foreground">
              Wir speichern personenbezogene Daten nur so lange, wie es für die jeweiligen Zwecke erforderlich
              ist oder gesetzliche Aufbewahrungspflichten (insbesondere handels- und steuerrechtlich, i. d. R.
              6 bzw. 10 Jahre) bestehen. Kandidatendaten werden gelöscht oder anonymisiert, wenn der
              Vermittlungsprozess abgeschlossen ist und keine Rechtsgrundlage für eine weitere Speicherung
              besteht oder die Einwilligung widerrufen wird. Zur Wahrnehmung Ihrer Rechte stellen wir
              Funktionen zum Export und zur Löschung von Daten bereit.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">18. Ihre Rechte als betroffene Person</h2>
            <p className="text-muted-foreground">
              Sie haben das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16 DSGVO), Löschung
              (Art. 17 DSGVO), Einschränkung der Verarbeitung (Art. 18 DSGVO) sowie Datenübertragbarkeit
              (Art. 20 DSGVO). Erteilte Einwilligungen können Sie jederzeit mit Wirkung für die Zukunft
              widerrufen (Art. 7 Abs. 3 DSGVO), ohne dass die Rechtmäßigkeit der bis dahin erfolgten
              Verarbeitung berührt wird. Zur Ausübung Ihrer Rechte genügt eine Mitteilung an
              info@bluewater-bridge.de.
            </p>
            <p className="text-muted-foreground mt-4">
              Im Zusammenhang mit der KI-gestützten Fit-Bewertung (Ziffer 12) haben Sie zudem das Recht, eine
              Erläuterung der Rolle dieser Bewertung im Sie betreffenden Auswahlprozess zu verlangen, Ihren
              Standpunkt darzulegen, die Bewertung anzufechten und ein Eingreifen einer natürlichen Person zu
              erwirken (Art. 22 Abs. 3 DSGVO). Das Recht auf Erläuterung der Entscheidungsfindung nach
              Art. 86 KI-Verordnung richtet sich vorrangig gegen den Betreiber (Recruiter bzw. Unternehmen),
              der die Bewertung im konkreten Auswahlprozess nutzt; wir unterstützen Sie bei der Zuordnung und
              Weiterleitung Ihres Anliegens.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">19. Widerspruchsrecht (Art. 21 DSGVO)</h2>
            <p className="text-muted-foreground">
              Soweit wir Daten auf Grundlage berechtigter Interessen (Art. 6 Abs. 1 lit. f DSGVO)
              verarbeiten, haben Sie das Recht, aus Gründen, die sich aus Ihrer besonderen Situation ergeben,
              jederzeit Widerspruch gegen diese Verarbeitung einzulegen. <strong>Werden Ihre Daten zur
              Direktwerbung verarbeitet, haben Sie das Recht, jederzeit ohne Angabe von Gründen Widerspruch
              einzulegen;</strong> wir verarbeiten Ihre Daten dann nicht mehr zu diesen Zwecken.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">20. Datensicherheit</h2>
            <p className="text-muted-foreground">
              Wir treffen geeignete technische und organisatorische Maßnahmen gemäß Art. 32 DSGVO, um Ihre
              Daten vor Verlust, Missbrauch und unbefugtem Zugriff zu schützen. Dazu gehören die
              Verschlüsselung der Datenübertragung (TLS), rollenbasierte Zugriffskontrollen, Mandantentrennung
              sowie die Protokollierung sicherheitsrelevanter Vorgänge. Unsere Maßnahmen werden fortlaufend an
              den Stand der Technik angepasst.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">21. Beschwerderecht bei einer Aufsichtsbehörde</h2>
            <p className="text-muted-foreground">
              Sie haben unbeschadet anderweitiger Rechtsbehelfe das Recht, sich bei einer
              Datenschutz-Aufsichtsbehörde zu beschweren (Art. 77 DSGVO). Für uns zuständig ist aufgrund
              unseres Sitzes in Bayern:<br /><br />
              Bayerisches Landesamt für Datenschutzaufsicht (BayLDA)<br />
              Promenade 18<br />
              91522 Ansbach
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">22. Pflicht zur Bereitstellung von Daten</h2>
            <p className="text-muted-foreground">
              Für den Abschluss und die Durchführung des Nutzungsvertrags ist die Bereitstellung der hierfür
              erforderlichen Daten notwendig. Ohne diese Daten können wir das Nutzerkonto und die
              Plattformleistungen nicht bereitstellen.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">23. Änderungen dieser Datenschutzerklärung</h2>
            <p className="text-muted-foreground">
              Wir passen diese Datenschutzerklärung an, wenn sich die Rechtslage, unsere Dienste oder die
              Datenverarbeitung ändern. Es gilt die jeweils auf dieser Seite veröffentlichte Fassung.<br /><br />
              Stand: Juni 2026
            </p>
          </section>
        </div>
      </main>

      <FooterSection />
    </div>
  );
};

export default Datenschutz;
