import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/layout/Navbar';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Search, Building2, Mail, Briefcase } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface Client {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  company_name: string | null;
  created_at: string;
  jobCount: number;
}

export default function AdminClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    // Get all client user_ids from user_roles
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'client');

    if (!roleData) {
      setLoading(false);
      return;
    }

    const clientUserIds = roleData.map(r => r.user_id);

    // Get profiles for these users
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .in('user_id', clientUserIds);

    // Get job counts for each client
    const { data: jobData } = await supabase
      .from('jobs')
      .select('client_id')
      .in('client_id', clientUserIds);

    const jobCounts = jobData?.reduce((acc, job) => {
      acc[job.client_id] = (acc[job.client_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    const clientsWithJobs = profileData?.map(profile => ({
      ...profile,
      jobCount: jobCounts[profile.user_id] || 0,
    })) || [];

    setClients(clientsWithJobs);
    setLoading(false);
  };

  const filteredClients = clients.filter(c =>
    c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.company_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <>
        <Navbar />
        <DashboardLayout>
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DashboardLayout>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Clients</h1>
            <p className="text-muted-foreground mt-1">
              Alle registrierten Unternehmen
            </p>
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gesamt Clients</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{clients.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Mit aktiven Jobs</CardTitle>
                <Briefcase className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {clients.filter(c => c.jobCount > 0).length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gesamt Jobs</CardTitle>
                <Briefcase className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {clients.reduce((sum, c) => sum + c.jobCount, 0)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suche nach Name, E-Mail oder Firma..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Clients Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>E-Mail</TableHead>
                    <TableHead>Firma</TableHead>
                    <TableHead>Jobs</TableHead>
                    <TableHead>Registriert</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Keine Clients gefunden
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredClients.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">
                          {client.full_name || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            {client.email}
                          </div>
                        </TableCell>
                        <TableCell>
                          {client.company_name || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{client.jobCount}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(client.created_at), 'PP', { locale: de })}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </>
  );
}
