// Mailtexte rund um Arbeitsvertrag und Unterschrift (Paket 3, 22.10.2026). Reine
// Funktionen: liefern Betreff, HTML und Text. Seit 23.10.2026 (Unterschrift über
// Matchunt) bekommen Unterzeichner ohne Konto und der Kandidat ihren persönlichen
// Link von Matchunt; DocuSign mailt eingebetteten Unterzeichnern nichts. Alte
// Umschläge (signing_mode 'email') verschickt DocuSign weiter selbst.
//
// Mehrsprachig (13.11.2026): jede Funktion nimmt `lang`, die Sprache des Empfängers
// (ohne Angabe Deutsch, wortgleich wie bisher). Übersetzt wird nur der Mailtext; der
// Vertrag selbst und die DocuSign-Dokumente bleiben, wie sie sind. Links auf
// /unterschrift/... und /vertrag/... tragen `?lang=`. Die Mail an Matchunt (adminCase) bleibt deutsch.
import { esc, layout } from './intake-mail.ts';
import type { MailContent } from './offer-mails.ts';
import { intlLocale, type Lang } from './i18n.ts';
import { euroIn, lang as langOf, m, quoteMarks, withLang } from './mail-i18n.ts';

type Lx = Lang | null | undefined;

const p = (s: string) => `<p style="margin:0 0 12px 0;">${s}</p>`;
const muted = (s: string) => `<span style="color:#6b7280;">${s}</span>`;
const quote = (s: string, lang?: Lx) => { const [a, b] = quoteMarks(lang); return `<div style="margin:12px 0;padding:10px 14px;background:#f6f7f9;border-radius:8px;color:#374151;">${a}${esc(s)}${b}</div>`; };
const plain = (...lines: (string | false | null | undefined)[]) => lines.filter(Boolean).join('\n');
const euro = (n: number | null | undefined, lang?: Lx) => euroIn(lang, n);
export const dateDe = (iso: string | null | undefined) =>
  (iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' }) : '');
/** Datum in der Sprache des Empfängers; ohne Sprache wie dateDe. */
export const dateIn = (iso: string | null | undefined, lang?: Lx) =>
  (iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString(intlLocale(lang), { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' }) : '');
const hallo = (name: string | null | undefined, lang?: Lx) => {
  const x = name ? ` ${esc(name)}` : '';
  return p(langOf(lang)({ de: m`Hallo${x},`, en: m`Hello${x},`, sv: m`Hej${x},`, nb: m`Hei${x},` }));
};
const L_OPEN_FILE = { de: 'Akte öffnen', en: 'Open candidate file', sv: 'Öppna kandidatakten', nb: 'Åpne kandidatmappen' };
const L_OPEN_PROFILE = { de: 'Profil öffnen', en: 'Open profile', sv: 'Öppna profilen', nb: 'Åpne profilen' };
const L_VIEW_SIGN = { de: 'Vertrag ansehen und unterschreiben', en: 'View and sign the contract', sv: 'Visa och skriv under avtalet', nb: 'Se og signer avtalen' };

export interface ContractFacts { signedOn: string | null; salary: number | null; variable: number | null; startDate: string | null }

export function factLines(f: ContractFacts, lang?: Lx): string[] {
  const L = langOf(lang);
  const variable = f.variable ? L({ de: m` + ${euro(f.variable, lang)} variabel`, en: m` + ${euro(f.variable, lang)} variable`, sv: m` + ${euro(f.variable, lang)} rörlig`, nb: m` + ${euro(f.variable, lang)} variabel` }) : '';
  return [
    f.signedOn ? `${L({ de: 'Unterschrieben am', en: 'Signed on', sv: 'Underskrivet', nb: 'Signert' })}: ${dateIn(f.signedOn, lang)}` : null,
    f.salary ? `${L({ de: 'Gehalt laut Vertrag', en: 'Salary per contract', sv: 'Lön enligt avtal', nb: 'Lønn ifølge avtalen' })}: ${euro(f.salary, lang)}${variable}` : null,
    f.startDate ? `${L({ de: 'Erster Arbeitstag', en: 'First working day', sv: 'Första arbetsdag', nb: 'Første arbeidsdag' })}: ${dateIn(f.startDate, lang)}` : null,
  ].filter(Boolean) as string[];
}
const factsHtml = (f: ContractFacts, lang?: Lx) => p(factLines(f, lang).map(esc).join('<br>'));

// --- An den Headhunter ---------------------------------------------------------

/** Stand des Vertrags: verschickt, Firma hat unterschrieben, abgelehnt, zurückgenommen … (text kommt schon in der Sprache des Headhunters) */
export function recruiterContractUpdate(o: { recruiterFirstName: string | null; candidateName: string; companyName: string; text: string; detail?: string | null; akteUrl: string; lang?: Lx }): MailContent {
  const heading = `${o.candidateName}: ${o.text}`;
  const body = [hallo(o.recruiterFirstName, o.lang), p(`${esc(o.companyName)}: ${esc(o.text)}`), o.detail ? quote(o.detail, o.lang) : ''].join('');
  return { subject: heading, html: layout({ lang: o.lang, preheader: o.companyName, heading, body, cta: { label: langOf(o.lang)(L_OPEN_FILE), url: o.akteUrl } }), text: plain(heading, o.detail, o.akteUrl) };
}

/** Kunde meldet die Unterschrift: Gegenprobe beim Kandidaten. */
export function recruiterCheckRequest(o: { recruiterFirstName: string | null; candidateName: string; companyName: string; facts: ContractFacts; akteUrl: string; lang?: Lx }): MailContent {
  const L = langOf(o.lang);
  const first = o.candidateName.split(' ')[0];
  const heading = L({ de: m`${o.companyName} meldet: ${o.candidateName} hat unterschrieben`, en: m`${o.companyName} reports: ${o.candidateName} has signed`, sv: m`${o.companyName} meddelar: ${o.candidateName} har skrivit under`, nb: m`${o.companyName} melder: ${o.candidateName} har signert` });
  const co = esc(o.companyName);
  const f = esc(first);
  const body = [
    hallo(o.recruiterFirstName, o.lang),
    p(L({
      de: m`${co} meldet die Unterschrift des Arbeitsvertrags. Passt das zu dem, was ${f} sagt?`,
      en: m`${co} reports that the employment contract has been signed. Does that match what ${f} says?`,
      sv: m`${co} meddelar att anställningsavtalet är underskrivet. Stämmer det med vad ${f} säger?`,
      nb: m`${co} melder at arbeidsavtalen er signert. Stemmer det med det ${f} sier?`,
    })),
    factsHtml(o.facts, o.lang),
    p(muted(L({ de: 'Bitte in der Akte „Stimmt“ oder „Weicht ab“ wählen.', en: 'Please choose “Correct” or “Differs” in the candidate file.', sv: 'Välj ”Stämmer” eller ”Avviker” i kandidatakten.', nb: 'Velg «Stemmer» eller «Avviker» i kandidatmappen.' }))),
  ].join('');
  return {
    subject: heading,
    html: layout({ lang: o.lang, preheader: L({ de: 'Gegenprobe', en: 'Cross-check', sv: 'Kontroll', nb: 'Kontroll' }), heading, body, cta: { label: L({ de: 'Gegenprobe machen', en: 'Cross-check now', sv: 'Gör kontrollen', nb: 'Gjør kontrollen' }), url: o.akteUrl } }),
    text: plain(heading, ...factLines(o.facts, o.lang), o.akteUrl),
  };
}

/** Tag 10 nach der Zusage ohne Meldung. */
export function recruiterFollowup(o: { recruiterFirstName: string | null; candidateName: string; companyName: string; days: number; akteUrl: string; lang?: Lx }): MailContent {
  const L = langOf(o.lang);
  const first = esc(o.candidateName.split(' ')[0]);
  const heading = L({ de: m`Vertrag mit ${o.candidateName}: seit ${o.days} Tagen keine Meldung`, en: m`Contract with ${o.candidateName}: no update for ${o.days} days`, sv: m`Avtal med ${o.candidateName}: inget besked på ${o.days} dagar`, nb: m`Avtale med ${o.candidateName}: ingen melding på ${o.days} dager` });
  const co = esc(o.companyName);
  const body = [
    hallo(o.recruiterFirstName, o.lang),
    p(L({
      de: m`Die Zusage an ${co} ist ${o.days} Tage her, eine Unterschrift ist noch nicht gemeldet. Frag bitte bei ${first} nach und trag den Stand in der Akte ein: unterschrieben oder abgesprungen.`,
      en: m`The acceptance to ${co} was ${o.days} days ago, and no signature has been reported yet. Please check with ${first} and update the status in the candidate file: signed or dropped out.`,
      sv: m`Ja-beskedet till ${co} kom för ${o.days} dagar sedan, och ingen underskrift har anmälts ännu. Hör med ${first} och för in läget i kandidatakten: underskrivet eller avhoppat.`,
      nb: m`Ja-et til ${co} kom for ${o.days} dager siden, og ingen signatur er meldt ennå. Sjekk med ${first} og før inn status i kandidatmappen: signert eller trukket seg.`,
    })),
  ].join('');
  return { subject: heading, html: layout({ lang: o.lang, preheader: L({ de: 'Vertrag nachfassen', en: 'Follow up on the contract', sv: 'Följ upp avtalet', nb: 'Følg opp avtalen' }), heading, body, cta: { label: L(L_OPEN_FILE), url: o.akteUrl } }), text: plain(heading, o.akteUrl) };
}

// --- An den Kunden -------------------------------------------------------------

/** Headhunter, Matchunt oder der Kandidat selbst meldet: Stimmt das? */
export function clientConfirmRequest(o: { name: string | null; candidateName: string; reporterName: string; facts: ContractFacts; profileUrl: string; lang?: Lx }): MailContent {
  const L = langOf(o.lang);
  const self = o.reporterName === o.candidateName;
  const heading = self
    ? L({ de: m`${o.candidateName} meldet: Arbeitsvertrag unterschrieben`, en: m`${o.candidateName} reports: employment contract signed`, sv: m`${o.candidateName} meddelar: anställningsavtalet underskrivet`, nb: m`${o.candidateName} melder: arbeidsavtalen signert` })
    : L({ de: m`${o.reporterName} meldet: ${o.candidateName} hat unterschrieben`, en: m`${o.reporterName} reports: ${o.candidateName} has signed`, sv: m`${o.reporterName} meddelar: ${o.candidateName} har skrivit under`, nb: m`${o.reporterName} melder: ${o.candidateName} har signert` });
  const c = `<strong>${esc(o.candidateName)}</strong>`;
  const r = esc(o.reporterName);
  const body = [
    hallo(o.name, o.lang),
    p(self
      ? L({ de: m`${c} meldet uns selbst: Der Arbeitsvertrag ist unterschrieben. Stimmt das?`, en: m`${c} has told us directly: the employment contract is signed. Is that correct?`, sv: m`${c} meddelar själv: anställningsavtalet är underskrivet. Stämmer det?`, nb: m`${c} melder selv: arbeidsavtalen er signert. Stemmer det?` })
      : L({ de: m`${r} meldet die Unterschrift des Arbeitsvertrags mit ${c}. Stimmt das?`, en: m`${r} reports that the employment contract with ${c} has been signed. Is that correct?`, sv: m`${r} meddelar att anställningsavtalet med ${c} är underskrivet. Stämmer det?`, nb: m`${r} melder at arbeidsavtalen med ${c} er signert. Stemmer det?` })),
    factsHtml(o.facts, o.lang),
    p(muted(L({ de: 'Erst nach Ihrer Bestätigung wird die Einstellung verbindlich.', en: 'The hire only becomes binding once you confirm.', sv: 'Anställningen blir bindande först när du bekräftar.', nb: 'Ansettelsen blir først bindende når du bekrefter.' }))),
  ].join('');
  return {
    subject: L({ de: m`${heading} – stimmt das?`, en: m`${heading} – is that correct?`, sv: m`${heading} – stämmer det?`, nb: m`${heading} – stemmer det?` }),
    html: layout({ lang: o.lang, preheader: L({ de: 'Bitte bestätigen', en: 'Please confirm', sv: 'Bekräfta gärna', nb: 'Bekreft gjerne' }), heading, body, cta: { label: L({ de: 'Bestätigen', en: 'Confirm', sv: 'Bekräfta', nb: 'Bekreft' }), url: o.profileUrl } }),
    text: plain(heading, ...factLines(o.facts, o.lang), o.profileUrl),
  };
}

/** Beide haben unterschrieben (DocuSign) bzw. die Meldung ist verbindlich. */
export function clientContractDone(o: { name: string | null; candidateName: string; facts: ContractFacts; digital: boolean; profileUrl: string; lang?: Lx }): MailContent {
  const L = langOf(o.lang);
  const heading = L({ de: m`Arbeitsvertrag mit ${o.candidateName} unterschrieben`, en: m`Employment contract with ${o.candidateName} signed`, sv: m`Anställningsavtal med ${o.candidateName} underskrivet`, nb: m`Arbeidsavtale med ${o.candidateName} signert` });
  const body = [
    hallo(o.name, o.lang),
    p(o.digital
      ? L({ de: 'Beide Seiten haben den Arbeitsvertrag über DocuSign unterschrieben. Das unterschriebene PDF liegt im Bewerberprofil.', en: 'Both sides have signed the employment contract via DocuSign. The signed PDF is in the candidate profile.', sv: 'Båda parter har skrivit under anställningsavtalet via DocuSign. Den underskrivna PDF:en finns i kandidatprofilen.', nb: 'Begge parter har signert arbeidsavtalen via DocuSign. Den signerte PDF-en ligger i kandidatprofilen.' })
      : L({ de: 'Die Unterschrift des Arbeitsvertrags ist bestätigt.', en: 'The signature of the employment contract is confirmed.', sv: 'Underskriften av anställningsavtalet är bekräftad.', nb: 'Signaturen på arbeidsavtalen er bekreftet.' })),
    factsHtml(o.facts, o.lang),
  ].join('');
  return { subject: heading, html: layout({ lang: o.lang, preheader: o.candidateName, heading, body, cta: { label: L(L_OPEN_PROFILE), url: o.profileUrl } }), text: plain(heading, ...factLines(o.facts, o.lang), o.profileUrl) };
}

/** Digitaler Weg: Stand an den Kunden (abgelehnt). text kommt schon in der Sprache des Kunden. */
export function clientContractUpdate(o: { name: string | null; candidateName: string; text: string; detail?: string | null; profileUrl: string; lang?: Lx }): MailContent {
  const heading = `${o.candidateName}: ${o.text}`;
  const body = [hallo(o.name, o.lang), p(esc(o.text)), o.detail ? quote(o.detail, o.lang) : ''].join('');
  return { subject: heading, html: layout({ lang: o.lang, preheader: o.candidateName, heading, body, cta: { label: langOf(o.lang)(L_OPEN_PROFILE), url: o.profileUrl } }), text: plain(heading, o.detail, o.profileUrl) };
}

/** Tag 7 nach der Zusage ohne Meldung: drei Knöpfe führen ins Profil. */
export function clientReminder(o: { name: string | null; candidateName: string; recruiterName: string; profileUrl: string; lang?: Lx }): MailContent {
  const L = langOf(o.lang);
  const first = o.candidateName.split(' ')[0];
  const heading = L({ de: m`Ist der Vertrag mit ${o.candidateName} unterschrieben?`, en: m`Has the contract with ${o.candidateName} been signed?`, sv: m`Är avtalet med ${o.candidateName} underskrivet?`, nb: m`Er avtalen med ${o.candidateName} signert?` });
  const link = (label: string, open: string) => `<a href="${esc(`${o.profileUrl}?vertrag=${open}`)}" style="display:inline-block;margin:0 8px 8px 0;padding:8px 14px;border:1px solid #d1d5db;border-radius:8px;color:#111827;text-decoration:none;">${esc(label)}</a>`;
  const rn = esc(o.recruiterName);
  const f = esc(first);
  const body = [
    hallo(o.name, o.lang),
    p(L({
      de: m`Damit ${rn} und wir ${f} bis zum Start begleiten können: Wie ist der Stand beim Arbeitsvertrag?`,
      en: m`So that ${rn} and we can support ${f} until the start date: what is the status of the employment contract?`,
      sv: m`För att ${rn} och vi ska kunna stötta ${f} fram till start: hur ser det ut med anställningsavtalet?`,
      nb: m`Slik at ${rn} og vi kan følge opp ${f} frem til oppstart: hvordan står det til med arbeidsavtalen?`,
    })),
    p(`${link(L({ de: 'Ja, melden', en: 'Yes, report it', sv: 'Ja, anmäl', nb: 'Ja, meld' }), 'melden')}${link(L({ de: 'Noch nicht, verschickt am …', en: 'Not yet, sent on …', sv: 'Inte än, skickat den …', nb: 'Ikke ennå, sendt …' }), 'verschickt')}${link(L({ de: m`${first} ist abgesprungen`, en: m`${first} has dropped out`, sv: m`${first} har hoppat av`, nb: m`${first} har trukket seg` }), 'abgesprungen')}`),
  ].join('');
  return { subject: heading, html: layout({ lang: o.lang, preheader: L({ de: 'Kurz melden', en: 'Quick update', sv: 'Kort besked', nb: 'Kort beskjed' }), heading, body }), text: plain(heading, `${L({ de: 'Melden', en: 'Report', sv: 'Anmäl', nb: 'Meld' })}: ${o.profileUrl}?vertrag=melden`) };
}

// --- An die Unterzeichner (Unterschrift über Matchunt) ---------------------------

const demoNote = (demo: boolean | undefined, lang?: Lx) => (demo ? p(muted(langOf(lang)({ de: 'Testbetrieb: Diese Unterschrift ist noch nicht rechtsverbindlich.', en: 'Test mode: this signature is not yet legally binding.', sv: 'Testläge: den här underskriften är ännu inte juridiskt bindande.', nb: 'Testmodus: denne signaturen er ennå ikke juridisk bindende.' }))) : '');
const validity = (days: number, lang?: Lx) => langOf(lang)({ de: m`Der Link gilt ${days} Tage und ist nur für Sie bestimmt.`, en: m`The link is valid for ${days} days and is meant only for you.`, sv: m`Länken gäller i ${days} dagar och är bara avsedd för dig.`, nb: m`Lenken gjelder i ${days} dager og er bare ment for deg.` });
const contractFacts = (o: { jobTitle: string; startDate: string | null; salary: number | null; variable: number | null }, lang?: Lx) => {
  const L = langOf(lang);
  const variable = o.variable ? L({ de: m` + ${euro(o.variable, lang)} variabel`, en: m` + ${euro(o.variable, lang)} variable`, sv: m` + ${euro(o.variable, lang)} rörlig`, nb: m` + ${euro(o.variable, lang)} variabel` }) : '';
  return [
    `${L({ de: 'Stelle', en: 'Role', sv: 'Tjänst', nb: 'Stilling' })}: ${o.jobTitle}`,
    o.startDate ? `${L({ de: 'Beginn', en: 'Start', sv: 'Start', nb: 'Oppstart' })}: ${dateIn(o.startDate, lang)}` : null,
    o.salary ? `${L({ de: 'Gehalt', en: 'Salary', sv: 'Lön', nb: 'Lønn' })}: ${euro(o.salary, lang)}${variable}` : null,
  ].filter(Boolean) as string[];
};

/** Unterzeichner der Firma ohne Matchunt-Konto (z. B. Geschäftsführung). */
export function companySignLink(o: {
  name: string | null; companyName: string; candidateName: string; jobTitle: string; uploaderName: string | null; uploaderEmail: string | null;
  url: string; days: number; reminder?: boolean; demo?: boolean; lang?: Lx;
}): MailContent {
  const L = langOf(o.lang);
  const url = withLang(o.url, o.lang);
  const heading = o.reminder
    ? L({ de: m`Erinnerung: Arbeitsvertrag ${o.candidateName} unterschreiben`, en: m`Reminder: sign the employment contract for ${o.candidateName}`, sv: m`Påminnelse: skriv under anställningsavtalet för ${o.candidateName}`, nb: m`Påminnelse: signer arbeidsavtalen for ${o.candidateName}` })
    : L({ de: m`Bitte unterschreiben: Arbeitsvertrag ${o.candidateName}`, en: m`Please sign: employment contract for ${o.candidateName}`, sv: m`Skriv under: anställningsavtal för ${o.candidateName}`, nb: m`Til signering: arbeidsavtale for ${o.candidateName}` });
  const who = (up: string | null) => up ?? L({ de: 'Ihr Team', en: 'Your team', sv: 'Ditt team', nb: 'Teamet ditt' });
  const n = o.name ? ` ${esc(o.name)}` : '';
  const c = `<strong>${esc(o.candidateName)}</strong>`;
  const j = esc(o.jobTitle);
  const co = esc(o.companyName);
  const f = esc(o.candidateName.split(' ')[0]);
  const body = [
    p(L({ de: m`Guten Tag${n},`, en: m`Hello${n},`, sv: m`Hej${n},`, nb: m`Hei${n},` })),
    p(L({
      de: m`${o.uploaderName ? `${esc(o.uploaderName)} hat` : 'Ihr Team hat'} bei Matchunt den Arbeitsvertrag für ${c} (${j}) hochgeladen. Sie unterschreiben für die ${co}; danach ist ${f} dran.`,
      en: m`${esc(who(o.uploaderName))} has uploaded the employment contract for ${c} (${j}) on Matchunt. You sign on behalf of ${co}; then it is ${f}'s turn.`,
      sv: m`${esc(who(o.uploaderName))} har laddat upp anställningsavtalet för ${c} (${j}) i Matchunt. Du skriver under för ${co}; sedan är det ${f}s tur.`,
      nb: m`${esc(who(o.uploaderName))} har lastet opp arbeidsavtalen for ${c} (${j}) i Matchunt. Du signerer for ${co}; deretter er det ${f} sin tur.`,
    })),
    demoNote(o.demo, o.lang),
  ].join('');
  const after = [validity(o.days, o.lang), o.uploaderName ? `${L({ de: 'Fragen', en: 'Questions', sv: 'Frågor', nb: 'Spørsmål' })}: ${o.uploaderName}${o.uploaderEmail ? `, ${o.uploaderEmail}` : ''}` : null].filter(Boolean).join(' ');
  return {
    subject: heading,
    html: layout({ lang: o.lang, preheader: o.companyName, heading, body, cta: { label: L(L_VIEW_SIGN), url }, after: esc(after) }),
    text: plain(heading, L({
      de: m`${who(o.uploaderName)} hat den Arbeitsvertrag für ${o.candidateName} hochgeladen. Sie unterschreiben für die ${o.companyName}.`,
      en: m`${who(o.uploaderName)} has uploaded the employment contract for ${o.candidateName}. You sign on behalf of ${o.companyName}.`,
      sv: m`${who(o.uploaderName)} har laddat upp anställningsavtalet för ${o.candidateName}. Du skriver under för ${o.companyName}.`,
      nb: m`${who(o.uploaderName)} har lastet opp arbeidsavtalen for ${o.candidateName}. Du signerer for ${o.companyName}.`,
    }), url, after),
  };
}

const replyTo = (recruiterName: string | null, lang?: Lx) => (recruiterName
  ? langOf(lang)({ de: m`Fragen zum Vertrag? Antworten Sie einfach auf diese Mail, sie geht an ${recruiterName}.`, en: m`Questions about the contract? Simply reply to this email; it goes to ${recruiterName}.`, sv: m`Frågor om avtalet? Svara bara på det här mejlet, det går till ${recruiterName}.`, nb: m`Spørsmål om avtalen? Bare svar på denne e-posten, den går til ${recruiterName}.` })
  : null);

/** Kandidat, sobald die Firma unterschrieben hat. */
export function candidateSignLink(o: {
  firstName: string; companyName: string; jobTitle: string; startDate: string | null; salary: number | null; variable: number | null;
  recruiterName: string | null; url: string; days: number; reminder?: boolean; demo?: boolean; lang?: Lx;
}): MailContent {
  const L = langOf(o.lang);
  const url = withLang(o.url, o.lang);
  const co = o.companyName;
  const heading = o.reminder
    ? L({ de: m`Erinnerung: Ihr Arbeitsvertrag mit ${co}`, en: m`Reminder: your employment contract with ${co}`, sv: m`Påminnelse: ditt anställningsavtal med ${co}`, nb: m`Påminnelse: arbeidsavtalen din med ${co}` })
    : L({ de: m`Ihr Arbeitsvertrag mit ${co} ist da`, en: m`Your employment contract with ${co} is ready`, sv: m`Ditt anställningsavtal med ${co} är här`, nb: m`Arbeidsavtalen din med ${co} er klar` });
  const facts = contractFacts(o, o.lang);
  const eco = esc(co);
  const body = [
    hallo(o.firstName, o.lang),
    p(o.reminder
      ? L({ de: m`Ihr Arbeitsvertrag mit ${eco} wartet noch auf Ihre Unterschrift.`, en: m`Your employment contract with ${eco} is still waiting for your signature.`, sv: m`Ditt anställningsavtal med ${eco} väntar fortfarande på din underskrift.`, nb: m`Arbeidsavtalen din med ${eco} venter fortsatt på signaturen din.` })
      : L({ de: m`${eco} hat Ihren Arbeitsvertrag unterschrieben. Jetzt fehlt nur noch Ihre Unterschrift.`, en: m`${eco} has signed your employment contract. Now only your signature is missing.`, sv: m`${eco} har skrivit under ditt anställningsavtal. Nu saknas bara din underskrift.`, nb: m`${eco} har signert arbeidsavtalen din. Nå mangler bare signaturen din.` })),
    p(facts.map(esc).join('<br>')),
    demoNote(o.demo, o.lang),
  ].join('');
  const after = [validity(o.days, o.lang), replyTo(o.recruiterName, o.lang)].filter(Boolean).join(' ');
  return {
    subject: heading,
    html: layout({ lang: o.lang, preheader: co, heading, body, cta: { label: L(L_VIEW_SIGN), url }, after: esc(after) }),
    text: plain(heading, ...facts, url, after),
  };
}

/** Kandidat: beide haben unterschrieben, Kopie über denselben Weg. */
export function candidateSignedCopy(o: { firstName: string; companyName: string; startDate: string | null; url: string; days: number; lang?: Lx }): MailContent {
  const L = langOf(o.lang);
  const url = withLang(o.url, o.lang);
  const heading = L({ de: m`Geschafft: Ihr Arbeitsvertrag mit ${o.companyName} ist unterschrieben`, en: m`Done: your employment contract with ${o.companyName} is signed`, sv: m`Klart: ditt anställningsavtal med ${o.companyName} är underskrivet`, nb: m`Ferdig: arbeidsavtalen din med ${o.companyName} er signert` });
  const d = o.startDate ? esc(dateIn(o.startDate, o.lang)) : '';
  const body = [
    hallo(o.firstName, o.lang),
    p(L({
      de: m`Beide Seiten haben unterschrieben${d ? `. Ihr erster Arbeitstag: ${d}` : ''}. Ihre Kopie des Vertrags können Sie hier herunterladen.`,
      en: m`Both sides have signed${d ? `. Your first working day: ${d}` : ''}. You can download your copy of the contract here.`,
      sv: m`Båda parter har skrivit under${d ? `. Din första arbetsdag: ${d}` : ''}. Här kan du ladda ner din kopia av avtalet.`,
      nb: m`Begge parter har signert${d ? `. Din første arbeidsdag: ${d}` : ''}. Her kan du laste ned din kopi av avtalen.`,
    })),
  ].join('');
  const after = L({ de: m`Der Link gilt ${o.days} Tage. Speichern Sie die Kopie bitte bei sich.`, en: m`The link is valid for ${o.days} days. Please save the copy for your records.`, sv: m`Länken gäller i ${o.days} dagar. Spara gärna kopian hos dig.`, nb: m`Lenken gjelder i ${o.days} dager. Lagre gjerne kopien hos deg.` });
  return { subject: heading, html: layout({ lang: o.lang, preheader: o.companyName, heading, body, cta: { label: L({ de: 'Kopie herunterladen', en: 'Download copy', sv: 'Ladda ner kopian', nb: 'Last ned kopien' }), url }, after: esc(after) }), text: plain(heading, url, after) };
}

// --- An den Kandidaten, wenn die Firma selbst verschickt (29.10.2026) -----------
// „<Headhunter> über Matchunt“, Antworten gehen an den Headhunter. Die Knöpfe öffnen
// die Seite /vertrag/:token mit vorgewählter Antwort; gespeichert wird erst dort.

export type CandidateAnswerKey = 'arrived' | 'missing' | 'signed' | 'ok' | 'differs';

const hrefOf = (url: string, a: CandidateAnswerKey | undefined, lang?: Lx) => withLang(a ? `${url}?a=${a}` : url, lang);
const buttons = (url: string, items: { label: string; a?: CandidateAnswerKey }[], lang?: Lx) => p(items.map((it, i) => {
  const href = hrefOf(url, it.a, lang);
  const style = i === 0
    ? 'display:inline-block;margin:0 8px 8px 0;padding:10px 16px;background:#111827;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:600;'
    : 'display:inline-block;margin:0 8px 8px 0;padding:10px 16px;border:1px solid #d1d5db;border-radius:8px;color:#111827;text-decoration:none;';
  return `<a href="${esc(href)}" style="${style}">${esc(it.label)}</a>`;
}).join(''));
const buttonLines = (url: string, items: { label: string; a?: CandidateAnswerKey }[], lang?: Lx) => items.map((it) => `${it.label}: ${hrefOf(url, it.a, lang)}`);
const STATUS_BUTTONS = (lang?: Lx): { label: string; a: CandidateAnswerKey }[] => {
  const L = langOf(lang);
  return [
    { label: L({ de: 'Ist angekommen', en: 'It has arrived', sv: 'Det har kommit', nb: 'Den har kommet' }), a: 'arrived' },
    { label: L({ de: 'Noch nicht da', en: 'Not here yet', sv: 'Inte kommit än', nb: 'Ikke kommet ennå' }), a: 'missing' },
    { label: L({ de: 'Schon unterschrieben', en: 'Already signed', sv: 'Redan underskrivet', nb: 'Allerede signert' }), a: 'signed' },
  ];
};

/** M1: Die Firma meldet „selbst verschickt am …“ (auch erneut nach „Noch nicht da“). */
export function candidateContractUnderway(o: {
  firstName: string; companyName: string; jobTitle: string; sentOn: string; startDate: string | null; salary: number | null; variable: number | null;
  recruiterName: string | null; url: string; again?: boolean; lang?: Lx;
}): MailContent {
  const lang = o.lang;
  const L = langOf(lang);
  const co = o.companyName;
  const heading = L({
    de: m`Ihr Arbeitsvertrag mit ${co} ist ${o.again ? 'erneut ' : ''}unterwegs`,
    en: m`Your employment contract with ${co} is on its way${o.again ? ' again' : ''}`,
    sv: m`Ditt anställningsavtal med ${co} är på väg${o.again ? ' igen' : ''}`,
    nb: m`Arbeidsavtalen din med ${co} er på vei${o.again ? ' igjen' : ''}`,
  });
  const facts = contractFacts(o, lang);
  const eco = esc(co);
  const d = esc(dateIn(o.sentOn, lang));
  const items = STATUS_BUTTONS(lang);
  const body = [
    hallo(o.firstName, lang),
    p(L({
      de: m`${eco} hat Ihnen den Arbeitsvertrag am ${d} ${o.again ? 'erneut ' : ''}geschickt, direkt von der Firma, per Post oder Mail.`,
      en: m`${eco} sent you the employment contract${o.again ? ' again' : ''} on ${d}, directly from the company, by post or email.`,
      sv: m`${eco} skickade${o.again ? ' igen' : ''} anställningsavtalet till dig ${d}, direkt från företaget, per post eller mejl.`,
      nb: m`${eco} sendte deg arbeidsavtalen${o.again ? ' på nytt' : ''} ${d}, direkte fra selskapet, i posten eller på e-post.`,
    })),
    p(facts.map(esc).join('<br>')),
    p(L({ de: 'Sagen Sie uns kurz Bescheid:', en: 'Please let us know:', sv: 'Ge oss ett kort besked:', nb: 'Gi oss en kort beskjed:' })),
    buttons(o.url, items, lang),
  ].join('');
  const after = replyTo(o.recruiterName, lang);
  return { subject: heading, html: layout({ lang, preheader: co, heading, body, after: after ? esc(after) : undefined }), text: plain(heading, ...facts, ...buttonLines(o.url, items, lang), after) };
}

/** M2: einmal nach 7 Tagen ohne Unterschrift; hat er „angekommen“ gesagt, nur noch „schon unterschrieben?“. */
export function candidateContractAsk(o: { firstName: string; companyName: string; arrived: boolean; recruiterName: string | null; url: string; lang?: Lx }): MailContent {
  const lang = o.lang;
  const L = langOf(lang);
  const heading = o.arrived
    ? L({ de: 'Haben Sie Ihren Arbeitsvertrag schon unterschrieben?', en: 'Have you signed your employment contract yet?', sv: 'Har du skrivit under ditt anställningsavtal än?', nb: 'Har du signert arbeidsavtalen din ennå?' })
    : L({ de: 'Ist Ihr Arbeitsvertrag angekommen?', en: 'Has your employment contract arrived?', sv: 'Har ditt anställningsavtal kommit fram?', nb: 'Har arbeidsavtalen din kommet fram?' });
  const items = o.arrived ? [{ label: L({ de: 'Ja, unterschrieben', en: 'Yes, signed', sv: 'Ja, underskrivet', nb: 'Ja, signert' }), a: 'signed' as const }] : STATUS_BUTTONS(lang);
  const eco = esc(o.companyName);
  const body = [
    hallo(o.firstName, lang),
    p(L({
      de: m`Ihr Vertrag mit ${eco} ist bei uns noch nicht als unterschrieben gemeldet. Wie ist der Stand bei Ihnen?`,
      en: m`Your contract with ${eco} has not been reported to us as signed yet. What is the status on your side?`,
      sv: m`Ditt avtal med ${eco} har ännu inte anmälts som underskrivet hos oss. Hur ser det ut hos dig?`,
      nb: m`Avtalen din med ${eco} er ennå ikke meldt som signert hos oss. Hvordan står det til hos deg?`,
    })),
    buttons(o.url, items, lang),
    o.arrived ? p(muted(L({ de: 'Noch nicht unterschrieben? Dann müssen Sie nichts tun.', en: 'Not signed yet? Then you do not need to do anything.', sv: 'Inte underskrivet än? Då behöver du inte göra något.', nb: 'Ikke signert ennå? Da trenger du ikke gjøre noe.' }))) : '',
  ].join('');
  const after = replyTo(o.recruiterName, lang);
  return { subject: heading, html: layout({ lang, preheader: o.companyName, heading, body, after: after ? esc(after) : undefined }), text: plain(heading, ...buttonLines(o.url, items, lang), after) };
}

/** M3: Die Firma zieht den digitalen Vertrag zurück und schickt selbst; der Kandidat hatte schon einen Link. */
export function candidateLinkVoid(o: { firstName: string; companyName: string; recruiterName: string | null; lang?: Lx }): MailContent {
  const lang = o.lang;
  const L = langOf(lang);
  const heading = L({ de: 'Ihr Unterschrifts-Link gilt nicht mehr', en: 'Your signing link is no longer valid', sv: 'Din länk för underskrift gäller inte längre', nb: 'Signeringslenken din gjelder ikke lenger' });
  const first = (co: string) => L({ de: m`${co} schickt Ihnen den Arbeitsvertrag jetzt direkt.`, en: m`${co} will now send you the employment contract directly.`, sv: m`${co} skickar nu anställningsavtalet direkt till dig.`, nb: m`${co} sender deg nå arbeidsavtalen direkte.` });
  const body = [
    hallo(o.firstName, lang),
    p(`${first(esc(o.companyName))} ${L({ de: 'Den Link aus unserer letzten Mail brauchen Sie nicht mehr. Sobald der Vertrag unterwegs ist, sagen wir Bescheid.', en: 'You no longer need the link from our last email. We will let you know as soon as the contract is on its way.', sv: 'Länken i vårt senaste mejl behövs inte längre. Vi hör av oss så snart avtalet är på väg.', nb: 'Lenken i den forrige e-posten vår trenger du ikke lenger. Vi gir beskjed så snart avtalen er på vei.' })}`),
  ].join('');
  const after = o.recruiterName ? L({ de: m`Fragen? Antworten Sie einfach auf diese Mail, sie geht an ${o.recruiterName}.`, en: m`Questions? Simply reply to this email; it goes to ${o.recruiterName}.`, sv: m`Frågor? Svara bara på det här mejlet, det går till ${o.recruiterName}.`, nb: m`Spørsmål? Bare svar på denne e-posten, den går til ${o.recruiterName}.` }) : null;
  return { subject: heading, html: layout({ lang, preheader: o.companyName, heading, body, after: after ? esc(after) : undefined }), text: plain(heading, first(o.companyName), after) };
}

/**
 * M4: Glückwunsch. Meldet die Firma, fragt die Mail „Stimmt das so?“ (ersetzt die Gegenprobe
 * beim Headhunter); ist die Unterschrift schon von beiden Seiten bestätigt, ohne Frage.
 */
export function candidateContractSigned(o: {
  firstName: string; companyName: string; signedOn: string | null; startDate: string | null; recruiterName: string | null; url: string | null; ask: boolean; lang?: Lx;
}): MailContent {
  const lang = o.lang;
  const L = langOf(lang);
  const heading = L({ de: m`Glückwunsch: Ihr Arbeitsvertrag mit ${o.companyName} ist unterschrieben`, en: m`Congratulations: your employment contract with ${o.companyName} is signed`, sv: m`Grattis: ditt anställningsavtal med ${o.companyName} är underskrivet`, nb: m`Gratulerer: arbeidsavtalen din med ${o.companyName} er signert` });
  const sd = o.signedOn ? esc(dateIn(o.signedOn, lang)) : '';
  const st = o.startDate ? esc(dateIn(o.startDate, lang)) : '';
  const since = L({ de: m`${sd ? ` seit ${sd}` : ''}`, en: m`${sd ? ` on ${sd}` : ''}`, sv: m`${sd ? ` den ${sd}` : ''}`, nb: m`${sd ? ` den ${sd}` : ''}` });
  const start = st ? L({ de: m` Ihr erster Arbeitstag: ${st}.`, en: m` Your first working day: ${st}.`, sv: m` Din första arbetsdag: ${st}.`, nb: m` Din første arbeidsdag: ${st}.` }) : '';
  const items = [
    { label: L({ de: 'Stimmt', en: 'Correct', sv: 'Stämmer', nb: 'Stemmer' }), a: 'ok' as const },
    { label: L({ de: 'Stimmt so nicht', en: 'Not quite right', sv: 'Stämmer inte', nb: 'Stemmer ikke' }), a: 'differs' as const },
  ];
  const eco = esc(o.companyName);
  const body = [
    hallo(o.firstName, lang),
    o.ask && o.url
      ? p(L({
        de: m`${eco} meldet: Ihr Vertrag ist${since} unterschrieben.${start} Stimmt das so?`,
        en: m`${eco} reports: your contract was signed${since}.${start} Is that correct?`,
        sv: m`${eco} meddelar: ditt avtal är underskrivet${since}.${start} Stämmer det?`,
        nb: m`${eco} melder: avtalen din er signert${since}.${start} Stemmer det?`,
      })) + buttons(o.url, items, lang)
      : p(L({
        de: m`Ihr Vertrag ist${since} unterschrieben, ${eco} hat es bestätigt.${start}`,
        en: m`Your contract was signed${since}, and ${eco} has confirmed it.${start}`,
        sv: m`Ditt avtal är underskrivet${since}, ${eco} har bekräftat det.${start}`,
        nb: m`Avtalen din er signert${since}, ${eco} har bekreftet det.${start}`,
      })),
  ].join('');
  const after = o.recruiterName ? L({ de: m`${o.recruiterName} begleitet Sie bis zum ersten Tag. Fragen? Antworten Sie einfach auf diese Mail.`, en: m`${o.recruiterName} will support you until your first day. Questions? Simply reply to this email.`, sv: m`${o.recruiterName} finns med dig fram till första dagen. Frågor? Svara bara på det här mejlet.`, nb: m`${o.recruiterName} følger deg opp frem til første dag. Spørsmål? Bare svar på denne e-posten.` }) : null;
  return {
    subject: heading, html: layout({ lang, preheader: o.companyName, heading, body, after: after ? esc(after) : undefined }),
    text: plain(
      heading,
      o.signedOn ? `${L({ de: 'Unterschrieben am', en: 'Signed on', sv: 'Underskrivet', nb: 'Signert' })}: ${dateIn(o.signedOn, lang)}` : null,
      o.startDate ? `${L({ de: 'Erster Arbeitstag', en: 'First working day', sv: 'Första arbetsdag', nb: 'Første arbeidsdag' })}: ${dateIn(o.startDate, lang)}` : null,
      ...(o.ask && o.url ? buttonLines(o.url, items, lang) : []), after,
    ),
  };
}

/** M5: Die Firma nimmt ihre Meldung „unterschrieben“ innerhalb von 24 Stunden zurück. */
export function candidateReportUndone(o: { firstName: string; companyName: string; recruiterName: string | null; url: string; lang?: Lx }): MailContent {
  const lang = o.lang;
  const L = langOf(lang);
  const heading = L({ de: 'Kurze Korrektur zu Ihrem Arbeitsvertrag', en: 'A quick correction about your employment contract', sv: 'En kort rättelse om ditt anställningsavtal', nb: 'En kort korrigering om arbeidsavtalen din' });
  const items: { label: string; a?: CandidateAnswerKey }[] = [
    { label: L({ de: 'Schon unterschrieben', en: 'Already signed', sv: 'Redan underskrivet', nb: 'Allerede signert' }), a: 'signed' },
    { label: L({ de: 'Noch nicht', en: 'Not yet', sv: 'Inte än', nb: 'Ikke ennå' }) },
  ];
  const eco = esc(o.companyName);
  const body = [
    hallo(o.firstName, lang),
    p(L({
      de: m`${eco} hat die Meldung „unterschrieben“ zurückgenommen. Wie ist der Stand bei Ihnen?`,
      en: m`${eco} has withdrawn its “signed” report. What is the status on your side?`,
      sv: m`${eco} har tagit tillbaka meddelandet ”underskrivet”. Hur ser det ut hos dig?`,
      nb: m`${eco} har trukket tilbake meldingen «signert». Hvordan står det til hos deg?`,
    })),
    buttons(o.url, items, lang),
  ].join('');
  const after = replyTo(o.recruiterName, lang);
  return { subject: heading, html: layout({ lang, preheader: o.companyName, heading, body, after: after ? esc(after) : undefined }), text: plain(heading, ...buttonLines(o.url, items, lang), after) };
}

/** An den Kunden: Der Kandidat sagt „Noch nicht da“. */
export function clientContractMissing(o: { name: string | null; candidateName: string; sentOn: string | null; profileUrl: string; lang?: Lx }): MailContent {
  const lang = o.lang;
  const L = langOf(lang);
  const first = esc(o.candidateName.split(' ')[0]);
  const heading = L({ de: m`${o.candidateName} hat den Arbeitsvertrag noch nicht erhalten`, en: m`${o.candidateName} has not received the employment contract yet`, sv: m`${o.candidateName} har inte fått anställningsavtalet ännu`, nb: m`${o.candidateName} har ikke mottatt arbeidsavtalen ennå` });
  const d = o.sentOn ? esc(dateIn(o.sentOn, lang)) : '';
  const body = [
    hallo(o.name, lang),
    p(L({
      de: m`${first} hat uns gerade gesagt: Der Arbeitsvertrag ist noch nicht angekommen.${d ? ` Laut Ihrer Angabe ist er am ${d} verschickt.` : ''}`,
      en: m`${first} has just told us: the employment contract has not arrived yet.${d ? ` According to you, it was sent on ${d}.` : ''}`,
      sv: m`${first} har just berättat för oss: anställningsavtalet har inte kommit fram ännu.${d ? ` Enligt dig skickades det ${d}.` : ''}`,
      nb: m`${first} har nettopp sagt til oss: arbeidsavtalen har ikke kommet fram ennå.${d ? ` Ifølge deg ble den sendt ${d}.` : ''}`,
    })),
    p(muted(L({ de: 'Bitte prüfen und erneut schicken, oder digital über Matchunt. Matchunt sagt dem Kandidaten Bescheid, sobald der Vertrag wieder unterwegs ist.', en: 'Please check and send it again, or digitally via Matchunt. Matchunt will let the candidate know once the contract is on its way again.', sv: 'Kontrollera och skicka det igen, eller digitalt via Matchunt. Matchunt meddelar kandidaten så snart avtalet är på väg igen.', nb: 'Sjekk og send den på nytt, eller digitalt via Matchunt. Matchunt gir kandidaten beskjed så snart avtalen er på vei igjen.' }))),
  ].join('');
  const url = `${o.profileUrl}?vertrag=verschickt`;
  return { subject: heading, html: layout({ lang, preheader: L({ de: 'Bitte erneut schicken', en: 'Please send again', sv: 'Skicka igen', nb: 'Send på nytt' }), heading, body, cta: { label: L({ de: 'Vertrag erneut schicken', en: 'Send contract again', sv: 'Skicka avtalet igen', nb: 'Send avtalen på nytt' }), url } }), text: plain(heading, url) };
}

// --- An Matchunt ---------------------------------------------------------------

/** Intern an Matchunt: bleibt deutsch. */
export function adminCase(o: { candidateName: string; companyName: string; recruiterName: string; reason: string; adminUrl: string }): MailContent {
  const heading = `Unterschrift klären: ${o.candidateName} · ${o.companyName}`;
  const body = [p(`${esc(o.reason)}`), p(muted(`Headhunter: ${esc(o.recruiterName)}`))].join('');
  return { subject: heading, html: layout({ preheader: 'Fall für Matchunt', heading, body, cta: { label: 'Fall öffnen', url: o.adminUrl } }), text: plain(heading, o.reason, o.adminUrl) };
}
