import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  Calendar,
  Mail,
  MessageSquare,
  Phone,
  Linkedin,
  Clock,
  Plus,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';
import { OutreachCompany } from '@/hooks/useOutreachCompanies';
import { formatDistanceToNow, format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useState } from 'react';

interface CompanyOutreachTabProps {
  company: OutreachCompany & { company_notes?: string };
  leads: any[];
}

interface TimelineEvent {
  id: string;
  type: 'email' | 'call' | 'linkedin' | 'note' | 'status_change';
  title: string;
  description?: string;
  contact?: string;
  date: Date;
  result?: 'success' | 'pending' | 'failed';
}

export function CompanyOutreachTab({ company, leads }: CompanyOutreachTabProps) {
  const [notes, setNotes] = useState(company.company_notes || '');

  // Build timeline from leads activity
  const timeline: TimelineEvent[] = [];

  // Add simulated timeline events based on contact status
  leads.forEach(lead => {
    if (lead.contact_outreach_status === 'kontaktiert') {
      timeline.push({
        id: `${lead.id}-contact`,
        type: 'email',
        title: `E-Mail an ${lead.contact_name || 'Kontakt'} gesendet`,
        contact: lead.contact_name,
        date: new Date(lead.updated_at || lead.created_at),
        result: 'pending',
      });
    }
    if (lead.contact_outreach_status === 'geöffnet') {
      timeline.push({
        id: `${lead.id}-open`,
        type: 'email',
        title: `${lead.contact_name || 'Kontakt'} hat E-Mail geöffnet`,
        contact: lead.contact_name,
        date: new Date(lead.updated_at || lead.created_at),
        result: 'pending',
      });
    }
    if (lead.contact_outreach_status === 'geantwortet') {
      timeline.push({
        id: `${lead.id}-reply`,
        type: 'email',
        title: `Antwort von ${lead.contact_name || 'Kontakt'} erhalten`,
        contact: lead.contact_name,
        date: new Date(lead.updated_at || lead.created_at),
        result: 'success',
      });
    }
  });

  // Sort by date descending
  timeline.sort((a, b) => b.date.getTime() - a.date.getTime());

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'call':
        return <Phone className="h-4 w-4" />;
      case 'linkedin':
        return <Linkedin className="h-4 w-4" />;
      case 'note':
        return <MessageSquare className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getResultColor = (result?: string) => {
    switch (result) {
      case 'success':
        return 'text-green-500 bg-green-500/10 border-green-500/20';
      case 'failed':
        return 'text-red-500 bg-red-500/10 border-red-500/20';
      default:
        return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
    }
  };

  // Calculate stats
  const kontaktiert = leads.filter(l => l.contact_outreach_status === 'kontaktiert').length;
  const geöffnet = leads.filter(l => l.contact_outreach_status === 'geöffnet').length;
  const geantwortet = leads.filter(l => l.contact_outreach_status === 'geantwortet').length;
  const openRate = kontaktiert > 0 ? Math.round((geöffnet / kontaktiert) * 100) : 0;
  const replyRate = kontaktiert > 0 ? Math.round((geantwortet / kontaktiert) * 100) : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left - Timeline */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-500" />
                Company Timeline
              </CardTitle>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Aktivität hinzufügen
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {timeline.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Noch keine Aktivitäten</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Starten Sie den Outreach, um die Timeline zu füllen.
                </p>
              </div>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border" />
                
                <div className="space-y-4">
                  {timeline.map((event, i) => (
                    <div key={event.id} className="flex gap-4 relative">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 border ${getResultColor(event.result)}`}>
                        {getEventIcon(event.type)}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-sm">{event.title}</p>
                            {event.description && (
                              <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(event.date, { addSuffix: true, locale: de })}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(event.date, 'dd.MM.yyyy HH:mm', { locale: de })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right - Stats & Notes */}
      <div className="space-y-4">
        {/* Outreach Stats */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Outreach Statistiken</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold">{kontaktiert}</p>
                <p className="text-xs text-muted-foreground">Kontaktiert</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold text-green-500">{geantwortet}</p>
                <p className="text-xs text-muted-foreground">Antworten</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Öffnungsrate</span>
                <span className="font-medium">{openRate}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div 
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${openRate}%` }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Antwortrate</span>
                <span className="font-medium">{replyRate}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div 
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${replyRate}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Next Steps */}
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-primary" />
              Nächste Schritte
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {leads.filter(l => l.contact_outreach_status === 'nicht_kontaktiert' || !l.contact_outreach_status).length > 0 && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {leads.filter(l => l.contact_outreach_status === 'nicht_kontaktiert' || !l.contact_outreach_status).length} Kontakte anschreiben
                </span>
              </div>
            )}
            {leads.filter(l => l.contact_outreach_status === 'geöffnet').length > 0 && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-yellow-500/10">
                <CheckCircle2 className="h-4 w-4 text-yellow-500" />
                <span className="text-sm">
                  Follow-up für {leads.filter(l => l.contact_outreach_status === 'geöffnet').length} Öffner
                </span>
              </div>
            )}
            {leads.filter(l => l.contact_outreach_status === 'geantwortet').length > 0 && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm">
                  {leads.filter(l => l.contact_outreach_status === 'geantwortet').length} Antworten bearbeiten
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-purple-500" />
              Notizen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Notizen zu diesem Unternehmen..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[120px]"
            />
            <Button variant="outline" size="sm" className="mt-2 w-full">
              Speichern
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
