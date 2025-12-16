import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Users, Mail, Send, BarChart3, Inbox, Target, CheckCircle, XCircle, 
  Clock, Eye, MousePointer, MessageSquare, Plus, Upload, Search, 
  MoreHorizontal, Trash2, Edit, RefreshCw, Play, Pause, TrendingUp,
  TrendingDown, Filter, Sparkles, AlertTriangle, Loader2, ArrowRight
} from 'lucide-react';
import { 
  useOutreachLeads, useOutreachCampaigns, useOutreachEmails, useOutreachStats, 
  useOutreachConversations, useApproveEmail, useRejectEmail, useRegenerateEmail,
  useDeleteLead, useToggleCampaign, useDeleteCampaign, useGenerateEmail,
  useQueueStatus, useRetryQueueItem, OutreachLead, OutreachCampaign
} from '@/hooks/useOutreach';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

// Dialog imports
import { LeadImportDialog } from '@/components/outreach/LeadImportDialog';
import { CampaignDialog } from '@/components/outreach/CampaignDialog';
import { LeadDetailSheet } from '@/components/outreach/LeadDetailSheet';
import { GenerateEmailsDialog } from '@/components/outreach/GenerateEmailsDialog';
import { QueueStatusCard } from '@/components/outreach/QueueStatusCard';

export default function AdminOutreach() {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Dialog states
  const [importOpen, setImportOpen] = useState(false);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<OutreachLead | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<OutreachCampaign | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Data hooks
  const { data: stats, isLoading: statsLoading } = useOutreachStats();
  const { data: leads, isLoading: leadsLoading } = useOutreachLeads();
  const { data: campaigns, isLoading: campaignsLoading } = useOutreachCampaigns();
  const { data: reviewEmails, isLoading: reviewLoading } = useOutreachEmails('review');
  const { data: conversations } = useOutreachConversations();
  const { data: queueItems } = useQueueStatus();
  
  // Mutations
  const approveEmail = useApproveEmail();
  const rejectEmail = useRejectEmail();
  const regenerateEmail = useRegenerateEmail();
  const deleteLead = useDeleteLead();
  const toggleCampaign = useToggleCampaign();
  const deleteCampaign = useDeleteCampaign();
  const generateEmail = useGenerateEmail();
  const retryQueue = useRetryQueueItem();

  // Cleanup scroll-lock when changing tabs or closing dialogs
  useEffect(() => {
    document.body.style.pointerEvents = '';
    document.body.removeAttribute('data-scroll-locked');
  }, [activeTab]);

  // Filtered leads
  const filteredLeads = leads?.filter(lead => {
    const matchesSearch = searchTerm === '' || 
      lead.contact_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.contact_email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'new': return 'secondary';
      case 'contacted': return 'default';
      case 'replied': return 'outline';
      case 'converted': return 'default';
      case 'unsubscribed': return 'destructive';
      default: return 'secondary';
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Outreach System</h1>
            <p className="text-muted-foreground mt-1">B2B E-Mail-Akquise & Reply Management</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              CSV Import
            </Button>
            <Button onClick={() => setCampaignOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Neue Kampagne
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-6 w-full max-w-4xl h-12">
            <TabsTrigger value="dashboard" className="gap-2">
              <BarChart3 className="h-4 w-4" />Dashboard
            </TabsTrigger>
            <TabsTrigger value="leads" className="gap-2">
              <Users className="h-4 w-4" />Leads
              {stats?.totalLeads ? <Badge variant="secondary" className="ml-1">{stats.totalLeads}</Badge> : null}
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="gap-2">
              <Target className="h-4 w-4" />Kampagnen
            </TabsTrigger>
            <TabsTrigger value="review" className="gap-2">
              <Mail className="h-4 w-4" />Review
              {stats?.pendingReview ? <Badge variant="destructive" className="ml-1">{stats.pendingReview}</Badge> : null}
            </TabsTrigger>
            <TabsTrigger value="inbox" className="gap-2">
              <Inbox className="h-4 w-4" />Inbox
            </TabsTrigger>
            <TabsTrigger value="queue" className="gap-2">
              <Send className="h-4 w-4" />Queue
              {stats?.queuePending ? <Badge variant="secondary" className="ml-1">{stats.queuePending}</Badge> : null}
            </TabsTrigger>
          </TabsList>

          {/* ========== DASHBOARD TAB ========== */}
          <TabsContent value="dashboard" className="space-y-6 mt-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-600" />
                    Leads
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats?.totalLeads || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats?.newLeads || 0} neu · {stats?.contactedLeads || 0} kontaktiert
                  </p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-200/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Send className="h-4 w-4 text-green-600" />
                    Gesendet
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats?.totalSent || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats?.queuePending || 0} in Warteschlange
                  </p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-200/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Eye className="h-4 w-4 text-purple-600" />
                    Öffnungsrate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-purple-600">{stats?.openRate || 0}%</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats?.totalOpened || 0} von {stats?.totalSent || 0} geöffnet
                  </p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-200/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-amber-600" />
                    Antwortrate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-amber-600">{stats?.replyRate || 0}%</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats?.totalReplied || 0} Antworten erhalten
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Active Campaigns & Recent Replies */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Aktive Kampagnen</CardTitle>
                    <CardDescription>Laufende Outreach-Kampagnen</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('campaigns')}>
                    Alle anzeigen <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {campaigns?.filter(c => c.is_active).slice(0, 4).map(campaign => (
                      <div key={campaign.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                        <div className="space-y-1">
                          <p className="font-medium">{campaign.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline" className="text-xs">{campaign.target_segment}</Badge>
                            <span>{campaign.goal}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="text-center">
                            <p className="font-semibold">{campaign.stats?.sent || 0}</p>
                            <p className="text-xs text-muted-foreground">Gesendet</p>
                          </div>
                          <div className="text-center">
                            <p className="font-semibold text-green-600">{campaign.stats?.opened || 0}</p>
                            <p className="text-xs text-muted-foreground">Geöffnet</p>
                          </div>
                          <div className="text-center">
                            <p className="font-semibold text-blue-600">{campaign.stats?.replied || 0}</p>
                            <p className="text-xs text-muted-foreground">Antworten</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {(!campaigns || campaigns.filter(c => c.is_active).length === 0) && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Target className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p>Keine aktiven Kampagnen</p>
                        <Button variant="link" onClick={() => setCampaignOpen(true)} className="mt-2">
                          Erste Kampagne erstellen
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Neueste Antworten</CardTitle>
                    <CardDescription>Eingegangene Replies</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('inbox')}>
                    Alle anzeigen <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {conversations?.slice(0, 5).map(conv => (
                      <div key={conv.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          conv.sentiment === 'positive' ? 'bg-green-500' : 
                          conv.sentiment === 'negative' ? 'bg-red-500' : 'bg-yellow-500'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{conv.lead?.contact_name}</p>
                          <p className="text-sm text-muted-foreground truncate">{conv.lead?.company_name}</p>
                        </div>
                        <Badge variant={conv.sentiment === 'positive' ? 'default' : conv.sentiment === 'negative' ? 'destructive' : 'secondary'}>
                          {conv.intent || 'unbekannt'}
                        </Badge>
                      </div>
                    ))}
                    {(!conversations || conversations.length === 0) && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Inbox className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p>Noch keine Antworten</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Review Queue Alert */}
            {stats?.pendingReview && stats.pendingReview > 0 && (
              <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/50">
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-medium">{stats.pendingReview} E-Mails warten auf Prüfung</p>
                      <p className="text-sm text-muted-foreground">Bitte überprüfen und freigeben</p>
                    </div>
                  </div>
                  <Button onClick={() => setActiveTab('review')}>
                    Jetzt prüfen
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ========== LEADS TAB ========== */}
          <TabsContent value="leads" className="space-y-4 mt-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle>Leads</CardTitle>
                    <CardDescription>{filteredLeads?.length || 0} Leads gefunden</CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="Suchen..." 
                        className="pl-9 w-64"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-40">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Alle Status</SelectItem>
                        <SelectItem value="new">Neu</SelectItem>
                        <SelectItem value="contacted">Kontaktiert</SelectItem>
                        <SelectItem value="replied">Geantwortet</SelectItem>
                        <SelectItem value="converted">Konvertiert</SelectItem>
                        <SelectItem value="unsubscribed">Abgemeldet</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={() => setImportOpen(true)}>
                      <Upload className="h-4 w-4 mr-2" />
                      Import
                    </Button>
                    <Button onClick={() => setGenerateOpen(true)}>
                      <Sparkles className="h-4 w-4 mr-2" />
                      E-Mails generieren
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {leadsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredLeads && filteredLeads.length > 0 ? (
                  <ScrollArea className="max-h-[600px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Kontakt</TableHead>
                        <TableHead>Firma</TableHead>
                        <TableHead>Branche</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Letzter Kontakt</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLeads.slice(0, 50).map(lead => (
                        <TableRow 
                          key={lead.id} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedLead(lead)}
                        >
                          <TableCell>
                            <div>
                              <p className="font-medium">{lead.contact_name}</p>
                              <p className="text-sm text-muted-foreground">{lead.contact_email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{lead.company_name}</p>
                              {lead.contact_role && <p className="text-sm text-muted-foreground">{lead.contact_role}</p>}
                            </div>
                          </TableCell>
                          <TableCell>{lead.industry || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(lead.status)}>{lead.status}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-primary rounded-full" 
                                  style={{ width: `${lead.score}%` }}
                                />
                              </div>
                              <span className="text-sm font-medium">{lead.score}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {lead.last_contacted_at 
                              ? format(new Date(lead.last_contacted_at), 'dd.MM.yy HH:mm', { locale: de }) 
                              : <span className="text-muted-foreground">-</span>
                            }
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedLead(lead); }}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Details anzeigen
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={(e) => { e.stopPropagation(); }}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Löschen
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-16 w-16 mx-auto mb-4 opacity-20" />
                    <h3 className="text-lg font-medium mb-2">Keine Leads gefunden</h3>
                    <p className="mb-4">Importieren Sie Leads per CSV oder erstellen Sie neue manuell.</p>
                    <Button onClick={() => setImportOpen(true)}>
                      <Upload className="h-4 w-4 mr-2" />
                      CSV Import starten
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== CAMPAIGNS TAB ========== */}
          <TabsContent value="campaigns" className="space-y-4 mt-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Kampagnen</h2>
                <p className="text-muted-foreground">{campaigns?.length || 0} Kampagnen erstellt</p>
              </div>
              <Button onClick={() => { setSelectedCampaign(null); setCampaignOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Neue Kampagne
              </Button>
            </div>

            {campaignsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : campaigns && campaigns.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {campaigns.map(campaign => (
                  <Card key={campaign.id} className={`relative overflow-hidden ${!campaign.is_active ? 'opacity-60' : ''}`}>
                    <div className={`absolute top-0 left-0 right-0 h-1 ${campaign.is_active ? 'bg-green-500' : 'bg-muted'}`} />
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-lg">{campaign.name}</CardTitle>
                          <CardDescription>{campaign.description || 'Keine Beschreibung'}</CardDescription>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setSelectedCampaign(campaign); setCampaignOpen(true); }}>
                              <Edit className="h-4 w-4 mr-2" />
                              Bearbeiten
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleCampaign.mutate({ id: campaign.id, isActive: !campaign.is_active })}>
                              {campaign.is_active ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                              {campaign.is_active ? 'Pausieren' : 'Aktivieren'}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => deleteCampaign.mutate(campaign.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Löschen
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge variant="outline">{campaign.target_segment}</Badge>
                        <Badge variant="secondary">{campaign.goal}</Badge>
                        {!campaign.is_active && <Badge variant="destructive">Pausiert</Badge>}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-4 gap-2 text-center mb-4">
                        <div className="p-2 rounded-lg bg-muted/50">
                          <p className="text-lg font-bold">{campaign.stats?.sent || 0}</p>
                          <p className="text-xs text-muted-foreground">Gesendet</p>
                        </div>
                        <div className="p-2 rounded-lg bg-muted/50">
                          <p className="text-lg font-bold text-green-600">{campaign.stats?.opened || 0}</p>
                          <p className="text-xs text-muted-foreground">Geöffnet</p>
                        </div>
                        <div className="p-2 rounded-lg bg-muted/50">
                          <p className="text-lg font-bold text-blue-600">{campaign.stats?.replied || 0}</p>
                          <p className="text-xs text-muted-foreground">Antworten</p>
                        </div>
                        <div className="p-2 rounded-lg bg-muted/50">
                          <p className="text-lg font-bold text-purple-600">{campaign.stats?.converted || 0}</p>
                          <p className="text-xs text-muted-foreground">Konvertiert</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Öffnungsrate</span>
                          <span className="font-medium">
                            {campaign.stats?.sent ? ((campaign.stats.opened / campaign.stats.sent) * 100).toFixed(1) : 0}%
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500 rounded-full transition-all" 
                            style={{ width: `${campaign.stats?.sent ? (campaign.stats.opened / campaign.stats.sent) * 100 : 0}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Antwortrate</span>
                          <span className="font-medium">
                            {campaign.stats?.sent ? ((campaign.stats.replied / campaign.stats.sent) * 100).toFixed(1) : 0}%
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 rounded-full transition-all" 
                            style={{ width: `${campaign.stats?.sent ? (campaign.stats.replied / campaign.stats.sent) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm text-muted-foreground">
                        <span>{campaign.sender_name}</span>
                        <span>{format(new Date(campaign.created_at), 'dd.MM.yyyy', { locale: de })}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <Target className="h-16 w-16 mx-auto mb-4 opacity-20" />
                  <h3 className="text-lg font-medium mb-2">Keine Kampagnen vorhanden</h3>
                  <p className="text-muted-foreground mb-4">Erstellen Sie Ihre erste Outreach-Kampagne.</p>
                  <Button onClick={() => setCampaignOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Erste Kampagne erstellen
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ========== REVIEW TAB ========== */}
          <TabsContent value="review" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Email List */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle>E-Mails zur Prüfung</CardTitle>
                  <CardDescription>{reviewEmails?.length || 0} E-Mails warten auf Review</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[600px]">
                    {reviewLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : reviewEmails && reviewEmails.length > 0 ? (
                      <div className="divide-y">
                        {reviewEmails.map(email => (
                          <div 
                            key={email.id} 
                            className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${selectedEmail === email.id ? 'bg-muted' : ''}`}
                            onClick={() => setSelectedEmail(email.id)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <p className="font-medium">{email.lead?.contact_name}</p>
                                <p className="text-sm text-muted-foreground">{email.lead?.company_name}</p>
                              </div>
                              <Badge variant={
                                email.confidence_level === 'hoch' ? 'default' : 
                                email.confidence_level === 'niedrig' ? 'destructive' : 'secondary'
                              }>
                                {email.confidence_level || 'mittel'}
                              </Badge>
                            </div>
                            <p className="text-sm mt-2 line-clamp-2">{email.subject}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <CheckCircle className="h-16 w-16 mx-auto mb-4 opacity-20 text-green-500" />
                        <h3 className="text-lg font-medium mb-2">Alles geprüft!</h3>
                        <p>Keine E-Mails zur Prüfung vorhanden.</p>
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Email Preview */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle>E-Mail Vorschau</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedEmail && reviewEmails?.find(e => e.id === selectedEmail) ? (() => {
                    const email = reviewEmails.find(e => e.id === selectedEmail)!;
                    return (
                      <div className="space-y-4">
                        <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-muted-foreground">An</p>
                              <p className="font-medium">{email.lead?.contact_name} &lt;{email.lead?.contact_email}&gt;</p>
                            </div>
                            <Badge variant="outline">{email.lead?.company_name}</Badge>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Betreff</p>
                            <p className="font-medium">{email.subject}</p>
                          </div>
                        </div>
                        
                        <div className="p-4 rounded-lg border bg-background min-h-[200px]">
                          <p className="whitespace-pre-wrap text-sm leading-relaxed">{email.body}</p>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-4">
                            <span className="text-muted-foreground">
                              Wörter: <span className="font-medium">{email.body?.split(' ').length || 0}</span>
                            </span>
                            <span className="text-muted-foreground">
                              Kampagne: <span className="font-medium">{email.campaign?.name || '-'}</span>
                            </span>
                          </div>
                          <Badge variant={
                            email.confidence_level === 'hoch' ? 'default' : 
                            email.confidence_level === 'niedrig' ? 'destructive' : 'secondary'
                          }>
                            Konfidenz: {email.confidence_level || 'mittel'}
                          </Badge>
                        </div>

                        <div className="flex gap-3 pt-4 border-t">
                          <Button 
                            variant="outline" 
                            className="flex-1"
                            onClick={() => rejectEmail.mutate(email.id)}
                            disabled={rejectEmail.isPending}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Ablehnen
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={() => regenerateEmail.mutate(email.id)}
                            disabled={regenerateEmail.isPending}
                          >
                            <RefreshCw className={`h-4 w-4 mr-2 ${regenerateEmail.isPending ? 'animate-spin' : ''}`} />
                            Neu generieren
                          </Button>
                          <Button 
                            className="flex-1"
                            onClick={() => approveEmail.mutate(email.id)}
                            disabled={approveEmail.isPending}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Freigeben
                          </Button>
                        </div>
                      </div>
                    );
                  })() : (
                    <div className="text-center py-12 text-muted-foreground">
                      <Mail className="h-16 w-16 mx-auto mb-4 opacity-20" />
                      <p>Wählen Sie eine E-Mail aus der Liste aus</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ========== INBOX TAB ========== */}
          <TabsContent value="inbox" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Unified Inbox</CardTitle>
                <CardDescription>Alle eingehenden Antworten und Konversationen</CardDescription>
              </CardHeader>
              <CardContent>
                {conversations && conversations.length > 0 ? (
                  <div className="divide-y">
                    {conversations.map(conv => (
                      <div key={conv.id} className="flex items-center gap-4 py-4 cursor-pointer hover:bg-muted/50 px-4 -mx-4 transition-colors">
                        <div className={`w-3 h-3 rounded-full shrink-0 ${
                          conv.sentiment === 'positive' ? 'bg-green-500' : 
                          conv.sentiment === 'negative' ? 'bg-red-500' : 'bg-yellow-500'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{conv.lead?.contact_name}</p>
                            <span className="text-muted-foreground">·</span>
                            <p className="text-sm text-muted-foreground">{conv.lead?.company_name}</p>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{conv.subject}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={
                            conv.intent === 'interested' ? 'default' :
                            conv.intent === 'not_interested' ? 'destructive' :
                            conv.intent === 'meeting_request' ? 'default' : 'secondary'
                          }>
                            {conv.intent || 'unbekannt'}
                          </Badge>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {conv.last_message_at && format(new Date(conv.last_message_at), 'dd.MM. HH:mm', { locale: de })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Inbox className="h-16 w-16 mx-auto mb-4 opacity-20" />
                    <h3 className="text-lg font-medium mb-2">Keine Konversationen</h3>
                    <p>Eingehende Antworten werden hier angezeigt.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== QUEUE TAB ========== */}
          <TabsContent value="queue" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <QueueStatusCard />
              </div>
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Warteschlange Details</CardTitle>
                  <CardDescription>Alle E-Mails in der Versand-Queue</CardDescription>
                </CardHeader>
                <CardContent>
                  {queueItems && queueItems.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Empfänger</TableHead>
                          <TableHead>Betreff</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Geplant</TableHead>
                          <TableHead>Versuche</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {queueItems.map(item => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <p className="font-medium">{item.email?.lead?.contact_name || '-'}</p>
                              <p className="text-sm text-muted-foreground">{item.email?.lead?.company_name || '-'}</p>
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">
                              {item.email?.subject || '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={
                                item.status === 'completed' ? 'default' :
                                item.status === 'failed' ? 'destructive' :
                                item.status === 'processing' ? 'secondary' : 'outline'
                              }>
                                {item.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                                {item.status === 'processing' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                                {item.status === 'completed' && <CheckCircle className="h-3 w-3 mr-1" />}
                                {item.status === 'failed' && <XCircle className="h-3 w-3 mr-1" />}
                                {item.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {format(new Date(item.scheduled_at), 'dd.MM. HH:mm', { locale: de })}
                            </TableCell>
                            <TableCell>{item.attempts}</TableCell>
                            <TableCell>
                              {item.status === 'failed' && (
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => retryQueue.mutate(item.id)}
                                  disabled={retryQueue.isPending}
                                >
                                  <RefreshCw className="h-4 w-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <Send className="h-16 w-16 mx-auto mb-4 opacity-20" />
                      <h3 className="text-lg font-medium mb-2">Queue ist leer</h3>
                      <p>Keine E-Mails in der Warteschlange.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <LeadImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <CampaignDialog open={campaignOpen} onOpenChange={setCampaignOpen} campaign={selectedCampaign || undefined} />
      <LeadDetailSheet 
        open={!!selectedLead} 
        onOpenChange={(open) => !open && setSelectedLead(null)} 
        lead={selectedLead}
        campaigns={campaigns || []}
        onGenerateEmail={(leadId, campaignId) => generateEmail.mutate({ leadId, campaignId })}
        onStartSequence={(leadId, campaignId) => {}}
      />
      <GenerateEmailsDialog 
        open={generateOpen} 
        onOpenChange={setGenerateOpen}
        leads={leads || []}
        campaigns={campaigns || []}
      />
    </DashboardLayout>
  );
}