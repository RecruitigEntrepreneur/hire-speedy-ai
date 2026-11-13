import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, Linkedin, Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { onboardingApi } from '@/lib/recruiterOnboardingApi';
import { AWARD_LABEL, ligaHallOfFame, ligaMe, ligaSetPreferences } from '@/lib/liga';
import { copyText, downloadBase64 } from '@/components/recruiter/partner/partnerClient';
import { linkedinShareUrl } from '../../../../supabase/functions/_shared/recruiter-partner';
import { LigaAwardCard } from './LigaAwardCard';
import { awardPostText, downloadRueckblick } from './ligaShare';

/**
 * H7: Glückwunsch-Fenster nach dem Saisonabschluss, einmal je Saison beim nächsten
 * Öffnen von Übersicht oder Liga. Gemerkt wird es in liga_preferences.award_seen_season.
 */
export function LigaAwardDialog() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation('recruiterLiga');
  const me = useQuery({ queryKey: ['liga', 'me', null], queryFn: () => ligaMe(null), staleTime: 60_000 });
  const hall = useQuery({ queryKey: ['liga', 'hall'], queryFn: ligaHallOfFame, staleTime: 60_000, enabled: !!me.data?.participant });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState('');

  const latest = (hall.data ?? []).find(r => r.is_me && r.awards.length > 0) ?? null;
  const seen = me.data?.prefs?.award_seen_season ?? null;
  useEffect(() => { if (latest && seen !== latest.season_id) setOpen(true); }, [latest, seen]);

  const partner = useQuery({
    queryKey: ['partner-number'],
    enabled: open,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const { data } = await supabase.from('recruiter_partner_status' as never).select('partner_number').eq('user_id', auth.user?.id ?? '').maybeSingle();
      return (data as { partner_number: string } | null)?.partner_number ?? null;
    },
  });

  if (!latest) return null;
  const award = latest.awards[0];
  const close = () => {
    setOpen(false);
    void ligaSetPreferences({ award_seen_season: latest.season_id }).then(() => qc.invalidateQueries({ queryKey: ['liga', 'me'] })).catch(() => undefined);
  };
  const post = () => {
    const text = awardPostText({ award, season: latest.season_label, rank: latest.rank, participants: latest.participants, number: partner.data });
    void copyText(text).then(() => toast({ title: t('dialog.copied'), description: t('dialog.copiedText') }));
    if (partner.data) window.open(linkedinShareUrl(partner.data), '_blank', 'noopener');
  };
  const certificate = async () => {
    setBusy('certificate');
    try {
      const r = await onboardingApi<{ file_name: string; base64: string }>(false, { action: 'partner-certificate' });
      downloadBase64(r.base64, r.file_name, 'application/pdf');
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : t('dialog.certificateFailed'), variant: 'destructive' });
    } finally { setBusy(''); }
  };

  return <Dialog open={open} onOpenChange={o => { if (!o) close(); }}>
    <DialogContent className="max-w-md text-center">
      <div className="mx-auto text-4xl text-[#C8A24A]" aria-hidden>✦</div>
      <DialogTitle className="text-xl">{t('dialog.title', { award: t(`award.${award}`, { defaultValue: AWARD_LABEL[award] }), season: latest.season_label })}</DialogTitle>
      <DialogDescription>
        {t('rankOf', { rank: latest.rank, total: latest.participants })} · {latest.points} {t('table.points')} · {t('placements', { count: latest.placements })}
      </DialogDescription>
      <div className="flex justify-center py-2"><LigaAwardCard award={award} season={latest.season_label} size="lg"/></div>
      <p className="text-xs text-muted-foreground">{t('dialog.badgeNote')}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button onClick={() => { close(); navigate('/recruiter/profile/partnerstatus?panel=signature'); }}><Mail className="mr-2 h-4 w-4"/>{t('dialog.signature')}</Button>
        <Button variant="outline" onClick={post}><Linkedin className="mr-2 h-4 w-4"/>{t('dialog.linkedin')}</Button>
        <Button variant="outline" disabled={busy === 'certificate'} onClick={() => void certificate()}>
          {busy === 'certificate' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileText className="mr-2 h-4 w-4"/>}{t('dialog.certificate')}
        </Button>
        <Button variant="outline" onClick={() => downloadRueckblick({
          season: latest.season_label, placements: latest.placements, interviews: latest.interviews ?? 0, quote: latest.quote,
          rank: latest.rank, participants: latest.participants, award, name: me.data?.name ?? '',
        })}><Download className="mr-2 h-4 w-4"/>{t('hall.image')}</Button>
      </div>
      <Button variant="ghost" size="sm" onClick={close}>{t('dialog.later')}</Button>
    </DialogContent>
  </Dialog>;
}
