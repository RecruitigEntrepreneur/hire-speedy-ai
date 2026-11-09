import type { ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ClipboardPaste, Download, Mail, Plug, Upload, UserPlus } from 'lucide-react';
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
}: {
  onLebenslauf: () => void;
  onText: () => void;
  onOhneLebenslauf: () => void;
  onHubspot: () => void;
  onPerMail: () => void;
  size?: 'sm' | 'default';
  /** Ziel für den Rundgang. */
  tour?: string;
}) {
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={size} data-tour={tour}>
          <UserPlus className="mr-1.5 h-3.5 w-3.5" />
          Kandidaten anlegen
          <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {/* Der Lebenslauf zuerst: daraus entstehen Akte, Werdegang und die Vorschläge im Interview. */}
        <Weg Icon={Upload} titel="Lebenslauf hochladen" text="PDF oder Word. Die KI liest aus, du prüfst nur noch." onClick={onLebenslauf} hervor />
        <Weg Icon={ClipboardPaste} titel="Text oder LinkedIn-Profil einfügen" text="Kopieren, einfügen, die KI liest aus." onClick={onText} />
        <Weg Icon={UserPlus} titel="Ohne Lebenslauf anlegen" text="Name und E-Mail reichen, den Lebenslauf fragst du an." onClick={onOhneLebenslauf} />
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onHubspot}>
          <Download className="mr-2 h-4 w-4" />
          Aus HubSpot importieren
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onPerMail}>
          <Mail className="mr-2 h-4 w-4" />
          Per E-Mail weiterleiten
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/recruiter/integrations')}>
          <Plug className="mr-2 h-4 w-4" />
          CRM verbinden
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Weg({ Icon, titel, text, onClick, hervor = false }: { Icon: ComponentType<{ className?: string }>; titel: string; text: string; onClick: () => void; hervor?: boolean }) {
  return (
    <DropdownMenuItem onClick={onClick} className={cn('items-start gap-2 py-2', hervor && 'bg-muted/60')}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="min-w-0">
        <span className="block font-medium">{titel}</span>
        <span className="block text-xs text-muted-foreground">{text}</span>
      </span>
    </DropdownMenuItem>
  );
}
