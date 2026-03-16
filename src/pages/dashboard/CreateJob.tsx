import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { JobWizard } from '@/components/jobs/wizard/JobWizard';
import { useJobWizard } from '@/hooks/useJobWizard';

export default function CreateJob() {
  const wizard = useJobWizard();

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <JobWizard wizard={wizard} />
      </div>
    </DashboardLayout>
  );
}
