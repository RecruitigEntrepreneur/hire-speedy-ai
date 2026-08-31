import { describe, expect, it } from 'vitest';
import {
  splitCompoundSkill, canonicalKey, normalizeSkillList, routeRequirements,
  type SynonymMap, type ClassifiedRequirement,
} from '../../supabase/functions/_shared/skills';

/**
 * Diese Aufbereitung entscheidet, ob der Matcher etwas vergleichen kann.
 *
 * calculate-match-v3-1:1174 behandelt jeden must_haves-Eintrag als Skillnamen.
 * Was hier durchrutscht, wird dort zu einem Muss-Kriterium, das kein Kandidat
 * erfüllt — es zählt gegen die mustHaveCoverage und drückt jeden Score.
 */

// Ausschnitt der echten skill_synonyms-Tabelle (113 Zeilen in Produktion).
const map: SynonymMap = new Map<string, string>([
  ['javascript', 'javascript'], ['js', 'javascript'], ['ecmascript', 'javascript'],
  ['typescript', 'typescript'], ['ts', 'typescript'],
  ['kubernetes', 'kubernetes'], ['k8s', 'kubernetes'],
  ['c#', 'c#'], ['csharp', 'c#'],
  ['.net', '.net'], ['dotnet', '.net'],
  ['postgresql', 'postgresql'], ['postgres', 'postgresql'],
]);

describe('splitCompoundSkill', () => {
  it('trennt zusammengesetzte Nennungen', () => {
    // "C#/.NET" als ein Eintrag findet weder ein Synonym noch ein Kandidatenprofil.
    expect(splitCompoundSkill('C#/.NET')).toEqual(['C#', '.NET']);
    expect(splitCompoundSkill('Deutsch und Englisch')).toEqual(['Deutsch', 'Englisch']);
    expect(splitCompoundSkill('React, Vue oder Angular')).toEqual(['React', 'Vue', 'Angular']);
  });

  it('lässt Namen zusammen, die den Trenner im Namen führen', () => {
    for (const s of ['CI/CD', 'TCP/IP', 'UI/UX', 'SAP FI/CO', 'A/B']) {
      expect(splitCompoundSkill(s), s).toEqual([s]);
    }
  });

  it('zerlegt keine Sätze — sonst entstünden Fragmente statt Skills', () => {
    const satz = 'Fundierte Erfahrung in der Entwicklung verteilter Systeme und deren Betrieb';
    expect(splitCompoundSkill(satz)).toEqual([satz]);
  });

  it('lässt einzelne Namen unangetastet', () => {
    expect(splitCompoundSkill('Kubernetes')).toEqual(['Kubernetes']);
    expect(splitCompoundSkill('  ')).toEqual([]);
  });
});

describe('canonicalKey — der Schlüssel zum Entdoppeln, nicht der Anzeigetext', () => {
  it('bildet Synonyme auf denselben Schlüssel ab', () => {
    expect(canonicalKey('TS', map)).toBe('typescript');
    expect(canonicalKey('TypeScript', map)).toBe('typescript');
    expect(canonicalKey('K8s', map)).toBe('kubernetes');
    expect(canonicalKey('Postgres', map)).toBe('postgresql');
  });

  it('behält Unbekanntes, statt es zu verwerfen', () => {
    expect(canonicalKey('SolidWorks', map)).toBe('solidworks');
  });

  it('verträgt anhängende Interpunktion', () => {
    expect(canonicalKey('TS.', map)).toBe('typescript');
  });
});

describe('normalizeSkillList', () => {
  it('trennt, entdoppelt und zeigt die ausführlichste Schreibweise', () => {
    // "TS" und "TypeScript" sind derselbe Skill — angezeigt wird der lange Name.
    expect(normalizeSkillList(['C#/.NET', 'TS', 'TypeScript', 'K8s'], map))
      .toEqual(['C#', '.NET', 'TypeScript', 'K8s']);
  });

  it('behält die Schreibweise des Kunden, statt sie kleinzuschreiben', () => {
    // skill_synonyms.canonical_name ist lowercase — im Profil des Kunden
    // hätte das "c#" und ".net" ergeben.
    expect(normalizeSkillList(['C#', 'JavaScript'], map)).toEqual(['C#', 'JavaScript']);
  });

  it('wirft Sätze weg — ein 60-Zeichen-Skill ist keiner', () => {
    const satz = 'Ganzheitliches Denkvermögen, hohe Eigenverantwortung und Umsetzungsstärke';
    expect(normalizeSkillList([satz, 'K8s'], map)).toEqual(['K8s']);
  });

  it('hält die Obergrenze ein', () => {
    expect(normalizeSkillList(Array.from({ length: 50 }, (_, i) => `Skill${i}`), map, 5)).toHaveLength(5);
  });
});

describe('routeRequirements — das eigentliche Einordnen', () => {
  // Die echten Kriterien der ASMPT-Anzeige, wie sie das Modell klassifiziert.
  const items: ClassifiedRequirement[] = [
    { text: 'Abgeschlossenes Studium der Informatik', kind: 'education' },
    { text: 'Fundierte Erfahrung in DevSecOps', kind: 'method', skill: 'DevSecOps', required: true },
    { text: 'CI/CD', kind: 'method', skill: 'CI/CD', required: true },
    { text: 'Infrastructure as Code', kind: 'method', skill: 'Infrastructure as Code', required: true },
    { text: 'Kenntnisse in C#/.NET, PowerShell oder TypeScript', kind: 'technology', skill: 'C#/.NET', required: true },
    { text: 'TypeScript', kind: 'technology', skill: 'TS', required: false },
    { text: 'Ganzheitliches Denkvermögen, hohe Eigenverantwortung', kind: 'soft' },
    { text: 'Freude an der Zusammenarbeit', kind: 'soft' },
    { text: 'Sehr gute Deutschkenntnisse', kind: 'language', language_code: 'Deutsch', language_level: 'C1' },
    { text: 'Sehr gute Englischkenntnisse', kind: 'language', language_code: 'Englisch', language_level: 'C1' },
    { text: 'Mindestens 5 Jahre Berufserfahrung', kind: 'experience', min_years: 5 },
    { text: 'ISTQB-Zertifizierung', kind: 'certification', skill: 'ISTQB' },
  ];

  const r = routeRequirements(items, map);

  it('lässt NUR matchbare Skills in die Muss-Liste', () => {
    expect(r.mustHaves).toEqual(['DevSecOps', 'CI/CD', 'Infrastructure as Code', 'C#', '.NET']);
  });

  it('hält Persönlichkeitsfloskeln aus der Muss-Liste heraus', () => {
    const alle = [...r.mustHaves, ...r.niceToHaves, ...r.skills].join(' ').toLowerCase();
    expect(alle).not.toContain('denkvermögen');
    expect(alle).not.toContain('freude');
  });

  it('verliert sie trotzdem nicht — sie stehen im Anforderungstext', () => {
    expect(r.narrative.join(' ')).toContain('Ganzheitliches Denkvermögen');
    expect(r.narrative.join(' ')).toContain('Freude an der Zusammenarbeit');
    expect(r.narrative.join(' ')).toContain('Studium der Informatik');
  });

  it('trennt zusammengesetzte Technologien', () => {
    expect(r.mustHaves).toContain('C#');
    expect(r.mustHaves).toContain('.NET');
    expect(r.mustHaves).not.toContain('C#/.NET');
  });

  it('erkennt Kann-Kriterien als solche', () => {
    expect(r.niceToHaves).toEqual(['TS']);
    expect(r.mustHaves).not.toContain('TS');
  });

  it('führt Sprachen in required_languages statt als Muss-Skill', () => {
    expect(r.requiredLanguages).toEqual([
      { code: 'de', minLevel: 'C1' },
      { code: 'en', minLevel: 'C1' },
    ]);
    expect(r.mustHaves.join(' ').toLowerCase()).not.toContain('deutsch');
  });

  it('zieht Erfahrungsjahre in experience_min', () => {
    expect(r.experienceMin).toBe(5);
  });

  it('führt Zertifikate getrennt', () => {
    expect(r.requiredCertifications).toEqual(['ISTQB']);
    expect(r.mustHaves).not.toContain('ISTQB');
  });

  it('deckelt die Muss-Liste bei acht', () => {
    const viele: ClassifiedRequirement[] = Array.from({ length: 20 }, (_, i) => ({
      text: `T${i}`, kind: 'technology', skill: `Tech${i}`, required: true,
    }));
    expect(routeRequirements(viele, map).mustHaves).toHaveLength(8);
  });

  it('kommt mit leerer Eingabe klar', () => {
    const leer = routeRequirements([], map);
    expect(leer.mustHaves).toEqual([]);
    expect(leer.experienceMin).toBeNull();
  });
});
