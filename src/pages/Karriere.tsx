import Karriere from '@/startseite/neu/kr-karriere';
import { WebsiteSeite } from './website/WebsiteSeite';

/**
 * Karriere-Seite der Website (27.11.2026, aus dem Labor: neu/kr-karriere). Ersetzt die alte Seite /careers
 * (pages/public/Careers.tsx mit erfundenen Stellen), deren Adresse hierher führt.
 */
export default function KarriereSeite() {
  return (
    <WebsiteSeite titel="Karriere">
      <Karriere />
    </WebsiteSeite>
  );
}
