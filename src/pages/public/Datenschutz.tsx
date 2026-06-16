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
            <h2 className="text-xl font-semibold mb-4">1. Verantwortlicher</h2>
            <p className="text-muted-foreground">
              Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:<br /><br />
              bluewater & Bridge GmbH<br />
              [Straße Hausnummer]<br />
              [PLZ Stadt]<br />
              Deutschland<br /><br />
              E-Mail: [E-Mail-Adresse]
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">2. Übersicht der Verarbeitungen</h2>
            <p className="text-muted-foreground">
              Matchunt ist eine Recruiting-Plattform, über die Unternehmen Stellen ausschreiben und
              verifizierte Recruiter Kandidatinnen und Kandidaten vorschlagen. Dabei verarbeiten wir
              personenbezogene Daten der folgenden Personengruppen:
            </p>
            <ul className="text-muted-foreground list-disc pl-6 mt-4 space-y-2">
              <li>Besucherinnen und Besucher dieser Website (Nutzungsdaten, Cookies)</li>
              <li>Registrierte Nutzerinnen und Nutzer (Unternehmen und Recruiter: Bestands- und Vertragsdaten)</li>
              <li>Kandidatinnen und Kandidaten, die von Recruitern vorgeschlagen werden (Bewerbungsdaten)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">3. Rechtsgrundlagen</h2>
            <p className="text-muted-foreground">
              Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung und
              vorvertragliche Maßnahmen), Art. 6 Abs. 1 lit. f DSGVO (berechtigte Interessen, etwa an der
              sicheren Bereitstellung der Plattform), Art. 6 Abs. 1 lit. a DSGVO (Einwilligung, etwa bei
              Cookies, die nicht technisch notwendig sind) sowie Art. 88 DSGVO i. V. m. § 26 BDSG, soweit
              Daten im Beschäftigungskontext verarbeitet werden.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">4. Hosting und Infrastruktur</h2>
            <p className="text-muted-foreground">
              Unsere Plattform wird in Rechenzentren innerhalb der Europäischen Union betrieben. Mit allen
              eingesetzten Dienstleistern (Auftragsverarbeitern) bestehen Auftragsverarbeitungsverträge gemäß
              Art. 28 DSGVO. Eingesetzte Dienstleister: [Hosting-/Infrastruktur-Dienstleister auflisten,
              z. B. Supabase (Datenbank & Authentifizierung), Hosting-Anbieter].
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">5. Registrierung und Nutzerkonten</h2>
            <p className="text-muted-foreground">
              Bei der Registrierung verarbeiten wir Name, E-Mail-Adresse, Passwort (verschlüsselt) sowie die
              gewählte Rolle (Unternehmen oder Recruiter). Diese Daten sind für die Bereitstellung des
              Nutzerkontos erforderlich (Art. 6 Abs. 1 lit. b DSGVO).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">6. Kandidatendaten und Anonymisierung</h2>
            <p className="text-muted-foreground">
              Recruiter erfassen auf der Plattform Daten von Kandidatinnen und Kandidaten (z. B. Lebenslauf,
              Qualifikationen, Gehaltsvorstellungen). Die Plattform arbeitet nach dem Triple-Blind-Prinzip:
              Identifizierende Daten werden gegenüber Unternehmen erst offengelegt, wenn die Kandidatin bzw.
              der Kandidat dem zugestimmt hat. Recruiter sind verpflichtet, Kandidaten über die Verarbeitung
              ihrer Daten auf Matchunt zu informieren und erforderliche Einwilligungen einzuholen.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">7. Cookies und Einwilligung</h2>
            <p className="text-muted-foreground">
              Wir verwenden technisch notwendige Cookies für den Betrieb der Website (z. B. Login-Sitzungen).
              Nicht notwendige Cookies (z. B. zur Analyse) setzen wir nur mit Ihrer Einwilligung über unseren
              Cookie-Banner ein. Ihre Auswahl können Sie jederzeit über die Cookie-Einstellungen ändern.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">8. Kontaktaufnahme</h2>
            <p className="text-muted-foreground">
              Bei Kontaktaufnahme (z. B. über das Kontaktformular oder per E-Mail) verarbeiten wir Ihre Angaben
              zur Bearbeitung der Anfrage (Art. 6 Abs. 1 lit. b bzw. lit. f DSGVO).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">9. Speicherdauer</h2>
            <p className="text-muted-foreground">
              Wir speichern personenbezogene Daten nur so lange, wie es für die jeweiligen Zwecke erforderlich
              ist oder gesetzliche Aufbewahrungspflichten bestehen. Kandidatendaten werden gelöscht oder
              anonymisiert, wenn der Vermittlungsprozess abgeschlossen ist und keine Rechtsgrundlage für eine
              weitere Speicherung besteht.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">10. Ihre Rechte</h2>
            <p className="text-muted-foreground">
              Sie haben das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16 DSGVO), Löschung
              (Art. 17 DSGVO), Einschränkung der Verarbeitung (Art. 18 DSGVO), Datenübertragbarkeit
              (Art. 20 DSGVO) sowie Widerspruch gegen die Verarbeitung (Art. 21 DSGVO). Erteilte
              Einwilligungen können Sie jederzeit mit Wirkung für die Zukunft widerrufen.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">11. Beschwerderecht</h2>
            <p className="text-muted-foreground">
              Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren
              (Art. 77 DSGVO). Zuständig ist die Aufsichtsbehörde des Bundeslandes, in dem wir unseren
              Sitz haben: [zuständige Landesdatenschutzbehörde].
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">12. Datensicherheit</h2>
            <p className="text-muted-foreground">
              Wir treffen technische und organisatorische Maßnahmen gemäß Art. 32 DSGVO, um Ihre Daten zu
              schützen. Dazu gehören die Verschlüsselung der Datenübertragung (TLS) und der gespeicherten
              Daten, rollenbasierte Zugriffskontrollen sowie die Protokollierung sicherheitsrelevanter
              Vorgänge.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">13. Änderungen dieser Datenschutzerklärung</h2>
            <p className="text-muted-foreground">
              Wir passen diese Datenschutzerklärung an, wenn sich die Rechtslage oder unsere Verarbeitungen
              ändern. Es gilt die jeweils auf dieser Seite veröffentlichte Fassung.<br /><br />
              Stand: [Datum]
            </p>
          </section>
        </div>
      </main>

      <FooterSection />
    </div>
  );
};

export default Datenschutz;
