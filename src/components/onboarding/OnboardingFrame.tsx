import type { ReactNode } from 'react';
import { Check, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MatchuntWordmark } from '@/components/ui/MatchuntWordmark';
import { MatchuntLogo } from '@/components/ui/MatchuntLogo';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { LanguageMenu } from '@/components/language/LanguageMenu';
import { LanguageHint } from '@/components/language/LanguageHint';
import './onboarding.css';

const STEP_KEYS = ['verify', 'details', 'contract', 'review'] as const;

export default function OnboardingFrame({ stage, title, description, email, accountAction, children }: { stage: number; title: string; description: string; email?: string; accountAction?: ReactNode; children: ReactNode }) {
  const { t } = useTranslation('recruiterFunnel');
  return <div className="mh-ui mh-onboarding">
    <header className="mh-header"><div className="mh-actions"><a href="/" className="mh-brand" aria-label={t('common.homeAria')}><MatchuntWordmark size="md"/></a><span className="mh-header-tag">{t('frame.tag')}</span></div><div className="mh-header-account">{email ? <span title={email}>{email}</span> : <span><LockKeyhole size={12} className="inline mr-1"/>{t('frame.invitation')}</span>}{accountAction}<LanguageMenu/><ThemeToggle/></div></header>
    <LanguageHint/>
    <main className="mh-main">
      <ol className="mh-steps" aria-label={t('frame.stepsAria')}>{STEP_KEYS.map((key, i) => <li key={key} aria-current={stage === i ? 'step' : undefined} className={i < stage ? 'mh-done' : ''}><span>{i < stage ? <Check size={14}/> : i + 1}</span><span>{t(`frame.steps.${key}`)}</span></li>)}</ol>
      <header className="mh-hero"><p className="mh-kicker">{t('frame.kicker')}</p><h1>{title}</h1><p className="mh-lead">{description}</p></header>
      <div className="mh-client-grid"><div className="mh-stack">{children}</div><aside className="mh-context"><MatchuntLogo size={36}/><h3>{t('frame.aside.title')}</h3><ol><li><strong>{t('frame.aside.confirmTitle')}</strong><p>{t('frame.aside.confirmText')}</p></li><li><strong>{t('frame.aside.detailsTitle')}</strong><p>{t('frame.aside.detailsText')}</p></li><li><strong>{t('frame.aside.signTitle')}</strong><p>{t('frame.aside.signText')}</p></li><li><strong>{t('frame.aside.startTitle')}</strong><p>{t('frame.aside.startText')}</p></li></ol><div className="mh-divider"/><p className="mh-muted" style={{ fontSize: 11 }}><ShieldCheck size={15} className="inline mr-1"/>{t('frame.aside.note')}</p></aside></div>
      <footer className="mh-footer"><span>{t('common.footerClaim')}</span><div><a href="/impressum">{t('common.imprint')}</a><a href="/datenschutz">{t('common.privacy')}</a></div></footer>
    </main>
  </div>;
}
