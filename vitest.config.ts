import { defineConfig } from 'vitest/config';
import path from 'node:path';

// evals/ plus die reinen Logikmodule unter src/lib/. Weiterhin ausgeschlossen
// bleiben die Deno-Tests unter supabase/functions/ (z. B.
// _shared/pii-redaction.test.ts): sie nutzen Deno-std-Asserts und laufen nicht
// unter Vitest.
//
// src/lib/*.test.ts ist bewusst eng gefasst: getestet wird ausschliesslich, was
// ohne React, ohne Netz und ohne Datenbank auskommt — Domain-Normalisierung,
// Freemail-Erkennung und die Abbildung Aufnahme -> jobs-Zeile. Genau diese drei
// entscheiden über Dubletten, Missbrauch am öffentlichen Link und darüber, ob
// Angaben des Kunden ein Ziel in der Datenbank finden.
export default defineConfig({
  test: {
    include: ['evals/**/*.test.ts', 'src/lib/**/*.test.ts'],
    watch: false,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
