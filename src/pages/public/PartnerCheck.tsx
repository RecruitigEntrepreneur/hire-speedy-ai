import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { intlLocale } from '@/i18n/languages';
import { LanguageMenu } from '@/components/language/LanguageMenu';
import { LanguageHint } from '@/components/language/LanguageHint';
import { BadgeCheck, CircleOff, Loader2, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MatchuntLogo } from '@/components/ui/MatchuntLogo';
import { supabase } from '@/integrations/supabase/client';
import { PartnerCard } from '@/components/recruiter/partner/PartnerCard';
import { LigaAwardCard } from '@/components/recruiter/liga/LigaAwardCard';
import { normalizeNumber, PARTNER_NUMBER, TIER_LABEL, type PublicPartner } from '../../../supabase/functions/_shared/recruiter-partner';

/**
 * Öffentliche Prüfseite matchunt.ai/partner/<nummer> (Partnerstatus, Etappe 3).
 * Ohne Anmeldung; zeigt nur, was die Function partner-check freigibt. Nicht für
 * Suchmaschinen: Wer prüfen will, kommt über Link, QR-Code oder Abzeichen.
 */
function useNoIndex() {
  const { t } = useTranslation('candidatePages');
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    const title = document.title;
    document.title = t('partner.docTitle');
    return () => { meta.remove(); document.title = title; };
  }, [t]);
}

// Datum und Uhrzeit in deutscher Zeit, geschrieben in der Sprache der Seite.
const berlin = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(iso).toLocaleString(intlLocale(i18n.language), { timeZone: 'Europe/Berlin', ...opts });
const time = (iso: string) => berlin(iso, { hour: '2-digit', minute: '2-digit' });
const dayDate = (iso: string) => berlin(iso, { day: '2-digit', month: '2-digit', year: 'numeric' });
const monthYear = (iso: string) => berlin(iso, { month: 'long', year: 'numeric' });

export default function PartnerCheck() {
  useNoIndex();
  const { t } = useTranslation(['candidatePages', 'recruiterLiga']);
  const { number: raw } = useParams();
  const navigate = useNavigate();
  const number = normalizeNumber(raw);
  const [result, setResult] = useState<PublicPartner | null>(null);
  const [failed, setFailed] = useState(false);
  const [other, setOther] = useState('');

  useEffect(() => {
    let active = true;
    setResult(null); setFailed(false);
    if (!PARTNER_NUMBER.test(number)) { setResult({ state: 'invalid' }); return; }
    void supabase.functions.invoke('partner-check', { body: { number } }).then(({ data, error }) => {
      if (!active) return;
      if (error || !data || typeof data !== 'object' || !('state' in data)) setFailed(true);
      else setResult(data as PublicPartner);
    });
    return () => { active = false; };
  }, [number]);

  const check = (e: FormEvent) => {
    e.preventDefault();
    const n = normalizeNumber(other);
    if (n) navigate(`/partner/${n}`);
  };

  return <div className="flex min-h-screen flex-col bg-background text-foreground">
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
        <Link to="/" className="flex items-center gap-2 font-semibold"><MatchuntLogo size={32}/>Matchunt</Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">{t('partner.heading')}</span>
          <LanguageMenu/>
        </div>
      </div>
      <LanguageHint className="border-b-0 border-t"/>
    </header>

    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <Card>
        <CardContent className="p-6 sm:p-8">
          {!result && !failed && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>{t('partner.checking')}</p>}
          {failed && <p role="alert" className="text-sm">{t('partner.unreachable')}</p>}

          {result?.state === 'active' && <div className="flex flex-col-reverse gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-sm font-medium text-success"><BadgeCheck className="h-5 w-5"/>{t('partner.verified', { tier: TIER_LABEL[result.tier] })}</p>
              <div>
                <h1 className="text-2xl font-semibold sm:text-3xl">{result.name || t('partner.fallbackName')}</h1>
                {result.company && <p className="text-muted-foreground">{result.company}</p>}
              </div>
              <p className="text-sm text-muted-foreground">{t('partner.since', { date: monthYear(result.since) })} <span className="font-mono">{result.number}</span><br/>
                {t('partner.checkedAt', { date: dayDate(result.checkedAt), time: time(result.checkedAt) })}</p>
              {result.expertise && <p className="border-t border-border pt-3 text-sm"><span className="text-muted-foreground">{t('partner.expertise')}</span>{result.expertise}</p>}
              {result.award && <p className="border-t border-border pt-3 text-sm">
                <span className="text-[#C8A24A]">✦ </span><span className="font-medium">{t('partner.awardSentence', { award: t(`recruiterLiga:award.${result.award.award}`), season: result.award.season_label, rank: result.award.rank, total: result.award.participants })}</span>
                <span className="block text-xs text-muted-foreground">{t('partner.criteria')}</span>
              </p>}
            </div>
            <div className="flex shrink-0 flex-col items-start gap-2 self-start sm:items-end sm:self-center">
              <PartnerCard tier={result.tier} size="lg"/>
              {result.award && <LigaAwardCard award={result.award.award} season={result.award.season_label}/>}
            </div>
          </div>}

          {(result?.state === 'paused' || result?.state === 'ended') && <div className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><CircleOff className="h-5 w-5"/>{t('partner.inactive')}</p>
            <h1 className="text-xl font-semibold">{result.state === 'ended' ? t('partner.endedSince', { date: dayDate(result.endedAt) }) : t('partner.paused')}</h1>
            <p className="text-sm text-muted-foreground">{t('partner.number')} <span className="font-mono">{result.number}</span>{t('partner.notValid')}</p>
          </div>}

          {result?.state === 'invalid' && <div className="space-y-4">
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><SearchX className="h-5 w-5"/>{t('partner.unknown')}</p>
              <h1 className="text-xl font-semibold">{t('partner.unknownTitle')}</h1>
              <p className="text-sm text-muted-foreground">{t('partner.unknownBody')}</p>
            </div>
            <form onSubmit={check} className="flex max-w-sm gap-2">
              <Input value={other} onChange={e => setOther(e.target.value)} placeholder="MP-7K3Q-92XW" aria-label={t('partner.numberLabel')} className="font-mono"/>
              <Button type="submit" disabled={!other.trim()}>{t('partner.check')}</Button>
            </form>
          </div>}
        </CardContent>
      </Card>
      <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
        {t('partner.disclaimer')}
      </p>
    </main>

    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-3xl flex-wrap gap-x-4 gap-y-1 px-4 py-4 text-xs text-muted-foreground">
        <Link to="/" className="hover:underline">{t('partner.whatIs')}</Link>
        <Link to="/impressum" className="hover:underline">{t('common.imprint')}</Link>
        <Link to="/datenschutz" className="hover:underline">{t('common.privacy')}</Link>
      </div>
    </footer>
  </div>;
}
