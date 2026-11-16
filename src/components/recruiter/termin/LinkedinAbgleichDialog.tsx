import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Linkedin, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { abgleichZeilen, uebernahme, type Aktuell, type ZeilenArt } from '@/lib/linkedinAbgleich';
import { linkedinApi, type LinkedinDatenfreigabe } from '@/lib/terminApi';

// Schlüssel der Hinweise je Stand der Datenfreigabe (Texte: recruiterTermin, linkedin.abgleich)
const HINWEIS: Record<Exclude<LinkedinDatenfreigabe, 'bereit'>, string> = {
  aus: 'linkedin.abgleich.dmaAus',
  in_arbeit: 'linkedin.abgleich.dmaInArbeit',
  nicht_freigegeben: 'linkedin.abgleich.dmaNichtFreigegeben',
};

/**
 * Profil › Über dich (16.11.2026): „Das haben wir auf LinkedIn gefunden“.
 * Ergänzen statt überschreiben: Leere Felder sind vorausgewählt, Eingetragenes ändert sich nur per Häkchen.
 */
export function LinkedinAbgleichDialog({ open, onOpenChange, aktuell, onUebernommen, onFreigeben }: {
  open: boolean; onOpenChange: (v: boolean) => void; aktuell: Aktuell; onUebernommen: () => void; onFreigeben: () => void;
}) {
  // recruiterFunnel: Anzeige der Katalogwerte (Sprachen, Bereiche) in den Zeilen
  const { t, i18n } = useTranslation(['recruiterTermin', 'recruiterFunnel']);
  const { user } = useAuth();
  const abgleich = useQuery({ queryKey: ['linkedin-abgleich', user?.id], enabled: open && !!user?.id, staleTime: 0, gcTime: 0, retry: false, queryFn: () => linkedinApi.abgleich() });
  // Sprache als Abhängigkeit: Zeilentexte entstehen in der Sprache der Oberfläche.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- i18n.language bestimmt die Texte
  const zeilen = useMemo(() => (abgleich.data ? abgleichZeilen(abgleich.data, aktuell) : []), [abgleich.data, aktuell, i18n.language]);
  const [gewaehlt, setGewaehlt] = useState<Set<ZeilenArt>>(new Set());
  const [busy, setBusy] = useState(false);
  useEffect(() => { setGewaehlt(new Set(zeilen.filter((z) => z.vorausgewaehlt).map((z) => z.art))); }, [zeilen]);

  const umschalten = (art: ZeilenArt, an: boolean) => setGewaehlt((g) => { const n = new Set(g); if (an) n.add(art); else n.delete(art); return n; });

  const uebernehmen = async () => {
    if (!abgleich.data || !user?.id) return;
    const u = uebernahme(gewaehlt, abgleich.data, aktuell);
    setBusy(true);
    try {
      if (u.foto) await linkedinApi.fotoUebernehmen();
      const update: Record<string, unknown> = { ...u.profil };
      if (u.expertise) update.recruiter_expertise = u.expertise;
      if (Object.keys(update).length) {
        const { error } = await supabase.from('profiles').update(update as never).eq('user_id', user.id);
        if (error) throw new Error(t('linkedin.abgleich.saveFailed'));
      }
      toast.success(t('linkedin.abgleich.adopted', { count: gewaehlt.size }));
      onUebernommen();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('linkedin.abgleich.failed'));
    } finally {
      setBusy(false);
    }
  };

  const dma = abgleich.data?.dma;
  return <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
    <DialogContent className="max-w-xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><Linkedin className="h-5 w-5 text-[#0A66C2]"/>{t('linkedin.abgleich.title')}</DialogTitle>
        <DialogDescription>{t('linkedin.abgleich.description')}</DialogDescription>
      </DialogHeader>

      {abgleich.isLoading ? <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>{t('linkedin.abgleich.loading')}</p>
        : abgleich.isError ? <div className="space-y-3 py-2">
          <p className="text-sm">{abgleich.error instanceof Error ? abgleich.error.message : t('linkedin.abgleich.readFailed')}</p>
          <Button variant="outline" size="sm" onClick={() => void abgleich.refetch()}>{t('linkedin.abgleich.retry')}</Button>
        </div>
        : <div className="space-y-3">
          {zeilen.length ? <ul className="divide-y divide-border rounded-lg border border-border">
            {zeilen.map((z) => <li key={z.art}>
              <label className="grid cursor-pointer grid-cols-[1.25rem_6.5rem_minmax(0,1fr)] items-start gap-3 px-3 py-2.5">
                <Checkbox className="mt-0.5" checked={gewaehlt.has(z.art)} onCheckedChange={(v) => umschalten(z.art, v === true)} aria-label={z.titel}/>
                <span className="text-sm text-muted-foreground">{z.titel}</span>
                <span className="min-w-0 text-sm">
                  <span className="flex items-center gap-2">
                    {z.art === 'foto' && abgleich.data?.bild && <img src={abgleich.data.bild} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" referrerPolicy="no-referrer"/>}
                    <span>{z.neu}</span>
                  </span>
                  {z.bisher && <span className="block text-xs text-muted-foreground">{t('linkedin.abgleich.before', { value: z.bisher })}</span>}
                  {z.hinweis && <span className="block text-xs text-muted-foreground">{z.hinweis}</span>}
                </span>
              </label>
            </li>)}
          </ul> : <p className="py-2 text-sm">{t('linkedin.abgleich.upToDate')}</p>}
          {dma && dma !== 'bereit' && <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{t(HINWEIS[dma])}</span>
            {dma === 'nicht_freigegeben' && <Button variant="outline" size="sm" onClick={onFreigeben}>{t('linkedin.abgleich.approve')}</Button>}
          </div>}
        </div>}

      <DialogFooter className="items-center gap-2 sm:justify-between">
        <span className="text-xs text-muted-foreground">{t('linkedin.abgleich.clientsDontSee')}</span>
        <div className="flex gap-2">
          <Button variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>{zeilen.length ? t('linkedin.abgleich.skip') : t('linkedin.abgleich.close')}</Button>
          {zeilen.length > 0 && <Button disabled={busy || gewaehlt.size === 0} onClick={() => void uebernehmen()}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}{gewaehlt.size === 0 ? t('linkedin.abgleich.adopt') : t('linkedin.abgleich.adoptCount', { count: gewaehlt.size })}
          </Button>}
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
