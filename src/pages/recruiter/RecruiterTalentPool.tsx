import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { TalentPoolDashboard } from '@/components/talent-pool/TalentPoolDashboard';

export default function RecruiterTalentPool() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Talent Pool</h1>
          <p className="text-muted-foreground">
            Verwalten Sie Ihren Kandidatenpool für zukünftige Positionen
          </p>
        </div>

        <TalentPoolDashboard />
      </div>
    </DashboardLayout>
  );
}
