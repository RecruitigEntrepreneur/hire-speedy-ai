import { AtSign, Bell, Briefcase, Building2, CalendarDays, Euro, FileSignature, FileText, FileUp, HelpCircle, MessageCircle, MessagesSquare, Receipt, Trophy, XCircle, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Ein ruhiges Symbol je Art (15.11.2026), damit man in der Glocke sieht, worum es geht. Keine Ampelfarben. */
export function hinweisSymbol(type: string): LucideIcon {
  if (['client_question', 'recruiter_answer', 'client_answer'].includes(type)) return MessageCircle;
  if (type.startsWith('offer_')) return FileText;
  if (type.startsWith('contract_')) return FileSignature;
  if (type === 'interview_feedback') return MessagesSquare;
  if (type.startsWith('booking_') || type.startsWith('interview_')) return CalendarDays;
  if (type === 'cv_received') return FileUp;
  if (['candidate_rejected', 'opt_in_denied', 'candidate_unavailable'].includes(type)) return XCircle;
  if (type.startsWith('invoice_')) return Receipt;
  if (type.startsWith('placement_') || type.startsWith('payout_')) return Euro;
  if (type === 'liga_award') return Trophy;
  if (['recruiter_job_questions', 'recruiter_nudge'].includes(type)) return HelpCircle;
  if (type === 'comment_mention') return AtSign;
  if (type.startsWith('company_')) return Building2;
  if (type.startsWith('job_') || type.startsWith('pause_') || ['engagement_requested', 'search_started', 'research_open'].includes(type)) return Briefcase;
  return Bell;
}

export function HinweisIcon({ type, className }: { type: string; className?: string }) {
  const Icon = hinweisSymbol(type);
  return (
    <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground', className)}>
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}
