import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';
import { getPublicAppUrl } from '../_shared/app-url.ts';

/**
 * Das Vertragsdokument zeichnen -- ohne Datenbank, ohne Ablage.
 *
 * Aus index.ts herausgezogen (26.09.2026), damit sich die Dokumente mit
 * Beispieldaten erzeugen und vor dem Versand ansehen lassen. Quelle bleibt
 * ausschliesslich der Snapshot des Auftrags bzw. des Rahmenvertrags.
 */

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 56;
const LINE = 14;

const eur = (n: number | null | undefined) =>
  n == null ? '—' : `${Number(n).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const date = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('de-DE', { dateStyle: 'long', timeStyle: 'short' }) : '—';

/** Tagessatz-Spanne aus der Aufnahme: "900–1.100 €" oder "1.000 €". */
const spanne = (min: unknown, max: unknown): string | null => {
  const a = Number(min) > 0 ? Number(min) : null;
  const b = Number(max) > 0 ? Number(max) : null;
  if (!a && !b) return null;
  const lo = Math.min(a ?? b!, b ?? a!), hi = Math.max(a ?? b!, b ?? a!);
  const f = (n: number) => Math.round(n).toLocaleString('de-DE');
  return lo === hi ? `${f(lo)} €` : `${f(lo)}–${f(hi)} €`;
};

export async function renderVertragsdokument(
  m: Record<string, any>,
  istRahmen: boolean,
): Promise<{ bytes: Uint8Array; nummer: string; seiten: number }> {
  // Die sprechende Nummer -- MV-… beim Einzelauftrag, RV-… beim Rahmenvertrag.
  const nummer = istRahmen ? m.agreement_number : m.mandate_number;

  const snap = (m.snapshot ?? {}) as Record<string, any>;
  const client = (snap.client ?? {}) as Record<string, any>;
  const position = (snap.position ?? {}) as Record<string, any>;
  // Seit dem Drei-Paket-Modell traegt der Snapshot 'package' und 'contract'
  // statt 'terms'. Die alte Form bleibt als Rueckfallebene: Auftraege aus der
  // Zeit davor muessen weiter ein richtiges Dokument ergeben.
  const pkg = (snap.package ?? {}) as Record<string, any>;
  const contract = (snap.contract ?? {}) as Record<string, any>;
  const legacy = (snap.terms ?? {}) as Record<string, any>;
  const terms = {
    fee_percentage:     pkg.fee_percentage     ?? legacy.fee_percentage,
    fee_basis:          pkg.fee_basis          ?? legacy.fee_basis,
    payment_terms_days: pkg.payment_terms_days ?? legacy.payment_terms_days,
    continuity_days:    pkg.continuity_days    ?? null,
    claim_notice_days:  pkg.claim_notice_days  ?? null,
    package_name:       pkg.name               ?? legacy.label,
    body_md:            contract.body_md       ?? legacy.body_md,
    vat_note:           legacy.vat_note
      ?? 'Alle Beträge verstehen sich zzgl. der gesetzlichen Umsatzsteuer.',
  } as Record<string, any>;
  const agb = (snap.agb ?? {}) as Record<string, any>;
  // Vertragswerk v4 (Fassung 2, 25.09.2026): Rahmenvertrag über
  // Personaldienstleistungen mit Datenblatt; je Position eine Auftragsbestätigung.
  const fassung = Number(contract.template_version ?? m.template_version ?? 1) || 1;
  const v4 = fassung >= 2;
  // Contracting-Auftrag: kein Paket, die Kondition ist der Tagessatz all-in.
  const contracting = !istRahmen
    && (m.fee_basis === 'day_rate_all_in' || position.employment_type === 'freelance');
  const datenblatt = (snap.datenblatt ?? null) as Record<string, any> | null;

  // Der Vertragspartner. Matchunt ist eine Marke der Bluewater & Bridge GmbH;
  // die Angaben entsprechen dem Impressum. Als Vorgabe fest im Code, damit ein
  // fehlendes Secret nicht zu einem Vertrag ohne Firmierung fuehrt — per
  // Umgebungsvariable weiterhin uebersteuerbar, etwa bei einem Sitzwechsel.
  const vendorName = Deno.env.get('MANDATE_VENDOR_NAME') ?? 'Bluewater & Bridge GmbH';
  const vendorAddress = Deno.env.get('MANDATE_VENDOR_ADDRESS')
    ?? 'Adlzreiterstraße 2, 80337 München';
  const vendorRegister = Deno.env.get('MANDATE_VENDOR_REGISTER')
    ?? 'Amtsgericht München, HRB 288632 · USt-IdNr. DE365690081';

  // ---- Dokument ---------------------------------------------------------
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage(A4);
  let y = A4[1] - MARGIN;

  const newPage = () => { page = pdf.addPage(A4); y = A4[1] - MARGIN; };
  const space = (h: number) => { if (y - h < MARGIN + 40) newPage(); };

  const write = (text: string, opts: { size?: number; bold?: boolean; color?: [number, number, number]; indent?: number } = {}) => {
    const size = opts.size ?? 10;
    const f = opts.bold ? bold : font;
    const maxWidth = A4[0] - 2 * MARGIN - (opts.indent ?? 0);
    // Zeilenumbruch von Hand: pdf-lib bricht nicht selbst um.
    for (const paragraph of String(text).split('\n')) {
      const words = paragraph.split(/\s+/).filter(Boolean);
      if (words.length === 0) { space(LINE); y -= LINE * 0.6; continue; }
      let line = '';
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (f.widthOfTextAtSize(candidate, size) > maxWidth && line) {
          space(LINE);
          page.drawText(line, { x: MARGIN + (opts.indent ?? 0), y, size, font: f,
            color: rgb(...(opts.color ?? [0.1, 0.1, 0.12])) });
          y -= LINE;
          line = word;
        } else {
          line = candidate;
        }
      }
      if (line) {
        space(LINE);
        page.drawText(line, { x: MARGIN + (opts.indent ?? 0), y, size, font: f,
          color: rgb(...(opts.color ?? [0.1, 0.1, 0.12])) });
        y -= LINE;
      }
    }
  };

  const row = (label: string, value: string) => {
    space(LINE);
    page.drawText(label, { x: MARGIN, y, size: 10, font, color: rgb(0.42, 0.45, 0.5) });
    const maxWidth = A4[0] - 2 * MARGIN - 175;
    const words = String(value || '—').split(/\s+/);
    let line = '';
    let first = true;
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (bold.widthOfTextAtSize(candidate, 10) > maxWidth && line) {
        page.drawText(line, { x: MARGIN + 175, y, size: 10, font: bold, color: rgb(0.1, 0.1, 0.12) });
        y -= LINE; space(LINE); line = word; first = false;
      } else line = candidate;
    }
    page.drawText(line, { x: MARGIN + 175, y, size: 10, font: bold, color: rgb(0.1, 0.1, 0.12) });
    y -= LINE;
    void first;
  };

  const rule = () => {
    space(12);
    page.drawLine({ start: { x: MARGIN, y: y + 4 }, end: { x: A4[0] - MARGIN, y: y + 4 },
      thickness: 0.6, color: rgb(0.85, 0.86, 0.88) });
    y -= 12;
  };

  const heading = (text: string) => { space(26); y -= 8; write(text, { size: 12, bold: true }); y -= 4; };

  // Kopf
  write('Matchunt', { size: 9, bold: true, color: [0.42, 0.45, 0.5] });
  y -= 6;
  write(istRahmen
    ? (v4 ? 'Rahmenvertrag über Personaldienstleistungen' : 'Rahmenvertrag über Personalvermittlung')
    : (v4 ? 'Auftragsbestätigung' : 'Einzelauftrag zur Personalvermittlung'), { size: 18, bold: true });
  y -= 4;
  write(`Vorgangsnummer ${nummer}`, { size: 10, color: [0.42, 0.45, 0.5] });
  rule();

  heading('Vertragsparteien');
  row('Auftragnehmer', vendorName);
  if (vendorAddress) row('', vendorAddress);
  if (vendorRegister) row('Register', vendorRegister);
  row('Marke', 'Matchunt');
  y -= 6;
  row('Auftraggeber', client.company_legal_name || client.company_name || '—');
  const addr = [client.company_street, [client.company_postal_code, client.company_city].filter(Boolean).join(' '), client.company_country]
    .filter(Boolean).join(', ');
  if (addr) row('Anschrift', addr);
  if (client.company_vat_id) row('USt-IdNr.', client.company_vat_id);
  if (client.company_registration_number) row('Handelsregister', client.company_registration_number);
  row('Ansprechpartner', [client.contact_name, client.contact_role].filter(Boolean).join(', ') || '—');
  row('E-Mail', client.contact_email || '—');
  if (client.contact_phone) row('Telefon', client.contact_phone);

  rule();
  if (istRahmen && v4) {
    heading('Anlage 1 – Datenblatt');
    row('Vertragsnummer', String(nummer));
    row('Fassung', `${fassung} · Prüfsumme ${String(contract.body_sha256 ?? '').slice(0, 16)}…`);
    row('AGB', `Fassung ${agb.version ?? '—'}, abrufbar unter ${getPublicAppUrl()}/agb`);
    row('Vertreten durch', [client.signer_name ?? client.contact_name, client.contact_role].filter(Boolean).join(', ') || '—');
    row('Portal-Administrator', [client.contact_name, client.contact_email].filter(Boolean).join(', ') || '—');
    const a = (datenblatt?.modul_a ?? {}) as Record<string, any>;
    row('Modul A – Festanstellung', a.package_key
      ? `Paket ${a.package_name ?? a.package_key} · ${eur(a.fee_percentage)} % des Bruttojahreszielgehalts`
        + (a.continuity_days ? ` · Continuity ${a.continuity_days} Tage` : '')
      : 'Paket Core (20 %) bis zur Wahl bei der ersten Festanstellungs-Position (§ 8 Abs. 2)');
    row('Zahlungsziel Modul A', `${a.payment_terms_days ?? 14} Tage netto`);
    row('Modul B – Contracting', 'gilt ab Vertragsschluss · Tagessätze je Projektauftrag');
    row('Zahlungsziel Modul B', `${datenblatt?.modul_b?.payment_terms_days ?? 14} Tage netto`);
    const p = (datenblatt?.erste_position ?? {}) as Record<string, any>;
    if (p.title) {
      const ct = p.contract_type === 'freelance' || p.employment_type === 'freelance';
      const teile = ct
        ? ['Contracting', p.title, p.location,
           spanne(p.day_rate_min, p.day_rate_max) ? `Budget ${spanne(p.day_rate_min, p.day_rate_max)} je Tag, alles inklusive` : null,
           p.days_per_week ? `${p.days_per_week} Tage/Woche` : null,
           p.duration_months ? `${p.duration_months} Monate` : null]
        : ['Festanstellung', p.title, p.location];
      row('Erste Position', teile.filter(Boolean).join(' · '));
    }
    rule();
  }
  if (!istRahmen) {
  heading('Gegenstand');
  row('Position', position.title || '—');
  if (position.location) row('Standort', position.location);
  row('Art', contracting ? 'Contracting' : 'Festanstellung');
  y -= 4;
  write(contracting
    ? 'Der Auftragnehmer stellt dem Auftraggeber für die vorstehend bezeichnete Position geeignete selbstständige Spezialisten vor. Der Einsatz kommt durch Projektauftrag nach § 12 des Rahmenvertrags zustande.'
    : 'Der Auftragnehmer wird für den Auftraggeber geeignete Kandidatinnen und Kandidaten für die vorstehend bezeichnete Position identifizieren, ansprechen, vorauswählen und vorstellen. Ein Anspruch auf das Zustandekommen einer Vermittlung besteht nicht.',
    { size: 10 },
  );

  rule();
  heading('Konditionen');
  if (contracting) {
    // Keine Prozente, keine Aufteilung: der Kunde sieht sein Budget als
    // All-in-Satz (Entscheidung 25.09.2026, contracting-konditionen.ts).
    const budget = spanne(position.day_rate_min, position.day_rate_max);
    row('Budget je Tag', budget ? `${budget}, alles inklusive, zzgl. USt` : 'wird vor jedem Einsatz abgestimmt');
    if (position.days_per_week) row('Umfang', `${position.days_per_week} Tage je Woche`);
    if (position.duration_months) {
      row('Laufzeit', `${position.duration_months} Monate${position.extension_possible ? ', Verlängerung möglich' : ''}`);
    }
    row('Vergütung', 'fester Tagessatz je geleistetem Einsatztag; kein Vermittlungshonorar');
    row('Abrechnung', `monatlich nach freigegebenen Tätigkeitsnachweisen, ${m.payment_terms_days ?? 14} Tage netto`);
    row('Kosten', 'erst ab dem ersten Einsatztag');
    y -= 4;
    write('Alle Beträge verstehen sich zzgl. der gesetzlichen Umsatzsteuer.', { size: 9, color: [0.42, 0.45, 0.5] });
  } else {
  if (terms.package_name) row('Paket', String(terms.package_name));
  row('Erfolgshonorar', `${eur(terms.fee_percentage)} % des Bruttojahreszielgehalts`);
  row('Fällig', 'ausschließlich im Erfolgsfall, mit Unterzeichnung des Anstellungsvertrags');
  row('Zahlungsziel', `${terms.payment_terms_days ?? 14} Tage netto ohne Abzug`);
  // Bewusst kein Euro-Betrag: die Bemessungsgrundlage steht erst mit dem
  // unterzeichneten Arbeitsvertrag fest. Eine Zahl hier waere eine Zusage,
  // die wir spaeter korrigieren muessten.
  if (terms.continuity_days) {
    row('Erneuter Suchlauf', `einmalig, bei Ausscheiden in den ersten ${terms.continuity_days} Tagen`);
    row('Meldefrist', `${terms.claim_notice_days ?? 14} Tage ab Kenntnis`);
  }
  row('Fixkosten', 'keine — kein Retainer, keine Grundgebühr');
  if (terms.vat_note) { y -= 4; write(String(terms.vat_note), { size: 9, color: [0.42, 0.45, 0.5] }); }

  if (terms.refund_rule) {
    y -= 6;
    write('Nachbesetzung und Erstattung', { size: 10, bold: true });
    write(String(terms.refund_rule), { size: 10 });
  }
  }   // Ende Festanstellungs-Konditionen

  }   // Ende der Bloecke, die es nur beim Einzelauftrag gibt

  if (terms.body_md) {
    rule();
    heading('Vertragstext');
    // Markdown-Auszeichnung entfernen: das PDF setzt seine eigene Typografie.
    // Ueberschriften (# Teil, ## §) werden fett gesetzt -- vorher liefen sie als
    // Fliesstext durch, und ein 17-seitiger Vertrag hatte keine Gliederung.
    // Tabellen (Anlage 2) werden zu lesbaren Zeilen "Zeile: Spalte – Wert; …",
    // Trennlinien entfallen. Der Vertragstext selbst (und seine Pruefsumme)
    // bleibt unveraendert -- nur die Darstellung im PDF.
    let tabellenKopf: string[] | null = null;
    for (const zeile of String(terms.body_md).split('\n')) {
      if (/^\s*-{3,}\s*$/.test(zeile)) continue;
      if (/^\s*\|.*\|\s*$/.test(zeile)) {
        const zellen = zeile.trim().replace(/^\||\|$/g, '').split('|').map((z) => z.trim());
        if (zellen.every((z) => /^:?-+:?$/.test(z))) continue;
        if (!tabellenKopf) { tabellenKopf = zellen; continue; }
        const kopf = tabellenKopf;
        write(`${zellen[0]}: ` + zellen.slice(1).map((z, i) => `${kopf[i + 1] ?? ''} – ${z}`).join('; '), { size: 10 });
        continue;
      }
      tabellenKopf = null;
      const h = zeile.match(/^(#+)\s*(.*)$/);
      if (h) {
        y -= 4;
        write(h[2].replace(/\*\*/g, ''), { size: h[1].length === 1 ? 12 : 10.5, bold: true });
      } else {
        write(zeile.replace(/\*\*/g, ''), { size: 10 });
      }
    }
  }

  rule();
  heading('Allgemeine Geschäftsbedingungen');
  // Am Rahmenvertrag gibt es keine Bestätigung in der Plattform -- dort stand
  // bisher "bestätigt am —".
  write(
    `Ergänzend gelten die Allgemeinen Geschäftsbedingungen des Auftragnehmers in der Fassung ${agb.version ?? '—'}, abrufbar unter ${agb.url ?? `${getPublicAppUrl()}/agb`}.`
    + (m.agb_accepted_at ? ` Der Auftraggeber hat sie am ${date(m.agb_accepted_at)} in der Plattform bestätigt.` : ''),
    { size: 10 },
  );

  rule();
  heading('Zustandekommen und Nachweis');
  if (istRahmen) {
    write(
      'Dieser Rahmenvertrag kommt mit der Unterzeichnung durch beide Parteien zustande. '
      + 'Er begründet keine Pflicht, Positionen zu beauftragen; '
      + (v4
        ? 'Positionen werden über die Plattform beauftragt und durch Auftragsbestätigung dokumentiert (§ 4).'
        : 'die einzelne Beauftragung erfolgt durch gesonderten Einzelauftrag.'),
      { size: 10 },
    );
    y -= 4;
    write(`Prüfsumme des Vertragsstands (SHA-256): ${m.snapshot_sha256}.`,
      { size: 9, color: [0.42, 0.45, 0.5] });
  } else {
    write(
      `Der Auftraggeber hat die vorstehenden Konditionen am ${date(m.client_confirmed_at)} elektronisch bestätigt und damit die Beauftragung angefragt. Bestätigt durch ${client.signer_name ?? client.contact_name ?? '—'} (${m.client_confirmed_email ?? '—'}).`,
      { size: 10 },
    );
    y -= 4;
    // Die Annahme steht hier nur, wenn sie schon erfolgt ist. Geht der
    // Vertrag unmittelbar nach der Anfrage zur Unterschrift raus, ist sie es
    // noch nicht -- dann waere "angenommen am —" eine Falschaussage im
    // Vertragsdokument. Die Annahme erfolgt in diesem Fall mit der
    // Gegenzeichnung, und die steht ohnehin darunter.
    if (m.accepted_at) {
      write(
        `Der Auftragnehmer hat die Beauftragung am ${date(m.accepted_at)} angenommen. Prüfsumme des bestätigten Konditionsstands (SHA-256): ${m.snapshot_sha256}.`,
        { size: 9, color: [0.42, 0.45, 0.5] },
      );
    } else {
      write(
        'Die Annahme durch den Auftragnehmer erfolgt mit dessen Gegenzeichnung. '
        + `Prüfsumme des bestätigten Konditionsstands (SHA-256): ${m.snapshot_sha256}.`,
        { size: 9, color: [0.42, 0.45, 0.5] },
      );
    }
  }

  // ---- Unterschriftsblock ------------------------------------------------
  space(150);
  y -= 24;
  rule();
  heading('Unterschriften');

  // Reichlich Luft zwischen Ueberschrift und Ankerpunkt. DocuSign setzt das
  // Unterschriftsfeld NACH OBEN vom Anker weg -- steht der Anker direkt
  // unter der Ueberschrift, deckt das Feld sie zu. Im ersten Testlauf
  // ueberlappte es "Unterschriften" und "Auftraggeber".
  y -= 52;
  const sigY = y;

  const unterschriftsfeld = (x: number, anker: string, rolle: string, partei: string) => {
    // Der Anker sitzt auf Linienhoehe: das Feld steht darueber, wie bei
    // einer Unterschrift auf Papier, die Beschriftung darunter.
    page.drawText(anker, { x, y: sigY, size: 9, font, color: rgb(1, 1, 1) });
    page.drawLine({ start: { x, y: sigY - 4 }, end: { x: x + 200, y: sigY - 4 },
      thickness: 0.8, color: rgb(0.6, 0.62, 0.65) });
    page.drawText(rolle, { x, y: sigY - 18, size: 9, font, color: rgb(0.42, 0.45, 0.5) });
    page.drawText(partei, { x, y: sigY - 30, size: 9, font, color: rgb(0.42, 0.45, 0.5) });
  };

  unterschriftsfeld(MARGIN, '/sig1/', 'Auftraggeber',
    String(client.company_legal_name || client.company_name || ''));
  // Zweiter Anker fuer die Gegenzeichnung. Ohne ihn haette DocuSign keinen
  // Bezugspunkt und setzte das Feld nach Seitenkoordinaten -- die
  // verrutschen, sobald der Vertragstext waechst.
  unterschriftsfeld(A4[0] / 2 + 20, '/sig2/', 'Auftragnehmer', vendorName);

  y = sigY - 44;

  // Fusszeile auf jeder Seite
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawText(`${nummer} · Seite ${i + 1} von ${pages.length}`, {
      x: MARGIN, y: 32, size: 8, font, color: rgb(0.6, 0.62, 0.65),
    });
  });

  const bytes = await pdf.save();

  return { bytes, nummer: String(nummer), seiten: pdf.getPages().length };
}
