import { describe, expect, it } from 'vitest';
import { buildAnsprache, buildJobPosting, postingAsText } from './jobPosting';
import type { WorkspaceJob } from '@/components/recruiter/RecruiterJobWorkspace';

const job = (extra: Record<string, unknown> = {}) => ({
  id: 'x', title: 'Finance Manager', employment_type: 'full-time', ...extra,
} as unknown as WorkspaceJob);

describe('Die Stellenanzeige zeigt nur, was der Kandidat sehen darf', () => {
  it('nennt weder Honorar noch Konkurrenzlage noch Absprunggrund', () => {
    const text = postingAsText(buildJobPosting(job({
      recruiter_fee_percentage: 15, salary_min: 70000, salary_max: 85000,
      candidates_in_pipeline: 2,
      candidates_dropped_reason: 'Gegenangebot',
      failure_profile: 'Zwei Kollegen sind gescheitert.',
      company_name: 'Bluewater & Bridge GmbH',
    })));
    for (const verboten of ['Honorar', 'Gegenangebot', 'gescheitert', 'Bluewater']) {
      expect(text).not.toContain(verboten);
    }
    expect(text).toContain('70.000 – 85.000 €');
  });
});

describe('Benefit-Dubletten', () => {
  it('fasst Gross-/Kleinschreibung und Praefixe zusammen', () => {
    const posting = buildJobPosting(job({ benefits: [
      'betriebliche Altersvorsorge', 'Betriebliche Altersvorsorge',
      'Jobrad', 'Jobrad / Fahrradleasing',
      'Essenszuschuss', 'Essenszuschuss oder Kantine',
      '30 Tage Urlaub',
    ] }));
    const zeile = posting.blocks.find(b => b.id === 'angebot')!.bullets.find(b => b.includes('Urlaub'))!;
    expect(zeile.split(' · ').sort()).toEqual(
      ['30 Tage Urlaub', 'Betriebliche Altersvorsorge', 'Essenszuschuss oder Kantine', 'Jobrad / Fahrradleasing'].sort());
  });

  it('trennt nur an einer echten Wortgrenze', () => {
    const posting = buildJobPosting(job({ benefits: ['Bonus', 'Bonuszahlung'] }));
    const zeile = posting.blocks.find(b => b.id === 'angebot')!.bullets[0];
    expect(zeile).toBe('Bonus · Bonuszahlung');
  });
});

describe('Zertifikate', () => {
  it('erscheinen nicht zweimal, wenn sie schon Kriterium sind', () => {
    const posting = buildJobPosting(job({
      nice_to_have_criteria: ['Bilanzbuchhalter IHK'],
      required_certifications: ['Bilanzbuchhalter IHK'],
    }));
    const profil = posting.blocks.find(b => b.id === 'profil')!;
    const alle = [...profil.bullets, ...(profil.gruppen ?? []).flatMap(g => g.bullets)];
    expect(alle.filter(b => b.includes('Bilanzbuchhalter')).length).toBe(1);
  });
});

describe('Leere Bloecke', () => {
  it('erscheinen gar nicht, statt als Floskel', () => {
    const posting = buildJobPosting(job());
    expect(posting.blocks.map(b => b.id)).toEqual([]);
  });
});

// So kommt eine Contracting-Stelle mit neuer Anzeige aus recruiter_jobs_view.
const contracting = (extra: Record<string, unknown> = {}) => job({
  title: 'Arzt / Ärztin (m/w/d)', employment_type: 'freelance', industry: 'Telemedizin',
  day_rate_min: 310, day_rate_max: 780, utilization_days_per_week: 3, contract_duration_months: 12, extension_possible: true,
  must_have_criteria: ['Approbation'],
  formatted_content: {
    anzeige: {
      einleitung: 'Du betreust Patienten per Video für {VERGUETUNG}.',
      unternehmen: 'Junges Telemedizin-Unternehmen.',
      aufgaben: ['Videosprechstunde', 'Dokumentation'],
      profil_zwingend: ['Von der KI erfunden'],
      angebot: ['Remote'],
      ablauf: [],
    },
    ansprache: {
      linkedin: 'Hallo {VORNAME}, remote Projekt, {VERGUETUNG}. Passt das?',
      email_betreff: 'Remote-Projekt Telemedizin',
      email_text: 'Hallo {VORNAME},\nkurz zu einem Projekt.',
      telefon: { einstieg: 'Hast du zwei Minuten?', argumente: ['remote'], fragen: ['Approbation?'] },
    },
  },
  ...extra,
});

describe('Anzeige & Ansprache (29.09.2026)', () => {
  it('setzt die Vergütung vom System ein und nennt Eckdaten für Contracting', () => {
    const posting = buildJobPosting(contracting());
    expect(posting.eckdaten).toEqual([
      { label: 'Tagessatz', wert: '310 – 780 € pro Tag, zzgl. USt' },
      { label: 'Umfang', wert: '3 Tage / Woche' },
      { label: 'Laufzeit', wert: '12 Monate, Verlängerung möglich' },
    ]);
    expect(posting.blocks.find(b => b.id === 'ueber')!.lead).toBe('Du betreust Patienten per Video für 310 – 780 € pro Tag.');
  });

  it('nimmt Angaben des Kunden vor KI-Text und kennzeichnet die Herkunft', () => {
    const profil = buildJobPosting(contracting()).blocks.find(b => b.id === 'profil')!;
    expect(profil.gruppen![0]).toEqual({ titel: 'Zwingend', bullets: ['Approbation'] });
    expect(profil.herkunft).toContain('kunde');
    const aufgaben = buildJobPosting(contracting()).blocks.find(b => b.id === 'aufgaben')!;
    expect(aufgaben.herkunft).toEqual(['ki']);
  });

  it('nennt bei Contracting Vertrag und Zahlung, bei Festanstellung nicht', () => {
    const angebot = buildJobPosting(contracting()).blocks.find(b => b.id === 'angebot')!;
    expect(angebot.title).toBe('Das Projekt bietet');
    expect(angebot.bullets.join(' ')).toContain('7 Tagen mit 2 % Skonto');
    expect(buildJobPosting(job({ benefits: ['Jobrad'] })).blocks.find(b => b.id === 'angebot')!.bullets.join(' ')).not.toContain('Skonto');
  });

  it('kopiert ohne Herkunft, mit Ansprechperson', () => {
    const text = postingAsText(buildJobPosting(contracting(), { name: 'Anna Beispiel', phone: '0170 1234567' }));
    expect(text).not.toMatch(/Angaben des Kunden|KI/);
    expect(text).toContain('DEINE ANSPRECHPERSON\nAnna Beispiel · 0170 1234567');
  });

  it('setzt Vorname und Vergütung in die Kurzansprachen ein', () => {
    const job_ = contracting();
    const posting = buildJobPosting(job_, { name: 'Anna Beispiel' });
    const a = buildAnsprache(job_, posting, 'Lena');
    expect(a.linkedin).toBe('Hallo Lena, remote Projekt, 310 – 780 € pro Tag. Passt das?');
    expect(buildAnsprache(job_, posting, '').linkedin).toBe('Hallo, remote Projekt, 310 – 780 € pro Tag. Passt das?');
    expect(a.email.text).toContain('Viele Grüße\nAnna Beispiel');
    expect(a.email.text).toContain('— Die ausführliche Beschreibung —');
    expect(a.telefon.konditionen).toBe('310 – 780 € pro Tag, zzgl. USt');
  });

  it('baut schlichte Ansprachen für Stellen ohne neue KI-Texte', () => {
    const alt = job({ title: 'Finance Manager', industry: 'Handel', salary_min: 70000, salary_max: 85000, must_have_criteria: ['HGB'] });
    const a = buildAnsprache(alt, buildJobPosting(alt), 'Tom');
    expect(a.linkedin).toContain('Hallo Tom, ich suche für ein Unternehmen aus der Branche Handel');
    expect(a.linkedin).toContain('70.000 – 85.000 €');
    expect(a.telefon.fragen).toEqual(['Bringst du HGB mit?']);
  });

  it('verrät weder Budget noch Honorar', () => {
    const job_ = contracting({ recruiter_fee_percentage: 11, fee_percentage: null });
    const posting = buildJobPosting(job_);
    const a = buildAnsprache(job_, posting, 'Lena');
    const alles = [postingAsText(posting), a.linkedin, a.email.text, a.telefon.einstieg].join(' ');
    for (const verboten of ['1.000', '400', 'Honorar', 'Provision', '11 %']) expect(alles).not.toContain(verboten);
  });
});
