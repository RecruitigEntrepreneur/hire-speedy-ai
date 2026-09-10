import { describe, expect, it } from 'vitest';
import { draftToJobRow } from '../../supabase/functions/_shared/intake-mapping';

/**
 * Die Abbildung Entwurf → Stelle gibt es zweimal: hier in src/ fuer das
 * Dashboard, und in supabase/functions/_shared/ fuer die Gast-Aufnahme, weil
 * Deno nicht aus src/ importieren kann.
 *
 * BEFUND (10.09.2026): Genau daran ist `briefing_answers` durchgefallen. Die
 * Ansicht `recruiter_jobs_view` projiziert daraus zwei Felder
 * (deliverable_90d, interview_process). Der Dashboard-Pfad schrieb sie, der
 * Gast-Pfad nicht -- und der Gast-Pfad ist der lebende. Die Spalte waere bei
 * jeder echten Aufnahme leer geblieben, ohne dass irgendwo etwas rot wird.
 *
 * Dieser Test ist die Reissleine dafuer.
 */
describe('Die Gast-Aufnahme traegt die Briefing-Antworten in die Stelle', () => {
  const entwurf = {
    contract_type: 'full-time',
    title: 'Finance Manager',
    built: { title: 'Finance Manager' },
    answers: {
      interview_process: { value: '2 Runden, unter 2 Wochen' },
      deliverable_90d: { value: 'Laufendes Geschäft voll übernommen' },
      weiss_nicht: { unknown: true },
    },
  };

  it('reicht die Antworten nach intake_payload.briefing_answers durch', () => {
    const zeile = draftToJobRow(entwurf) as Record<string, any>;
    const antworten = zeile.intake_payload?.briefing_answers;
    expect(antworten?.interview_process?.value).toBe('2 Runden, unter 2 Wochen');
    expect(antworten?.deliverable_90d?.value).toBe('Laufendes Geschäft voll übernommen');
  });

  it('nimmt "Weiß ich nicht" mit, statt es zu verschlucken', () => {
    // Die Ansicht entscheidet, was daraus wird -- narrativeAnswer() liefert
    // dafuer einen leeren Text. Verschluckt die Abbildung den Eintrag schon
    // hier, ist der Unterschied zwischen "nicht gefragt" und "weiss der Kunde
    // nicht" fuer immer verloren.
    const zeile = draftToJobRow(entwurf) as Record<string, any>;
    expect(zeile.intake_payload?.briefing_answers?.weiss_nicht).toEqual({ unknown: true });
  });

  it('bleibt still, wenn ein Entwurf gar keine Antworten hat', () => {
    const zeile = draftToJobRow({ contract_type: 'full-time', built: {} }) as Record<string, any>;
    expect(zeile.intake_payload?.briefing_answers).toBeNull();
  });
});
