import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, Mail, Linkedin, Phone, User } from "lucide-react";
import { LeadProfileDialog } from "../LeadProfileDialog";

interface ContactsTabProps {
  companyId: string;
}

export function ContactsTab({ companyId }: ContactsTabProps) {
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  const { data: leads, isLoading } = useQuery({
    queryKey: ['company-leads', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outreach_leads')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'replied': return 'bg-green-100 text-green-800 border-green-300';
      case 'sent': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'bounced': return 'bg-red-100 text-red-800 border-red-300';
      case 'opened': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Laden...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium text-muted-foreground">
          {leads?.length || 0} Kontakte
        </h3>
        <Button size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          Kontakt hinzufügen
        </Button>
      </div>

      {leads && leads.length > 0 ? (
        <div className="space-y-2">
          {leads.map((lead) => (
            <Card 
              key={lead.id} 
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setSelectedLeadId(lead.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {lead.contact_name ? getInitials(lead.contact_name) : <User className="h-4 w-4" />}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{lead.contact_name || "Unbekannt"}</span>
                      <Badge variant="outline" className={getStatusColor(lead.outreach_status)}>
                        {lead.outreach_status || 'neu'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                      {lead.contact_role && <span>{lead.contact_role}</span>}
                      {lead.department && <span>• {lead.department}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {lead.contact_email && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                        <Mail className="h-4 w-4" />
                      </Button>
                    )}
                    {lead.personal_linkedin_url && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(lead.personal_linkedin_url!, '_blank');
                        }}
                      >
                        <Linkedin className="h-4 w-4" />
                      </Button>
                    )}
                    {lead.contact_phone && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                        <Phone className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Keine Kontakte vorhanden</p>
            <p className="text-sm mt-1">Füge den ersten Kontakt hinzu</p>
          </CardContent>
        </Card>
      )}

      {selectedLeadId && (
        <LeadProfileDialog
          leadId={selectedLeadId}
          onClose={() => setSelectedLeadId(null)}
        />
      )}
    </div>
  );
}
