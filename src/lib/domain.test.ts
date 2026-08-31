import { describe, expect, it } from 'vitest';
import {
  normalizeDomain, domainFromEmail, extractDomain,
  isFreemailDomain, isFreemailAddress, isPlausibleEmail, maskEmail,
} from './domain';

/**
 * Die Domain-Normalisierung entscheidet über Dubletten und über den
 * Missbrauchsschutz am öffentlichen Link. Vier divergierende Implementierungen
 * im Bestand konnten für dieselbe Eingabe unterschiedliche Domains erzeugen und
 * damit die UNIQUE-Prüfung auf outreach_companies.domain umgehen.
 */
describe('normalizeDomain', () => {
  it('vereinheitlicht Protokoll, Schreibweise, www und Pfad', () => {
    for (const input of [
      'https://www.Acme.de/karriere?utm=x',
      'HTTP://acme.de',
      '  www.acme.de  ',
      'acme.de/',
      'acme.de.',
      'https://acme.de:8443/jobs',
    ]) {
      expect(normalizeDomain(input), input).toBe('acme.de');
    }
  });

  it('entfernt nur ein FÜHRENDES www., nicht jedes Vorkommen', () => {
    // useCompanyImport.ts:41 benutzt replace('www.','') und verstümmelt damit
    // genau diesen Fall.
    expect(normalizeDomain('foo.wwwbar.de')).toBe('foo.wwwbar.de');
    expect(normalizeDomain('www.wwwbar.de')).toBe('wwwbar.de');
  });

  it('behält Subdomains — jobs.acme.de ist nicht acme.de', () => {
    expect(normalizeDomain('jobs.acme.de')).toBe('jobs.acme.de');
  });

  it('verwirft Unbrauchbares statt Halbgares zu liefern', () => {
    for (const input of [null, undefined, '', '   ', 'localhost', 'acme', 'kein hostname', 'ünicode.de']) {
      expect(normalizeDomain(input as string), String(input)).toBeNull();
    }
  });

  it('akzeptiert Punycode', () => {
    expect(normalizeDomain('xn--mller-kva.de')).toBe('xn--mller-kva.de');
  });
});

describe('domainFromEmail / extractDomain', () => {
  it('zieht die Domain aus einer Adresse', () => {
    expect(domainFromEmail('Vorname.Name@Acme.DE')).toBe('acme.de');
    expect(domainFromEmail('name@mail.acme.de')).toBe('mail.acme.de');
  });

  it('gibt bei fehlendem @ null zurück statt zu raten', () => {
    expect(domainFromEmail('acme.de')).toBeNull();
  });

  it('nimmt beides: Adresse oder URL', () => {
    expect(extractDomain('name@acme.de')).toBe('acme.de');
    expect(extractDomain('https://www.acme.de')).toBe('acme.de');
  });
});

describe('Freemail-Erkennung', () => {
  it('kennt die im DACH-Raum relevanten Anbieter', () => {
    for (const d of ['gmail.com', 'web.de', 'gmx.de', 'gmx.net', 't-online.de',
                     'freenet.de', 'icloud.com', 'outlook.de', 'bluewin.ch', 'aon.at']) {
      expect(isFreemailDomain(d), d).toBe(true);
    }
  });

  it('kennt gängige Wegwerfdienste', () => {
    for (const d of ['mailinator.com', 'yopmail.com', 'trashmail.de', '10minutemail.com']) {
      expect(isFreemailDomain(d), d).toBe(true);
    }
  });

  it('hält Firmendomains für Firmendomains', () => {
    for (const d of ['acme.de', 'bluewater-bridge.de', 'matchunt.ai', 'mail.acme.de']) {
      expect(isFreemailDomain(d), d).toBe(false);
    }
  });

  it('normalisiert vor der Prüfung — sonst rutscht Großschreibung durch', () => {
    expect(isFreemailAddress('Max.Mustermann@GMAIL.COM')).toBe(true);
    expect(isFreemailAddress('max@www.gmail.com')).toBe(true);
  });
});

describe('isPlausibleEmail', () => {
  it('lässt reale Adressen durch', () => {
    for (const e of ['a@b.de', 'vorname.name+tag@sub.acme.co.uk', "o'brien@acme.ie"]) {
      expect(isPlausibleEmail(e), e).toBe(true);
    }
  });

  it('weist offensichtlich Unbrauchbares ab', () => {
    for (const e of ['', 'name', 'name@', '@acme.de', 'name@acme', 'a b@acme.de', 'name@acme,de']) {
      expect(isPlausibleEmail(e), e).toBe(false);
    }
  });
});

describe('maskEmail', () => {
  it('zeigt genug zum Wiedererkennen und nicht mehr', () => {
    expect(maskEmail('marko@acme.de')).toBe('ma***@acme.de');
    expect(maskEmail('a@acme.de')).toBe('a***@acme.de');
  });
});
