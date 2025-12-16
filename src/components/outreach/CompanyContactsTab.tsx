import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Users, 
  Mail, 
  Linkedin, 
  Sparkles,
  Search,
  UserPlus,
  Star,
  Filter
} from 'lucide-react';
import { OutreachCompany } from '@/hooks/useOutreachCompanies';
import { useUpdateContactOutreach } from '@/hooks/useCompanyOutreach';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface CompanyContactsTabProps {
  company: OutreachCompany;
  leads: any[];
}

export function CompanyContactsTab({ company, leads }: CompanyContactsTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  
  const updateContactMutation = useUpdateContactOutreach();

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = 
      (lead.contact_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (lead.contact_title?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (lead.contact_email?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || lead.contact_outreach_status === statusFilter;
    const matchesLevel = levelFilter === 'all' || lead.decision_level === levelFilter;
    
    return matchesSearch && matchesStatus && matchesLevel;
  });

  const getStatusBadge = (status: string | undefined) => {
    switch (status) {
      case 'kontaktiert':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">📤 Kontaktiert</Badge>;
      case 'geöffnet':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">👁️ Geöffnet</Badge>;
      case 'geantwortet':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">✅ Antwort</Badge>;
      case 'nicht_interessiert':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">❌ Kein Interesse</Badge>;
      default:
        return <Badge variant="outline">⚪ Nicht kontaktiert</Badge>;
    }
  };

  const getLevelBadge = (level: string | undefined) => {
    switch (level) {
      case 'entscheider':
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">👔 Entscheider</Badge>;
      case 'influencer':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">💡 Influencer</Badge>;
      case 'gatekeeper':
        return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">📋 Gatekeeper</Badge>;
      default:
        return <Badge variant="outline">❓ Unbekannt</Badge>;
    }
  };

  const handleStatusChange = (leadId: string, newStatus: string) => {
    updateContactMutation.mutate({ id: leadId, contact_outreach_status: newStatus });
  };

  const handleLevelChange = (leadId: string, newLevel: string) => {
    updateContactMutation.mutate({ id: leadId, decision_level: newLevel });
  };

  const handleAreaChange = (leadId: string, newArea: string) => {
    updateContactMutation.mutate({ id: leadId, functional_area: newArea });
  };

  const handlePrimaryToggle = (leadId: string, current: boolean) => {
    updateContactMutation.mutate({ id: leadId, is_primary_contact: !current });
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Kontakte suchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Alle Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="nicht_kontaktiert">⚪ Nicht kontaktiert</SelectItem>
            <SelectItem value="kontaktiert">📤 Kontaktiert</SelectItem>
            <SelectItem value="geöffnet">👁️ Geöffnet</SelectItem>
            <SelectItem value="geantwortet">✅ Geantwortet</SelectItem>
            <SelectItem value="nicht_interessiert">❌ Kein Interesse</SelectItem>
          </SelectContent>
        </Select>

        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Alle Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Level</SelectItem>
            <SelectItem value="entscheider">👔 Entscheider</SelectItem>
            <SelectItem value="influencer">💡 Influencer</SelectItem>
            <SelectItem value="gatekeeper">📋 Gatekeeper</SelectItem>
            <SelectItem value="unknown">❓ Unbekannt</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline">
          <UserPlus className="h-4 w-4 mr-2" />
          Kontakt hinzufügen
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{leads.length}</p>
            <p className="text-xs text-muted-foreground">Gesamt</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-muted-foreground">
              {leads.filter(l => l.contact_outreach_status === 'nicht_kontaktiert' || !l.contact_outreach_status).length}
            </p>
            <p className="text-xs text-muted-foreground">Offen</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-blue-500">
              {leads.filter(l => l.contact_outreach_status === 'kontaktiert').length}
            </p>
            <p className="text-xs text-muted-foreground">Kontaktiert</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-yellow-500">
              {leads.filter(l => l.contact_outreach_status === 'geöffnet').length}
            </p>
            <p className="text-xs text-muted-foreground">Geöffnet</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-green-500">
              {leads.filter(l => l.contact_outreach_status === 'geantwortet').length}
            </p>
            <p className="text-xs text-muted-foreground">Geantwortet</p>
          </CardContent>
        </Card>
      </div>

      {/* Contacts Table */}
      <Card>
        <CardContent className="p-0">
          {filteredLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Keine Kontakte gefunden</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Name & Rolle</TableHead>
                  <TableHead>Bereich</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 ${lead.is_primary_contact ? 'text-yellow-500' : 'text-muted-foreground'}`}
                        onClick={() => handlePrimaryToggle(lead.id, lead.is_primary_contact)}
                      >
                        <Star className="h-4 w-4" fill={lead.is_primary_contact ? 'currentColor' : 'none'} />
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{lead.contact_name || 'Unbekannt'}</p>
                        <p className="text-sm text-muted-foreground">{lead.contact_title || lead.contact_email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select 
                        value={lead.functional_area || 'unknown'} 
                        onValueChange={(val) => handleAreaChange(lead.id, val)}
                      >
                        <SelectTrigger className="w-[120px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unknown">Unbekannt</SelectItem>
                          <SelectItem value="tech">Tech</SelectItem>
                          <SelectItem value="finance">Finance</SelectItem>
                          <SelectItem value="people">People</SelectItem>
                          <SelectItem value="ops">Ops</SelectItem>
                          <SelectItem value="sales">Sales</SelectItem>
                          <SelectItem value="marketing">Marketing</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select 
                        value={lead.decision_level || 'unknown'} 
                        onValueChange={(val) => handleLevelChange(lead.id, val)}
                      >
                        <SelectTrigger className="w-[130px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unknown">❓ Unbekannt</SelectItem>
                          <SelectItem value="entscheider">👔 Entscheider</SelectItem>
                          <SelectItem value="influencer">💡 Influencer</SelectItem>
                          <SelectItem value="gatekeeper">📋 Gatekeeper</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select 
                        value={lead.contact_outreach_status || 'nicht_kontaktiert'} 
                        onValueChange={(val) => handleStatusChange(lead.id, val)}
                      >
                        <SelectTrigger className="w-[150px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nicht_kontaktiert">⚪ Nicht kontaktiert</SelectItem>
                          <SelectItem value="kontaktiert">📤 Kontaktiert</SelectItem>
                          <SelectItem value="geöffnet">👁️ Geöffnet</SelectItem>
                          <SelectItem value="geantwortet">✅ Geantwortet</SelectItem>
                          <SelectItem value="nicht_interessiert">❌ Kein Interesse</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {lead.contact_email && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                            <a href={`mailto:${lead.contact_email}`}>
                              <Mail className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        {lead.linkedin_url && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                            <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer">
                              <Linkedin className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        <Button variant="outline" size="sm">
                          <Sparkles className="h-3 w-3 mr-1" />
                          E-Mail
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
