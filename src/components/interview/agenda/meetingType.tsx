import { MapPin, Phone, Video, type LucideIcon } from 'lucide-react';

const LABELS: Record<string, string> = {
  video: 'Video-Call',
  teams: 'Teams',
  meet: 'Google Meet',
  phone: 'Telefon',
  onsite: 'Vor Ort',
};

export const meetingTypeLabel = (type: string | null): string => (type && LABELS[type]) || 'Interview';

const iconFor = (type: string | null): LucideIcon =>
  type === 'phone' ? Phone : type === 'onsite' ? MapPin : Video;

export function MeetingTypeIcon({ type, className }: { type: string | null; className?: string }) {
  const Icon = iconFor(type);
  return <Icon className={className} aria-hidden="true" />;
}
