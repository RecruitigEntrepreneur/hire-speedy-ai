import { Link } from "react-router-dom";
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
            <h2 className="text-xl font-semibold mb-4">§ 1 Geltungsbereich</h2>
            <p className="text-muted-foreground">
              Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für die Nutzung der Plattform Matchunt,
              betrieben von der bluewater & Bridge GmbH, [Adresse] (nachfolgend „Matchunt"). Die Plattform
              richtet sich ausschließlich an Unternehmer im Sinne des § 14 BGB.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">§ 2 Vertragsgegenstand</h2>
            <p className="text-muted-foreground">
              Matchunt betreibt eine Online-Plattform, über die Unternehmen Stellen ausschreiben und
              registrierte, verifizierte Recruiter passende Kandidatinnen und Kandidaten vorschlagen können.
              Matchunt vermittelt den Kontakt und stellt die technische Infrastruktur einschließlich
              Zahlungsabwicklung bereit. Matchunt wird nicht selbst als Personalvermittler tätig.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">§ 3 Registrierung und Nutzerkonto</h2>
            <p className="text-muted-foreground">
              Die Nutzung der Plattform setzt eine Registrierung voraus. Recruiter durchlaufen vor
              Freischaltung einen Verifizierungsprozess. Zugangsdaten sind vertraulich zu behandeln.
              Matchunt kann Konten bei Verstößen gegen diese AGB sperren.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">§ 4 Leistungen für Unternehmen</h2>
            <p className="text-muted-foreground">
              Das Ausschreiben von Stellen ist kostenlos. Eine Vergütung (Vermittlungsprovision) fällt
              ausschließlich im Erfolgsfall an, d. h. bei Zustandekommen eines Arbeitsvertrags mit einer über
              die Plattform vorgeschlagenen Kandidatin bzw. einem Kandidaten. Die Höhe der Provision wird vor
              Beginn des Vermittlungsprozesses transparent ausgewiesen. [Provisionshöhe/-modell einfügen]
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">§ 5 Leistungen für Recruiter</h2>
            <p className="text-muted-foreground">
              Recruiter erhalten Zugang zu ausgeschriebenen Mandaten und schlagen Kandidatinnen und Kandidaten
              vor. Im Erfolgsfall erhält der Recruiter den vereinbarten Anteil an der Vermittlungsprovision.
              Der Anteil wird vor Annahme eines Mandats ausgewiesen. Recruiter sichern zu, dass sie zur
              Weitergabe der Kandidatendaten berechtigt sind und die Kandidaten informiert haben.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">§ 6 Umgehungsverbot</h2>
            <p className="text-muted-foreground">
              Unternehmen ist es untersagt, über die Plattform vorgeschlagene Kandidatinnen und Kandidaten
              unter Umgehung von Matchunt einzustellen, um die Vermittlungsprovision zu vermeiden. Kommt
              innerhalb von [Zeitraum, z. B. 12 Monaten] nach dem Vorschlag ein Arbeitsverhältnis zustande,
              gilt die Vermittlung als über die Plattform erfolgt und die Provision wird fällig.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">§ 7 Vergütung und Zahlungsabwicklung</h2>
            <p className="text-muted-foreground">
              Die Zahlungsabwicklung erfolgt über ein Treuhandsystem (Escrow). Die Provision wird mit
              Vertragsunterschrift fällig und nach den vereinbarten Bedingungen an den Recruiter ausgezahlt.
              Alle Preise verstehen sich zuzüglich gesetzlicher Umsatzsteuer. [Zahlungsfristen,
              Rückerstattungs-/Probezeitregelung einfügen]
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">§ 8 Datenschutz und Vertraulichkeit</h2>
            <p className="text-muted-foreground">
              Die Verarbeitung personenbezogener Daten richtet sich nach unserer{" "}
              <Link to="/datenschutz" className="text-foreground underline hover:no-underline">
                Datenschutzerklärung
              </Link>
              . Die Parteien behandeln alle über die Plattform erlangten Informationen vertraulich,
              insbesondere Kandidatendaten und Konditionen.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">§ 9 Haftung</h2>
            <p className="text-muted-foreground">
              Matchunt haftet unbeschränkt für Vorsatz und grobe Fahrlässigkeit sowie bei Verletzung von
              Leben, Körper und Gesundheit. Bei einfacher Fahrlässigkeit haftet Matchunt nur für die
              Verletzung wesentlicher Vertragspflichten (Kardinalpflichten), begrenzt auf den
              vertragstypischen, vorhersehbaren Schaden. Matchunt übernimmt keine Gewähr für das
              Zustandekommen von Vermittlungen oder die Eignung vorgeschlagener Kandidaten.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">§ 10 Laufzeit und Kündigung</h2>
            <p className="text-muted-foreground">
              Der Nutzungsvertrag läuft auf unbestimmte Zeit und kann von beiden Seiten jederzeit ohne
              Einhaltung einer Frist gekündigt werden. Bereits entstandene Provisionsansprüche bleiben von
              einer Kündigung unberührt.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">§ 11 Schlussbestimmungen</h2>
            <p className="text-muted-foreground">
              Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts.
              Gerichtsstand ist, soweit gesetzlich zulässig, der Sitz der bluewater & Bridge GmbH. Sollten
              einzelne Bestimmungen dieser AGB unwirksam sein, bleibt die Wirksamkeit der übrigen
              Bestimmungen unberührt.<br /><br />
              Stand: [Datum]
            </p>
          </section>
        </div>
      </main>

      <FooterSection />
    </div>
  );
};

export default AGB;
