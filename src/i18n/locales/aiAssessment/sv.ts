import type de from './de';
import type { Messages } from '../../types';

const sv: Messages<typeof de> = {
  recommendation: {
    strong_yes: 'Tydlig rekommendation',
    yes: 'Rekommendation',
    maybe: 'Oavgjort',
    no: 'Rekommenderas inte',
    strong_no: 'Avslag',
  },
  score: {
    excellent: 'Utmärkt',
    veryGood: 'Mycket bra',
    good: 'Bra',
    satisfactory: 'Godkänt',
    improve: 'Behöver förbättras',
  },
  title: 'AI-bedömning',
  overall: 'Helhetsbedömning',
  technical: 'Teknisk matchning',
  culture: 'Kulturell matchning',
  communication: 'Kommunikation',
  risk: 'Riskbedömning',
  risks: 'Identifierade risker',
  mitigations: 'Rekommenderade åtgärder',
};
export default sv;
