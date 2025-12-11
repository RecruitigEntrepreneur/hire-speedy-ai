import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RecruiterStripeOnboarding } from "@/components/payment/RecruiterStripeOnboarding";
import { EscrowStatusBadge } from "@/components/payment/EscrowStatusBadge";
import { PayoutRequestCard } from "@/components/payment/PayoutRequestCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Loader2, Wallet, TrendingUp, Clock, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface PlacementWithPayout {
  id: string;
  start_date: string;
  recruiter_payout: number;
  escrow_status: string;
  escrow_release_date: string | null;
  payment_status: string;
  submission: {
    candidate: {
      full_name: string;
    };
    job: {
      title: string;
      company_name: string;
    };
  };
  payout_request: {
    id: string;
    status: string;
    created_at: string;
  } | null;
}

interface PayoutStats {
  pending: number;
  inEscrow: number;
  available: number;
  paid: number;
}

export default function RecruiterPayouts() {
  const { user } = useAuth();
  const [placements, setPlacements] = useState<PlacementWithPayout[]>([]);
  const [stats, setStats] = useState<PayoutStats>({ pending: 0, inEscrow: 0, available: 0, paid: 0 });
  const [loading, setLoading] = useState(true);

  const fetchPayouts = async () => {
    if (!user) return;

    try {
      // Fetch placements with payout info
      const { data: placementsData, error: placementsError } = await supabase
        .from("placements")
        .select(`
          id,
          start_date,
          recruiter_payout,
          escrow_status,
          escrow_release_date,
          payment_status,
          submission:submissions!inner (
            recruiter_id,
            candidate:candidates (
              full_name
            ),
            job:jobs (
              title,
              company_name
            )
          )
        `)
        .eq("submission.recruiter_id", user.id);

      if (placementsError) throw placementsError;

      // Fetch payout requests
      const { data: payoutRequests } = await supabase
        .from("payout_requests")
        .select("*")
        .eq("recruiter_id", user.id);

      // Map payout requests to placements
      const placementsWithPayouts = (placementsData || []).map((p: any) => ({
        ...p,
        payout_request: payoutRequests?.find((pr) => pr.placement_id === p.id) || null,
      }));

      setPlacements(placementsWithPayouts);

      // Calculate stats
      const newStats: PayoutStats = { pending: 0, inEscrow: 0, available: 0, paid: 0 };
      
      placementsWithPayouts.forEach((p: PlacementWithPayout) => {
        const amount = p.recruiter_payout || 0;
        
        if (p.payout_request?.status === "completed") {
          newStats.paid += amount;
        } else if (p.escrow_status === "released" || 
          (p.escrow_status === "held" && p.escrow_release_date && new Date(p.escrow_release_date) <= new Date())) {
          newStats.available += amount;
        } else if (p.escrow_status === "held") {
          newStats.inEscrow += amount;
        } else {
          newStats.pending += amount;
        }
      });

      setStats(newStats);
    } catch (error) {
      console.error("Error fetching payouts:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayouts();
  }, [user]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  };

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
          <div>
            <h1 className="text-2xl font-bold">Auszahlungen</h1>
            <p className="text-muted-foreground">
              Verwalte deine Auszahlungen und Stripe-Verbindung
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ausstehend</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stats.pending)}</div>
                <p className="text-xs text-muted-foreground">Warte auf Zahlung</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">In Escrow</CardTitle>
                <Wallet className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{formatCurrency(stats.inEscrow)}</div>
                <p className="text-xs text-muted-foreground">90-Tage Escrow</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Verfügbar</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.available)}</div>
                <p className="text-xs text-muted-foreground">Zur Auszahlung bereit</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ausgezahlt</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stats.paid)}</div>
                <p className="text-xs text-muted-foreground">Gesamt erhalten</p>
              </CardContent>
            </Card>
          </div>

          {/* Stripe Onboarding */}
          <RecruiterStripeOnboarding />

          {/* Placements Table */}
          <Card>
            <CardHeader>
              <CardTitle>Deine Placements</CardTitle>
              <CardDescription>
                Übersicht aller Placements und deren Auszahlungsstatus
              </CardDescription>
            </CardHeader>
            <CardContent>
              {placements.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Noch keine Placements vorhanden
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kandidat</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Startdatum</TableHead>
                      <TableHead>Provision</TableHead>
                      <TableHead>Escrow Status</TableHead>
                      <TableHead>Auszahlung</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {placements.map((placement) => (
                      <TableRow key={placement.id}>
                        <TableCell className="font-medium">
                          {placement.submission?.candidate?.full_name || "—"}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p>{placement.submission?.job?.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {placement.submission?.job?.company_name}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {placement.start_date
                            ? format(new Date(placement.start_date), "dd.MM.yyyy", { locale: de })
                            : "—"}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(placement.recruiter_payout || 0)}
                        </TableCell>
                        <TableCell>
                          <EscrowStatusBadge
                            status={placement.escrow_status || "pending"}
                            releaseDate={placement.escrow_release_date || undefined}
                          />
                        </TableCell>
                        <TableCell>
                          {placement.payout_request ? (
                            <Badge
                              variant="outline"
                              className={
                                placement.payout_request.status === "completed"
                                  ? "bg-green-500/10 text-green-600"
                                  : placement.payout_request.status === "pending"
                                  ? "bg-yellow-500/10 text-yellow-600"
                                  : ""
                              }
                            >
                              {placement.payout_request.status === "completed"
                                ? "Ausgezahlt"
                                : placement.payout_request.status === "pending"
                                ? "Angefragt"
                                : placement.payout_request.status}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </>
  );
}
