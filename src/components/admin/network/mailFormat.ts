import type { MailEventType, MailStat } from '../../../../supabase/functions/_shared/email-stats';

/** Beschriftungen und Datumsformat für Mails in der Recruiterverwaltung. */

export const MAIL_LABELS: Record<string, string> = {
  recruiter_onboarding_invitation: 'Einladung', recruiter_onboarding_code: 'Anmeldecode', recruiter_onboarding_activation: 'Zugangsmail',
};
export const EVENT_LABELS: Record<MailEventType, string> = {
  sent: 'Versendet', delivered: 'Zugestellt', delivery_delayed: 'Zustellung verzögert', opened: 'Geöffnet', clicked: 'Link geklickt',
  bounced: 'Unzustellbar', complained: 'Als Spam gemeldet', failed: 'Fehlgeschlagen', suppressed: 'Von Resend unterdrückt',
};
export const shortDate = (s?: string | null) => s ? new Date(s).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–';

/** Wichtigster Stand einer Mail in zwei, drei Wörtern. */
export const mailHeadline = (m: MailStat) => m.status === 'failed' ? 'Versand fehlgeschlagen'
  : m.problem && m.problem.type !== 'delivery_delayed' ? EVENT_LABELS[m.problem.type]
  : m.clicks.count ? 'Link geklickt' : m.opens.count ? 'Geöffnet' : m.deliveredAt ? 'Zugestellt'
  : m.lastEvent ? EVENT_LABELS[m.lastEvent] : m.status === 'sent' ? 'An Resend übergeben' : 'Wird versendet';
