// Kunden-Aufgaben (23.10.2026): Ableitung aus dem Stand – jede Art entsteht im richtigen
// Moment, verschwindet mit der Handlung und verwaist nicht.
import { budgetChip, deriveClientTasks, noticeLabel, wishBand, type ClientTaskInput } from '../functions/_shared/client-tasks.ts';

const eq = (a: unknown, b: unknown, m = '') => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m} erwartet ${JSON.stringify(b)}, war ${JSON.stringify(a)}`); };
const assert = (v: unknown, m = 'Assertion failed') => { if (!v) throw new Error(m); };

const NOW = Date.parse('2026-10-23T12:00:00Z');
const ago = (days: number, hours = 0) => new Date(NOW - days * 86400000 - hours * 3600000).toISOString();
const ahead = (days: number) => new Date(NOW + days * 86400000).toISOString();
const JOB = 'j0000000-0000-4000-8000-000000000001';
const REC = 'r0000000-0000-4000-8000-000000000001';

let n = 0;
const id = (p: string) => `${p}${String(++n).padStart(7, '0')}-0000-4000-8000-000000000000`;

function sub(extra: Record<string, unknown> = {}) {
  const sid = id('s');
  const cid = id('c');
  return { sub: { id: sid, job_id: JOB, candidate_id: cid, recruiter_id: REC, stage: 'submitted', status: 'submitted', submitted_at: ago(3), identity_unlocked: true, ...extra }, cand: { id: cid, full_name: 'Tessa Testfall' } };
}

function input(parts: Partial<ClientTaskInput> & { subs?: ReturnType<typeof sub>[] }): ClientTaskInput {
  const subs = parts.subs ?? [];
  return {
    ...parts,
    now: NOW,
    jobs: parts.jobs ?? [{ id: JOB, title: 'Sales Manager DACH', status: 'published' }],
    submissions: subs.map((x) => x.sub), candidates: subs.map((x) => x.cand),
    recruiters: parts.recruiters ?? [{ user_id: REC, full_name: 'Marko Benko' }],
    interviews: parts.interviews ?? [], offers: parts.offers ?? [], recommendations: parts.recommendations ?? [],
    contracts: parts.contracts ?? [], placements: parts.placements ?? [], invoices: parts.invoices ?? [],
    questions: parts.questions ?? [], messages: parts.messages ?? [], log: parts.log ?? [],
  };
}

const kinds = (r: ReturnType<typeof deriveClientTasks>) => r.tasks.map((x) => x.kind);

Deno.test('Kandidat prüfen: neu eingereicht, rot nach 2 Tagen; Name nur mit Freigabe', () => {
  const a = sub();
  const b = sub({ identity_unlocked: false, submitted_at: ago(0, 5) });
  const r = deriveClientTasks(input({ subs: [a, b] }));
  eq(kinds(r), ['review', 'review']);
  eq(r.tasks[0].who, 'Tessa Testfall', 'freigegeben');
  assert(r.tasks[0].urgent && !r.tasks[1].urgent, 'älter als 2 Tage zuerst und rot');
  assert(/^PR-[0-9A-Z]{6}$/.test(r.tasks[1].who), r.tasks[1].who);
});

Deno.test('Interviews: andere Zeit, abgelaufene Anfrage, laufende Anfrage wartet auf den Kandidaten', () => {
  const a = sub(), b = sub(), c = sub();
  const r = deriveClientTasks(input({
    subs: [a, b, c],
    interviews: [
      { id: id('i'), submission_id: a.sub.id, status: 'counter_proposed', created_at: ago(2), updated_at: ago(1), counter_slots: [{ datetime: ahead(5) }] },
      { id: id('i'), submission_id: b.sub.id, status: 'pending_response', created_at: ago(10), proposed_slots: [{ datetime: ago(3) }] },
      { id: id('i'), submission_id: c.sub.id, status: 'pending_response', created_at: ago(1), proposed_slots: [{ datetime: ahead(3) }] },
    ],
  }));
  eq(kinds(r).sort(), ['alternative', 'expired_request']);
  assert(r.tasks.find((x) => x.kind === 'alternative')!.urgent, 'Kandidat wartet');
  eq(r.waiting.map((w) => w.by), ['candidate']);
});

Deno.test('Feedback: erst nach Beginn, verschwindet mit dem Weg; unsicher nach 3 Tagen, Angebot mit Empfehlung', () => {
  const a = sub(), b = sub(), c = sub(), d = sub(), e = sub();
  const fb = (way: string, at: string) => JSON.stringify({ recommendation: way, submitted_at: at, concerns: way === 'unsure' ? 'Führungserfahrung?' : '' });
  const r = deriveClientTasks(input({
    subs: [a, b, c, d, e],
    interviews: [
      { id: id('i'), submission_id: a.sub.id, status: 'scheduled', scheduled_at: ago(0, 3), duration_minutes: 60, created_at: ago(5) },
      { id: id('i'), submission_id: b.sub.id, status: 'scheduled', scheduled_at: ahead(2), duration_minutes: 60, created_at: ago(1) },
      { id: id('i'), submission_id: c.sub.id, status: 'completed', scheduled_at: ago(5), duration_minutes: 60, created_at: ago(8), feedback: fb('unsure', ago(4)) },
      { id: id('i'), submission_id: d.sub.id, status: 'completed', scheduled_at: ago(2), duration_minutes: 60, created_at: ago(6), feedback: fb('offer', ago(1)) },
      { id: id('i'), submission_id: e.sub.id, status: 'completed', scheduled_at: ago(2), duration_minutes: 60, created_at: ago(6), feedback: fb('offer', ago(1)) },
    ],
    recommendations: [{ id: id('o'), submission_id: d.sub.id, created_at: ago(0, 2) }],
  }));
  eq(kinds(r).sort(), ['decide_unsure', 'feedback', 'make_offer']);
  assert(r.tasks.find((x) => x.kind === 'decide_unsure')!.detail.includes('Führungserfahrung'), 'Grund der Unsicherheit');
  assert(r.waiting.some((w) => w.title.includes('schreibt die Empfehlung')), 'ohne Empfehlung: Headhunter dran');
  assert(r.waiting.some((w) => w.by === 'date'), 'künftiger Termin');
});

Deno.test('Angebot: Gegenwunsch, Frist vorbei, sonst Headhunter dran; abgelehntes Angebot erzeugt nichts Neues', () => {
  const a = sub(), b = sub(), c = sub(), d = sub();
  const r = deriveClientTasks(input({
    subs: [a, b, c, d],
    offers: [
      { id: id('o'), submission_id: a.sub.id, status: 'countered', created_at: ago(3), counter_offer_at: ago(1), candidate_response: { wish: { salary: 90000, startDate: '2027-03-01' } } },
      { id: id('o'), submission_id: b.sub.id, status: 'considering', created_at: ago(9), response_due: '2026-10-20', candidate_response: { until: '2026-10-21' } },
      { id: id('o'), submission_id: c.sub.id, status: 'with_recruiter', created_at: ago(1), response_due: '2026-10-30' },
      { id: id('o'), submission_id: d.sub.id, status: 'declined', created_at: ago(4) },
    ],
  }));
  eq(kinds(r).sort(), ['counter', 'offer_overdue']);
  assert(r.tasks.find((x) => x.kind === 'counter')!.detail.includes('90.000 €'), 'Wunsch im Detail');
  eq(r.waiting.map((w) => w.key.split(':')[0]), ['offer-wait']);
});

Deno.test('Vertrag: schicken, selbst verschickt erst nach 7 Tagen, DocuSign Firma zuerst, gemeldet bestätigen', () => {
  const a = sub(), b = sub(), c = sub(), d = sub(), e = sub();
  const r = deriveClientTasks(input({
    subs: [a, b, c, d, e],
    contracts: [
      { id: id('k'), submission_id: a.sub.id, status: 'preparing', created_at: ago(2), salary: 85000, variable_salary: 15000, start_date: '2027-02-01' },
      { id: id('k'), submission_id: b.sub.id, status: 'sent_self', sent_at: ago(8), created_at: ago(9) },
      { id: id('k'), submission_id: c.sub.id, status: 'sent_self', sent_at: ago(2), created_at: ago(3) },
      { id: id('k'), submission_id: d.sub.id, status: 'sent_digital', sent_at: ago(1), created_at: ago(2), company_signer_name: 'Marko Benko' },
      { id: id('k'), submission_id: e.sub.id, status: 'reported', reported_at: ago(1), reported_role: 'recruiter', signed_on: '2026-10-22', created_at: ago(3) },
    ],
  }));
  eq(kinds(r).sort(), ['confirm_signature', 'contract_signed_check', 'docusign_sign', 'send_contract']);
  assert(r.tasks.find((x) => x.kind === 'send_contract')!.detail.includes('85.000 € + 15.000 €'), 'Werte der Zusage');
  eq(r.waiting.length, 1, 'selbst verschickt, noch keine 7 Tage');
});

Deno.test('Nach der Einstellung: Antritt ab dem ersten Tag, vorher Termin; Nichtantritt geht an Matchunt', () => {
  const a = sub({ stage: 'placed' }), b = sub({ stage: 'placed' }), c = sub({ stage: 'placed' });
  const r = deriveClientTasks(input({
    subs: [a, b, c],
    placements: [
      { id: id('p'), submission_id: a.sub.id, placement_state: 'agreed', first_working_day: '2026-10-20' },
      { id: id('p'), submission_id: b.sub.id, placement_state: 'agreed', first_working_day: '2027-02-01' },
      { id: id('p'), submission_id: c.sub.id, placement_state: 'agreed', first_working_day: '2026-10-01', non_start_reported_at: ago(5) },
    ],
  }));
  eq(kinds(r), ['confirm_start']);
  assert(r.tasks[0].urgent, 'mehr als 3 Tage nach Start: rot');
  eq(r.waiting.map((w) => w.by).sort(), ['date', 'matchunt']);
});

Deno.test('Rechnung: nur gestellt und offen; „ist überwiesen“ wartet auf Matchunt', () => {
  const r = deriveClientTasks(input({
    invoices: [
      { id: id('v'), job_id: JOB, status: 'open', released_at: ago(2), issued_at: ago(2), due_date: '2026-11-06', invoice_number: 'RE-2026-0042', total_amount_cents: 2380000 },
      { id: id('v'), job_id: JOB, status: 'open', released_at: ago(2), issued_at: ago(2), due_date: '2026-10-24', invoice_number: 'RE-2026-0043', total_amount_cents: 100, client_paid_reported_at: ago(0, 1), client_paid_reported_on: '2026-10-23' },
      { id: id('v'), job_id: JOB, status: 'paid', released_at: ago(20), invoice_number: 'RE-2026-0001' },
    ],
  }));
  eq(kinds(r), ['invoice']);
  assert(r.tasks[0].title.includes('23.800,00 €'), r.tasks[0].title);
  eq(r.waiting.map((w) => w.by), ['matchunt']);
});

Deno.test('Frage vom Headhunter: Fragenliste, nach Antwort (Protokoll) weg; geschlossene Stelle ohne Aufgaben', () => {
  const qid = id('q');
  const q = { id: qid, title: 'Ihr Headhunter hat 2 Fragen zu Sales Manager DACH', message: 'Kurz zwei Punkte\n– Geht Homeoffice 3 Tage?\n– Gibt es einen Dienstwagen?', related_id: JOB, created_at: ago(3) };
  const r = deriveClientTasks(input({ questions: [q] }));
  eq(kinds(r), ['recruiter_question']);
  eq(r.tasks[0].ref.questions, ['Geht Homeoffice 3 Tage?', 'Gibt es einen Dienstwagen?']);
  eq(deriveClientTasks(input({ questions: [q], log: [{ task_key: `question:${qid}` }] })).tasks.length, 0, 'beantwortet');

  const closed = deriveClientTasks(input({ subs: [sub()], jobs: [{ id: JOB, title: 'X', status: 'closed' }] }));
  eq(closed.tasks.length, 0, 'Stelle geschlossen');
});

Deno.test('Offene Frage an den Headhunter: Aufgabe bleibt, mit Vermerk; Antwort des Headhunters hebt ihn auf', () => {
  const a = sub();
  const msgs = [{ id: id('m'), job_id: JOB, candidate_id: a.cand.id, sender_id: 'kunde-0000-0000-0000-000000000001', created_at: ago(1) }];
  const r = deriveClientTasks(input({ subs: [a], messages: msgs }));
  eq(kinds(r), ['review']);
  assert(r.tasks[0].note?.includes('Frage an Marko'), String(r.tasks[0].note));
  const answered = deriveClientTasks(input({ subs: [a], messages: [...msgs, { id: id('m'), job_id: JOB, candidate_id: a.cand.id, sender_id: REC, created_at: ago(0, 2) }] }));
  eq(answered.tasks[0].note, null);
});

// ---------------------------------------------------------------- Entscheidungshilfe (23.10.2026)

const JOB_B = { id: JOB, title: 'Sales Manager DACH', status: 'published', salary_min: 75000, salary_max: 90000 };
const PROFIL = { job_title: 'Sales Manager', seniority: 'senior', experience_years: 8, city: 'München', expected_salary: 87000, notice_period: '3_months', skills: ['B2B SaaS', 'Neukunden', 'Salesforce', 'HubSpot', 'MEDDIC'], remote_preference: 'hybrid' };

Deno.test('Kurzprofil: ohne Freigabe nur Bänder (Region, Erfahrung, Gehalt), nie Name oder Stadt', () => {
  const a = sub({ identity_unlocked: false, recruiter_notes: 'Will ein eigenes Gebiet aufbauen.' });
  a.cand = { ...a.cand, ...PROFIL } as any;
  const b = sub();
  const r = deriveClientTasks(input({ subs: [a, b], jobs: [JOB_B], interviews: [{ id: id('i'), submission_id: b.sub.id, status: 'scheduled', scheduled_at: ahead(2), created_at: ago(1) }], recruiters: [{ user_id: REC, full_name: 'Julia Hartmann' }] }));
  const ctx = r.tasks.find((x) => x.kind === 'review')!.context!;
  const all = JSON.stringify(ctx);
  assert(!/Tessa|München|8 J\./.test(all), `verrät Identität: ${all}`);
  assert(/Süddeutschland/.test(all) && /6–10 Jahre/.test(all) && /80–90 T€/.test(all), all);
  eq(ctx.chip, { text: 'im Budget', tone: 'good' }, 'Band 80–90 bei Obergrenze 90');
  assert(/^Wollen Sie PR-[0-9A-Z]{6} kennenlernen\?$/.test(ctx.ask!), ctx.ask!);
  eq(ctx.quote, { by: 'Julia Hartmann', text: 'Will ein eigenes Gebiet aufbauen.' });
  assert(/3 Monate Kündigungsfrist/.test(all) && !/3_months/.test(all), 'Kündigungsfrist lesbar');
  eq(ctx.why, 'Außerdem für diese Stelle: 1 Kandidat · 1 im Interview – andere sind schon weiter');
});

Deno.test('Kurzprofil: nach Freigabe Stadt und Jahre; Budget-Etikett nur mit Obergrenze', () => {
  const a = sub();
  a.cand = { ...a.cand, ...PROFIL } as any;
  const ctx = deriveClientTasks(input({ subs: [a], jobs: [JOB_B] })).tasks[0].context!;
  assert(/München/.test(JSON.stringify(ctx)) && /8 J\. Erfahrung/.test(JSON.stringify(ctx)), JSON.stringify(ctx.facts));
  eq(ctx.ask, 'Wollen Sie Tessa kennenlernen?');
  eq(ctx.why, 'Bisher der einzige Kandidat für diese Stelle');
  const ohne = deriveClientTasks(input({ subs: [a] })).tasks[0].context!;
  eq(ohne.chip, null, 'Stelle ohne Gehaltsrahmen');
  eq(budgetChip(wishBand({ expected_salary: 104000 }), JOB_B), { text: 'über Budget', tone: 'bad' });
  eq(budgetChip(wishBand({ expected_salary: 95000 }), JOB_B), { text: 'am oberen Rand', tone: 'warn' }, 'Band 90–100 berührt die Obergrenze');
  eq(budgetChip(wishBand({ expected_salary: 91000 }), { salary_max: 95000 }), { text: 'am oberen Rand', tone: 'warn' });
  eq(noticeLabel('3_months_eoq'), '3 Monate zum Quartalsende');
  eq(noticeLabel('4_weeks'), '4 Wochen');
});

Deno.test('Gegenwunsch: Angebot | Wunsch | Rahmen, Begründung des Headhunters, Honorar beim Wunsch', () => {
  const a = sub();
  const r = deriveClientTasks(input({
    subs: [a], jobs: [JOB_B], feePct: { [JOB]: 20 },
    offers: [{ id: id('o'), submission_id: a.sub.id, status: 'countered', created_at: ago(2), counter_offer_at: ago(0, 3), salary_offered: 85000, variable_salary: 15000, start_date: '2027-02-01', response_due: '2026-10-30', version: 1,
      candidate_response: { wish: { salary: 90000, startDate: '2027-03-01' }, reason: 'Kündigungsfrist 3 Monate' } }],
  }));
  const ctx = r.tasks[0].context!;
  eq(ctx.compare!.heads, ['Ihr Angebot', 'Tessas Wunsch', 'Rahmen Stelle']);
  eq(ctx.compare!.rows.filter((x) => x.changed).map((x) => x.label), ['Fixgehalt', 'Start']);
  eq(ctx.quote, { by: 'Marko Benko', text: 'Kündigungsfrist 3 Monate' });
  eq(ctx.why, 'Honorar beim Wunsch: 21.000 € statt 20.000 € zzgl. USt. (20 % vom Zielgehalt)');
  eq(ctx.chip, { text: 'im Budget', tone: 'good' });
});

Deno.test('Frage vom Headhunter: Absender aus dem Mail-Protokoll, Antwort geht an alle Suchenden', () => {
  const qid = id('q');
  const R2 = 'r0000000-0000-4000-8000-000000000002';
  const q = { id: qid, type: 'recruiter_job_questions', title: 'Ihr Headhunter hat 2 Fragen', message: 'Kurz zwei Punkte:\n– Dienstwagen?\n– Reisetage?', related_id: JOB, created_at: ago(1) };
  const r = deriveClientTasks(input({
    questions: [q], questionSenders: { [qid]: R2 },
    recruiters: [{ user_id: REC, full_name: 'Marko Benko' }, { user_id: R2, full_name: 'Julia Hartmann', company_name: 'Hartmann Executive Search' }],
    activations: [{ job_id: JOB, recruiter_id: REC, status: 'active', activated_at: ago(5) }, { job_id: JOB, recruiter_id: R2, status: 'active', activated_at: ago(2) }],
    partners: [{ user_id: R2, tier: 'gold', ended_at: null }],
  }));
  const ctx = r.tasks[0].context!;
  eq(ctx.ask, 'Julia Hartmann fragt zu Sales Manager DACH');
  eq(ctx.quote, { by: 'Julia Hartmann', text: 'Kurz zwei Punkte' });
  assert(/^Hartmann Executive Search · Gold Partner · sucht seit .+ · 0 Kandidaten eingereicht$/.test(ctx.why!), ctx.why!);
  eq(ctx.foot, 'Ihre Antwort geht an alle 2 Headhunter, die für diese Stelle suchen.');
  eq(r.tasks[0].waitingWho, 'Julia Hartmann');
});

Deno.test('Rechnung: netto, USt., brutto, Fälligkeit; ohne Bankdaten Verweis auf die Rechnung', () => {
  const r = deriveClientTasks(input({
    invoices: [{ id: id('v'), status: 'open', released_at: ago(1), issued_at: ago(1), job_id: JOB, invoice_number: 'RE-2026-0042', amount_cents: 2000000, tax_amount_cents: 380000, total_amount_cents: 2380000, vat_rate: 19, due_date: '2026-10-25' }],
  }));
  const f = Object.fromEntries(r.tasks[0].context!.facts.map((x) => [x.label, x.value]));
  eq(f['Honorar'], '20.000,00 € netto');
  eq(f['USt. 19 %'], '3.800,00 €');
  eq(f['Gesamt'], '23.800,00 € · fällig 25.10.2026');
  eq(f['Verwendungszweck'], 'RE-2026-0042');
  eq(r.tasks[0].context!.chip, { text: 'in 2 Tagen', tone: 'warn' });
});
