import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { 
  Target, Users, Mail, MousePointer, MessageSquare, 
  Trophy, Settings, Trash2, Play, Pause 
} from 'lucide-react';
import { OutreachCampaign } from '@/hooks/useOutreach';

interface CampaignCardProps {
  campaign: OutreachCampaign;
  onEdit: (campaign: OutreachCampaign) => void;
  onToggle: (id: string, isActive: boolean) => void;
  onDelete: (id: string) => void;
  onGenerateEmails: (campaignId: string) => void;
}

export function CampaignCard({ 
  campaign, 
  onEdit, 
  onToggle, 
  onDelete,
  onGenerateEmails 
}: CampaignCardProps) {
  const stats = campaign.stats;
  const openRate = stats.sent > 0 ? (stats.opened / stats.sent * 100).toFixed(1) : 0;
  const replyRate = stats.sent > 0 ? (stats.replied / stats.sent * 100).toFixed(1) : 0;
  const conversionRate = stats.sent > 0 ? (stats.converted / stats.sent * 100).toFixed(1) : 0;

  const getSegmentLabel = (segment: string) => {
    switch (segment) {
      case 'enterprise': return 'Enterprise';
      case 'mid_market': return 'Mid-Market';
      case 'smb': return 'SMB';
      case 'startup': return 'Startup';
      default: return segment;
    }
  };

  const getGoalLabel = (goal: string) => {
    switch (goal) {
      case 'discovery': return 'Bedarf prüfen';
      case 'meeting': return 'Gespräch';
      case 'qualification': return 'Qualifizierung';
      case 'nurture': return 'Beziehung';
      default: return goal;
    }
  };

  return (
    <Card className={`${!campaign.is_active ? 'opacity-60' : ''}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              {campaign.name}
            </CardTitle>
            {campaign.description && (
              <p className="text-sm text-muted-foreground mt-1">{campaign.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={campaign.is_active && !campaign.is_paused}
              onCheckedChange={(checked) => onToggle(campaign.id, checked)}
            />
            {campaign.is_paused && (
              <Badge variant="secondary">Pausiert</Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2 mt-2">
          <Badge variant="outline">{getSegmentLabel(campaign.target_segment)}</Badge>
          <Badge variant="outline">{getGoalLabel(campaign.goal)}</Badge>
          <Badge variant="outline">{campaign.tonality}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-5 gap-2 text-center">
          <div className="p-2 bg-muted/50 rounded">
            <Mail className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-lg font-bold">{stats.sent}</p>
            <p className="text-xs text-muted-foreground">Gesendet</p>
          </div>
          <div className="p-2 bg-muted/50 rounded">
            <MousePointer className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-lg font-bold">{stats.opened}</p>
            <p className="text-xs text-muted-foreground">Geöffnet</p>
          </div>
          <div className="p-2 bg-muted/50 rounded">
            <Users className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-lg font-bold">{stats.clicked}</p>
            <p className="text-xs text-muted-foreground">Geklickt</p>
          </div>
          <div className="p-2 bg-muted/50 rounded">
            <MessageSquare className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-lg font-bold">{stats.replied}</p>
            <p className="text-xs text-muted-foreground">Antworten</p>
          </div>
          <div className="p-2 bg-muted/50 rounded">
            <Trophy className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-lg font-bold">{stats.converted}</p>
            <p className="text-xs text-muted-foreground">Konvertiert</p>
          </div>
        </div>

        {/* Rates */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Öffnungsrate</span>
            <span className="font-medium">{openRate}%</span>
          </div>
          <Progress value={Number(openRate)} className="h-1.5" />
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Antwortrate</span>
            <span className="font-medium">{replyRate}%</span>
          </div>
          <Progress value={Number(replyRate)} className="h-1.5" />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onGenerateEmails(campaign.id)}
            disabled={!campaign.is_active}
          >
            <Play className="h-4 w-4 mr-1" />
            E-Mails generieren
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(campaign)}
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => onDelete(campaign.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Footer Info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          <span>Von: {campaign.sender_name}</span>
          <span>Erstellt: {new Date(campaign.created_at).toLocaleDateString('de-DE')}</span>
        </div>
      </CardContent>
    </Card>
  );
}
