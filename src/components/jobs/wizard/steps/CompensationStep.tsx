import { useWizardContext } from '../JobWizard';
import { PermanentCompensation } from './PermanentCompensation';
import { FreelanceProject } from './FreelanceProject';
import { TempStaffingDetails } from './TempStaffingDetails';

export function CompensationStep() {
  const { formData } = useWizardContext();

  switch (formData.engagement_model) {
    case 'permanent':
      return <PermanentCompensation />;
    case 'freelance':
      return <FreelanceProject />;
    case 'temp_staffing':
      return <TempStaffingDetails />;
    default:
      return <PermanentCompensation />;
  }
}
