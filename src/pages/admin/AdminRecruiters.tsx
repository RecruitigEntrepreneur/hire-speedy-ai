import { DashboardLayout } from '@/components/layout/DashboardLayout';
import NetworkCockpit from '@/components/admin/network/NetworkCockpit';
import { AdminReviewQueues } from '@/components/admin/review/AdminReviewQueues';

/**
 * Recruiterverwaltung. Einladungen, Onboarding-Vorgänge und Recruiter-Konten
 * stehen seit dem 18.09.2026 in einer Liste je Person, mit „Jetzt dran“ oben und
 * der Akte rechts. Die frühere Einzelgebühr je Recruiter ist entfallen: Die
 * Konditionen gelten einheitlich nach dem Konditionenblatt des Rahmenvertrags.
 */
export default function AdminRecruiters() {
  return <DashboardLayout>
    <div className="container space-y-6 py-6">
      <NetworkCockpit/>
      {/* Prüfungen: Direktkontakte, Pausen/Schließungen, Bestandskunden, Partnerstufen */}
      <AdminReviewQueues/>
    </div>
  </DashboardLayout>;
}
