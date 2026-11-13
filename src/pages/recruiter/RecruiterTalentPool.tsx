import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { TalentPoolDashboard } from '@/components/talent-pool/TalentPoolDashboard';
import { useTranslation } from 'react-i18next';

export default function RecruiterTalentPool() {
  const { t } = useTranslation('recruiterCandidates');
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t('pool.title')}</h1>
          <p className="text-muted-foreground">
            {t('pool.subtitle')}
          </p>
        </div>

        <TalentPoolDashboard />
      </div>
    </DashboardLayout>
  );
}
