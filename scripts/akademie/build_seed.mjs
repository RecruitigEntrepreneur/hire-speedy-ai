// Prüft die Inhalts-JSONs (modul-1..8.json) und erzeugt die Seed-Migration der Ausbildung.
// Aufruf: node scripts/akademie/build_seed.mjs scripts/akademie/inhalte supabase/migrations/<neuer-zeitstempel>_academy_ausbildung_inhalte.sql
// Feste IDs + ON CONFLICT DO NOTHING: Eine neue Migration fügt nur Neues hinzu. Geänderte Texte bereits
// eingespielter Fragen brauchen ein eigenes UPDATE (oder den Fragenpool im Admin).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const [dir, out] = process.argv.slice(2);
if (!dir || !out) { console.error('Aufruf: node build_seed.mjs <ordner> <ziel.sql>'); process.exit(1); }

const uuid = (key) => {
  const h = createHash('md5').update('matchunt-akademie/' + key).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const q = (s) => (s === null || s === undefined ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);
const j = (v) => `${q(JSON.stringify(v))}::jsonb`;

const errors = [];
const warn = [];
const modules = [];
for (let n = 1; n <= 8; n++) {
  const f = join(dir, `modul-${n}.json`);
  if (!existsSync(f)) { errors.push(`fehlt: modul-${n}.json`); continue; }
  let m;
  try { m = JSON.parse(readFileSync(f, 'utf8')); } catch (e) { errors.push(`modul-${n}.json kein JSON: ${e.message}`); continue; }
  if (m.sort !== n) warn.push(`modul-${n}: sort=${m.sort}, wird auf ${n} gesetzt`);
  m.sort = n;
  if (!m.title || !m.description) errors.push(`modul-${n}: title/description fehlt`);
  if (!Array.isArray(m.lessons) || m.lessons.length !== 3) errors.push(`modul-${n}: ${m.lessons?.length} Themen statt 3`);
  (m.lessons ?? []).forEach((l, li) => {
    const tag = `modul-${n}/thema-${li + 1}`;
    if (!l.title || !l.body || !l.learning_goal) errors.push(`${tag}: title/body/learning_goal fehlt`);
    const words = (l.body ?? '').split(/\s+/).filter(Boolean).length;
    if (words < 250) warn.push(`${tag}: Lerntext nur ${words} Wörter`);
    if (!Array.isArray(l.questions) || l.questions.length < 5) errors.push(`${tag}: nur ${l.questions?.length} Fragen`);
    (l.questions ?? []).forEach((x, qi) => {
      const t = `${tag}/frage-${qi + 1}`;
      if (!x.prompt || !x.explanation) errors.push(`${t}: prompt/explanation fehlt`);
      if (x.type === 'single' || x.type === 'multi') {
        const ids = (x.options ?? []).map((o) => o.id);
        if (ids.length < 2 || new Set(ids).size !== ids.length) errors.push(`${t}: Optionen ungültig`);
        const c = x.type === 'single' ? [x.correct] : x.correct;
        if (!Array.isArray(c) || !c.length || c.some((id) => !ids.includes(id))) errors.push(`${t}: correct passt nicht zu den Optionen`);
        if (x.type === 'single' && typeof x.correct !== 'string') errors.push(`${t}: single braucht correct als Text`);
      } else if (x.type === 'order') {
        const ids = (x.items ?? []).map((o) => o.id);
        if (ids.length < 3 || new Set(ids).size !== ids.length) errors.push(`${t}: order braucht ≥3 eindeutige Schritte`);
      } else if (x.type === 'match') {
        if (!Array.isArray(x.pairs) || x.pairs.length < 2 || x.pairs.some((p) => !p.left || !p.right)) errors.push(`${t}: match braucht ≥2 vollständige Paare`);
        const rights = (x.pairs ?? []).map((p) => p.right);
        if (new Set(rights).size !== rights.length) errors.push(`${t}: rechte Seite doppelt`);
      } else errors.push(`${t}: unbekannter Typ ${x.type}`);
    });
  });
  modules.push(m);
}

if (errors.length) { console.error('FEHLER:\n' + errors.join('\n')); process.exit(2); }

const course = uuid('course/ausbildung');
const sql = [];
sql.push(`-- ============================================================================
-- Matchunt Akademie — Inhalte der Ausbildung (8 Module, 24 Themen, Fragenpool)
-- Erzeugt aus den Inhalts-Dateien; feste IDs, erneutes Ausführen ändert nichts.
-- Setzt 20261022120000_academy_ausbildung.sql voraus.
-- ============================================================================
`);
sql.push(`INSERT INTO public.academy_courses (id, slug, title, description, level, is_premium, published, sort_order) VALUES
  (${q(course)}, 'ausbildung', 'Ausbildung zum Headhunter',
   ${q('Acht Module vom Spielfeld bis zur Selbstständigkeit: lernen, abfragen, testen. Wer am Ende die Zulassung besteht, arbeitet an echten Stellen auf Matchunt.')},
   'beginner', false, true, 0)
ON CONFLICT (id) DO NOTHING;
`);

let questionCount = 0;
for (const m of modules) {
  const mid = uuid(`module/${m.sort}`);
  sql.push(`\n-- Modul ${m.sort}: ${m.title}`);
  sql.push(`INSERT INTO public.academy_modules (id, course_id, title, sort_order, description, test_question_count, test_pass_pct, test_retry_minutes) VALUES
  (${q(mid)}, ${q(course)}, ${q(m.title)}, ${m.sort}, ${q(m.description)}, ${m.test_question_count ?? 15}, ${m.test_pass_pct ?? 80}, 120)
ON CONFLICT (id) DO NOTHING;`);
  m.lessons.forEach((l, li) => {
    const lid = uuid(`lesson/${m.sort}/${li + 1}`);
    sql.push(`INSERT INTO public.academy_lessons (id, module_id, title, content_type, body, duration_min, is_premium, sort_order, learning_goal, vorlage_title, vorlage_body, quiz_question_count) VALUES
  (${q(lid)}, ${q(mid)}, ${q(l.title)}, 'text', ${q(l.body)}, ${Number(l.duration_min) || 8}, false, ${li + 1}, ${q(l.learning_goal)}, ${q(l.vorlage_title ?? null)}, ${q(l.vorlage_body ?? null)}, 5)
ON CONFLICT (id) DO NOTHING;`);
    l.questions.forEach((x, qi) => {
      const qid = uuid(`question/${m.sort}/${li + 1}/${qi + 1}`);
      // Reihenfolge/Zuordnen: Kennungen ohne Muster, sonst verrät die Kennung die Lösung.
      const oid = (k) => createHash('md5').update(`matchunt-akademie/opt/${qid}/${k}`).digest('hex').slice(0, 8);
      let options; let correct;
      if (x.type === 'single' || x.type === 'multi') { options = x.options; correct = x.correct; }
      else if (x.type === 'order') {
        options = x.items.map((it, i) => ({ id: oid(`s${i}`), text: it.text }));
        correct = options.map((o) => o.id);
      } else {
        const left = x.pairs.map((p, i) => ({ id: oid(`l${i}`), text: p.left }));
        const right = x.pairs.map((p, i) => ({ id: oid(`r${i}`), text: p.right }));
        options = { left, right };
        correct = Object.fromEntries(left.map((l, i) => [l.id, right[i].id]));
      }
      sql.push(`INSERT INTO public.academy_questions (id, lesson_id, type, case_text, prompt, options, sort_order) VALUES (${q(qid)}, ${q(lid)}, ${q(x.type)}, ${q(x.case || null)}, ${q(x.prompt)}, ${j(options)}, ${qi + 1}) ON CONFLICT (id) DO NOTHING;`);
      sql.push(`INSERT INTO public.academy_question_keys (question_id, correct, explanation) VALUES (${q(qid)}, ${j(correct)}, ${q(x.explanation)}) ON CONFLICT (question_id) DO NOTHING;`);
      questionCount++;
    });
  });
}
writeFileSync(out, sql.join('\n') + '\n');
console.log(`OK: ${modules.length} Module, ${modules.reduce((s, m) => s + m.lessons.length, 0)} Themen, ${questionCount} Fragen → ${out}`);
if (warn.length) console.log('Hinweise:\n' + warn.join('\n'));
