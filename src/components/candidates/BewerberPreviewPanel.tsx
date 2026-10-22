import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCandidateFitAssessment } from '@/hooks/useCandidateFitAssessment';
import { useCandidateInsights, verfuegbarAus } from '@/components/candidates/client/useCandidateInsights';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { FrageSheet, initialsOf } from '@/components/candidates/client/FrageSheet';
import { submitterName, useSubmitter } from '@/components/candidates/client/useSubmitter';
import { NOTICE_OPTIONS, optionLabel } from '@/lib/candidateDossier';
import {
  Calendar,
  X,
  ChevronRight,
  MapPin,
  Banknote,
  Clock,
  Briefcase,
  Laptop,
  Sparkles,
  GraduationCap,
  Building2,
  Archive,
  LockOpen,
  MessageSquare,
  Pencil,
  RefreshCw,
  FileText,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BewerberStatusPill, bewerberStateLabel } from './BewerberStatusPill';
import { BewerberNotes } from './BewerberNotes';
import type { BewerberItem } from '@/hooks/useBewerber';
import type { CareerEntry } from '@/hooks/useBewerber';
import type { LucideIcon } from 'lucide-react';

interface BewerberPreviewPanelProps {
  item: BewerberItem;
  onInterviewRequest?: () => void;
  onReject?: () => void;
}

export interface PrimaryAction {
  labelKey: string;
  icon: LucideIcon;
  /** 'wizard' öffnet die Interview-Anfrage; 'feedback', 'offer', 'frage' öffnen das Fenster im Profil; sonst Navigationsziel */
  run: 'wizard' | 'feedback' | 'offer' | 'frage' | string;
}

/** Diese Aktionen laufen als Fenster im Bewerberprofil. */
export const PROFILE_ACTIONS = ['feedback', 'offer', 'contract', 'frage', 'profil'];

const TERMINAL_STAGES = ['hired', 'placed', 'rejected', 'client_rejected', 'withdrawn'];

// Genau EINE Primäraktion pro Zustand — sie beantwortet „Was ist jetzt zu tun?".
export function primaryActionFor(stateKey: string): PrimaryAction {
  if (stateKey === 'opted_in') return { labelKey: 'bewerber.actions.plan_interview', icon: Calendar, run: 'wizard' };
  if (stateKey === 'abgesagt' || stateKey === 'termin_abgesagt' || stateKey === 'no_show')
    return { labelKey: 'bewerber.actions.rerequest', icon: RefreshCw, run: 'wizard' };
  if (stateKey === 'terminvorschlag') return { labelKey: 'bewerber.actions.review_proposal', icon: Calendar, run: '/dashboard/interviews' };
  if (stateKey === 'geplant') return { labelKey: 'bewerber.actions.view_appointment', icon: Calendar, run: '/dashboard/interviews' };
  if (stateKey === 'wartet_kandidat') return { labelKey: 'bewerber.actions.view_request', icon: Eye, run: '/dashboard/interviews' };
  if (stateKey === 'feedback' || stateKey === 'feedback_nodate')
    return { labelKey: 'bewerber.actions.give_feedback', icon: Pencil, run: 'feedback' };
  // Nach dem Feedback: der gewählte Weg ist die Hauptaktion
  if (stateKey === 'naechste_runde') return { labelKey: 'bewerber.actions.plan_next_round', icon: Calendar, run: 'wizard' };
  if (stateKey === 'angebot_vorbereiten') return { labelKey: 'bewerber.actions.make_offer', icon: FileText, run: 'offer' };
  if (stateKey === 'unsicher') return { labelKey: 'bewerber.actions.ask_hh', icon: MessageSquare, run: 'frage' };
  if (stateKey === 'interview_phase') return { labelKey: 'bewerber.actions.view_interviews', icon: Eye, run: '/dashboard/interviews' };
  // Angebot über den Headhunter: die Schritte stehen in der Angebots-Box im Profil
  if (stateKey === 'offer_negotiating') return { labelKey: 'bewerber.actions.review_counter', icon: FileText, run: 'profil' };
  if (stateKey === 'offer_rejected' || stateKey === 'offer_withdrawn' || stateKey === 'offer_prep') return { labelKey: 'bewerber.actions.make_offer', icon: FileText, run: 'offer' };
  // Arbeitsvertrag nach der Zusage (Paket 3): Schritte in der Vertrags-Box im Profil
  if (stateKey === 'offer_accepted' || stateKey === 'vertrag_abgelehnt') return { labelKey: 'bewerber.actions.send_contract', icon: FileText, run: 'contract' };
  if (stateKey === 'vertrag_bestaetigen') return { labelKey: 'bewerber.actions.confirm_signature', icon: FileText, run: 'profil' };
  if (stateKey === 'vertrag_unterwegs' || stateKey === 'vertrag_unterschrieben') return { labelKey: 'bewerber.actions.view_contract', icon: FileText, run: 'profil' };
  if (stateKey.startsWith('offer_')) return { labelKey: 'bewerber.actions.view_offer', icon: FileText, run: 'profil' };
  // wait_* und pruefung
  return { labelKey: 'bewerber.actions.request_interview', icon: Calendar, run: 'wizard' };
}

function formatSalary(min: number | null, max: number | null): string {
  if (!min && !max) return '—';
  const fmt = (v: number) =>
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `ab ${fmt(min)}`;
  return `bis ${fmt(max!)}`;
}

function formatRemote(pref: string | null): string {
  const map: Record<string, string> = {
    remote: 'Remote',
    hybrid: 'Hybrid',
    onsite: 'Vor Ort',
    flexible: 'Flexibel',
  };
  return pref ? map[pref] || pref : '—';
}

function formatCareerDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.getFullYear().toString();
}

function formatCareerRange(entry: CareerEntry): string {
  if (entry.isCurrent) {
    const start = formatCareerDate(entry.startDate);
    return start ? `Seit ${start}` : 'Aktuell';
  }
  const start = formatCareerDate(entry.startDate);
  const end = formatCareerDate(entry.endDate);
  if (start && end) return `${start} – ${end}`;
  if (start) return `Ab ${start}`;
  return '';
}

function formatDuration(years: number | null): string {
  if (!years) return '';
  if (years === 1) return '1 Jahr';
  return `${years} Jahre`;
}

export function BewerberPreviewPanel({ item, onInterviewRequest, onReject }: BewerberPreviewPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fitRoh = useCandidateFitAssessment(item.submissionId).assessment?.executive_summary ?? null;
  const fitText = fitRoh ? fitRoh.charAt(0).toUpperCase() + fitRoh.slice(1) : null;
  // Gehaltswunsch und Verfügbarkeit wie im Profil: zuerst aus dem Gespräch mit dem Headhunter.
  const gespraech = useCandidateInsights(item.submissionId).data?.interview ?? null;
  const displayName =
    item.fullName || item.currentRole || item.career[0]?.jobTitle || t('bewerber.card.no_role');
  const initials = displayName.slice(0, 2).toUpperCase();
  const isArchived = item.tab === 'archiv';
  // Eingestellt/abgelehnt/zurückgezogen: keine Primäraktion, auch wenn nur die Stage es sagt
  const isClosed = TERMINAL_STAGES.includes(item.status) || TERMINAL_STAGES.includes(item.stage);
  const primary = primaryActionFor(item.state.key);
  const PrimaryIcon = primary.icon;
  const [aiExpanded, setAiExpanded] = useState(false);
  const [skillsExpanded, setSkillsExpanded] = useState(false);
  const [showFrage, setShowFrage] = useState(false);
  const { data: submitter } = useSubmitter(item.submissionId, item.jobId);
  const hhName = submitterName(submitter);
  // Nie den Rohwert („3_months_eoq“) zeigen
  const verfuegbar =
    verfuegbarAus(gespraech) ||
    (item.noticePeriod ? optionLabel(NOTICE_OPTIONS, item.noticePeriod) : null) ||
    (item.availabilityDate ? `ab ${new Date(item.availabilityDate).toLocaleDateString('de-DE')}` : null) ||
    'Sofort';

  useEffect(() => {
    setAiExpanded(false);
    setSkillsExpanded(false);
  }, [item.submissionId]);

  const runPrimary = () => {
    if (primary.run === 'wizard') {
      onInterviewRequest?.();
    } else if (PROFILE_ACTIONS.includes(primary.run)) {
      navigate(`/dashboard/candidates/${item.submissionId}`, primary.run === 'profil' ? undefined : { state: { open: primary.run } });
    } else {
      navigate(primary.run);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* ─── HERO ─── */}
      <div className="p-5 border-b">
        <div className="flex items-start gap-3 mb-3">
          <Avatar className="h-14 w-14 border-2 border-background shadow-sm">
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <Link to={`/dashboard/candidates/${item.submissionId}`} className="text-lg font-bold text-foreground hover:text-primary transition-colors truncate">
                {displayName}
              </Link>
              {item.identityUnlocked && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-success/10 text-success shrink-0">
                  <LockOpen className="h-3 w-3" />
                  {t('bewerber.identity_unlocked')}
                </span>
              )}
              <BewerberStatusPill item={item} />
            </div>
            {item.fullName && item.currentRole && (
              <p className="text-sm text-muted-foreground">{item.currentRole}</p>
            )}
            <p className="text-xs text-muted-foreground/70 mt-0.5">
              Für: <span className="font-medium text-muted-foreground">{item.jobTitle}</span>
              <span className="ml-2 font-mono text-muted-foreground/50">{item.anonymizedName}</span>
            </p>
          </div>
        </div>

        {/* Quick Facts inline */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mb-4">
          <span className="flex items-center gap-1">
            <Briefcase className="h-3 w-3" />
            {item.experienceBand}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {item.region}
          </span>
          <span className="flex items-center gap-1">
            <Banknote className="h-3 w-3" />
            {gespraech?.salary_wish || item.salaryBand || t('bewerber.chips.salary_locked')}
          </span>
          <span className="flex items-center gap-1">
            <Laptop className="h-3 w-3" />
            {formatRemote(item.remotePreference)}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {verfuegbar}
          </span>
          {item.seniority && (
            <span className="flex items-center gap-1">
              <GraduationCap className="h-3 w-3" />
              <span className="capitalize">{item.seniority}</span>
            </span>
          )}
        </div>

        {/* Wer den Kandidaten eingereicht hat */}
        {submitter && (
          <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
            <Avatar className="h-5 w-5">
              {submitter.photo && <AvatarImage src={submitter.photo} alt="" />}
              <AvatarFallback className="bg-primary/10 text-[9px] text-primary">{initialsOf(hhName)}</AvatarFallback>
            </Avatar>
            <span>
              Eingereicht von <span className="font-medium text-foreground">{hhName}</span>
              {` · ${new Date(item.submittedAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`}
            </span>
          </div>
        )}

        {/* CTAs bzw. Archiv-Status */}
        {isArchived ? (
          <div className="rounded-lg border bg-muted/40 px-3 py-2.5 flex items-start gap-2">
            <Archive className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {bewerberStateLabel(item, t)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {item.archiveKind === 'eingestellt'
                  ? t('bewerber.archive.hired_info')
                  : t('bewerber.archive.closed_info')}
              </p>
              {item.archiveKind === 'eingestellt' && (
                <Button variant="outline" size="sm" className="mt-2" asChild>
                  <Link to="/dashboard/placements">{t('bewerber.archive.view_placement')}</Link>
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {!isClosed && (
              <Button size="sm" onClick={runPrimary}>
                <PrimaryIcon className="h-3.5 w-3.5 mr-1.5" />
                {t(primary.labelKey, item.state.params)}
              </Button>
            )}
            <Button variant="outline" size="sm" className="text-muted-foreground" onClick={onReject}>
              <X className="h-3.5 w-3.5 mr-1.5" />
              {t('bewerber.actions.reject')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto text-muted-foreground"
              onClick={() => setShowFrage(true)}
            >
              <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
              Frage an {hhName}
            </Button>
          </div>
        )}
      </div>

      {/* ─── BODY: 50/50 Split ─── */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 divide-x min-h-0">

          {/* ─── LEFT: Skills + KI-Einschätzung ─── */}
          <div className="p-4 space-y-4">
            {/* Skills Card */}
            {item.skills && item.skills.length > 0 && (
              <div className="bg-card border rounded-lg p-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Skills
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {(skillsExpanded ? item.skills : item.skills.slice(0, 8)).map((skill, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs font-normal">
                      {skill}
                    </Badge>
                  ))}
                  {item.skills.length > 8 && (
                    <button
                      type="button"
                      onClick={() => setSkillsExpanded((v) => !v)}
                      className="rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                      aria-expanded={skillsExpanded}
                    >
                      <Badge
                        variant="outline"
                        className="text-xs font-normal cursor-pointer hover:bg-muted transition-colors"
                      >
                        {skillsExpanded ? t('bewerber.skills.less') : `+${item.skills.length - 8}`}
                      </Badge>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* KI-Einschätzung Card */}
            <div className="bg-card border rounded-lg p-3 border-l-2 border-l-amber-400">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Einschätzung zur Stelle
                </h4>
                <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0">
                  KI-Text
                </Badge>
              </div>

              {/* AI Summary — auf 3 Zeilen verdichtet, Volltext auf Klick */}
              {/* Keine Zahl beim Kunden (EU AI Act, 09.10.2026): der Text der Einschätzung, sonst die Lebenslauf-Zusammenfassung. */}
              {(fitText || item.aiSummary) && (
                <div className="mb-3">
                  <p className={cn('text-xs text-muted-foreground leading-relaxed', !aiExpanded && 'line-clamp-3')}>
                    {fitText || item.aiSummary}
                  </p>
                  <button
                    type="button"
                    onClick={() => setAiExpanded((v) => !v)}
                    className="text-xs text-muted-foreground underline underline-offset-2 mt-1 hover:text-foreground transition-colors"
                  >
                    {aiExpanded ? t('bewerber.ai.less') : t('bewerber.ai.more')}
                  </button>
                </div>
              )}

              {/* Disclaimer */}
              <p className="text-[10px] text-muted-foreground/50 leading-tight">
                Passung zur Stelle, nicht Bewertung der Person. Die Entscheidung liegt bei Ihnen.
              </p>
            </div>

            {/* Empfehlung des Headhunters beim Einreichen */}
            {item.recruiterNotes?.trim() && (
              <div className="bg-card border rounded-lg p-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Empfehlung von {hhName}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">„{item.recruiterNotes.trim()}“</p>
              </div>
            )}

          </div>

          {/* ─── RIGHT: Werdegang ─── */}
          <div className="p-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Letzte Stationen
            </h4>

            {item.career.length > 0 ? (
              <div className="space-y-2">
                {item.career.map((entry, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'rounded-lg p-2.5 border',
                      entry.isCurrent
                        ? 'bg-green-500/5 border-green-500/20'
                        : 'bg-muted/30 border-transparent'
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <div className={cn(
                        'mt-0.5 h-2 w-2 rounded-full shrink-0',
                        entry.isCurrent ? 'bg-green-500' : 'bg-muted-foreground/30'
                      )} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground leading-tight">
                          {entry.jobTitle}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Building2 className="h-3 w-3 shrink-0" />
                          {entry.companyAnonymized}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground/70">
                          <span>{formatCareerRange(entry)}</span>
                          {entry.durationYears && (
                            <>
                              <span>·</span>
                              <span>{formatDuration(entry.durationYears)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground/50 py-6 text-center">
                Keine Stationen verfügbar
              </div>
            )}
          </div>
        </div>

        {/* Team-Notizen */}
        <BewerberNotes submissionId={item.submissionId} />
      </div>

      {/* ─── FOOTER ─── */}
      <div className="p-3 border-t">
        <Button variant="outline" size="sm" className="w-full" asChild>
          <Link to={`/dashboard/candidates/${item.submissionId}`}>
            Vollständiges Profil
            <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Link>
        </Button>
      </div>
      <FrageSheet
        open={showFrage}
        onOpenChange={setShowFrage}
        submitter={submitter}
        submissionId={item.submissionId}
        jobId={item.jobId}
        candidateId={item.candidateId}
        jobTitle={item.jobTitle}
        code={item.anonymizedName}
        role={item.currentRole}
        identityUnlocked={item.identityUnlocked}
        noticeFallback={item.noticePeriod}
      />
    </div>
  );
}
