import { Link } from "react-router-dom";
import { Navbar } from "@/components/layout/Navbar";
import { FooterSection } from "@/components/landing/FooterSection";
import { ArrowLeft } from "lucide-react";

const Impressum = () => {
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

        <h1 className="text-4xl font-bold mb-8">Impressum</h1>

        <div className="prose prose-slate dark:prose-invert max-w-none space-y-8">
          <section>
            <p className="text-xl text-muted-foreground mb-8">
              Matchunt – eine Marke der Bluewater &amp; Bridge GmbH
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Angaben gemäß § 5 DDG</h2>
            <p className="text-muted-foreground">
              Bluewater &amp; Bridge GmbH<br />
              Adlzreiterstraße 2<br />
              80337 München<br />
              Deutschland
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Vertreten durch</h2>
            <p className="text-muted-foreground">
              Marko Benko
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Kontakt</h2>
            <p className="text-muted-foreground">
              Telefon: 089 380 30 73 0<br />
              Telefax: 089 380 30 73 99<br />
              E-Mail: info@bluewater-bridge.de
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Registereintrag</h2>
            <p className="text-muted-foreground">
              Registergericht: Amtsgericht München<br />
              Registernummer: HRB 288632
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Umsatzsteuer-ID</h2>
            <p className="text-muted-foreground">
              Umsatzsteuer-Identifikationsnummer gemäß § 27 a UStG:<br />
              DE365690081
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
            <p className="text-muted-foreground">
              Marko Benko<br />
              Adlzreiterstraße 2<br />
              80337 München
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Verbraucherstreitbeilegung</h2>
            <p className="text-muted-foreground">
              Die von der Europäischen Kommission bereitgestellte Plattform zur Online-Streitbeilegung
              (OS-Plattform) wurde im Jahr 2025 eingestellt und steht nicht mehr zur Verfügung.
            </p>
            <p className="text-muted-foreground mt-4">
              Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
              Verbraucherschlichtungsstelle im Sinne des Verbraucherstreitbeilegungsgesetzes (VSBG)
              teilzunehmen. Unser Angebot richtet sich zudem ausschließlich an Unternehmer.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Haftung für Inhalte</h2>
            <p className="text-muted-foreground">
              Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte auf diesen Seiten nach den
              allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 DDG sind wir als Diensteanbieter jedoch nicht
              verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen
              zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
            </p>
            <p className="text-muted-foreground mt-4">
              Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den allgemeinen
              Gesetzen bleiben hiervon unberührt. Eine diesbezügliche Haftung ist jedoch erst ab dem Zeitpunkt
              der Kenntnis einer konkreten Rechtsverletzung möglich. Bei Bekanntwerden von entsprechenden
              Rechtsverletzungen werden wir diese Inhalte umgehend entfernen.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Haftung für Links</h2>
            <p className="text-muted-foreground">
              Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben.
              Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der
              verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Urheberrecht</h2>
            <p className="text-muted-foreground">
              Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen
              Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der
              Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.
            </p>
          </section>
        </div>
      </main>

      <FooterSection />
    </div>
  );
};

export default Impressum;
