import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Loader2, X } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { buchhaltungApi, dateDe, todayIso } from '@/lib/buchhaltungApi';
import { ErrorLine, Loading, errText, useRefresh } from '@/components/admin/buchhaltung/ui';

const pct = (v: number | null) => (v == null ? '–' : String(v).replace('.', ','));

/**
 * Admin › Pakete & Konditionen (A10, J6, Umbau 11.11.2026): Fassungen mit Prüfregeln,
 * Stichtag für Fassung 2, Headhunter informieren, Zustimmungen, Standardwerte des
 * Angebots bei Core-Nichtantritt. Die Werte selbst stehen fest im Code (konditionen.ts).
 */
export default function AdminPaketeKonditionen() {
  const refresh = useRefresh();
  const q = useQuery({ queryKey: ['admin-buchhaltung', 'konditionen'], queryFn: () => buchhaltungApi.conditions() });
  const d = q.data;
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [list, setList] = useState(false);
  useEffect(() => { if (d) setDate(d.settings.activeFrom ?? ''); }, [d?.settings.activeFrom]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveDate = async (value: string | null) => {
    setBusy('date');
    try { await buchhaltungApi.setConditionsDate(value); toast.success(value ? `Stichtag ${dateDe(value)} gespeichert.` : 'Stichtag entfernt. Alle Headhunter bleiben auf Fassung 1.'); refresh(); } catch (e) { toast.error(errText(e)); } finally { setBusy(null); }
  };
  const announce = async () => {
    setBusy('announce');
    try { const r = await buchhaltungApi.announceConditions(); toast.success(`${r.notified} Headhunter informiert, ${r.mailed} Mails verschickt${r.alreadyConsented ? `, ${r.alreadyConsented} haben schon zugestimmt` : ''}.`); if (r.mailFailed?.length) toast.error(`Mail nicht zugestellt an: ${r.mailFailed.join(', ')}`); refresh(); } catch (e) { toast.error(errText(e)); } finally { setBusy(null); }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-5">
        <div>
          <h1 className="text-2xl font-semibold">Pakete & Konditionen</h1>
          <p className="text-sm text-muted-foreground">Was der Kunde zahlt und wie es sich aufteilt, in Prozent vom Bruttojahreszielgehalt. Jede Besetzung trägt die Fassung, die bei der Aktivierung der Stelle galt.</p>
        </div>
        {q.isLoading ? <Loading /> : q.error || !d ? <ErrorLine error={q.error} /> : (
          <>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="p-2">Paket</th><th className="p-2 text-right">Kunde</th><th className="p-2 text-right">bei Antritt</th><th className="p-2 text-right">nach Garantie</th>
                    <th className="p-2 text-right">Matchunt</th><th className="p-2 text-right">Auslobung</th><th className="p-2 text-right">Matchunt im Fall</th><th className="p-2" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {d.rows.map((r) => (
                    <tr key={`${r.key}-${r.version ?? 0}`}>
                      <td className="p-2 font-medium">{r.label}</td>
                      <td className="p-2 text-right tabular-nums">{pct(r.clientPct)}</td>
                      <td className="p-2 text-right tabular-nums">{pct(r.initialPct)}</td>
                      <td className="p-2 text-right tabular-nums">{pct(r.retentionPct)}</td>
                      <td className="p-2 text-right tabular-nums">{pct(r.matchuntPct)}</td>
                      <td className="p-2 text-right tabular-nums">{pct(r.bountyPct)}</td>
                      <td className="p-2 text-right tabular-nums">{pct(r.matchuntOnClaimPct)}</td>
                      <td className="p-2">{r.ok ? <Check className="h-4 w-4 text-muted-foreground" /> : <X className="h-4 w-4 text-destructive" />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="flex gap-2 text-sm">
              {d.allOk ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> : <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
              <span>{d.allOk ? 'Beide Prüfregeln gehen auf' : 'Eine Prüfregel geht nicht auf'} · {d.checkText}</span>
            </p>

            <div className="space-y-3 rounded-lg border p-4">
              <p className="font-medium">Fassung 2</p>
              <p className="text-sm text-muted-foreground">
                {d.settings.activeFrom
                  ? `Gilt ab ${dateDe(d.settings.activeFrom)} für Stellen, die danach aktiviert werden: für neue Headhunter und alle, die zustimmen. Für alle anderen ab ${dateDe(d.settings.forcedFrom)} (12 Monate, Vertrag § 18 Abs. 2).`
                  : 'Noch kein Stichtag. Bis dahin gilt für alle Fassung 1.'}
              </p>
              {d.canEditDate ? (
                <div className="flex flex-wrap items-end gap-2">
                  <label className="block text-sm"><span className="text-muted-foreground">Stichtag („ab Live-Gang“)</span><Input type="date" min={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 h-9 w-48" /></label>
                  <Button size="sm" disabled={busy === 'date' || !date || date === d.settings.activeFrom} onClick={() => saveDate(date)}>{busy === 'date' && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Stichtag speichern</Button>
                  {d.settings.activeFrom && <Button size="sm" variant="ghost" disabled={busy === 'date'} onClick={() => saveDate(null)}>Stichtag entfernen</Button>}
                </div>
              ) : <p className="text-xs text-muted-foreground">Fassung 2 gilt schon, der Stichtag lässt sich nicht mehr ändern.</p>}
              <div className="flex flex-wrap items-center gap-2 border-t pt-3 text-sm">
                <p className="min-w-0 flex-1 text-muted-foreground">
                  Zustimmung der Headhunter: {d.consents.count} von {d.consents.total}
                  {d.settings.announcedAt ? ` · informiert am ${dateDe(d.settings.announcedAt.slice(0, 10))}` : ''}
                  {d.announce.latest && !d.settings.announcedAt ? ` · informieren spätestens bis ${dateDe(d.announce.latest)}` : ''}
                </p>
                <Button size="sm" variant="ghost" onClick={() => setList(true)}>Liste</Button>
                <Button size="sm" variant="outline" disabled={!d.announce.allowed || busy === 'announce'} title={d.announce.why ?? undefined} onClick={announce}>
                  {busy === 'announce' && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{d.settings.announcedAt ? 'Erneut informieren' : 'Headhunter informieren'}
                </Button>
              </div>
              {d.announce.why && <p className="text-xs text-muted-foreground">{d.announce.why}</p>}
              <p className="text-xs text-muted-foreground">Die Headhunter bekommen eine Mail (Nachweis der Ankündigung in Textform, § 18 Abs. 2) und eine Mitteilung in der App und sehen oben in ihrer Übersicht den Hinweis mit „Ansehen“, bis sie zugestimmt haben.</p>
            </div>

            <div className="space-y-2 rounded-lg border p-4 text-sm">
              <p className="font-medium">Standardwerte · Nachbesetzung als Option bei Core-Nichtantritt</p>
              <div className="grid gap-x-6 gap-y-1 sm:grid-cols-[14rem_1fr]">
                <span className="text-muted-foreground">Nur auf Entscheidung von</span><span>Matchunt, je Fall</span>
                <span className="text-muted-foreground">Vorgeschlagener Preis</span><span>{pct(d.joker.pct)} % vom Zielgehalt, je Fall änderbar (auch 0 € als Kulanz)</span>
                <span className="text-muted-foreground">Angebot gültig</span><span>{d.joker.validDays} Tage</span>
                <span className="text-muted-foreground">Wann</span><span>nur bei „nicht angefangen“, höchstens einmal je Besetzung</span>
              </div>
              <p className="text-xs text-muted-foreground">Fest im Code. Nimmt der Kunde an, gilt das als eigene kleine Vereinbarung in Textform. Das Wort „Joker“ sieht der Kunde nie.</p>
            </div>
          </>
        )}
      </div>
      <Dialog open={list} onOpenChange={setList}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader className="text-left">
            <DialogTitle>Zustimmung zu Fassung 2</DialogTitle>
            <DialogDescription>{d ? `${d.consents.count} von ${d.consents.total} Headhuntern` : ''}</DialogDescription>
          </DialogHeader>
          <div className="divide-y rounded-lg border text-sm">
            {(d?.consents.list ?? []).map((c) => (
              <div key={c.id} className="flex items-center gap-2 p-2">
                <span className="flex-1"><span className="block">{c.name}</span><span className="block text-xs text-muted-foreground">{c.email ?? ''}</span></span>
                <span className="text-xs text-muted-foreground">{c.consentedAt ? `zugestimmt ${dateDe(c.consentedAt.slice(0, 10))}` : 'noch nicht'}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
