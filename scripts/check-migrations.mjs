// Prüft Migrationsdateien auf die Regeln, mit denen Lovable Migrationen ablehnt (Stand 22.10.2026).
// Aufruf: node scripts/check-migrations.mjs supabase/migrations/<datei>.sql [...]
// Ohne Dateien: alle Migrationen, die nicht auf origin/main liegen.
// Exit-Code 1, sobald ein Fehler gefunden wird; Hinweise brechen nicht ab.
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

let files = process.argv.slice(2);
if (!files.length) {
  const out = execSync('git diff --name-only --diff-filter=AM origin/main -- supabase/migrations; git ls-files --others --exclude-standard -- supabase/migrations', { encoding: 'utf8' });
  files = [...new Set(out.split('\n').filter((f) => f.endsWith('.sql')))];
}
if (!files.length) { console.log('Keine Migrationen zu prüfen.'); process.exit(0); }

/** Entfernt Kommentare und Funktionskörper ($$ … $$ bzw. $tag$ … $tag$), damit nur Anweisungen der obersten Ebene bleiben. */
function topLevel(sql) {
  let s = sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  s = s.replace(/(\$[A-Za-z_]*\$)[\s\S]*?\1/g, ' $body$ ');
  return s;
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

let errors = 0;
for (const file of files) {
  const raw = readFileSync(file, 'utf8');
  const sql = topLevel(raw);
  const found = [];
  const err = (msg) => { found.push(`  FEHLER  ${msg}`); errors++; };
  const hint = (msg) => found.push(`  Hinweis ${msg}`);

  for (const m of sql.matchAll(/^\s*(BEGIN|COMMIT|ROLLBACK)\s*;/gim)) err(`${m[1]}; in der Datei (Lovable steuert die Transaktion selbst)`);
  for (const m of sql.matchAll(/\bINSERT\s+INTO\s+([\w."]+)/gi)) err(`Daten-Einfügung in ${m[1]} (keine Seeds, Schlüssel oder Einstellungen in Migrationen)`);
  for (const m of sql.matchAll(/\bUPDATE\s+([\w."]+)\s+SET\b/gi)) err(`Datenänderung in ${m[1]} (UPDATE außerhalb einer Funktion)`);
  for (const m of sql.matchAll(/\bDELETE\s+FROM\s+([\w."]+)/gi)) err(`Daten-Löschung in ${m[1]} (DELETE außerhalb einer Funktion)`);
  for (const m of sql.matchAll(/\bcron\.schedule\s*\(\s*'([^']*)'\s*,\s*'([^']*)'/gi)) {
    hint(`Cron „${m[1]}“ mit „${m[2]}“ – nur täglich/wöchentlich ging durch, häufige Dauerläufe nicht`);
  }
  for (const m of sql.matchAll(/REFERENCES\s+auth\.users/gi)) err(`Fremdschlüssel auf auth.users (Zeile ~${lineOf(sql, m.index)}); Nutzer-ID nur als uuid speichern`);

  // Neue Tabellen brauchen ausdrückliche Rechte.
  for (const m of sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?"?(\w+)"?/gi)) {
    const t = m[1];
    const grants = [...sql.matchAll(new RegExp(`GRANT\\s+[^;]*?\\s+ON\\s+(?:TABLE\\s+)?(?:[\\w.]+\\s*,\\s*)*(?:public\\.)?${t}\\b[^;]*?\\s+TO\\s+([^;]+);`, 'gi'))]
      .map((g) => g[1].toLowerCase());
    if (!grants.some((g) => g.includes('service_role'))) err(`Tabelle ${t}: kein GRANT … TO service_role`);
    // Lovable (29.10.2026): erst GRANT, dann RLS einschalten
    const rls = sql.search(new RegExp(`ALTER\\s+TABLE\\s+(?:public\\.)?${t}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, 'i'));
    const firstGrant = sql.search(new RegExp(`GRANT\\s+[^;]*?\\s+ON\\s+(?:TABLE\\s+)?(?:[\\w.]+\\s*,\\s*)*(?:public\\.)?${t}\\b`, 'i'));
    if (rls >= 0 && firstGrant >= 0 && rls < firstGrant) err(`Tabelle ${t}: RLS wird vor dem GRANT eingeschaltet (Zeile ~${lineOf(sql, rls)}); GRANT zuerst`);
    if (!grants.some((g) => g.includes('authenticated') || g.includes('anon'))) hint(`Tabelle ${t}: kein GRANT an authenticated/anon – nur richtig, wenn ausschließlich Funktionen zugreifen`);
  }

  // SECURITY DEFINER nur mit festem search_path.
  for (const m of sql.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([\w.]+)\s*\([^;]*?;/gi)) {
    const stmt = m[0];
    if (/SECURITY\s+DEFINER/i.test(stmt) && !/search_path/i.test(stmt)) err(`Funktion ${m[1]}: SECURITY DEFINER ohne SET search_path`);
  }

  console.log(`${found.some((f) => f.includes('FEHLER')) ? '✗' : '✓'} ${file}`);
  found.forEach((f) => console.log(f));
}
console.log(errors ? `\n${errors} Fehler – so lehnt Lovable die Migration ab.` : '\nKeine Fehler nach den Lovable-Regeln.');
process.exit(errors ? 1 : 0);
