import type { ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ClipboardPaste, Mail, Plug, Upload, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

/**
 * „Kandidaten anlegen“ (04.11.2026): Ein Klick zeigt erst die Wege, nie direkt ein
 * Formular. Dasselbe Menü auf dem Dashboard und unter „Meine Kandidaten“.
 */
export function KandidatAnlegenMenu({
  onLebenslauf,
  onText,
  onOhneLebenslauf,
  onHubspot,
  onPerMail,
  size = 'sm',
  tour,
  className,
}: {
  onLebenslauf: () => void;
  onText: () => void;
  onOhneLebenslauf: () => void;
  onHubspot: () => void;
  onPerMail: () => void;
  size?: 'sm' | 'default';
  /** Ziel für den Rundgang. */
  tour?: string;
  /** z. B. volle Breite am Handy */
  className?: string;
}) {
  const navigate = useNavigate();
  const { t } = useTranslation('candidates');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={size} data-tour={tour} className={className}>
          {/* Am Handy nur der Abstand des Knopfs (gap-2), sonst doppelt: so passt „Rundgang“ daneben */}
          <UserPlus className="mr-1.5 h-3.5 w-3.5 max-sm:mr-0" />
          {t('menu.button')}
          <ChevronDown className="ml-1.5 h-3.5 w-3.5 max-sm:ml-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72" data-tour="add.menu">
        {/* Der Lebenslauf zuerst: daraus entstehen Akte, Werdegang und die Vorschläge im Interview. */}
        <Weg Icon={Upload} titel={t('menu.cvTitle')} text={t('menu.cvText')} onClick={onLebenslauf} hervor tour="add.cv" />
        <Weg Icon={ClipboardPaste} titel={t('menu.textTitle')} text={t('menu.textText')} onClick={onText} tour="add.paste" />
        <Weg Icon={UserPlus} titel={t('menu.withoutCvTitle')} text={t('menu.withoutCvText')} onClick={onOhneLebenslauf} tour="add.manual" />
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onHubspot}>
          <HubspotLogo className="mr-2 h-4 w-4" />
          {t('menu.hubspot')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onPerMail}>
          <Mail className="mr-2 h-4 w-4" />
          {t('menu.perMail')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/recruiter/integrations')}>
          <Plug className="mr-2 h-4 w-4" />
          {t('menu.connectCrm')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** HubSpot-Zeichen (Simple Icons, CC0) in der Markenfarbe, damit man die Quelle sofort erkennt. */
function HubspotLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="#FF7A59" aria-hidden="true">
      <path d="M18.164 7.93V5.084a2.198 2.198 0 001.267-1.978v-.067A2.2 2.2 0 0017.238.845h-.067a2.2 2.2 0 00-2.193 2.193v.067a2.196 2.196 0 001.252 1.973l.013.006v2.852a6.22 6.22 0 00-2.969 1.31l.012-.01-7.828-6.095A2.497 2.497 0 104.3 4.656l-.012.006 7.697 5.991a6.176 6.176 0 00-1.038 3.446c0 1.343.425 2.588 1.147 3.607l-.013-.02-2.342 2.343a1.968 1.968 0 00-.58-.095h-.002a2.033 2.033 0 102.033 2.033 1.978 1.978 0 00-.1-.595l.005.014 2.317-2.317a6.247 6.247 0 104.782-11.134l-.036-.005zm-.964 9.378a3.206 3.206 0 113.215-3.207v.002a3.206 3.206 0 01-3.207 3.207z" />
    </svg>
  );
}

function Weg({ Icon, titel, text, onClick, hervor = false, tour }: { Icon: ComponentType<{ className?: string }>; titel: string; text: string; onClick: () => void; hervor?: boolean; tour?: string }) {
  return (
    <DropdownMenuItem onClick={onClick} data-tour={tour} className={cn('items-start gap-2 py-2', hervor && 'bg-muted/60')}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="min-w-0">
        <span className="block font-medium">{titel}</span>
        <span className="block text-xs text-muted-foreground">{text}</span>
      </span>
    </DropdownMenuItem>
  );
}
