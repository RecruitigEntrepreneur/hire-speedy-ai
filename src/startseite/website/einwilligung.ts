// „Cookie-Einstellungen“ im Fuß öffnet den Cookie-Hinweis der App (die Website hat keinen eigenen).
import { setCookieBannerOpen } from '@/lib/cookieBanner';
export const zentraleOeffnen = () => setCookieBannerOpen(true);
