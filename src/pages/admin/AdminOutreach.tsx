import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Mail, Send, BarChart3, Inbox, Target, CheckCircle, XCircle, Clock, Eye, MousePointer, MessageSquare } from 'lucide-react';
import { useOutreachLeads, useOutreachCampaigns, useOutreachEmails, useOutreachStats, useOutreachConversations, useApproveEmail } from '@/hooks/useOutreach';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export default function AdminOutreach() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { data: stats } = useOutreachStats();
  const { data: leads } = useOutreachLeads();
  const { data: campaigns } = useOutreachCampaigns();
  const { data: reviewEmails } = useOutreachEmails('review');
  const { data: conversations } = useOutreachConversations();
  const approveEmail = useApproveEmail();

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Outreach System</h1>
            <p className="text-muted-foreground">B2B E-Mail-Akquise & Reply Management</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-6 w-full max-w-3xl">
            <TabsTrigger value="dashboard"><BarChart3 className="h-4 w-4 mr-1" />Dashboard</TabsTrigger>
            <TabsTrigger value="leads"><Users className="h-4 w-4 mr-1" />Leads</TabsTrigger>
            <TabsTrigger value="campaigns"><Target className="h-4 w-4 mr-1" />Kampagnen</TabsTrigger>
            <TabsTrigger value="review"><Mail className="h-4 w-4 mr-1" />Review</TabsTrigger>
            <TabsTrigger value="inbox"><Inbox className="h-4 w-4 mr-1" />Inbox</TabsTrigger>
            <TabsTrigger value="queue"><Send className="h-4 w-4 mr-1" />Queue</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Leads</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-bold">{stats?.totalLeads || 0}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Gesendet</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-bold">{stats?.totalSent || 0}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Öffnungsrate</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-bold text-green-600">{stats?.openRate}%</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Antwortrate</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-bold text-blue-600">{stats?.replyRate}%</div></CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle>Aktive Kampagnen</CardTitle></CardHeader>
                <CardContent>
                  {campaigns?.filter(c => c.is_active).slice(0, 5).map(campaign => (
                    <div key={campaign.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="font-medium">{campaign.name}</p>
                        <p className="text-sm text-muted-foreground">{campaign.target_segment}</p>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1"><Send className="h-3 w-3" />{campaign.stats?.sent || 0}</span>
                        <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{campaign.stats?.opened || 0}</span>
                        <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{campaign.stats?.replied || 0}</span>
                      </div>
                    </div>
                  ))}
                  {(!campaigns || campaigns.filter(c => c.is_active).length === 0) && (
                    <p className="text-muted-foreground text-center py-4">Keine aktiven Kampagnen</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Neueste Antworten</CardTitle></CardHeader>
                <CardContent>
                  {conversations?.slice(0, 5).map(conv => (
                    <div key={conv.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="font-medium">{conv.lead?.contact_name}</p>
                        <p className="text-sm text-muted-foreground">{conv.lead?.company_name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={conv.sentiment === 'positive' ? 'default' : conv.sentiment === 'negative' ? 'destructive' : 'secondary'}>
                          {conv.intent || 'unbekannt'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {(!conversations || conversations.length === 0) && (
                    <p className="text-muted-foreground text-center py-4">Keine Antworten</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="leads">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Leads ({leads?.length || 0})</CardTitle>
                <Button>CSV Import</Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kontakt</TableHead>
                      <TableHead>Firma</TableHead>
                      <TableHead>Branche</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Letzter Kontakt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads?.slice(0, 20).map(lead => (
                      <TableRow key={lead.id}>
                        <TableCell>
                          <div><p className="font-medium">{lead.contact_name}</p><p className="text-sm text-muted-foreground">{lead.contact_email}</p></div>
                        </TableCell>
                        <TableCell>{lead.company_name}</TableCell>
                        <TableCell>{lead.industry || '-'}</TableCell>
                        <TableCell><Badge variant="outline">{lead.status}</Badge></TableCell>
                        <TableCell>{lead.score}</TableCell>
                        <TableCell>{lead.last_contacted_at ? format(new Date(lead.last_contacted_at), 'dd.MM.yy', { locale: de }) : '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="campaigns">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Kampagnen</CardTitle>
                <Button>Neue Kampagne</Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Ziel</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Gesendet</TableHead>
                      <TableHead>Geöffnet</TableHead>
                      <TableHead>Antworten</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns?.map(campaign => (
                      <TableRow key={campaign.id}>
                        <TableCell className="font-medium">{campaign.name}</TableCell>
                        <TableCell>{campaign.goal}</TableCell>
                        <TableCell>
                          <Badge variant={campaign.is_active ? 'default' : 'secondary'}>
                            {campaign.is_active ? 'Aktiv' : 'Inaktiv'}
                          </Badge>
                        </TableCell>
                        <TableCell>{campaign.stats?.sent || 0}</TableCell>
                        <TableCell>{campaign.stats?.opened || 0}</TableCell>
                        <TableCell>{campaign.stats?.replied || 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="review">
            <Card>
              <CardHeader>
                <CardTitle>E-Mail Review Queue ({reviewEmails?.length || 0})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {reviewEmails?.map(email => (
                  <div key={email.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{email.lead?.contact_name} @ {email.lead?.company_name}</p>
                        <p className="text-sm text-muted-foreground">{email.lead?.contact_email}</p>
                      </div>
                      <Badge variant={email.confidence_level === 'hoch' ? 'default' : email.confidence_level === 'niedrig' ? 'destructive' : 'secondary'}>
                        {email.confidence_level || 'mittel'}
                      </Badge>
                    </div>
                    <div className="bg-muted/50 p-3 rounded">
                      <p className="font-medium mb-2">Betreff: {email.subject}</p>
                      <p className="text-sm whitespace-pre-wrap">{email.body}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm"><XCircle className="h-4 w-4 mr-1" />Ablehnen</Button>
                      <Button size="sm" onClick={() => approveEmail.mutate(email.id)} disabled={approveEmail.isPending}>
                        <CheckCircle className="h-4 w-4 mr-1" />Freigeben
                      </Button>
                    </div>
                  </div>
                ))}
                {(!reviewEmails || reviewEmails.length === 0) && (
                  <p className="text-center text-muted-foreground py-8">Keine E-Mails zur Prüfung</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="inbox">
            <Card>
              <CardHeader><CardTitle>Unified Inbox</CardTitle></CardHeader>
              <CardContent>
                {conversations?.map(conv => (
                  <div key={conv.id} className="flex items-center justify-between py-3 border-b last:border-0 cursor-pointer hover:bg-muted/50 px-2 rounded">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${conv.sentiment === 'positive' ? 'bg-green-500' : conv.sentiment === 'negative' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                      <div>
                        <p className="font-medium">{conv.lead?.contact_name}</p>
                        <p className="text-sm text-muted-foreground">{conv.subject}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{conv.intent}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {conv.last_message_at && format(new Date(conv.last_message_at), 'dd.MM. HH:mm', { locale: de })}
                      </span>
                    </div>
                  </div>
                ))}
                {(!conversations || conversations.length === 0) && (
                  <p className="text-center text-muted-foreground py-8">Keine Konversationen</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="queue">
            <Card>
              <CardHeader><CardTitle>Versand-Queue</CardTitle></CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center py-8">Queue-Status wird hier angezeigt</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
