import { defineConfig } from 'vitest/config';

// Bewusst nur auf evals/ gescoped: die bestehenden Deno-Tests unter
// supabase/functions/ (z. B. _shared/pii-redaction.test.ts) nutzen
// Deno-std-Asserts und laufen nicht unter Vitest.
export default defineConfig({
  test: {
    include: ['evals/**/*.test.ts'],
    watch: false,
  },
});
