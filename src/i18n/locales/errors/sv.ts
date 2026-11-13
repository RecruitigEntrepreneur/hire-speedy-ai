import type de from './de';
import type { Messages } from '../../types';

const sv: Messages<typeof de> = {
  matchCalc: 'Beräkningen misslyckades',
  fitCredit: 'AI-kreditgränsen är nådd. Kontakta supporten.',
  fitRate: 'För många förfrågningar. Vänta en stund.',
  fitCreated: 'Matchningsanalys skapad',
  fitCreatedText: 'Matchningsanalysen har tagits fram.',
  fitUnknown: 'Okänt fel när analysen skulle tas fram',
  fitFailed: 'Analysen misslyckades',
  generic: 'Något gick fel',
  activities: 'Aktiviteterna kunde inte laddas',
  notSignedIn: 'Inte inloggad',
  saveFailed: 'Det gick inte att spara',
  feedbackSaved: 'Feedback sparad',
  feedbackFailed: 'Feedbacken kunde inte sparas',
  sendFailed: 'Det gick inte att skicka.',
  notDeployed: 'Kan inte skicka: funktionen ”{{fn}}” är inte driftsatt än.',
  docxInvalid: 'Filen är ingen giltig Word-fil.',
  docxBroken: 'Word-filen är skadad.',
  docxEmpty: 'Word-filen innehåller ingen text.',
  docxBrowser: 'Din webbläsare kan inte öppna Word-filer. Använd PDF eller text.',
  score: {
    excellent: 'Utmärkt',
    veryGood: 'Mycket bra',
    good: 'Bra',
    satisfactory: 'Godkänt',
    sufficient: 'Tillräckligt',
    low: 'Låg',
  },
  multiplier: {
    none: 'Inga begränsningar',
    light: 'Lätta begränsningar',
    clear: 'Tydliga begränsningar',
    severe: 'Allvarliga begränsningar',
  },
  coverage: {
    complete: 'Fullständig',
    sufficient: 'Tillräcklig',
    partial: 'Delvis',
    insufficient: 'Otillräcklig',
  },
};
export default sv;
