import { MapPin, Phone, Video, type LucideIcon } from 'lucide-react';
import i18n from '@/i18n';

// Gespeichert bleibt der Schlüssel (video, phone …); die Beschriftung kommt beim Aufruf aus dem Namespace interviews.
const KNOWN = new Set(['video', 'teams', 'meet', 'phone', 'onsite']);

export const meetingTypeLabel = (type: string | null): string =>
  i18n.t(`interviews:meeting.${type && KNOWN.has(type) ? type : 'fallback'}`);

const iconFor = (type: string | null): LucideIcon =>
  type === 'phone' ? Phone : type === 'onsite' ? MapPin : Video;

export function MeetingTypeIcon({ type, className }: { type: string | null; className?: string }) {
  const Icon = iconFor(type);
  return <Icon className={className} aria-hidden="true" />;
}
