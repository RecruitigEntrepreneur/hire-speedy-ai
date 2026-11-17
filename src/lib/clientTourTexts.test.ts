import { describe, expect, it } from 'vitest';

/**
 * Die Bühne zeigt die echten Seiten (Demo-Modus). Damit Karte und Seite dasselbe sagen, muss der
 * Knopf auf der Rundgang-Karte genau so heißen wie der echte Knopf, auf den der Kunde klickt.
 * Die Empfehlung im Beispiel nutzt die Feldnamen der echten Empfehlung (offers:rec.*).
 */
const files = import.meta.glob<{ default: Record<string, unknown> }>('../i18n/locales/*/*.ts', { eager: true });
const lookup = (ns: string, lang: string, path: string) =>
  path.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
    files[`../i18n/locales/${ns}/${lang}.ts`]?.default);
const fill = (text: unknown, values: Record<string, string>) =>
  String(text).replace(/\{\{(\w+)\}\}/g, (_m, k: string) => values[k] ?? `{{${k}}}`);

/** Mitmach-Schritt → echter Knopf (Namespace, Schlüssel). */
const BUTTONS: Record<string, [string, string]> = {
  'c-jobsNew': ['clientJobs', 'jobs2.new.blank'],
  'c-intakeKind': ['clientFunnel', 'kind.permanentTitle'],
  'c-candidate': ['clientTasks', 'action.review'],
  'c-request': ['clientTasks', 'main.review'],
  'c-invite': ['clientInterviews', 'request.send'],
  'c-feedback': ['clientInterviews', 'feedback.way.offer.label'],
  'c-offer': ['offers', 'client.form.nextCheck'],
  'c-offerSend': ['offers', 'client.form.sendTo'],
  'c-contract': ['contracts', 'client.dialog.saveSent'],
};

const LANGS = ['de', 'en', 'sv', 'nb'];

describe('Rundgang-Karte und echte Seite sagen dasselbe', () => {
  for (const lang of LANGS) {
    it(`Mitmach-Knöpfe heißen wie die echten Knöpfe (${lang})`, () => {
      for (const [id, [ns, key]] of Object.entries(BUTTONS)) {
        const real = lookup(ns, lang, key);
        expect(typeof real, `${ns}:${key}`).toBe('string');
        const card = lookup('clientGuide', lang, `steps.${id}.action`);
        expect(fill(card, { hhFirst: 'Julia' }), id).toBe(fill(real, { hh: 'Julia' }));
      }
    });

    it(`Art der Besetzung bei Contracting heißt wie die echte Karte (${lang})`, () => {
      expect(lookup('clientGuide', lang, 'steps.c-intakeKind.actionContracting')).toBe(lookup('clientFunnel', lang, 'kind.contractingTitle'));
    });

    it(`findet die Felder der Empfehlung (${lang})`, () => {
      for (const key of ['fix', 'start', 'homeoffice', 'wichtig', 'gut_zu_wissen', 'bedenken']) {
        expect(typeof lookup('offers', lang, `rec.rows.${key}`), key).toBe('string');
      }
      expect(typeof lookup('offers', lang, 'rec.value.from')).toBe('string');
    });
  }
});
