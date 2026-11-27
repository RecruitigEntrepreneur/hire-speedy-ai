import { describe, expect, it } from 'vitest';
import { pickTourJob } from '@/components/client/tour/tourData';

describe('Kunden-Rundgang: welche Stelle er zeigt', () => {
  it('nimmt die neueste Stelle in Festanstellung und überspringt Contracting (Marko 17.11.2026)', () => {
    const rows = [
      { id: 'a', employment_type: 'freelance' },
      { id: 'b', employment_type: 'contracting' },
      { id: 'c', employment_type: 'full-time' },
      { id: 'd', employment_type: 'full_time' },
    ];
    expect(pickTourJob(rows)?.id).toBe('c');
  });

  it('nur Contracting: keine eigene Stelle, dann läuft der Rundgang am Beispiel in Festanstellung', () => {
    expect(pickTourJob([{ id: 'a', employment_type: 'freelance' }])).toBeNull();
    expect(pickTourJob([])).toBeNull();
  });

  it('ohne Angabe zur Art gilt die Stelle als Festanstellung', () => {
    expect(pickTourJob([{ id: 'a', employment_type: null }])?.id).toBe('a');
  });
});
