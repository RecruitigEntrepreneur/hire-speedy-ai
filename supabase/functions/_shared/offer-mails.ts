// Mailtexte rund um Empfehlung und Angebot (22.10.2026). Reine Funktionen:
// liefern Betreff, HTML und Text. Das Angebot überbringt der Headhunter, der
// Kandidat bekommt es danach schriftlich und antwortet selbst.
//
// Mehrsprachig (13.11.2026): jede Funktion nimmt `lang`, die Sprache des Empfängers
// (ohne Angabe Deutsch, wortgleich wie bisher). Die Mail an Matchunt
// (adminEinsatzAngefragt) bleibt deutsch. Der Link zur Angebotsseite trägt `?lang=`.
import { esc, layout } from './intake-mail.ts';
import type { Lang } from './i18n.ts';
import { euroIn, lang as langOf, m, quoteMarks, shortDay, withLang } from './mail-i18n.ts';

export interface MailContent { subject: string; html: string; text: string }

type Lx = Lang | null | undefined;

const p = (s: string) => `<p style="margin:0 0 12px 0;">${s}</p>`;
const muted = (s: string) => `<span style="color:#6b7280;">${s}</span>`;
const quote = (s: string, lang?: Lx) => { const [a, b] = quoteMarks(lang); return `<div style="margin:12px 0;padding:10px 14px;background:#f6f7f9;border-radius:8px;color:#374151;">${a}${esc(s)}${b}</div>`; };
const quoted = (s: string, lang?: Lx) => { const [a, b] = quoteMarks(lang); return `${a}${s}${b}`; };
const plain = (...lines: (string | false | null | undefined)[]) => lines.filter(Boolean).join('\n');
const euro = (n: number | null | undefined, lang?: Lx) => euroIn(lang, n);
/** „Mo., 09.11.“; in einem anderen Jahr mit Jahr: „Mo., 01.02.2027“ */
const day = (iso: string | null | undefined, lang?: Lx) => shortDay(iso, lang);
const hallo = (n: string | null | undefined, lang: Lx) => {
  const x = n ? ` ${n}` : '';
  return langOf(lang)({ de: m`Hallo${x},`, en: m`Hello${x},`, sv: m`Hej${x},`, nb: m`Hei${x},` });
};
const L_OPEN_OFFER = { de: 'Angebot öffnen', en: 'Open offer', sv: 'Öppna erbjudandet', nb: 'Åpne tilbudet' };
const L_OPEN_FILE = { de: 'Akte öffnen', en: 'Open candidate file', sv: 'Öppna kandidatakten', nb: 'Åpne kandidatmappen' };
const L_OPEN_PROFILE = { de: 'Bewerberprofil öffnen', en: 'Open candidate profile', sv: 'Öppna kandidatprofilen', nb: 'Åpne kandidatprofilen' };
const L_REASON = { de: 'Grund', en: 'Reason', sv: 'Anledning', nb: 'Grunn' };
const L_VIEW_ANSWER = { de: 'Angebot ansehen und antworten', en: 'View and reply to the offer', sv: 'Se erbjudandet och svara', nb: 'Se tilbudet og svar' };

export interface OfferFacts {
  salary: number;
  variable: number | null;
  startDate: string | null;
  responseDue: string | null;
  contractType: string | null;
  probationMonths: number | null;
  workModel: string | null;
  extras: string[];
}

/** Zeilen für Mail und Text: „Fixgehalt 140.000 €“ usw. Ort/Modell und Extras sind Eingaben des Kunden und bleiben, wie sie sind. */
export function offerLines(o: OfferFacts, lang?: Lx): string[] {
  const L = langOf(lang);
  const fixed = o.contractType === 'fixed_term';
  return [
    L({ de: m`Fixgehalt: ${euro(o.salary, lang)} pro Jahr`, en: m`Base salary: ${euro(o.salary, lang)} per year`, sv: m`Fast lön: ${euro(o.salary, lang)} per år`, nb: m`Fastlønn: ${euro(o.salary, lang)} per år` }),
    o.variable ? L({ de: m`Variabel bei 100 %: ${euro(o.variable, lang)}`, en: m`Variable pay at 100%: ${euro(o.variable, lang)}`, sv: m`Rörlig lön vid 100 %: ${euro(o.variable, lang)}`, nb: m`Variabel lønn ved 100 %: ${euro(o.variable, lang)}` }) : null,
    o.startDate ? L({ de: m`Erster Arbeitstag: ${day(o.startDate, lang)}`, en: m`First working day: ${day(o.startDate, lang)}`, sv: m`Första arbetsdag: ${day(o.startDate, lang)}`, nb: m`Første arbeidsdag: ${day(o.startDate, lang)}` }) : null,
    [
      fixed ? L({ de: 'befristet', en: 'fixed-term', sv: 'visstidsanställning', nb: 'midlertidig' }) : L({ de: 'unbefristet', en: 'permanent', sv: 'tillsvidareanställning', nb: 'fast' }),
      o.probationMonths ? L({ de: m`${o.probationMonths} Monate Probezeit`, en: m`${o.probationMonths}-month probation`, sv: m`${o.probationMonths} månaders provanställning`, nb: m`${o.probationMonths} måneders prøvetid` }) : null,
    ].filter(Boolean).join(' · '),
    o.workModel ? `${L({ de: 'Ort und Modell', en: 'Location and work model', sv: 'Ort och arbetsform', nb: 'Sted og arbeidsform' })}: ${o.workModel}` : null,
    o.extras.length ? `${L({ de: 'Extras', en: 'Extras', sv: 'Förmåner', nb: 'Goder' })}: ${o.extras.join(', ')}` : null,
  ].filter(Boolean) as string[];
}

const linesHtml = (lines: string[]) => p(lines.map((l) => esc(l)).join('<br>'));

// --- An den Headhunter ---------------------------------------------------------

/**
 * Angebot beim Headhunter. mailAt: wann der Kandidat es von selbst bekommt („um 17:05“, „morgen um 08:00“),
 * schon in der Sprache des Headhunters (whenLabel mit lang).
 * wishAccepted: der Kunde hat den Gegenwunsch angenommen, der Kandidat hat Version 2 schon per Mail.
 */
export function recruiterOfferReceived(o: { recruiterFirstName: string | null; candidateName: string; companyName: string; jobTitle: string; offer: OfferFacts; message: string | null; adjusted: boolean; mailAt: string | null; wishAccepted?: boolean; offerUrl: string; lang?: Lx }): MailContent {
  const lang = o.lang;
  const L = langOf(lang);
  const first = o.candidateName.split(' ')[0];
  const eFirst = esc(first);
  const eCo = esc(o.companyName);
  const eCand = `<strong>${esc(o.candidateName)}</strong>`;
  const lines = offerLines(o.offer, lang);
  if (o.wishAccepted) {
    const heading = L({ de: m`${o.companyName} nimmt den Wunsch von ${first} an`, en: m`${o.companyName} accepts ${first}'s request`, sv: m`${o.companyName} godtar önskemålet från ${first}`, nb: m`${o.companyName} godtar ønsket fra ${first}` });
    const body = [
      p(hallo(o.recruiterFirstName ? esc(o.recruiterFirstName) : null, lang)),
      p(L({
        de: m`${eCo} nimmt den Wunsch von ${eCand} an. ${eFirst} hat die neue Version gerade per Mail bekommen und kann direkt zusagen. Sag ${eFirst} kurz Bescheid.`,
        en: m`${eCo} accepts the request from ${eCand}. ${eFirst} has just received the new version by email and can accept right away. Give ${eFirst} a quick heads-up.`,
        sv: m`${eCo} godtar önskemålet från ${eCand}. ${eFirst} har just fått den nya versionen via mejl och kan tacka ja direkt. Hör av dig kort till ${eFirst}.`,
        nb: m`${eCo} godtar ønsket fra ${eCand}. ${eFirst} har nettopp fått den nye versjonen på e-post og kan takke ja med en gang. Gi ${eFirst} en kort beskjed.`,
      })),
      linesHtml(lines),
    ].join('');
    return { subject: heading, html: layout({ lang, preheader: o.jobTitle, heading, body, cta: { label: L(L_OPEN_OFFER), url: o.offerUrl } }), text: plain(heading, ...lines, o.offerUrl) };
  }
  const heading = o.adjusted
    ? L({ de: m`Angepasstes Angebot für ${o.candidateName}`, en: m`Revised offer for ${o.candidateName}`, sv: m`Justerat erbjudande till ${o.candidateName}`, nb: m`Justert tilbud til ${o.candidateName}` })
    : L({ de: m`Angebot für ${o.candidateName}`, en: m`Offer for ${o.candidateName}`, sv: m`Erbjudande till ${o.candidateName}`, nb: m`Tilbud til ${o.candidateName}` });
  const dueDay = o.offer.responseDue ? esc(day(o.offer.responseDue, lang)) : '';
  const due = dueDay ? ` bis ${dueDay}` : '';
  const at = o.mailAt ? esc(o.mailAt) : '';
  const eJob = `<strong>${esc(o.jobTitle)}</strong>`;
  const body = [
    p(hallo(o.recruiterFirstName ? esc(o.recruiterFirstName) : null, lang)),
    p(L({
      de: m`${eCo} macht ${eCand} ${o.adjusted ? 'ein angepasstes Angebot' : 'ein Angebot'} für ${eJob}. Bitte ruf ${eFirst} jetzt an.${at ? ` Spätestens ${at} bekommt ${eFirst} das Angebot von selbst per Mail und antwortet dann selbst${due || '.'}` : ''}`,
      en: m`${eCo} is making ${eCand} ${o.adjusted ? 'a revised offer' : 'an offer'} for ${eJob}. Please call ${eFirst} now.${at ? ` ${eFirst} will receive the offer by email automatically ${at} at the latest and will then reply directly${dueDay ? ` by ${dueDay}` : ''}.` : ''}`,
      sv: m`${eCo} ger ${eCand} ${o.adjusted ? 'ett justerat erbjudande' : 'ett erbjudande'} för ${eJob}. Ring ${eFirst} nu.${at ? ` Senast ${at} får ${eFirst} erbjudandet automatiskt via mejl och svarar sedan själv${dueDay ? ` senast ${dueDay}` : ''}.` : ''}`,
      nb: m`${eCo} gir ${eCand} ${o.adjusted ? 'et justert tilbud' : 'et tilbud'} for ${eJob}. Ring ${eFirst} nå.${at ? ` Senest ${at} får ${eFirst} tilbudet automatisk på e-post og svarer deretter selv${dueDay ? ` innen ${dueDay}` : ''}.` : ''}`,
    })),
    linesHtml(lines),
    o.message ? p(`${muted(L({ de: m`Nachricht von ${eCo}:`, en: m`Message from ${eCo}:`, sv: m`Meddelande från ${eCo}:`, nb: m`Melding fra ${eCo}:` }))}`) + quote(o.message, lang) : '',
  ].join('');
  return {
    subject: L({
      de: m`${heading} – bitte ${o.mailAt ? `${o.mailAt.replace(/^um /, 'bis ').replace(/^morgen um /, 'bis morgen ')} ` : ''}anrufen`,
      en: m`${heading} – please call now`,
      sv: m`${heading} – ring nu`,
      nb: m`${heading} – ring nå`,
    }),
    html: layout({ lang, preheader: o.jobTitle, heading, body, cta: { label: L(L_OPEN_OFFER), url: o.offerUrl } }),
    text: plain(heading, ...lines, o.message && `${L({ de: 'Nachricht', en: 'Message', sv: 'Meddelande', nb: 'Melding' })}: ${quoted(o.message, lang)}`, o.offerUrl),
  };
}

/** text kommt vom Aufrufer schon in der Sprache des Headhunters. */
export function recruiterOfferUpdate(o: { recruiterFirstName: string | null; candidateName: string; companyName: string; text: string; akteUrl: string; lang?: Lx }): MailContent {
  const lang = o.lang;
  const heading = `${o.companyName}: ${o.text}`;
  const body = [p(hallo(o.recruiterFirstName ? esc(o.recruiterFirstName) : null, lang)), p(`${esc(o.text)} (${esc(o.candidateName)}).`)].join('');
  return { subject: heading, html: layout({ lang, preheader: o.candidateName, heading, body, cta: { label: langOf(lang)(L_OPEN_FILE), url: o.akteUrl } }), text: plain(heading, o.akteUrl) };
}

// --- Contracting: Einsatz angefragt (Etappe 1, 11.11.2026) ------------------------
// Bis Projektauftrag und Leistungsschein in der Plattform laufen, stimmt Matchunt
// Tagessatz und Vertrag von Hand ab. Kein Angebot, kein Arbeitsvertrag.

export interface EinsatzFacts { startDate: string; months: number; daysPerWeek: number }

const einsatzZeile = (e: EinsatzFacts, lang?: Lx) => langOf(lang)({
  de: m`Beginn ${day(e.startDate, lang)} · ${e.months} Monate · ${e.daysPerWeek} Tage je Woche`,
  en: m`Start ${day(e.startDate, lang)} · ${e.months} months · ${e.daysPerWeek} days per week`,
  sv: m`Start ${day(e.startDate, lang)} · ${e.months} månader · ${e.daysPerWeek} dagar per vecka`,
  nb: m`Oppstart ${day(e.startDate, lang)} · ${e.months} måneder · ${e.daysPerWeek} dager per uke`,
});

export function recruiterEinsatzAngefragt(o: { recruiterFirstName: string | null; candidateName: string; companyName: string; jobTitle: string; einsatz: EinsatzFacts; akteUrl: string; lang?: Lx }): MailContent {
  const lang = o.lang;
  const L = langOf(lang);
  const first = o.candidateName.trim().split(/\s+/)[0];
  const heading = L({ de: m`${o.companyName} will ${o.candidateName} einsetzen`, en: m`${o.companyName} wants to engage ${o.candidateName}`, sv: m`${o.companyName} vill anlita ${o.candidateName}`, nb: m`${o.companyName} vil engasjere ${o.candidateName}` });
  const zeile = einsatzZeile(o.einsatz, lang);
  const eCand = `<b style="font-weight:600">${esc(o.candidateName)}</b>`;
  const tell = (f: string) => L({
    de: m`Sag ${f} Bescheid. Matchunt meldet sich bei dir wegen seines Tagessatzes und des Vertrags.`,
    en: m`Let ${f} know. Matchunt will get in touch with you about their day rate and the contract.`,
    sv: m`Meddela ${f}. Matchunt hör av sig till dig om dagsarvodet och avtalet.`,
    nb: m`Gi ${f} beskjed. Matchunt tar kontakt med deg om dagsraten og avtalen.`,
  });
  const body = [
    p(hallo(o.recruiterFirstName ? esc(o.recruiterFirstName) : null, lang)),
    p(L({
      de: m`${esc(o.companyName)} möchte ${eCand} als Spezialisten für ${esc(o.jobTitle)} einsetzen: ${esc(zeile)}.`,
      en: m`${esc(o.companyName)} would like to engage ${eCand} as a specialist for ${esc(o.jobTitle)}: ${esc(zeile)}.`,
      sv: m`${esc(o.companyName)} vill anlita ${eCand} som specialist för ${esc(o.jobTitle)}: ${esc(zeile)}.`,
      nb: m`${esc(o.companyName)} vil engasjere ${eCand} som spesialist for ${esc(o.jobTitle)}: ${esc(zeile)}.`,
    })),
    p(`${tell(esc(first))} ${L({ de: 'Ein Angebot über ein Gehalt gibt es bei Contracting nicht.', en: 'In contracting there is no salary offer.', sv: 'Vid konsultuppdrag lämnas inget lönebud.', nb: 'Ved konsulentoppdrag gis det ikke noe lønnstilbud.' })}`),
  ].join('');
  return {
    subject: heading,
    html: layout({ lang, preheader: zeile, heading, body, cta: { label: L(L_OPEN_FILE), url: o.akteUrl } }),
    text: plain(heading, zeile, tell(first), o.akteUrl),
  };
}

/** An Matchunt (intern): bleibt deutsch. */
export function adminEinsatzAngefragt(o: { candidateName: string; companyName: string; jobTitle: string; recruiterName: string; budget: string | null; einsatz: EinsatzFacts; url: string }): MailContent {
  const heading = `Einsatz angefragt: ${o.candidateName} bei ${o.companyName}`;
  const zeilen = [
    `${o.jobTitle} · ${einsatzZeile(o.einsatz)}`,
    o.budget ?? 'Kunde ohne Budget: Tagessatz je Einsatz abstimmen',
    `Headhunter: ${o.recruiterName}`,
  ];
  const todo = 'Von Hand: Tagessatz mit dem Headhunter abstimmen, Projektauftrag an den Kunden, Freelancer-Vertrag und Leistungsschein an den Spezialisten.';
  const body = [...zeilen.map((z) => p(esc(z))), p(muted(esc(todo)))].join('');
  return { subject: heading, html: layout({ preheader: zeilen[0], heading, body, cta: { label: 'Bewerbung öffnen', url: o.url } }), text: plain(heading, ...zeilen, todo, o.url) };
}

// --- An den Kunden ---------------------------------------------------------------

export type AnswerWay = 'accepted' | 'considering' | 'countered' | 'declined';

export function clientOfferAnswer(o: {
  name: string | null; candidateName: string; recruiterName: string; jobTitle: string; way: AnswerWay;
  until?: string | null; note?: string | null; wish?: { salary?: number | null; variable?: number | null; startDate?: string | null; other?: string | null } | null;
  reason?: string | null; profileUrl: string;
  /** Hat der Kandidat selbst geantwortet (Antwortseite, 25.10.2026)? */
  byCandidate?: boolean;
  lang?: Lx;
}): MailContent {
  const lang = o.lang;
  const L = langOf(lang);
  const first = o.candidateName.split(' ')[0];
  const until = o.until ? day(o.until, lang) : '';
  const heading = o.way === 'accepted'
    ? L({ de: m`${o.candidateName} hat zugesagt`, en: m`${o.candidateName} has accepted`, sv: m`${o.candidateName} har tackat ja`, nb: m`${o.candidateName} har takket ja` })
    : o.way === 'considering'
      ? L({ de: m`${first} überlegt noch${until ? ` bis ${until}` : ''}`, en: m`${first} is still considering${until ? ` until ${until}` : ''}`, sv: m`${first} funderar fortfarande${until ? ` till ${until}` : ''}`, nb: m`${first} vurderer fortsatt${until ? ` til ${until}` : ''}` })
      : o.way === 'countered'
        ? L({ de: m`${first} hat einen Gegenwunsch`, en: m`${first} has a counter-request`, sv: m`${first} har ett motförslag`, nb: m`${first} har et motforslag` })
        : L({ de: m`${o.candidateName} hat abgesagt`, en: m`${o.candidateName} has declined`, sv: m`${o.candidateName} har tackat nej`, nb: m`${o.candidateName} har takket nei` });
  const wishLines = o.wish ? [
    o.wish.salary ? `${L({ de: 'Fixgehalt gewünscht', en: 'Requested base salary', sv: 'Önskad fast lön', nb: 'Ønsket fastlønn' })}: ${euro(o.wish.salary, lang)}` : null,
    o.wish.variable ? `${L({ de: 'Variabel gewünscht', en: 'Requested variable pay', sv: 'Önskad rörlig lön', nb: 'Ønsket variabel lønn' })}: ${euro(o.wish.variable, lang)}` : null,
    o.wish.startDate ? `${L({ de: 'Start gewünscht', en: 'Requested start', sv: 'Önskat startdatum', nb: 'Ønsket oppstart' })}: ${day(o.wish.startDate, lang)}` : null,
    o.wish.other ? `${L({ de: 'Sonst noch', en: 'Other', sv: 'Övrigt', nb: 'Annet' })}: ${o.wish.other}` : null,
  ].filter(Boolean) as string[] : [];
  const rn = esc(o.recruiterName);
  const ef = esc(first);
  const next = o.way === 'accepted'
    ? L({ de: 'Schicken Sie jetzt den Arbeitsvertrag. Im Bewerberprofil finden Sie alle Vertragsdaten.', en: 'Please send the employment contract now. You will find all contract details in the candidate profile.', sv: 'Skicka anställningsavtalet nu. Alla avtalsuppgifter finns i kandidatprofilen.', nb: 'Send arbeidsavtalen nå. Alle avtaleopplysningene finner du i kandidatprofilen.' })
    : o.way === 'countered'
      ? L({ de: 'Im Bewerberprofil nehmen Sie den Wunsch an, machen einen eigenen Vorschlag, bleiben bei Ihrem Angebot oder sagen ab.', en: 'In the candidate profile you can accept the request, make your own proposal, stay with your offer or decline.', sv: 'I kandidatprofilen kan du godta önskemålet, lägga ett eget förslag, stå fast vid ditt erbjudande eller tacka nej.', nb: 'I kandidatprofilen kan du godta ønsket, komme med et eget forslag, holde fast ved tilbudet ditt eller takke nei.' })
      : o.way === 'considering'
        ? L({ de: m`${rn} meldet sich, sobald ${ef} entschieden hat.`, en: m`${rn} will get in touch as soon as ${ef} has decided.`, sv: m`${rn} hör av sig så snart ${ef} har bestämt sig.`, nb: m`${rn} tar kontakt så snart ${ef} har bestemt seg.` })
        : L({ de: 'Ihre anderen Bewerber finden Sie in der Bewerberliste.', en: 'You will find your other candidates in the candidate list.', sv: 'Dina övriga kandidater hittar du i kandidatlistan.', nb: 'De andre kandidatene dine finner du i kandidatlisten.' });
  const eCand = `<strong>${esc(o.candidateName)}</strong>`;
  const eJob = esc(o.jobTitle);
  const body = [
    p(hallo(o.name ? esc(o.name.split(' ')[0]) : null, lang)),
    p(o.byCandidate
      ? L({ de: m`${eCand} hat selbst auf Ihr Angebot geantwortet (${eJob}).`, en: m`${eCand} has replied to your offer directly (${eJob}).`, sv: m`${eCand} har själv svarat på ditt erbjudande (${eJob}).`, nb: m`${eCand} har selv svart på tilbudet ditt (${eJob}).` })
      : L({ de: m`${rn} hat die Antwort von ${eCand} (${eJob}) eingetragen.`, en: m`${rn} has recorded the answer from ${eCand} (${eJob}).`, sv: m`${rn} har registrerat svaret från ${eCand} (${eJob}).`, nb: m`${rn} har registrert svaret fra ${eCand} (${eJob}).` })),
    wishLines.length ? linesHtml(wishLines) : '',
    o.reason ? p(`${muted(`${L(L_REASON)}:`)} ${esc(o.reason)}`) : '',
    o.note ? quote(o.note, lang) : '',
    p(next),
  ].join('');
  return { subject: heading, html: layout({ lang, preheader: o.jobTitle, heading, body, cta: { label: L(L_OPEN_PROFILE), url: o.profileUrl } }), text: plain(heading, ...wishLines, o.reason && `${L(L_REASON)}: ${o.reason}`, o.note && quoted(o.note, lang), o.profileUrl) };
}

/** Bezeichnungen und Werte der Empfehlung schreibt der Headhunter; sie bleiben, wie sie sind. */
export function clientRecommendation(o: { name: string | null; candidateName: string; recruiterName: string; jobTitle: string; intro: string | null; items: { label: string; value: string }[]; profileUrl: string; lang?: Lx }): MailContent {
  const lang = o.lang;
  const L = langOf(lang);
  const heading = L({ de: m`Empfehlung von ${o.recruiterName} zu ${o.candidateName}`, en: m`Recommendation from ${o.recruiterName} on ${o.candidateName}`, sv: m`Rekommendation från ${o.recruiterName} om ${o.candidateName}`, nb: m`Anbefaling fra ${o.recruiterName} om ${o.candidateName}` });
  const body = [
    p(hallo(o.name ? esc(o.name.split(' ')[0]) : null, lang)),
    o.intro ? quote(o.intro, lang) : '',
    p(o.items.map((i) => `${muted(`${esc(i.label)}:`)} ${esc(i.value)}`).join('<br>')),
    p(L({ de: 'Im Bewerberprofil steht die Empfehlung neben Ihrem Angebot.', en: 'In the candidate profile, the recommendation appears next to your offer.', sv: 'I kandidatprofilen visas rekommendationen bredvid ditt erbjudande.', nb: 'I kandidatprofilen står anbefalingen ved siden av tilbudet ditt.' })),
  ].join('');
  return { subject: heading, html: layout({ lang, preheader: o.jobTitle, heading, body, cta: { label: L({ de: 'Angebot machen', en: 'Make an offer', sv: 'Lämna ett erbjudande', nb: 'Gi et tilbud' }), url: o.profileUrl } }), text: plain(heading, o.intro, ...o.items.map((i) => `${i.label}: ${i.value}`), o.profileUrl) };
}


// --- An den Kandidaten (G + H, 25.10.2026) -----------------------------------------

export type CandidateMailKind = 'offer' | 'reminder' | 'confirm' | 'confirm_reminder';

/** Klaras persönliche Zeile mit Absender: die Mail selbst kommt vom Headhunter. */
const messageBlock = (companyName: string, message: string | null, lang?: Lx) =>
  (message ? p(muted(langOf(lang)({ de: m`Nachricht von ${esc(companyName)}:`, en: m`Message from ${esc(companyName)}:`, sv: m`Meddelande från ${esc(companyName)}:`, nb: m`Melding fra ${esc(companyName)}:` }))) + quote(message, lang) : '');

/**
 * Eckdaten des Angebots an den Kandidaten, Absender „<Headhunter> über Matchunt“.
 * offer = erste Mail, reminder = einmalige Erinnerung nach 24 Std.,
 * confirm = „Haben Sie zugesagt?“ nach einer Meldung des Headhunters.
 */
export function candidateOffer(o: {
  kind: CandidateMailKind; candidateName: string; recruiterName: string; companyName: string; jobTitle: string;
  offer: OfferFacts; version: number; message: string | null; url: string; reportedAt?: string | null; lang?: Lx;
}): MailContent {
  const lang = o.lang;
  const L = langOf(lang);
  const url = withLang(o.url, lang);
  const confirm = o.kind === 'confirm' || o.kind === 'confirm_reminder';
  const reminder = o.kind === 'reminder' || o.kind === 'confirm_reminder';
  const recruiterFirst = o.recruiterName.split(' ')[0];
  const rem = reminder ? L({ de: 'Erinnerung: ', en: 'Reminder: ', sv: 'Påminnelse: ', nb: 'Påminnelse: ' }) : '';
  const co = o.companyName;
  const subject = confirm
    ? L({ de: m`${rem}Haben Sie zugesagt? Ihr Angebot von ${co}`, en: m`${rem}Have you accepted? Your offer from ${co}`, sv: m`${rem}Har du tackat ja? Ditt erbjudande från ${co}`, nb: m`${rem}Har du takket ja? Tilbudet ditt fra ${co}` })
    : L({ de: m`${rem}Ihr Angebot von ${co}: ${o.jobTitle}`, en: m`${rem}Your offer from ${co}: ${o.jobTitle}`, sv: m`${rem}Ditt erbjudande från ${co}: ${o.jobTitle}`, nb: m`${rem}Tilbudet ditt fra ${co}: ${o.jobTitle}` });
  const eRn = esc(o.recruiterName);
  const eCo = esc(co);
  const ver = o.version > 1 ? o.version : 0;
  const intro = confirm
    ? L({
      de: m`${eRn} hat ${eCo} Ihre Zusage gemeldet. Bitte bestätigen Sie sie kurz, erst dann gilt sie und der Arbeitsvertrag folgt.`,
      en: m`${eRn} has told ${eCo} that you have accepted. Please confirm briefly; only then does your acceptance count and the employment contract follow.`,
      sv: m`${eRn} har meddelat ${eCo} att du tackat ja. Bekräfta det kort – först då gäller ditt ja och anställningsavtalet kommer.`,
      nb: m`${eRn} har meldt til ${eCo} at du har takket ja. Bekreft det kort – først da gjelder ja-et ditt, og arbeidsavtalen følger.`,
    })
    : reminder
      ? L({
        de: m`Sie haben noch nicht auf Ihr Angebot von ${eCo} geantwortet. Hier noch einmal die Eckdaten.`,
        en: m`You have not yet replied to your offer from ${eCo}. Here are the key terms again.`,
        sv: m`Du har ännu inte svarat på ditt erbjudande från ${eCo}. Här är villkoren igen.`,
        nb: m`Du har ennå ikke svart på tilbudet ditt fra ${eCo}. Her er hovedvilkårene igjen.`,
      })
      : L({
        de: m`wie mit ${eRn} besprochen, hier die Eckdaten Ihres Angebots von ${eCo}${ver ? ` (Version ${ver})` : ''}:`,
        en: m`As discussed with ${eRn}, here are the key terms of your offer from ${eCo}${ver ? ` (version ${ver})` : ''}:`,
        sv: m`Som du och ${eRn} har pratat om kommer här villkoren i ditt erbjudande från ${eCo}${ver ? ` (version ${ver})` : ''}:`,
        nb: m`Som avtalt med ${eRn}, her er hovedvilkårene i tilbudet ditt fra ${eCo}${ver ? ` (versjon ${ver})` : ''}:`,
      });
  const lines = offerLines(o.offer, lang);
  const dueDay = o.offer.responseDue ? day(o.offer.responseDue, lang) : '';
  const due = dueDay ? L({ de: m`Antwort bis ${dueDay}`, en: m`Reply by ${dueDay}`, sv: m`Svara senast ${dueDay}`, nb: m`Svar innen ${dueDay}` }) : null;
  const notYet = L({ de: 'Das sind die Eckdaten, noch kein Arbeitsvertrag.', en: 'These are the key terms, not yet an employment contract.', sv: 'Det här är villkoren, inte ett anställningsavtal.', nb: 'Dette er hovedvilkårene, ikke en arbeidsavtale.' });
  const body = [
    p(L({ de: m`Guten Tag ${esc(o.candidateName)},`, en: m`Dear ${esc(o.candidateName)},`, sv: m`Hej ${esc(o.candidateName)},`, nb: m`Hei ${esc(o.candidateName)},` })),
    p(intro),
    linesHtml([...lines, ...(due ? [due] : [])]),
    messageBlock(co, o.message, lang),
    p(muted(L({
      de: m`Das sind die Eckdaten, noch kein Arbeitsvertrag. Verbindlich ist erst der Arbeitsvertrag, den Sie mit ${eCo} unterschreiben.`,
      en: m`These are the key terms, not yet an employment contract. Only the employment contract you sign with ${eCo} is binding.`,
      sv: m`Det här är villkoren, inte ett anställningsavtal. Bindande är först det anställningsavtal du skriver under med ${eCo}.`,
      nb: m`Dette er hovedvilkårene, ikke en arbeidsavtale. Det er først arbeidsavtalen du signerer med ${eCo}, som er bindende.`,
    }))),
    p(L({ de: m`Fragen klären Sie mit ${esc(recruiterFirst)}: Antworten Sie einfach auf diese Mail.`, en: m`If you have questions, talk to ${esc(recruiterFirst)}: simply reply to this email.`, sv: m`Frågor tar du med ${esc(recruiterFirst)}: svara bara på det här mejlet.`, nb: m`Spørsmål tar du med ${esc(recruiterFirst)}: bare svar på denne e-posten.` })),
  ].join('');
  const cta = { label: confirm ? L({ de: 'Zusage bestätigen', en: 'Confirm acceptance', sv: 'Bekräfta ditt ja', nb: 'Bekreft ja-et' }) : L(L_VIEW_ANSWER), url };
  return {
    subject,
    html: layout({
      lang, preheader: `${co} · ${o.jobTitle}`,
      heading: confirm
        ? L({ de: 'Haben Sie zugesagt?', en: 'Have you accepted?', sv: 'Har du tackat ja?', nb: 'Har du takket ja?' })
        : L({ de: m`Ihr Angebot von ${co}`, en: m`Your offer from ${co}`, sv: m`Ditt erbjudande från ${co}`, nb: m`Tilbudet ditt fra ${co}` }),
      body, cta,
    }),
    text: plain(subject, ...lines, due, notYet, url),
  };
}

/** Kandidat: die Antwortfrist wurde verlängert, das Angebot gilt unverändert. */
export function candidateDueExtended(o: { candidateName: string; companyName: string; jobTitle: string; responseDue: string; url: string; lang?: Lx }): MailContent {
  const lang = o.lang;
  const L = langOf(lang);
  const url = withLang(o.url, lang);
  const co = o.companyName;
  const subject = L({ de: m`Neue Antwortfrist: Ihr Angebot von ${co}`, en: m`New reply deadline: your offer from ${co}`, sv: m`Ny svarsfrist: ditt erbjudande från ${co}`, nb: m`Ny svarfrist: tilbudet ditt fra ${co}` });
  const d = day(o.responseDue, lang);
  const ed = `<strong>${esc(d)}</strong>`;
  const body = [
    p(L({ de: m`Guten Tag ${esc(o.candidateName)},`, en: m`Dear ${esc(o.candidateName)},`, sv: m`Hej ${esc(o.candidateName)},`, nb: m`Hei ${esc(o.candidateName)},` })),
    p(L({
      de: m`${esc(co)} hat die Antwortfrist bis ${ed} verlängert. Das Angebot gilt unverändert.`,
      en: m`${esc(co)} has extended the reply deadline to ${ed}. The offer is unchanged.`,
      sv: m`${esc(co)} har förlängt svarsfristen till ${ed}. Erbjudandet gäller oförändrat.`,
      nb: m`${esc(co)} har forlenget svarfristen til ${ed}. Tilbudet gjelder uendret.`,
    })),
  ].join('');
  return {
    subject,
    html: layout({ lang, preheader: `${co} · ${o.jobTitle}`, heading: L({ de: 'Neue Antwortfrist', en: 'New reply deadline', sv: 'Ny svarsfrist', nb: 'Ny svarfrist' }), body, cta: { label: L(L_VIEW_ANSWER), url } }),
    text: plain(subject, L({ de: m`Antwort bis ${d}`, en: m`Reply by ${d}`, sv: m`Svara senast ${d}`, nb: m`Svar innen ${d}` }), url),
  };
}

/** Kunde: der Headhunter bittet um mehr Zeit für den Kandidaten. */
export function clientExtensionAsked(o: { name: string | null; candidateName: string; recruiterName: string; jobTitle: string; responseDue: string | null; profileUrl: string; lang?: Lx }): MailContent {
  const lang = o.lang;
  const L = langOf(lang);
  const heading = L({ de: m`${o.recruiterName} bittet um mehr Zeit für ${o.candidateName}`, en: m`${o.recruiterName} is asking for more time for ${o.candidateName}`, sv: m`${o.recruiterName} ber om mer tid för ${o.candidateName}`, nb: m`${o.recruiterName} ber om mer tid for ${o.candidateName}` });
  const rn = esc(o.recruiterName);
  const c = `<strong>${esc(o.candidateName)}</strong>`;
  const j = esc(o.jobTitle);
  const d = o.responseDue ? esc(day(o.responseDue, lang)) : '';
  const body = [
    p(hallo(o.name ? esc(o.name.split(' ')[0]) : null, lang)),
    p(L({
      de: m`${rn} bittet um eine längere Antwortfrist für Ihr Angebot an ${c} (${j}).${d ? ` Bisher gilt: Antwort bis ${d}.` : ''}`,
      en: m`${rn} is asking for a longer reply deadline for your offer to ${c} (${j}).${d ? ` Currently: reply by ${d}.` : ''}`,
      sv: m`${rn} ber om en längre svarsfrist för ditt erbjudande till ${c} (${j}).${d ? ` Just nu gäller: svar senast ${d}.` : ''}`,
      nb: m`${rn} ber om en lengre svarfrist for tilbudet ditt til ${c} (${j}).${d ? ` Nå gjelder: svar innen ${d}.` : ''}`,
    })),
    p(L({ de: 'Die Frist verlängern Sie im Bewerberprofil mit einem Klick.', en: 'You can extend the deadline in the candidate profile with one click.', sv: 'Du förlänger fristen i kandidatprofilen med ett klick.', nb: 'Du forlenger fristen i kandidatprofilen med ett klikk.' })),
  ].join('');
  return { subject: heading, html: layout({ lang, preheader: o.jobTitle, heading, body, cta: { label: L(L_OPEN_PROFILE), url: o.profileUrl } }), text: plain(heading, o.profileUrl) };
}

/** Headhunter: der Kandidat möchte sprechen (Rückruf binnen 2 Std.). until kommt schon in der Sprache des Headhunters. */
export function recruiterCallback(o: { recruiterFirstName: string | null; candidateName: string; companyName: string; topic: string | null; until: string; akteUrl: string; lang?: Lx }): MailContent {
  const lang = o.lang;
  const L = langOf(lang);
  const heading = L({ de: m`${o.candidateName} möchte mit dir sprechen`, en: m`${o.candidateName} would like to talk to you`, sv: m`${o.candidateName} vill prata med dig`, nb: m`${o.candidateName} vil snakke med deg` });
  const c = esc(o.candidateName);
  const co = esc(o.companyName);
  const u = `<strong>${esc(o.until)}</strong>`;
  const body = [
    p(hallo(o.recruiterFirstName ? esc(o.recruiterFirstName) : null, lang)),
    p(L({
      de: m`${c} möchte das Angebot von ${co} mit dir besprechen. Bitte ruf bis ${u} zurück.`,
      en: m`${c} would like to discuss the offer from ${co} with you. Please call back by ${u}.`,
      sv: m`${c} vill gå igenom erbjudandet från ${co} med dig. Ring tillbaka senast ${u}.`,
      nb: m`${c} vil gå gjennom tilbudet fra ${co} med deg. Ring tilbake innen ${u}.`,
    })),
    o.topic ? quote(o.topic, lang) : '',
    p(L({
      de: 'Einen Gegenwunsch schickst du danach im Angebot an den Kunden, mit dem Haken „sagt bei diesen Werten zu“.',
      en: 'Afterwards, send any counter-request to the client in the offer, with the box “will accept at these terms” ticked.',
      sv: 'Ett motförslag skickar du sedan till kunden i erbjudandet, med rutan ”tackar ja till dessa villkor” ikryssad.',
      nb: 'Et motforslag sender du deretter til kunden i tilbudet, med haken «takker ja til disse vilkårene».',
    })),
  ].join('');
  return {
    subject: heading,
    html: layout({ lang, preheader: o.companyName, heading, body, cta: { label: L(L_OPEN_OFFER), url: o.akteUrl } }),
    text: plain(heading, o.topic && quoted(o.topic, lang), `${L({ de: 'Rückruf bis', en: 'Call back by', sv: 'Ring tillbaka senast', nb: 'Ring tilbake innen' })} ${o.until}`, o.akteUrl),
  };
}
