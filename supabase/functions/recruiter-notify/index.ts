// Headhunter benachrichtigt aus einer Aufgabe heraus den Kunden oder den
// Kandidaten – über das System, mit vorgefertigten Sätzen, ohne Direktkontakt.
//
//   client_nudge      → Benachrichtigung + Mail an das Kundenteam der Stelle,
//                       höchstens einmal in 3 Tagen je Einreichung,
//                       Kandidat erscheint vor Opt-In nur als Bewerber-Kürzel.
//                       Seit 20.10.2026 auch für mehrere Einreichungen auf einmal
//                       (`submissionIds`): je Kundenteam EINE Mail mit allen Kandidaten,
//                       je Stelle eine Benachrichtigung, je Einreichung ein Beleg.
//                       Seit 29.10.2026 mit `anlass` (review, interview_feedback, counter, contract,
//                       opt_in, rejected): Betreff, Schluss und Link je Aufgabe.
//   candidate_message → Mail an den Kandidaten im Namen des Headhunters,
//                       Antwort geht an den Headhunter.
//   job_questions     → Offene Fragen der Aufnahme an das Kundenteam einer Stelle
//                       (Briefing „Kunden fragen“, 21.10.2026). Nur mit laufender
//                       Suche, höchstens einmal in 7 Tagen je Stelle und Headhunter.
//                       Der Kunde antwortet in der Aufnahme der Stelle.
//
// Jeder Versand landet als Beleg im candidate_activity_log.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { json, preflight } from '../_shared/http.ts';
import { serviceClient } from '../_shared/intake-core.ts';
import { authUser, defaultCtx, interviewFailure, must } from '../_shared/interview-service.ts';
import { intlLocale, normLang, tr, type Lang } from '../_shared/i18n.ts';
import { candidateLanguage, clientLanguage } from '../_shared/recipient-language.ts';
import { quoteMarks, viaMatchunt } from '../_shared/mail-i18n.ts';

// Mehrsprachigkeit (13.11.2026): Der Text des Headhunters kommt aus dem Frontend schon in der
// Sprache des Empfängers. Übersetzt wird hier der Rahmen (Anrede, Einstieg, Schluss, Gruß, Knopf),
// je Empfänger nach recipient-language.ts; schickt das Frontend `lang` mit (Sprache des Textes),
// gilt diese für alle Empfänger, damit Rahmen und Text zusammenpassen. Glocke und Protokoll bleiben deutsch.
type L4 = { de: string; en: string; sv: string; nb: string };
const T = (lang: Lang, t: L4, vars?: Record<string, string | number>) => tr(lang, t, vars);

const UUID = /^[0-9a-f-]{36}$/i;
const NUDGE_COOLDOWN_MS = 3 * 86_400_000;
// Ein Zwischenstand je Erinnerung an den Kunden, höchstens alle 7 Tage (wie ZWISCHENSTAND_SPERRE_TAGE in kundePrueft.ts)
const ZWISCHENSTAND_SPERRE_MS = 7 * 86_400_000;
const QUESTIONS_COOLDOWN_MS = 7 * 86_400_000;

// Anlass der Nachricht an den Kunden (29.10.2026): Betreff, Schluss und Link passen zur Aufgabe.
// review, interview_feedback und counter sind Erinnerungen (Sperre 3 Tage, zählen als client_nudge),
// opt_in und rejected nur ein Stand an den Kunden (client_message, ohne Sperre).
type Anlass = 'review' | 'interview_feedback' | 'decision' | 'counter' | 'contract' | 'opt_in' | 'rejected';
/** Schluss und Knopf je Anlass in den anderen Sprachen (Deutsch steht in ANLAESSE). */
const ANLASS_TEXT: Record<Anlass, { closing: Omit<L4, 'de'>; link: Omit<L4, 'de'> }> = {
  review: {
    closing: { en: 'In the dashboard you can request an interview, decline or mark “Still reviewing” with one click.', sv: 'I dashboarden kan du med ett klick begära en intervju, tacka nej eller markera ”Granskas fortfarande”.', nb: 'I dashbordet kan du med ett klikk be om et intervju, takke nei eller melde «Vurderes fortsatt».' },
    link: { en: 'Open submission', sv: 'Öppna kandidatförslaget', nb: 'Åpne kandidatforslaget' },
  },
  interview_feedback: {
    closing: { en: 'In the dashboard you can give your feedback with one click: next interview, offer or rejection.', sv: 'I dashboarden ger du din återkoppling med ett klick: nästa samtal, erbjudande eller avslag.', nb: 'I dashbordet gir du tilbakemeldingen din med ett klikk: neste samtale, tilbud eller avslag.' },
    link: { en: 'Open submission', sv: 'Öppna kandidatförslaget', nb: 'Åpne kandidatforslaget' },
  },
  decision: {
    closing: { en: 'In the dashboard you decide with one click: offer, another round or rejection.', sv: 'I dashboarden bestämmer du med ett klick: erbjudande, ny omgång eller avslag.', nb: 'I dashbordet bestemmer du med ett klikk: tilbud, ny runde eller avslag.' },
    link: { en: 'Decide', sv: 'Bestäm', nb: 'Bestem' },
  },
  counter: {
    closing: { en: 'You can reply in the dashboard right next to the offer.', sv: 'Ditt svar ger du i dashboarden direkt vid erbjudandet.', nb: 'Svaret ditt gir du i dashbordet direkte ved tilbudet.' },
    link: { en: 'Answer counter-request', sv: 'Svara på motförslaget', nb: 'Svar på motforslaget' },
  },
  contract: {
    closing: { en: 'You can report the contract status in the dashboard with one click.', sv: 'Läget för avtalet anmäler du i dashboarden med ett klick.', nb: 'Status for avtalen melder du i dashbordet med ett klikk.' },
    link: { en: 'Open contract', sv: 'Öppna avtalet', nb: 'Åpne avtalen' },
  },
  opt_in: {
    closing: { en: 'You do not need to do anything else. As soon as a time is set, you will see it in the dashboard.', sv: 'Du behöver inte göra något mer. Så snart en tid är bestämd ser du den i dashboarden.', nb: 'Du trenger ikke gjøre noe mer. Så snart et tidspunkt er avtalt, ser du det i dashbordet.' },
    link: { en: 'Open submission', sv: 'Öppna kandidatförslaget', nb: 'Åpne kandidatforslaget' },
  },
  rejected: {
    closing: { en: 'Thank you for your feedback. Feel free to reply directly to this email.', sv: 'Tack för ditt besked. Svara gärna direkt på det här mejlet.', nb: 'Takk for tilbakemeldingen. Svar gjerne direkte på denne e-posten.' },
    link: { en: 'Open submission', sv: 'Öppna kandidatförslaget', nb: 'Åpne kandidatforslaget' },
  },
};
const ANLAESSE: Record<Anlass, { ask: string; closing: string; link: string; reminder: boolean; logTitle: string }> = {
  review: { ask: 'bittet um Rückmeldung zu', closing: 'Im Dashboard können Sie mit einem Klick ein Interview anfragen, absagen oder „Noch in Prüfung“ melden.', link: 'Einreichung öffnen', reminder: true, logTitle: 'Kunden erinnert' },
  interview_feedback: { ask: 'bittet um Ihren Eindruck aus dem Interview mit', closing: 'Im Dashboard geben Sie Ihr Feedback mit einem Klick: nächstes Gespräch, Angebot oder Absage.', link: 'Einreichung öffnen', reminder: true, logTitle: 'Kunden nach Interview-Eindruck gefragt' },
  decision: { ask: 'bittet um Ihre Entscheidung zu', closing: 'Im Dashboard entscheiden Sie mit einem Klick: Angebot, weitere Runde oder Absage.', link: 'Entscheiden', reminder: true, logTitle: 'Kunden um Entscheidung gebeten' },
  counter: { ask: 'bittet um Ihre Antwort auf den Gegenwunsch von', closing: 'Ihre Antwort geben Sie im Dashboard direkt beim Angebot.', link: 'Gegenwunsch beantworten', reminder: true, logTitle: 'Kunden an Gegenwunsch erinnert' },
  contract: { ask: 'bittet um Rückmeldung zum Vertrag von', closing: 'Den Stand des Vertrags melden Sie im Dashboard mit einem Klick.', link: 'Vertrag öffnen', reminder: true, logTitle: 'Kunden zum Vertrag gefragt' },
  opt_in: { ask: 'meldet sich zu Ihrer Interview-Anfrage für', closing: 'Sie müssen nichts weiter tun. Sobald ein Termin feststeht, sehen Sie ihn im Dashboard.', link: 'Einreichung öffnen', reminder: false, logTitle: 'Kunden zur Interview-Anfrage informiert' },
  rejected: { ask: 'meldet sich zu Ihrer Absage für', closing: 'Danke für Ihre Rückmeldung. Antworten Sie gern direkt auf diese Mail.', link: 'Einreichung öffnen', reminder: false, logTitle: 'Kunden nach der Absage geschrieben' },
};

const anonCode = (candidateId: string) => `PR-${String(candidateId ?? '').slice(0, 6).toUpperCase()}`;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const paragraphs = (text: string) => text.split(/\n{2,}/).map((p) => `<p style="margin:0 0 12px">${esc(p).replace(/\n/g, '<br>')}</p>`).join('');

async function loadBundle(db: any, submissionId: unknown, recruiterId: string) {
  must(typeof submissionId === 'string' && UUID.test(submissionId), 'Ungültige Einreichung.');
  const { data, error } = await db.from('submissions')
    .select('id, stage, status, identity_unlocked, company_revealed, recruiter_id, candidate_id, job_id, submitted_at, jobs!inner(id, title, company_name, client_id, organization_id), candidates!inner(id, full_name, email, phone)')
    .eq('id', submissionId).maybeSingle();
  must(!error && data, 'Einreichung nicht gefunden.', 'not_found');
  must(data.recruiter_id === recruiterId, 'Keine Berechtigung für diese Einreichung.', 'not_allowed');
  return { submission: data, job: data.jobs, candidate: data.candidates };
}

async function clientTeam(db: any, job: any): Promise<{ userId: string; email: string | null; name: string }[]> {
  const ids = new Set<string>();
  if (job.client_id) ids.add(job.client_id);
  if (job.organization_id) {
    const { data: org } = await db.from('organizations').select('owner_id').eq('id', job.organization_id).maybeSingle();
    if (org?.owner_id) ids.add(org.owner_id);
    const { data: members } = await db.from('organization_members').select('user_id, role').eq('organization_id', job.organization_id).eq('status', 'active');
    for (const m of members ?? []) if (m.role !== 'finance') ids.add(m.user_id);
  }
  if (!ids.size) return [];
  const { data: profiles } = await db.from('profiles').select('user_id, full_name, email').in('user_id', [...ids]);
  return (profiles ?? []).map((p: any) => ({ userId: p.user_id, email: p.email ? String(p.email).toLowerCase() : null, name: p.full_name || 'Kunde' }));
}

async function recruiterProfile(db: any, userId: string) {
  const { data } = await db.from('profiles').select('full_name, email, phone').eq('user_id', userId).maybeSingle();
  return { name: data?.full_name || 'Ihr Headhunter', email: data?.email ? String(data.email).toLowerCase() : null, phone: data?.phone ? String(data.phone) : null };
}

const dayMonth = (iso: string | null | undefined, lang: Lang = 'de') => (iso ? new Date(iso).toLocaleDateString(intlLocale(lang), { day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' }) : null);
const euroDe = (n: number, lang: Lang = 'de') => `${new Intl.NumberFormat(intlLocale(lang)).format(n)} €`;
const zahl = (n: number) => (['null', 'eine', 'zwei', 'drei', 'vier', 'fünf'][n] ?? String(n));

/**
 * Betreff und Einstieg der Mail an das Kundenteam in der Sprache des Headhunters (29.10.2026):
 * erst der Bezug, dann seine Bitte, dann ein freundlicher Schluss und sein Gruß.
 */
function clientWording(anlass: Anlass, o: { n: number; who: string; job: string; days: number | null; wish: string | null }, lang: Lang = 'de') {
  if (lang !== 'de' && lang !== 'de-AT' && lang !== 'de-CH') return clientWordingIn(anlass, o, lang);
  const seit = o.days === null ? '' : o.days <= 1 ? 'vor kurzem' : `vor ${o.days} Tagen`;
  const ch = (t: string) => (lang === 'de-CH' ? t.replace(/ß/g, 'ss') : t);
  const w = germanWording(anlass, o, seit);
  return { subject: ch(w.subject), intro: ch(w.intro) };
}

function germanWording(anlass: Anlass, o: { n: number; who: string; job: string; days: number | null; wish: string | null }, seit: string) {
  switch (anlass) {
    case 'review': return o.n === 1
      ? { subject: `${o.who}: Haben Sie schon eine Einschätzung?`, intro: `${seit ? `${seit} ` : ''}habe ich Ihnen ${o.who} für die Stelle ${o.job} vorgestellt.`.replace(/^./, (c) => c.toLowerCase()) }
      : { subject: `${o.n} Kandidaten warten auf Ihre Einschätzung`, intro: `ich habe Ihnen ${zahl(o.n)} Kandidaten vorgestellt, die noch auf Ihre Einschätzung warten:` };
    case 'interview_feedback': return o.n === 1
      ? { subject: `Wie war Ihr Eindruck von ${o.who}?`, intro: `danke für das Interview mit ${o.who} zur Stelle ${o.job}.` }
      : { subject: `Ihr Eindruck aus den Interviews mit ${o.n} Kandidaten?`, intro: `danke für die Interviews mit ${zahl(o.n)} Kandidaten:` };
    case 'decision': return { subject: `${o.who}: Wie möchten Sie weitermachen?`, intro: `${o.who} wartet seit einigen Tagen auf eine Rückmeldung zur Stelle ${o.job}.` };
    case 'counter': return { subject: `Gegenwunsch von ${o.who}: Ihre Rückmeldung`, intro: `ich melde mich wegen des Gegenwunsches von ${o.who} zur Stelle ${o.job}${o.wish ? `: ${o.wish}` : ''}.` };
    case 'contract': return { subject: `Arbeitsvertrag von ${o.who}: kurzer Stand?`, intro: `ich melde mich wegen des Arbeitsvertrags von ${o.who} zur Stelle ${o.job}.` };
    case 'opt_in': return { subject: `Ihre Interview-Anfrage für ${o.who}: kurzer Stand`, intro: `kurzer Stand von mir zu Ihrer Interview-Anfrage für ${o.who} (${o.job}):` };
    case 'rejected': return { subject: `Danke für Ihre Rückmeldung zu ${o.who}`, intro: `danke für Ihre Rückmeldung zu ${o.who} (${o.job}).` };
  }
}

/** Englisch, Schwedisch, Norwegisch: gleicher Aufbau, natürlich formuliert. */
function clientWordingIn(anlass: Anlass, o: { n: number; who: string; job: string; days: number | null; wish: string | null }, lang: Lang) {
  const v = { who: o.who, job: o.job, n: o.n, wish: o.wish ? `: ${o.wish}` : '' };
  const seit = o.days === null ? '' : o.days <= 1
    ? T(lang, { de: '', en: ' recently', sv: ' nyligen', nb: ' nylig' })
    : T(lang, { de: '', en: ' {d} days ago', sv: ' för {d} dagar sedan', nb: ' for {d} dager siden' }, { d: o.days });
  const x = (subject: L4, intro: L4) => ({ subject: T(lang, subject, v), intro: T(lang, intro, { ...v, seit }) });
  switch (anlass) {
    case 'review': return o.n === 1
      ? x({ de: '', en: '{who}: do you have an assessment yet?', sv: '{who}: har du hunnit bilda dig en uppfattning?', nb: '{who}: har du rukket å gjøre deg opp en mening?' },
        { de: '', en: 'I introduced {who} to you for the {job} role{seit}.', sv: 'Jag presenterade {who} för dig för tjänsten {job}{seit}.', nb: 'Jeg presenterte {who} for deg til stillingen {job}{seit}.' })
      : x({ de: '', en: '{n} candidates are waiting for your assessment', sv: '{n} kandidater väntar på din bedömning', nb: '{n} kandidater venter på din vurdering' },
        { de: '', en: 'I have introduced {n} candidates to you who are still waiting for your assessment:', sv: 'Jag har presenterat {n} kandidater för dig som fortfarande väntar på din bedömning:', nb: 'Jeg har presentert {n} kandidater for deg som fortsatt venter på din vurdering:' });
    case 'interview_feedback': return o.n === 1
      ? x({ de: '', en: 'What was your impression of {who}?', sv: 'Vad fick du för intryck av {who}?', nb: 'Hvilket inntrykk fikk du av {who}?' },
        { de: '', en: 'Thank you for the interview with {who} for the {job} role.', sv: 'Tack för intervjun med {who} för tjänsten {job}.', nb: 'Takk for intervjuet med {who} til stillingen {job}.' })
      : x({ de: '', en: 'Your impression from the interviews with {n} candidates?', sv: 'Ditt intryck från intervjuerna med {n} kandidater?', nb: 'Inntrykket ditt fra intervjuene med {n} kandidater?' },
        { de: '', en: 'Thank you for the interviews with {n} candidates:', sv: 'Tack för intervjuerna med {n} kandidater:', nb: 'Takk for intervjuene med {n} kandidater:' });
    case 'decision': return x({ de: '', en: '{who}: how would you like to proceed?', sv: '{who}: hur vill du gå vidare?', nb: '{who}: hvordan vil du gå videre?' },
      { de: '', en: '{who} has been waiting a few days for feedback on the {job} role.', sv: '{who} har väntat några dagar på besked om tjänsten {job}.', nb: '{who} har ventet noen dager på tilbakemelding om stillingen {job}.' });
    case 'counter': return x({ de: '', en: 'Counter-request from {who}: your response', sv: 'Motförslag från {who}: ditt svar', nb: 'Motforslag fra {who}: ditt svar' },
      { de: '', en: "I'm getting in touch about the counter-request from {who} for the {job} role{wish}.", sv: 'Jag hör av mig om motförslaget från {who} för tjänsten {job}{wish}.', nb: 'Jeg tar kontakt angående motforslaget fra {who} til stillingen {job}{wish}.' });
    case 'contract': return x({ de: '', en: 'Employment contract for {who}: quick update?', sv: 'Anställningsavtal för {who}: kort lägesrapport?', nb: 'Arbeidsavtale for {who}: kort status?' },
      { de: '', en: "I'm getting in touch about the employment contract for {who} for the {job} role.", sv: 'Jag hör av mig om anställningsavtalet för {who} för tjänsten {job}.', nb: 'Jeg tar kontakt angående arbeidsavtalen for {who} til stillingen {job}.' });
    case 'opt_in': return x({ de: '', en: 'Your interview request for {who}: quick update', sv: 'Din intervjuförfrågan för {who}: kort lägesrapport', nb: 'Intervjuforespørselen din for {who}: kort status' },
      { de: '', en: 'A quick update from me on your interview request for {who} ({job}):', sv: 'En kort lägesrapport från mig om din intervjuförfrågan för {who} ({job}):', nb: 'En kort status fra meg om intervjuforespørselen din for {who} ({job}):' });
    case 'rejected': return x({ de: '', en: 'Thank you for your feedback on {who}', sv: 'Tack för ditt besked om {who}', nb: 'Takk for tilbakemeldingen om {who}' },
      { de: '', en: 'Thank you for your feedback on {who} ({job}).', sv: 'Tack för ditt besked om {who} ({job}).', nb: 'Takk for tilbakemeldingen om {who} ({job}).' });
  }
}

/** Anrede, Gruß und kleine Bausteine des Rahmens. */
const frame = {
  guten: (lang: Lang, name: string) => T(lang, { de: 'Guten Tag {n},', en: 'Dear {n},', sv: 'Hej {n},', nb: 'Hei {n},' }, { n: name }),
  hallo: (lang: Lang, name: string) => T(lang, { de: 'Hallo {n},', en: 'Hi {n},', sv: 'Hej {n},', nb: 'Hei {n},' }, { n: name }),
  gruss: (lang: Lang) => T(lang, { de: 'Viele Grüße', en: 'Best regards', sv: 'Vänliga hälsningar', nb: 'Vennlig hilsen' }),
  ueber: (lang: Lang) => T(lang, { de: 'über Matchunt', en: 'via Matchunt', sv: 'via Matchunt', nb: 'via Matchunt' }),
  askBack: (lang: Lang) => T(lang, { de: 'Fehlt Ihnen noch etwas? Antworten Sie einfach auf diese Mail.', en: 'Is anything missing? Simply reply to this email.', sv: 'Saknar du något? Svara bara på det här mejlet.', nb: 'Mangler du noe? Bare svar på denne e-posten.' }),
  bewerber: (lang: Lang, code: string) => T(lang, { de: 'Bewerber {c}', en: 'Candidate {c}', sv: 'Kandidat {c}', nb: 'Kandidat {c}' }, { c: code }),
  seitBei: (lang: Lang, d: string) => T(lang, { de: 'seit {d} bei Ihnen', en: 'with you since {d}', sv: 'hos dig sedan {d}', nb: 'hos deg siden {d}' }, { d }),
};
const anlassClosing = (anlass: Anlass, lang: Lang) => T(lang, { de: ANLAESSE[anlass].closing, ...ANLASS_TEXT[anlass].closing });
const anlassLink = (anlass: Anlass, lang: Lang) => T(lang, { de: ANLAESSE[anlass].link, ...ANLASS_TEXT[anlass].link });

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    must(req.method === 'POST', 'Bitte POST verwenden.');
    const body = await req.json().catch(() => ({}));
    // Kann diese Version bündeln? Das Fenster fragt vorher, damit eine ältere
    // Version nie eine Mail je Kandidat verschickt (20.10.2026).
    if (body.action === 'ping') return json({ ok: true, bundles: true });
    const user = await authUser(req);
    const db = serviceClient();
    const ctx = defaultCtx(db);
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    must(text.length > 0 && text.length <= 2000, 'Der Text fehlt oder ist zu lang.');

    const me = await recruiterProfile(db, user.id);

    if (body.action === 'client_nudge') {
      const ids: unknown[] = Array.isArray(body.submissionIds) && body.submissionIds.length ? body.submissionIds : [body.submissionId];
      must(ids.length <= 30, 'Höchstens 30 Einreichungen auf einmal.');
      const bundles = [];
      for (const id of [...new Set(ids)]) bundles.push(await loadBundle(db, id, user.id));

      const anlass: Anlass = typeof body.anlass === 'string' && body.anlass in ANLAESSE ? body.anlass as Anlass
        : body.intent === 'interview_feedback' ? 'interview_feedback' : 'review';
      const art = ANLAESSE[anlass];

      // Sperre: Erinnerungen einmal in drei Tagen je Einreichung (ein Stand an den Kunden zählt nicht)
      let blocked = new Set<string>();
      if (art.reminder) {
        const { data: recent } = await db.from('candidate_activity_log')
          .select('related_submission_id')
          .in('related_submission_id', bundles.map((x) => x.submission.id))
          .eq('recruiter_id', user.id)
          .contains('metadata', { kind: 'client_nudge' })
          .gte('created_at', new Date(ctx.now() - NUDGE_COOLDOWN_MS).toISOString());
        blocked = new Set((recent ?? []).map((r: any) => r.related_submission_id));
      }
      const todo = bundles.filter((x) => !blocked.has(x.submission.id));
      must(todo.length > 0, 'Der Kunde wurde in den letzten drei Tagen schon erinnert.', 'not_allowed');

      const label = (x: typeof todo[number], lang: Lang = 'de') => (x.submission.identity_unlocked ? x.candidate.full_name : frame.bewerber(lang, anonCode(x.candidate.id)));
      const textLang = normLang(body.lang);
      const detailUrl = (x: typeof todo[number]) => `${ctx.appUrl()}/dashboard/candidates/${x.submission.id}`;

      // Gegenwunsch: Zahlen gleich in den Einstieg (29.10.2026)
      let wish: ((lang: Lang) => string) | null = null;
      if (anlass === 'counter') {
        const { data: o } = await db.from('offers').select('salary_offered, candidate_response').eq('submission_id', todo[0].submission.id)
          .eq('status', 'countered').order('created_at', { ascending: false }).limit(1).maybeSingle();
        const w = Number((o as any)?.candidate_response?.wish?.salary);
        if (o && w > 0) wish = (lang) => T(lang, { de: '{a} statt {b}', en: '{a} instead of {b}', sv: '{a} i stället för {b}', nb: '{a} i stedet for {b}' }, { a: euroDe(w, lang), b: euroDe((o as any).salary_offered, lang) });
      }
      const daysSince = (x: typeof todo[number]) => (x.submission.submitted_at ? Math.max(0, Math.floor((ctx.now() - Date.parse(x.submission.submitted_at)) / 86_400_000)) : null);

      // Je Kundenteam eine Mail, darin je Stelle die wartenden Kandidaten
      const byClient = new Map<string, typeof todo>();
      for (const x of todo) {
        const key = `${x.job.client_id ?? ''}|${x.job.organization_id ?? ''}`;
        byClient.set(key, [...(byClient.get(key) ?? []), x]);
      }
      let recipients = 0;
      let mails = 0;
      for (const list of byClient.values()) {
        const team = await clientTeam(db, list[0].job);
        recipients += team.length;
        const byJob = new Map<string, typeof todo>();
        for (const x of list) byJob.set(x.job.id, [...(byJob.get(x.job.id) ?? []), x]);
        for (const person of team) {
          // Sprache dieses Empfängers (oder die des Textes, wenn das Frontend sie mitschickt)
          const lang = textLang ?? await clientLanguage(db, { userId: person.userId, email: person.email });
          const words = clientWording(anlass, { n: list.length, who: label(list[0], lang), job: list[0].job.title, days: daysSince(list[0]), wish: wish ? wish(lang) : null }, lang);
          // Mehrere Kandidaten: eine Zeile je Kandidat mit Stelle und Datum, darunter der Link
          const lines = list.length > 1
            ? list.map((x) => ({ text: `${x.job.title} · ${label(x, lang)}${anlass === 'review' && x.submission.submitted_at ? ` · ${frame.seitBei(lang, String(dayMonth(x.submission.submitted_at, lang)))}` : ''}`, url: detailUrl(x) }))
            : [{ text: '', url: detailUrl(list[0]) }];
          const askBack = art.reminder ? frame.askBack(lang) : null;
          const sign = `${frame.gruss(lang)}\n${me.name}\n${frame.ueber(lang)}`;
          const closing = anlassClosing(anlass, lang);
          const linkLabel = anlassLink(anlass, lang);
          for (const jobList of byJob.values()) {
            const n = jobList.length;
            await db.from('notifications').insert({
              user_id: person.userId, type: 'recruiter_nudge',
              title: n === 1 ? clientWording(anlass, { n: 1, who: label(jobList[0]), job: jobList[0].job.title, days: null, wish: wish ? wish('de') : null }).subject : `${me.name}: ${n} Kandidaten zu ${jobList[0].job.title}`,
              message: `${jobList[0].job.title} · ${text}`,
              related_type: 'submission', related_id: jobList[0].submission.id,
            });
          }
          if (!person.email) continue;
          const bodyText = [
            frame.guten(lang, person.name),
            words.intro,
            list.length > 1 ? lines.map((l) => `• ${l.text}\n  ${l.url}`).join('\n') : `${linkLabel}: ${lines[0].url}`,
            text,
            closing,
            askBack,
            sign,
          ].filter(Boolean).join('\n\n');
          const linkHtml = (url: string) => `<a href="${url}" style="display:inline-block;margin-top:4px;padding:6px 12px;border-radius:6px;background:#111;color:#fff;text-decoration:none;font-size:14px">${esc(linkLabel)}</a>`;
          const listHtml = list.length > 1
            ? lines.map((l) => `<p style="margin:0 0 10px">• ${esc(l.text)}<br>${linkHtml(l.url)}</p>`).join('')
            : `<p style="margin:0 0 12px">${linkHtml(lines[0].url)}</p>`;
          const r = await ctx.mail({
            fromEmail: ctx.fromEmail, fromName: viaMatchunt(me.name, lang), to: person.email, replyTo: me.email ?? undefined,
            subject: words.subject,
            text: bodyText,
            html: `<div style="font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.55;color:#111">${paragraphs(`${frame.guten(lang, person.name)}\n\n${words.intro}`)}${listHtml}${paragraphs([text, closing, askBack].filter(Boolean).join('\n\n'))}${paragraphs(sign)}</div>`,
          }, { template: art.reminder ? 'recruiter_client_nudge' : 'recruiter_client_message', meta: { submission_ids: list.map((x) => x.submission.id), intent: body.intent ?? null, anlass } });
          if (r.sent) mails++;
        }
      }

      for (const x of todo) {
        await db.from('candidate_activity_log').insert({
          candidate_id: x.candidate.id, recruiter_id: user.id, activity_type: 'email',
          title: art.logTitle, description: text,
          metadata: { kind: art.reminder ? 'client_nudge' : 'client_message', anlass, intent: body.intent ?? null, hints: body.hints ?? [], recipients, mails, bundle: todo.length },
          related_submission_id: x.submission.id,
        });
      }
      return json({ ok: true, bundled: true, nudged: todo.map((x) => x.submission.id), skipped: [...blocked], recipients, mails });
    }

    if (body.action === 'job_questions') {
      must(typeof body.jobId === 'string' && UUID.test(body.jobId), 'Ungültige Stelle.');
      const fragen: string[] = Array.isArray(body.fragen)
        ? [...new Set(body.fragen.map((f: any) => (typeof f?.frage === 'string' ? f.frage.trim() : '')).filter((f: string) => f && f.length <= 200))].slice(0, 20) as string[]
        : [];
      must(fragen.length > 0, 'Bitte mindestens eine Frage auswählen.');
      // Nur wer für diese Stelle sucht, darf den Kunden fragen.
      const { data: act } = await db.from('recruiter_job_activations')
        .select('id, status').eq('job_id', body.jobId).eq('recruiter_id', user.id)
        .order('activated_at', { ascending: false }).limit(1).maybeSingle();
      must(act && act.status !== 'ended', 'Fragen an den Kunden gehen erst, wenn du für diese Stelle suchst.', 'not_allowed');
      const { data: job } = await db.from('jobs').select('id, title, client_id, organization_id').eq('id', body.jobId).maybeSingle();
      must(job, 'Stelle nicht gefunden.', 'not_found');
      const { data: recent } = await db.from('email_events').select('id')
        .eq('template_name', 'recruiter_job_questions')
        .contains('metadata', { job_id: body.jobId, recruiter_id: user.id })
        .gte('created_at', new Date(ctx.now() - QUESTIONS_COOLDOWN_MS).toISOString()).limit(1);
      must(!(recent ?? []).length, 'Du hast den Kunden in den letzten sieben Tagen schon gefragt.', 'not_allowed');

      const team = await clientTeam(db, job);
      const link = `${ctx.appUrl()}/dashboard/aufnahme/${job.id}`;
      const subjectIn = (lang: Lang) => fragen.length === 1
        ? T(lang, { de: 'Ihr Headhunter hat eine Frage zu {job}', en: 'Your headhunter has a question about {job}', sv: 'Din headhunter har en fråga om {job}', nb: 'Headhunteren din har et spørsmål om {job}' }, { job: job.title })
        : T(lang, { de: 'Ihr Headhunter hat {n} Fragen zu {job}', en: 'Your headhunter has {n} questions about {job}', sv: 'Din headhunter har {n} frågor om {job}', nb: 'Headhunteren din har {n} spørsmål om {job}' }, { n: fragen.length, job: job.title });
      const liste = fragen.map((f) => `– ${f}`).join('\n');
      const textLang = normLang(body.lang);
      let mails = 0;
      for (const person of team) {
        await db.from('notifications').insert({
          user_id: person.userId, type: 'recruiter_nudge', title: subjectIn('de'),
          message: `${text}\n${liste}`, related_type: 'job', related_id: job.id,
        });
        if (!person.email) continue;
        const lang = textLang ?? await clientLanguage(db, { userId: person.userId, email: person.email });
        const [qa, qb] = quoteMarks(lang);
        const intro = T(lang, {
          de: '{me} sucht über Matchunt für Ihre Stelle {job} und hat Fragen:',
          en: '{me} is recruiting for your {job} role via Matchunt and has some questions:',
          sv: '{me} rekryterar via Matchunt till din tjänst {job} och har några frågor:',
          nb: '{me} rekrutterer via Matchunt til stillingen din {job} og har noen spørsmål:',
        }, { me: me.name, job: `${qa}${job.title}${qb}` });
        const closing = T(lang, {
          de: 'Antworten Sie direkt in der Aufnahme der Stelle; Ihr Headhunter sieht die Angaben dann im Briefing.',
          en: 'Please answer directly in the job intake; your headhunter will then see the details in the briefing.',
          sv: 'Svara direkt i underlaget för tjänsten; din headhunter ser sedan uppgifterna i briefingen.',
          nb: 'Svar direkte i grunnlaget for stillingen; headhunteren din ser da opplysningene i briefen.',
        });
        const r = await ctx.mail({
          fromEmail: ctx.fromEmail, fromName: 'Matchunt', to: person.email, replyTo: me.email ?? undefined, subject: subjectIn(lang),
          text: `${frame.guten(lang, person.name)}\n\n${intro}\n\n${text}\n\n${liste}\n\n${closing}\n${link}`,
          html: `<div style="font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111">${paragraphs(`${frame.guten(lang, person.name)}\n\n${intro}\n\n${text}`)}`
            + `<ul style="margin:0 0 16px;padding-left:20px">${fragen.map((f) => `<li style="margin:0 0 4px">${esc(f)}</li>`).join('')}</ul>`
            + `<p style="margin:0 0 12px"><a href="${link}" style="color:#111;font-weight:600">${esc(T(lang, { de: 'Fragen in der Aufnahme beantworten', en: 'Answer the questions in the job intake', sv: 'Svara på frågorna i underlaget', nb: 'Svar på spørsmålene i grunnlaget' }))}</a></p>`
            + `<p style="margin-top:16px;color:#555">${esc(closing)}</p></div>`,
        }, { template: 'recruiter_job_questions', meta: { job_id: job.id, recruiter_id: user.id, fragen: fragen.length } });
        if (r.sent) mails++;
      }
      return json({ ok: true, recipients: team.length, mails });
    }

    if (body.action === 'candidate_message') {
      const b = await loadBundle(db, body.submissionId, user.id);
      must(!!b.candidate.email, 'Der Kandidat hat keine E-Mail-Adresse.', 'not_found');
      const first = String(b.candidate.full_name || '').trim().split(/\s+/)[0] || 'Hallo';
      // Kandidat: die Sprache des Textes, sonst die seines Headhunters
      const lang = normLang(body.lang) ?? await candidateLanguage(db, user.id);
      const subject = typeof body.subject === 'string' && body.subject.trim() ? body.subject.trim().slice(0, 120)
        : T(lang, { de: 'Kurze Rückmeldung zu {job}', en: 'A quick update on {job}', sv: 'En kort uppdatering om {job}', nb: 'En kort oppdatering om {job}' }, { job: b.job.title });
      // Zwischenstand nur einmal je Erinnerung (05.11.2026: 5× an Sven in zwei Minuten). Erst eine
      // neue Erinnerung an den Kunden macht den nächsten sinnvoll; auch gegen Doppelklick und zweiten Tab.
      if (body.kind === 'zwischenstand') {
        const { data: letzte } = await db.from('candidate_activity_log').select('created_at')
          .eq('related_submission_id', b.submission.id)
          .contains('metadata', { kind: 'candidate_message', message_kind: 'zwischenstand', sent: true })
          .gte('created_at', new Date(ctx.now() - ZWISCHENSTAND_SPERRE_MS).toISOString())
          .order('created_at', { ascending: false }).limit(1);
        const zuletzt = (letzte ?? [])[0]?.created_at as string | undefined;
        if (zuletzt) {
          const { data: neuer } = await db.from('candidate_activity_log').select('id')
            .eq('related_submission_id', b.submission.id)
            .contains('metadata', { kind: 'client_nudge' })
            .gt('created_at', zuletzt).limit(1);
          const am = new Date(zuletzt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' });
          must((neuer ?? []).length > 0, `${first} hat am ${am} schon einen Zwischenstand bekommen.`, 'not_allowed');
        }
      }
      // In Julias Ton (29.10.2026): du, Gruß mit Vornamen, darunter Name und Telefon
      const meFirst = me.name.trim().split(/\s+/)[0] || me.name;
      const bodyText = `${frame.hallo(lang, first)}\n\n${text}\n\n${frame.gruss(lang)}\n${meFirst}\n\n${me.name} · ${frame.ueber(lang)}${me.phone ? ` · ${me.phone}` : ''}`;
      const r = await ctx.mail({
        fromEmail: ctx.fromEmail, fromName: viaMatchunt(me.name, lang), to: b.candidate.email, replyTo: me.email ?? undefined,
        subject, text: bodyText,
        html: `<div style="font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111">${paragraphs(bodyText)}</div>`,
      }, { template: 'recruiter_candidate_message', meta: { submission_id: b.submission.id, kind: body.kind ?? null } });
      await db.from('candidate_activity_log').insert({
        candidate_id: b.candidate.id, recruiter_id: user.id, activity_type: 'email',
        title: `Nachricht an ${first}`, description: text,
        metadata: { kind: 'candidate_message', message_kind: body.kind ?? null, sent: r.sent, error: r.error ?? null },
        related_submission_id: b.submission.id,
      });
      must(r.sent, `Die Mail konnte nicht gesendet werden${r.error ? `: ${r.error}` : '.'}`, 'upstream_error');
      return json({ ok: true });
    }

    must(false, 'Unbekannte Aktion.');
  } catch (e) {
    return interviewFailure(e);
  }
});
