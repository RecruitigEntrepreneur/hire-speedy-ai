/**
 * Mitschreiben für die Feedback-Lasche, ab dem ersten Skript.
 *
 * main.tsx importiert diese Datei als Allererstes: supabase-js merkt sich
 * fetch beim Anlegen des Clients, der Netzwerk-Mitschnitt muss also vorher
 * stehen. Fehler beim Laden der Seite sind so auch schon dabei.
 */
import { installConsoleBuffer } from './consoleBuffer';
import { installSessionTrail } from './sessionTrail';

installConsoleBuffer();
installSessionTrail();
