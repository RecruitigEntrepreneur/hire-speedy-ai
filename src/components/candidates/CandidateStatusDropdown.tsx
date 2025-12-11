import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { UserCheck, Phone, Calendar, Gift, Star, XCircle } from 'lucide-react';

interface CandidateStatusDropdownProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  new: { label: 'Neu', icon: Star, color: 'bg-blue-100 text-blue-700' },
  contacted: { label: 'Kontaktiert', icon: Phone, color: 'bg-amber-100 text-amber-700' },
  interview: { label: 'Interview', icon: Calendar, color: 'bg-purple-100 text-purple-700' },
  offer: { label: 'Angebot', icon: Gift, color: 'bg-emerald-100 text-emerald-700' },
  placed: { label: 'Platziert', icon: UserCheck, color: 'bg-green-100 text-green-700' },
  rejected: { label: 'Absage', icon: XCircle, color: 'bg-red-100 text-red-700' },
};

export function CandidateStatusDropdown({ value, onChange, disabled }: CandidateStatusDropdownProps) {
  const currentStatus = statusConfig[value] || statusConfig.new;
  const Icon = currentStatus.icon;

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-[180px]">
        <SelectValue>
          <div className="flex items-center gap-2">
            <Badge className={currentStatus.color}>
              <Icon className="h-3 w-3 mr-1" />
              {currentStatus.label}
            </Badge>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {Object.entries(statusConfig).map(([key, config]) => {
          const StatusIcon = config.icon;
          return (
            <SelectItem key={key} value={key}>
              <div className="flex items-center gap-2">
                <StatusIcon className="h-4 w-4" />
                {config.label}
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
