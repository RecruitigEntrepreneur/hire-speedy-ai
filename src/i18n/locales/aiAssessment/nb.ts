import type de from './de';
import type { Messages } from '../../types';

const nb: Messages<typeof de> = {
  recommendation: {
    strong_yes: 'Klar anbefaling',
    yes: 'Anbefaling',
    maybe: 'Uavklart',
    no: 'Ikke anbefalt',
    strong_no: 'Avslag',
  },
  score: {
    excellent: 'Utmerket',
    veryGood: 'Svært god',
    good: 'God',
    satisfactory: 'Tilfredsstillende',
    improve: 'Forbedringsbehov',
  },
  title: 'AI-vurdering',
  overall: 'Samlet vurdering',
  technical: 'Teknisk match',
  culture: 'Kulturell match',
  communication: 'Kommunikasjon',
  risk: 'Risikovurdering',
  risks: 'Identifiserte risikoer',
  mitigations: 'Anbefalte tiltak',
};
export default nb;
