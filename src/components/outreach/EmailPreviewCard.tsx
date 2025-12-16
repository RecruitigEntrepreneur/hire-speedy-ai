import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Check, X, RefreshCw, Edit, Building2, User, AlertTriangle } from 'lucide-react';
import { OutreachEmail } from '@/hooks/useOutreach';

interface EmailPreviewCardProps {
  email: OutreachEmail;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onRegenerate: (id: string) => void;
  isSelected?: boolean;
  onClick?: () => void;
}

export function EmailPreviewCard({ 
  email, 
  onApprove, 
  onReject, 
  onRegenerate,
  isSelected,
  onClick 
}: EmailPreviewCardProps) {
  const getConfidenceColor = (level?: string) => {
    switch (level) {
      case 'high': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'medium': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'low': return 'bg-red-500/10 text-red-600 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    }
  };

  const wordCount = email.body?.split(/\s+/).length || 0;

  return (
    <Card 
      className={`cursor-pointer transition-all hover:shadow-md ${
        isSelected ? 'ring-2 ring-primary' : ''
      }`}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-medium truncate">{email.lead?.company_name}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-3 w-3 shrink-0" />
              <span className="truncate">{email.lead?.contact_name}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge className={getConfidenceColor(email.confidence_level)}>
              {email.confidence_level || 'unknown'}
            </Badge>
            <span className="text-xs text-muted-foreground">{wordCount} Wörter</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-sm font-medium mb-1">Betreff:</p>
          <p className="text-sm bg-muted/50 p-2 rounded">{email.subject}</p>
        </div>

        <div>
          <p className="text-sm font-medium mb-1">Inhalt:</p>
          <div className="text-sm bg-muted/50 p-2 rounded max-h-[150px] overflow-y-auto whitespace-pre-wrap">
            {email.body}
          </div>
        </div>

        {email.campaign && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Kampagne:</span>
            <Badge variant="outline" className="text-xs">{email.campaign.name}</Badge>
          </div>
        )}

        {wordCount > 150 && (
          <div className="flex items-center gap-2 text-xs text-yellow-600">
            <AlertTriangle className="h-3 w-3" />
            <span>E-Mail könnte zu lang sein</span>
          </div>
        )}

        <Separator />

        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-green-600 hover:text-green-700 hover:bg-green-50"
            onClick={() => onApprove(email.id)}
          >
            <Check className="h-4 w-4 mr-1" />
            Freigeben
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => onReject(email.id)}
          >
            <X className="h-4 w-4 mr-1" />
            Ablehnen
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onRegenerate(email.id)}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
