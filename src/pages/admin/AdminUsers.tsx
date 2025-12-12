import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Loader2, 
  Search, 
  Users, 
  UserCheck, 
  Building2, 
  Shield,
  MoreHorizontal,
  Eye,
  Ban,
  CheckCircle,
  Mail,
  RefreshCw
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface User {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'client' | 'recruiter';
  status: string;
  verified: boolean;
  created_at: string;
  company_name?: string | null;
  internal_notes?: string | null;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    // Fetch user roles
    const { data: rolesData, error: rolesError } = await supabase
      .from('user_roles')
      .select('*')
      .order('created_at', { ascending: false });

    if (rolesError) {
      console.error('Error fetching roles:', rolesError);
      setLoading(false);
      return;
    }

    // Fetch profiles
    const userIds = rolesData.map(r => r.user_id);
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('user_id, full_name, email, company_name, internal_notes')
      .in('user_id', userIds);

    const profileMap = profilesData?.reduce((acc, p) => {
      acc[p.user_id] = p;
      return acc;
    }, {} as Record<string, any>) || {};

    const enrichedUsers = rolesData.map(role => ({
      id: role.id,
      user_id: role.user_id,
      email: profileMap[role.user_id]?.email || '-',
      full_name: profileMap[role.user_id]?.full_name || null,
      role: role.role as 'admin' | 'client' | 'recruiter',
      status: role.status || 'active',
      verified: role.verified || false,
      created_at: role.created_at,
      company_name: profileMap[role.user_id]?.company_name || null,
      internal_notes: profileMap[role.user_id]?.internal_notes || null,
    }));

    setUsers(enrichedUsers);
    setLoading(false);
  };

  const handleToggleStatus = async (user: User) => {
    setProcessing(user.id);
    const newStatus = user.status === 'active' ? 'suspended' : 'active';
    
    const { error } = await supabase
      .from('user_roles')
      .update({ 
        status: newStatus,
        suspended_at: newStatus === 'suspended' ? new Date().toISOString() : null
      })
      .eq('id', user.id);

    if (error) {
      toast.error('Fehler beim Aktualisieren');
    } else {
      toast.success(newStatus === 'suspended' ? 'Benutzer suspendiert' : 'Benutzer aktiviert');
      fetchUsers();
    }
    setProcessing(null);
  };

  const handleToggleVerified = async (user: User) => {
    setProcessing(user.id);
    
    const { error } = await supabase
      .from('user_roles')
      .update({ verified: !user.verified })
      .eq('id', user.id);

    if (error) {
      toast.error('Fehler beim Aktualisieren');
    } else {
      toast.success(user.verified ? 'Verifizierung aufgehoben' : 'Benutzer verifiziert');
      fetchUsers();
    }
    setProcessing(null);
  };

  const handleChangeRole = async (user: User, newRole: string) => {
    setProcessing(user.id);
    
    const { error } = await supabase
      .from('user_roles')
      .update({ role: newRole as 'admin' | 'client' | 'recruiter' })
      .eq('id', user.id);

    if (error) {
      toast.error('Fehler beim Ändern der Rolle');
    } else {
      toast.success('Rolle geändert');
      fetchUsers();
      setSelectedUser(prev => prev ? { ...prev, role: newRole as 'admin' | 'client' | 'recruiter' } : null);
    }
    setProcessing(null);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-purple-500">Admin</Badge>;
      case 'recruiter':
        return <Badge className="bg-blue-500">Recruiter</Badge>;
      case 'client':
        return <Badge className="bg-green-500">Kunde</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  const getStatusBadge = (status: string, verified: boolean) => {
    if (status === 'suspended') {
      return <Badge variant="destructive">Suspendiert</Badge>;
    }
    if (!verified) {
      return <Badge variant="outline">Nicht verifiziert</Badge>;
    }
    return <Badge className="bg-green-500">Aktiv</Badge>;
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.company_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  const adminCount = users.filter(u => u.role === 'admin').length;
  const clientCount = users.filter(u => u.role === 'client').length;
  const recruiterCount = users.filter(u => u.role === 'recruiter').length;
  const unverifiedCount = users.filter(u => !u.verified).length;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Users className="h-8 w-8" />
              Benutzerverwaltung
            </h1>
            <p className="text-muted-foreground mt-1">
              Alle Benutzer einsehen und verwalten
            </p>
          </div>
          <Button variant="outline" onClick={fetchUsers}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Aktualisieren
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gesamt</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Kunden</CardTitle>
              <Building2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{clientCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recruiter</CardTitle>
              <UserCheck className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{recruiterCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Nicht verifiziert</CardTitle>
              <Shield className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{unverifiedCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suche nach Name, E-Mail, Firma..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Rolle filtern" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Rollen</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="client">Kunde</SelectItem>
              <SelectItem value="recruiter">Recruiter</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Users Table */}
        <Card>
          <CardContent className="p-0">
            {filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Keine Benutzer gefunden</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Benutzer</TableHead>
                    <TableHead>Rolle</TableHead>
                    <TableHead>Firma</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Registriert</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{user.full_name || 'Kein Name'}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getRoleBadge(user.role)}
                      </TableCell>
                      <TableCell>
                        {user.company_name || '-'}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(user.status, user.verified)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(user.created_at), 'PPP', { locale: de })}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={processing === user.id}>
                              {processing === user.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreHorizontal className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => {
                              setSelectedUser(user);
                              setDetailOpen(true);
                            }}>
                              <Eye className="mr-2 h-4 w-4" />
                              Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {!user.verified && (
                              <DropdownMenuItem onClick={() => handleToggleVerified(user)}>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Verifizieren
                              </DropdownMenuItem>
                            )}
                            {user.verified && user.role === 'recruiter' && (
                              <DropdownMenuItem onClick={() => handleToggleVerified(user)}>
                                <Shield className="mr-2 h-4 w-4" />
                                Verifizierung aufheben
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleToggleStatus(user)}>
                              <Ban className="mr-2 h-4 w-4" />
                              {user.status === 'active' ? 'Suspendieren' : 'Aktivieren'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Benutzerdetails</DialogTitle>
            </DialogHeader>
            {selectedUser && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{selectedUser.full_name || 'Kein Name'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">E-Mail</p>
                    <p className="font-medium">{selectedUser.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Rolle</p>
                    {getRoleBadge(selectedUser.role)}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    {getStatusBadge(selectedUser.status, selectedUser.verified)}
                  </div>
                  {selectedUser.company_name && (
                    <div className="col-span-2">
                      <p className="text-sm text-muted-foreground">Firma</p>
                      <p className="font-medium">{selectedUser.company_name}</p>
                    </div>
                  )}
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Registriert am</p>
                    <p className="font-medium">
                      {format(new Date(selectedUser.created_at), 'PPP', { locale: de })}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Rolle ändern</Label>
                  <Select 
                    value={selectedUser.role} 
                    onValueChange={(value) => handleChangeRole(selectedUser, value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client">Kunde</SelectItem>
                      <SelectItem value="recruiter">Recruiter</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2 pt-4">
                  {!selectedUser.verified && (
                    <Button 
                      className="flex-1"
                      onClick={() => {
                        handleToggleVerified(selectedUser);
                        setDetailOpen(false);
                      }}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Verifizieren
                    </Button>
                  )}
                  <Button 
                    variant={selectedUser.status === 'active' ? 'destructive' : 'default'}
                    className="flex-1"
                    onClick={() => {
                      handleToggleStatus(selectedUser);
                      setDetailOpen(false);
                    }}
                  >
                    <Ban className="mr-2 h-4 w-4" />
                    {selectedUser.status === 'active' ? 'Suspendieren' : 'Aktivieren'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}