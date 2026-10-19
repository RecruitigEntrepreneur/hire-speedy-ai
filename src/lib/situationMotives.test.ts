import { describe, expect, it } from 'vitest';
import {
  MOTIVE_CHIPS,
  MOTIVE_NEG,
  INCIDENT_CHIPS,
  MOTIVATION_ADDONS,
  MOTIVE_POS,
  MOTIVE_RECOGNIZE,
  clientMotivation,
  earlierGeneratedMotivation,
  environmentSentence,
  goalSentence,
  incidentChipsFor,
  incidentHasEvent,
  isAutoWhyNow,
  learnablePhrase,
  legacyAddonFields,
  motiveDetailChoices,
  replaceMotive,
  understandOwnWords,
  additionConflicts,
  ambiguousIncidents,
  ambiguousMotives,
  incidentParts,
  resolveAmbiguous,
  resolveAmbiguousIncident,
  incidentSentence,
  incidentSuggestions,
  incidentTimeOptions,
  setIncidentOwn,
  setIncidentTime,
  toggleIncident,
  evaluateMotives,
  isOldAutoMotivation,
  joinMotivation,
  motivationQuote,
  ownWordsSentence,
  recognizedMotives,
  splitMotivation,
  toggleAddition,
  motiveLabels,
  motiveOwnWords,
  toggleMotive,
  withOwnWords,
  type MotiveEvaluation,
} from './situationMotives';
import { MOTIVATION_TAGS, OFFER_OPTIONS } from './candidateDossier';
import type { RoleFamily } from './roleFamily';

const PRONOUN = /\b(er|sie|ihr|ihm|ihn|sein|seine|seiner|ihre|ihrer)\b/i;
const FAMILIES = Object.keys(MOTIVE_CHIPS) as RoleFamily[];

describe('Bausteine', () => {
  it('haben Nominativ und Akkusativ ohne Komma und ohne Er/Sie', () => {
    for (const [label, e] of [...Object.entries(MOTIVE_POS), ...Object.entries(MOTIVE_NEG)]) {
      for (const t of [e.nom, e.need, ...Object.values(e.needBy ?? {})]) {
        expect(t, label).not.toContain(',');
        expect(PRONOUN.test(t), `${label}: ${t}`).toBe(false);
      }
      expect(/\bein (\w+ )?(Verdienst|Arbeitsweg|Firmenwagen|Arbeitgeber|Dienstplan|Technikstack)\b/.test(e.need), `${label}: ${e.need}`).toBe(false);
    }
  });

  it('kein Knopf enthält ein Komma (das Feld trennt nach Komma)', () => {
    const labels = [...Object.keys(MOTIVE_POS), ...Object.keys(MOTIVE_NEG), ...Object.values(INCIDENT_CHIPS).flat(), ...MOTIVATION_ADDONS];
    for (const l of labels) expect(l, l).not.toContain(',');
  });

  it('verweisen nur auf vorhandene Angebots-Punkte und Wechselgrund-Themen', () => {
    for (const e of [...Object.values(MOTIVE_POS), ...Object.values(MOTIVE_NEG)]) {
      if (e.offer) expect(OFFER_OPTIONS).toContain(e.offer);
      if (e.tag) expect(MOTIVATION_TAGS).toContain(e.tag);
    }
  });

  it('jede Familie hat nur bekannte Knöpfe und keine zwei zum selben Thema bei gefällt', () => {
    for (const f of FAMILIES) {
      for (const l of MOTIVE_CHIPS[f].pos) expect(MOTIVE_POS[l], `${f} ${l}`).toBeTruthy();
      for (const l of MOTIVE_CHIPS[f].neg) expect(MOTIVE_NEG[l], `${f} ${l}`).toBeTruthy();
      const pairs = MOTIVE_CHIPS[f].pos.map((l) => MOTIVE_POS[l].pair);
      expect(new Set(pairs).size, f).toBe(pairs.length);
    }
  });
});

describe('Alle Kombinationen bis 3 Knöpfe je Seite', () => {
  const subsets = (arr: string[], max: number): string[][] => {
    const out: string[][] = [[]];
    const rec = (start: number, cur: string[]) => {
      for (let i = start; i < arr.length; i++) {
        const next = [...cur, arr[i]];
        out.push(next);
        if (next.length < max) rec(i + 1, next);
      }
    };
    rec(0, []);
    return out;
  };
  const check = (o: MotiveEvaluation, f: RoleFamily): string[] => {
    const bad: string[] = [];
    for (const s of o.saetze) {
      if (!s.endsWith('.')) bad.push(`kein Punkt: ${s}`);
      if (/ ,|,,| {2}| \.|\.\./.test(s)) bad.push(`Zeichen: ${s}`);
      if (/\b(\w+) \1\b/i.test(s)) bad.push(`Doppelwort: ${s}`);
      if (PRONOUN.test(s)) bad.push(`Er/Sie: ${s}`);
      const m = /^(Am meisten|Außerdem) (gefällt|stört)(?: heute)? (.*)\.$/.exec(s);
      if (m && / und /.test(m[3].replace(/Nacht- und|Budget und|Zeit und|Innendienst und|Strategie und|Technik und/g, ''))) bad.push(`Einzahl bei Liste: ${s}`);
    }
    if (o.braucht.some((b) => o.wieHeute.includes(b))) bad.push('doppelt in bieten und wie heute');
    if (o.kunde.length > 3 || new Set(o.kunde).size !== o.kunde.length) bad.push('Kundenfragen');
    if (o.hinweise.length > 3) bad.push('Hinweise');
    if (new Set(o.suche).size !== o.suche.length) bad.push('Suche doppelt');
    if (f === 'clevel' && o.kunde.some((k) => k.includes('Überstunden'))) bad.push('Überstunden bei Geschäftsführung');
    if (f === 'gewerblich' && [...o.braucht, ...o.wieHeute].some((x) => x.includes('Homeoffice'))) bad.push('Homeoffice bei Pflege');
    return bad;
  };

  for (const f of FAMILIES) {
    it(`ergibt saubere Texte für ${f}`, () => {
      const bad: string[] = [];
      for (const p of subsets(MOTIVE_CHIPS[f].pos, 3)) for (const n of subsets(MOTIVE_CHIPS[f].neg, 3)) {
        if (!p.length && !n.length) continue;
        for (const b of check(evaluateMotives(f, p, n), f)) bad.push(`${p.join('/')} | ${n.join('/')}: ${b}`);
      }
      expect(bad.slice(0, 5)).toEqual([]);
    });
  }
});

describe('Testpersonen', () => {
  it('Sabine: Führungskraft mit neuer Führung', () => {
    const o = evaluateMotives('fuehrung', ['Mein Team', 'Stabilität', 'Gestaltungsspielraum'], ['Kein eigenes Budget', 'Neue Führungskraft', 'Zu viel Verwaltung']);
    expect(o.saetze).toEqual([
      'Am meisten gefallen heute das eigene Team, die Stabilität des Unternehmens und der Gestaltungsspielraum.',
      'Am meisten stören das fehlende eigene Budget, die neue Führungskraft und der hohe Verwaltungsanteil.',
    ]);
    expect(o.braucht).toEqual(['ein eigenes Budget', 'eine unterstützende Führungskraft', 'weniger Verwaltungsaufwand']);
    expect(o.wieHeute).toEqual(['ein gutes Team', 'ein wirtschaftlich stabiles Unternehmen', 'viel Gestaltungsspielraum']);
    expect(o.weiter.ausloeser).toEqual(['Neue Führungskraft']);
    expect(o.hinweise.map((h) => h.key)).toEqual(['bindung']);
  });

  it('Remote gestrichen: was gefiel, fällt weg und steht nicht mehr bei gefällt', () => {
    const o = evaluateMotives('it', ['Remote', 'Technik'], ['Remote gestrichen', 'Mehr Termine als Arbeit']);
    expect(o.saetze[0]).toBe('Am meisten gefällt heute die eingesetzte Technik.');
    expect(o.saetze[2]).toBe('Was bisher gefallen hat, fällt gerade weg oder ändert sich: das Remote-Arbeiten. Das ist ein starker Wechselgrund.');
    expect(o.hinweise.some((h) => h.key.startsWith('widerspruch'))).toBe(false);
  });

  it('nur Geld: Gegenangebot-Risiko und Gehaltsfrage an den Kunden', () => {
    const o = evaluateMotives('spezialist', ['Arbeitsweg', 'Team'], ['Gehalt']);
    expect(o.hinweise[0].key).toBe('nur-geld');
    expect(o.kunde[0]).toContain('Gehaltsspanne');
  });

  it('Widerspruch beim Gehalt mit Knöpfen zum Auflösen', () => {
    const o = evaluateMotives('vertrieb', ['Verdienst'], ['Fixum zu niedrig']);
    const h = o.hinweise.find((x) => x.conflict);
    expect(h?.text).toContain('Fixum gut, Provision schwach');
    expect(h?.conflict).toEqual({ pos: 'Verdienst', neg: 'Fixum zu niedrig' });
  });

  it('feste Arbeitszeiten und Einspringen sind kein Widerspruch', () => {
    const o = evaluateMotives('gewerblich', ['Feste Arbeitszeiten'], ['Dienstplan und Einspringen']);
    expect(o.hinweise.map((h) => h.level)).toEqual(['blau']);
  });

  it('nichts stört: gelber Hinweis und Anforderungen nur „wie heute“', () => {
    const o = evaluateMotives('spezialist', ['Team', 'Aufgaben'], []);
    expect(o.hinweise[0].key).toBe('kein-grund');
    expect(o.braucht).toEqual([]);
    expect(o.wieHeute.length).toBe(2);
  });
});

describe('Feld lesen und schreiben', () => {
  it('liest alte Knopfnamen als neue und lässt eigene Worte stehen', () => {
    const text = 'Neue Vorgesetzte, Kein Budget oder Entscheidungsrecht, will endlich selbst entscheiden';
    expect(motiveLabels(text, 'neg')).toEqual(['Neue Führungskraft', 'Kein Budget oder Entscheidungsrecht']);
    expect(ambiguousMotives(text, 'neg')).toEqual([{ label: 'Kein Budget oder Entscheidungsrecht', options: ['Kein eigenes Budget', 'Kaum Entscheidungsrecht'], ask: 'Fehlt das eigene Budget, das Entscheidungsrecht oder beides?' }]);
    expect(motiveOwnWords(text, 'neg')).toBe('will endlich selbst entscheiden');
  });

  it('Knopf aus entfernt auch den alten Namen, eigene Worte bleiben', () => {
    const next = toggleMotive('Neue Vorgesetzte, Zu viel Verwaltung, Zitat', 'Neue Führungskraft', 'neg');
    expect(next).toBe('Zu viel Verwaltung, Zitat');
    expect(toggleMotive(next, 'Arbeitslast', 'neg')).toBe('Zu viel Verwaltung, Arbeitslast, Zitat');
  });

  it('zählt bei gefällt je Thema nur einen Knopf (alte Interviews mit „Team“ und „Mein Team“)', () => {
    const o = evaluateMotives('fuehrung', ['Mein Team', 'Aufgaben', 'Gehalt', 'Team'], ['Arbeitslast']);
    expect(o.saetze.join(' ')).not.toContain('das Team');
    expect(o.zuViele).toBe(false);
  });

  it('eigene Worte ersetzen, Knöpfe bleiben', () => {
    expect(withOwnWords('Mein Team, alt', 'pos', 'neu')).toBe('Mein Team, neu');
    expect(withOwnWords('Mein Team, alt', 'pos', '')).toBe('Mein Team');
  });
});

describe('Wechselmotivation für den Kunden', () => {
  const MONEY = /gehalt|vergütung|bezahlung|provision|fixum|verdienst|€|euro/i;
  const subsets = (arr: string[], max: number): string[][] => {
    const out: string[][] = [[]];
    const rec = (start: number, cur: string[]) => {
      for (let i = start; i < arr.length; i++) {
        const next = [...cur, arr[i]];
        out.push(next);
        if (next.length < max) rec(i + 1, next);
      }
    };
    rec(0, []);
    return out;
  };

  for (const f of FAMILIES) {
    it(`nie Er/Sie, Gehalt oder Kritik an Personen (${f})`, () => {
      const bad: string[] = [];
      for (const p of subsets(MOTIVE_CHIPS[f].pos, 3)) for (const n of subsets(MOTIVE_CHIPS[f].neg, 3)) {
        const { text } = clientMotivation(f, p.join(', '), n.join(', '), 'Neuorganisation, seit ca. 04/2026');
        if (PRONOUN.test(text)) bad.push(`Er/Sie: ${text}`);
        if (MONEY.test(text)) bad.push(`Geld: ${text}`);
        // Nur Lob („eine gute Führungskraft“ aus gefällt) darf die Führung nennen, nie Kritik.
        if (/Führungskraft|Vorgesetzt|Konflikt/i.test(text.replace('eine gute Führungskraft', ''))) bad.push(`Person: ${text}`);
        if (/ ,|,,| {2}| \.|\b(\w+) \1\b/i.test(text)) bad.push(`Zeichen: ${text}`);
      }
      expect(bad.slice(0, 5)).toEqual([]);
    });
  }

  it('Sabine: positiv, mit Anlass und Zeitpunkt, ohne die neue Führungskraft', () => {
    const r = clientMotivation('fuehrung', 'Mein Team, Stabilität, Gestaltungsspielraum', 'Kein eigenes Budget, Neue Führungskraft, Zu viel Verwaltung', 'Neuer Chef, Neuorganisation, seit ca. 04/2026');
    expect(r.text).toBe('Sucht ein eigenes Budget und weniger Verwaltungsaufwand. Anlass ist eine Neuorganisation im Frühjahr 2026. Wichtig bleiben außerdem ein gutes Team, ein wirtschaftlich stabiles Umfeld und Gestaltungsspielraum.');
    expect(r.weggelassen).toEqual(['Neue Führungskraft']);
    expect(r.ohneGrund).toBe(false);
  });

  it('nur Gehalt stört: kein Kundentext, Hinweis an den Headhunter', () => {
    const r = clientMotivation('spezialist', 'Arbeitsweg, Team', 'Gehalt');
    expect(r.text).toBe('');
    expect(r.ohneGrund).toBe(true);
    expect(r.fehltGrund).toBe(true);
  });

  it('nur gefällt: kein Kundentext ohne Wechselgrund', () => {
    const r = clientMotivation('it', 'Remote, Team', '');
    expect(r.text).toBe('');
    expect(r.fehltGrund).toBe(true);
    expect(r.ohneGrund).toBe(false);
  });

  it('Ziele und Unternehmen als ganze Sätze, jeder mit Herkunft', () => {
    const r = clientMotivation('it', 'Remote, Team, Produkt', 'Mehr Termine als Arbeit, Kein Einfluss auf Technik, Bereitschaftsdienst', '', {
      companySize: 'midsize', industryChange: 'open', relocation: true, international: 'yes', goals: ['Tech Lead'],
    });
    expect(r.text).toBe('Sucht mehr Zeit für konzentrierte Arbeit, Mitsprache bei Technikentscheidungen und weniger Bereitschaftsdienst. Langfristiges Ziel: Tech Lead. Bevorzugt den Mittelstand und ist offen für einen Branchenwechsel, einen Umzug und internationale Aufgaben. Wichtig bleiben außerdem Remote-Arbeit, ein gutes Team und ein überzeugendes Produkt.');
    expect(r.parts.map((p) => p.src)).toEqual(['stört', 'Ziel', 'Wunschstelle · Unternehmen', 'gefällt']);
  });

  it('Umfeld-Satz: nur Angetipptes, egal und Nein bleiben draußen', () => {
    expect(environmentSentence({ companySize: 'any', international: 'no', relocation: false })).toBe('');
    expect(environmentSentence({ companySize: 'corporate' })).toBe('Bevorzugt einen Konzern.');
    expect(environmentSentence({ industryChange: 'same', companySize: 'startup' })).toBe('Bevorzugt ein Start-up und möchte in der bisherigen Branche bleiben.');
    expect(environmentSentence({ relocation: true })).toBe('Ist offen für einen Umzug.');
    expect(goalSentence(['Teamleitung', 'Tech Lead', 'Architektur'])).toBe('Langfristiges Ziel: Teamleitung oder Tech Lead.');
    expect(goalSentence(['Wechsel in den Mittelstand'], { companySize: 'midsize' })).toBe('');
  });

  it('genaue Führungs-Knöpfe gehen nie zum Kunden', () => {
    for (const d of MOTIVE_NEG['Probleme mit der Führungskraft'].details ?? []) {
      const r = clientMotivation('fuehrung', '', `${d}, Arbeitslast`);
      expect(r.weggelassen).toContain(d);
      expect(r.text).not.toMatch(/Führung|Rückendeckung|Mikromanagement/);
    }
  });

  it('alte Automatik-Sätze werden erkannt, eigene Texte nicht', () => {
    expect(isOldAutoMotivation('Stört vor allem: kein Budget oder Entscheidungsrecht.')).toBe(true);
    expect(isOldAutoMotivation('Wechselgrund: Gehalt.')).toBe(true);
    expect(isOldAutoMotivation('Will endlich selbst entscheiden.')).toBe(false);
  });

  it('Konflikt-Knöpfe setzen kein Wechselgrund-Thema „Führung“', () => {
    expect(MOTIVE_NEG['Probleme mit der Führungskraft'].tag).toBeUndefined();
    expect(MOTIVE_NEG['Neue Führungskraft'].tag).toBeUndefined();
  });
});

describe('Ergänzung zur Wechselmotivation', () => {
  const gen = 'Sucht mehr Gestaltungsspielraum.';
  it('erkennt Satz aus Klicks mit und ohne Ergänzung', () => {
    expect(splitMotivation(gen, gen)).toEqual({ auto: true, addition: '' });
    expect(splitMotivation(`${gen} Gerne im Mittelstand.`, gen)).toEqual({ auto: true, addition: 'Gerne im Mittelstand.' });
    expect(splitMotivation('Ganz eigener Text.', gen)).toEqual({ auto: false, addition: '' });
  });
  it('Ergänzungen an und aus, als eigene Sätze', () => {
    const a = toggleAddition('', 'Gerne im Mittelstand');
    expect(a).toBe('Gerne im Mittelstand.');
    const b = toggleAddition(a, 'Offen für Umzug');
    expect(b).toBe('Gerne im Mittelstand. Offen für Umzug.');
    expect(toggleAddition(b, 'Gerne im Mittelstand')).toBe('Offen für Umzug.');
    expect(joinMotivation(gen, b)).toBe(`${gen} ${b}`);
  });
  it('macht aus der eigenen Notiz einen Zitat-Satz', () => {
    expect(motivationQuote('Kein Budget oder Entscheidungsrecht, möchte endlich selbst entscheiden')).toBe('Möchte endlich selbst entscheiden.');
    expect(motivationQuote('Kein Budget oder Entscheidungsrecht')).toBe('');
  });
});

describe('Konkreter Auslöser', () => {
  const today = new Date(2026, 9, 16);
  it('Sabine: Satz mit Zeit und Häufigkeit, alte Namen zählen', () => {
    const text = 'Neuer Chef, seit ca. 04/2026, Neuorganisation';
    expect(incidentParts(text)).toEqual({ events: ['Neue Führungskraft', 'Neuorganisation'], time: 'seit ca. 04/2026', own: '' });
    expect(incidentSentence(text, 'Regelmäßig')).toBe('Im Frühjahr 2026 kamen eine neue Führungskraft und eine Neuorganisation. Seitdem ist es regelmäßig ein Thema.');
  });
  it('ohne Zeit Akkusativ, „länger her“, Zustände und Werdegang', () => {
    expect(incidentSentence('Stellenabbau', null)).toBe('Ausgelöst durch einen Stellenabbau.');
    expect(incidentSentence('Systemwechsel, länger her', 'Dauerhaft')).toBe('Vor längerer Zeit kam ein Systemwechsel. Seitdem ist es dauerhaft ein Thema.');
    expect(incidentSentence('Nach 8 Jahren keine nächste Stufe', null)).toBe('Nach 8 Jahren ist keine nächste Stufe in Sicht.');
    // Ohne echten Anlass gibt es kein „Wie oft“ (wird dann nicht gefragt).
    expect(incidentSentence('Kein einzelner Anlass', 'Gelegentlich')).toBe('Kein einzelner Anlass, es hat sich schleichend entwickelt.');
    expect(incidentSentence('Nach 8 Jahren keine nächste Stufe', 'Dauerhaft')).toBe('Nach 8 Jahren ist keine nächste Stufe in Sicht. Es ist dauerhaft ein Thema.');
    expect(incidentSentence('Schleichend, kein Anlass, Neuorganisation', null)).toBe('Ausgelöst durch eine Neuorganisation.');
  });
  it('Zeit ist eine Auswahl, eigene Worte bleiben am Ende', () => {
    const [drei, halb] = incidentTimeOptions(today);
    expect(halb).toEqual({ value: 'seit ca. 04/2026', label: 'vor einem halben Jahr', month: '04/2026' });
    let t = setIncidentTime('Neuorganisation, Zitat', drei.value);
    t = setIncidentTime(t, halb.value);
    expect(t).toBe('Neuorganisation, seit ca. 04/2026, Zitat');
    expect(toggleIncident(t, 'Budget gekürzt')).toBe('Neuorganisation, Budget gekürzt, seit ca. 04/2026, Zitat');
    expect(setIncidentOwn(t, '')).toBe('Neuorganisation, seit ca. 04/2026');
  });
  it('Vorschläge aus Stör-Knöpfen und Werdegang', () => {
    expect(incidentSuggestions('Neue Führungskraft, Zu viel Verwaltung', { tenureYears: 8, newJob: false })).toEqual(['Neue Führungskraft', 'Nach 8 Jahren keine nächste Stufe']);
    expect(incidentSuggestions('Umstrukturierung, Übernahme', { tenureYears: 2, newJob: false })).toEqual(['Neuorganisation', 'Übernahme']);
    expect(incidentSuggestions('', { tenureYears: 0, newJob: true })).toEqual(['Stelle anders als versprochen']);
  });
  it('alle Kombinationen ergeben saubere Sätze', () => {
    const bad: string[] = [];
    const times = [...incidentTimeOptions(today).map((o) => o.value), ''];
    for (const f of FAMILIES) {
      const chips = [...INCIDENT_CHIPS[f], 'Nach 8 Jahren keine nächste Stufe', 'Stelle anders als versprochen', 'Kein einzelner Anlass'];
      for (let i = 0; i < chips.length; i++) for (let j = i; j < chips.length; j++) for (const time of times) for (const fr of [null, 'Einmalig', 'Dauerhaft']) {
        const text = [...new Set([chips[i], chips[j]]), ...(time ? [time] : [])].join(', ');
        const s = incidentSentence(text, fr);
        if (!s) bad.push(`leer: ${text}`);
        if (/ ,|,,| {2}| \.|\.\.|\b(\w+) \1\b/i.test(s)) bad.push(`Zeichen: ${s}`);
        if (/\bkam (\S+ ){0,6}und\b/.test(s) && !/Übernahme oder|Abgang/.test(s)) bad.push(`Einzahl bei Liste: ${s}`);
        if (PRONOUN.test(s.replace(/die Stelle/g, ''))) bad.push(`Er/Sie: ${s}`);
      }
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });
});

describe('Eigene Worte', () => {
  it('werden zum Satz und Themen werden erkannt', () => {
    expect(ownWordsSentence('der weg zur arbeit macht spaß')).toBe('Der weg zur arbeit macht spaß.');
    expect(recognizedMotives('Mein Team, der weg zur arbeit macht spaß', 'pos')).toEqual(['Arbeitsweg']);
    expect(recognizedMotives('Arbeitsweg, der weg zur arbeit macht spaß', 'pos')).toEqual([]);
    expect(recognizedMotives('seit der neue Chef da ist, nur noch Reporting', 'neg')).toEqual(['Neue Führungskraft', 'Zu viel Verwaltung']);
  });
  it('erkannte Themen sind echte Knöpfe', () => {
    for (const [, l] of MOTIVE_RECOGNIZE.pos) expect(MOTIVE_POS[l], l).toBeTruthy();
    for (const [, l] of MOTIVE_RECOGNIZE.neg) expect(MOTIVE_NEG[l], l).toBeTruthy();
  });
});

describe('Präzise Knöpfe', () => {
  it('kein Knopf in den Listen vermischt zwei Dinge mit „oder“/„und“', () => {
    const lists = [...FAMILIES.flatMap((f) => [...MOTIVE_CHIPS[f].pos, ...MOTIVE_CHIPS[f].neg]), ...Object.values(INCIDENT_CHIPS).flat()];
    for (const l of lists) expect(/\s(oder|und)\s/.test(l), l).toBe(false);
  });
  it('alter ungenauer Knopf steht nicht im Kundentext, bis er geklärt ist', () => {
    const r = clientMotivation('fuehrung', 'Mein Team', 'Kein Budget oder Entscheidungsrecht, Zu viel Verwaltung');
    expect(r.text).toBe('Sucht weniger Verwaltungsaufwand. Wichtig bleibt außerdem ein gutes Team.');
    expect(r.ungenau).toEqual(['Kein Budget oder Entscheidungsrecht']);
    expect(r.weggelassen).toEqual([]);
  });
  it('Klären ersetzt den alten Knopf an seiner Stelle', () => {
    const t = 'Kein Budget oder Entscheidungsrecht, Neue Führungskraft, Zitat';
    expect(resolveAmbiguous(t, 'neg', 'Kein Budget oder Entscheidungsrecht', ['Kein eigenes Budget'])).toBe('Kein eigenes Budget, Neue Führungskraft, Zitat');
    expect(resolveAmbiguous(t, 'neg', 'Kein Budget oder Entscheidungsrecht', ['Kein eigenes Budget', 'Kaum Entscheidungsrecht'])).toBe('Kein eigenes Budget, Kaum Entscheidungsrecht, Neue Führungskraft, Zitat');
    expect(ambiguousIncidents('Übernahme oder Umbau, seit ca. 04/2026')[0].options).toEqual(['Übernahme', 'Neuorganisation']);
    expect(resolveAmbiguousIncident('Übernahme oder Umbau, seit ca. 04/2026', 'Übernahme oder Umbau', ['Neuorganisation'])).toBe('Neuorganisation, seit ca. 04/2026');
  });
  it('„Umstrukturierung“ aus alten Interviews ist jetzt genau der Knopf Umstrukturierung', () => {
    expect(motiveLabels('Umstrukturierung', 'neg')).toEqual(['Umstrukturierung']);
  });
  it('meldet widersprüchliche Ergänzungen', () => {
    expect(additionConflicts('Gerne im Mittelstand. Gerne im Konzern.')).toEqual([['Gerne im Mittelstand', 'Gerne im Konzern']]);
    expect(additionConflicts('Gerne im Konzern.')).toEqual([]);
  });
  it('Mittelstand und Konzern schließen sich aus', () => {
    expect(toggleAddition('Gerne im Mittelstand. Offen für Umzug.', 'Gerne im Konzern')).toBe('Offen für Umzug. Gerne im Konzern.');
  });
});

describe('Auslöser statt „Warum gerade jetzt?“', () => {
  it('Suchstatus als Knöpfe, mit eigenem Satz', () => {
    expect(incidentSentence('Kein einzelner Anlass, Wurde angesprochen', null)).toBe('Kein einzelner Anlass, es hat sich schleichend entwickelt. Wurde angesprochen und ist offen für einen Wechsel.');
    expect(incidentSentence('Neue Führungskraft, seit ca. 04/2026, Sucht aktiv', 'Regelmäßig')).toBe('Im Frühjahr 2026 kam eine neue Führungskraft. Seitdem ist es regelmäßig ein Thema. Sucht bereits aktiv nach einer neuen Stelle.');
    expect(incidentChipsFor('it', [], '')).toEqual(expect.arrayContaining(['Kein einzelner Anlass', 'Wurde angesprochen', 'Sucht aktiv']));
  });
  it('„Wann“ und „Wie oft“ nur bei einem echten Anlass', () => {
    expect(incidentHasEvent('Kein einzelner Anlass, Sucht aktiv')).toBe(false);
    expect(incidentHasEvent('Neuorganisation')).toBe(true);
    expect(incidentHasEvent('Nach 8 Jahren keine nächste Stufe')).toBe(true);
  });
  it('erkennt automatisch gefülltes „Warum jetzt“, frühere eigene Angaben bleiben', () => {
    expect(isAutoWhyNow('')).toBe(true);
    expect(isAutoWhyNow('Im Frühjahr 2026 kam eine neue Führungskraft. Seitdem ist es regelmäßig ein Thema.')).toBe(true);
    expect(isAutoWhyNow('Kein einzelner Anlass, es hat sich schleichend entwickelt. Wurde angesprochen und ist offen für einen Wechsel.')).toBe(true);
    expect(isAutoWhyNow('Läuft schon länger, Wurde angesprochen')).toBe(false);
    expect(isAutoWhyNow('Will endlich weg.')).toBe(false);
  });
});

describe('Eigene Worte verstehen', () => {
  const labels = (text: string, side: 'pos' | 'neg', fam: RoleFamily | null = null) => understandOwnWords(text, side, fam).map((u) => u.label);
  it('versteht Chef, Überarbeitung und Entscheidungen, mit Satzteil als Beleg', () => {
    const hits = understandOwnWords('mein chef entscheidet alles allein, bin total überarbeitet', 'neg', 'it');
    expect(hits.map((h) => h.label)).toEqual(['Probleme mit der Führungskraft', 'Kaum Entscheidungsrecht', 'Arbeitslast']);
    expect(hits[0]).toMatchObject({ quote: 'mein chef entscheidet alles allein', detail: 'Führungskraft entscheidet allein' });
    expect(hits[2].quote).toBe('bin total überarbeitet');
  });
  it('Führungskraft-Details auch im Folgesatz, neue Führungskraft vor allgemeiner', () => {
    expect(understandOwnWords('seit der neue gf da ist, mischt er sich überall ein', 'neg', 'fuehrung').map((h) => [h.label, h.detail ?? null]))
      .toEqual([['Neue Führungskraft', null], ['Probleme mit der Führungskraft', 'Führungskraft mischt sich überall ein']]);
    expect(labels('probleme mit vorgesetzten', 'neg')).toEqual(['Probleme mit der Führungskraft']);
  });
  it('Lob bei „stört“ und Verneinung bei „gefällt“ ergeben keinen Vorschlag', () => {
    expect(labels('die kollegen sind super aber das gehalt passt nicht', 'neg')).toEqual(['Gehalt']);
    expect(labels('das gehalt ist nicht gut', 'pos')).toEqual([]);
  });
  it('wählt den Knopf der Familie bei gleichem Sinn', () => {
    expect(labels('zu wenig geld und ständig einspringen', 'neg', 'gewerblich')).toEqual(['Bezahlung', 'Ständiges Einspringen']);
    expect(labels('nah am wohnort, gute bezahlung', 'pos', 'gewerblich')).toEqual(['Nähe zum Wohnort', 'Bezahlung']);
  });
  it('lässt Angetipptes und gewählte Details weg', () => {
    expect(labels('Arbeitslast, bin total überarbeitet', 'neg')).toEqual([]);
    expect(labels('Wenig Rückendeckung, mein chef lässt mich hängen', 'neg')).toEqual([]);
  });
  it('schlägt den genauen Knopf vor, wenn die Führungskraft schon angetippt ist', () => {
    expect(labels('Probleme mit der Führungskraft, mein chef entscheidet alles allein', 'neg')).toEqual(['Führungskraft entscheidet allein', 'Kaum Entscheidungsrecht']);
  });
  it('gelernte Wendungen zählen sofort', () => {
    const learned = [{ side: 'neg' as const, phrase: 'endlose telkos', label: 'Mehr Termine als Arbeit' }];
    expect(understandOwnWords('die endlose Telkos fressen meinen halben Tag', 'neg', 'it')).toEqual([]);
    expect(understandOwnWords('die endlose Telkos fressen meinen halben Tag', 'neg', 'it', learned)).toEqual([
      { label: 'Mehr Termine als Arbeit', quote: 'die endlose Telkos fressen meinen halben Tag', source: 'gelernt' },
    ]);
  });
  it('gelernt wird nur kurz und ohne Namen, Zahlen oder Mails', () => {
    expect(learnablePhrase('Jour fixes')).toBe('jour fixes');
    expect(learnablePhrase('Herr Müller nervt total mit seinen Meetings jeden Tag')).toBe('nervt total mit seinen meetings jeden');
    expect(learnablePhrase('3 Stunden Pendeln')).toBeNull();
    expect(learnablePhrase('a@b.de')).toBeNull();
  });
  it('„Wie genau?“ ersetzt den ungenauen Knopf an seiner Stelle', () => {
    expect(motiveDetailChoices('Arbeitslast, Probleme mit der Führungskraft', 'neg')).toEqual([{ label: 'Probleme mit der Führungskraft', options: MOTIVE_NEG['Probleme mit der Führungskraft'].details }]);
    expect(replaceMotive('Arbeitslast, Probleme mit der Führungskraft, eigene Worte', 'Probleme mit der Führungskraft', 'Wenig Rückendeckung', 'neg'))
      .toBe('Arbeitslast, Wenig Rückendeckung, eigene Worte');
  });
  it('genaue Knöpfe ohne Komma und ohne „oder/und“', () => {
    for (const d of MOTIVE_NEG['Probleme mit der Führungskraft'].details ?? []) {
      expect(d.includes(','), d).toBe(false);
      expect(/\s(oder|und)\s/.test(d), d).toBe(false);
      expect(MOTIVE_NEG[d].detailOf).toBe('Probleme mit der Führungskraft');
    }
  });
});

describe('Frühere Zusatzknöpfe', () => {
  it('werden zu Antworten, der Rest bleibt Ergänzung', () => {
    expect(legacyAddonFields('Gerne im Mittelstand. Offen für Branchenwechsel. Offen für Umzug. Gerne international. Langfristige Perspektive wichtig.')).toEqual({
      env: { companySize: 'midsize', industryChange: 'open', relocation: true, international: 'yes' },
      rest: 'Langfristige Perspektive wichtig.',
    });
    expect(legacyAddonFields('Gerne im Mittelstand. Gerne im Konzern.')).toEqual({ env: {}, rest: 'Gerne im Mittelstand. Gerne im Konzern.' });
    expect(legacyAddonFields('Möchte endlich selbst entscheiden.')).toEqual({ env: {}, rest: 'Möchte endlich selbst entscheiden.' });
  });
  it('Zitat erst ab einem ganzen Satz ohne Personen und Geld', () => {
    expect(motivationQuote('Arbeitslast, überarbeitet')).toBe('');
    expect(motivationQuote('Arbeitslast, mein Chef lässt mich immer hängen')).toBe('');
    expect(motivationQuote('Arbeitslast, will wieder etwas bewegen können')).toBe('Will wieder etwas bewegen können.');
  });
});

describe('Früher erzeugte Kundentexte', () => {
  it('erkennt auch Ziel- und Umfeld-Sätze', () => {
    const t = 'Sucht weniger Bereitschaftsdienst. Nächster Schritt: Tech Lead. Bevorzugt den Mittelstand und ist offen für einen Umzug. Wichtig bleibt außerdem Remote-Arbeit. Will endlich selbst entscheiden.';
    expect(earlierGeneratedMotivation(t)).toEqual({ auto: true, addition: 'Will endlich selbst entscheiden.' });
  });
  it('werden erkannt, eigene Sätze bleiben als Ergänzung', () => {
    const alt = 'Sucht echte Entscheidungsbefugnis mit eigenem Budget und mehr Zeit für Führung und fachliche Themen. Anlass ist eine Neuorganisation im Frühjahr 2026. Wichtig bleiben außerdem ein gut besetztes Team, ein wirtschaftlich stabiles Umfeld und Gestaltungsspielraum. Gerne im Mittelstand.';
    expect(earlierGeneratedMotivation(alt)).toEqual({ auto: true, addition: 'Gerne im Mittelstand.' });
  });
  it('selbst umformulierte Sätze zählen nicht', () => {
    expect(earlierGeneratedMotivation('Sucht mehr Verantwortung im Mittelstand.').auto).toBe(false);
    expect(earlierGeneratedMotivation('Will endlich selbst entscheiden.').auto).toBe(false);
  });
});
