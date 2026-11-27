import type { ComponentType } from 'react';
import {
  Award, Baby, BedDouble, Bike, CalendarClock, CalendarDays, Car, Clock, Coins, FileCheck, Globe, GraduationCap,
  HeartPulse, Home, Landmark, Laptop, MessagesSquare, Monitor, Mountain, Palmtree, PieChart, PiggyBank, Plane, PlugZap,
  Repeat, Star, Sun, Tag, TrainFront, Truck, Dumbbell, Utensils,
} from 'lucide-react';

/**
 * Ein Symbol je Benefit für das Raster im Airbnb-Stil (27.11.2026).
 * Schlüssel ist der deutsche Speicherwert (BenefitsBlock); selbst eingetragene
 * Benefits bekommen den Stern.
 */
const SYMBOLE: Record<string, ComponentType<{ className?: string }>> = {
  '30 Tage Urlaub': Palmtree,
  'Mehr als 30 Tage Urlaub': Sun,
  'Home-Office möglich': Home,
  'Gleitzeit ohne Kernzeit': Clock,
  'Teilzeit möglich': CalendarClock,
  'Workation / Arbeiten aus dem Ausland': Globe,
  'Sabbatical': Mountain,
  'Bonus / Prämien': Coins,
  'Betriebliche Altersvorsorge': PiggyBank,
  'Vermögenswirksame Leistungen': Landmark,
  'Mitarbeiterbeteiligung': PieChart,
  'Umzugsunterstützung': Truck,
  'Jobrad / Fahrradleasing': Bike,
  'Deutschlandticket / Fahrtkostenzuschuss': TrainFront,
  'Firmenwagen': Car,
  'Parkplatz oder Ladesäule': PlugZap,
  'Weiterbildungsbudget': GraduationCap,
  'Konferenzen und Zertifizierungen': Award,
  'Coaching / Mentoring': MessagesSquare,
  'Essenszuschuss oder Kantine': Utensils,
  'Sportangebot (Wellpass, Urban Sports)': Dumbbell,
  'Gesundheitsvorsorge / Betriebsarzt': HeartPulse,
  'Kinderbetreuung oder Kita-Zuschuss': Baby,
  'Moderne Hardware, Gerätewahl': Laptop,
  'Mitarbeiterrabatte': Tag,
  // Contracting
  'Reisekosten werden erstattet': Plane,
  'Übernachtung wird gestellt': BedDouble,
  'Remote-Anteil möglich': Home,
  'Vor-Ort-Tage flexibel': CalendarDays,
  'Keine Kernzeitpflicht': Clock,
  'Eigene Zeiteinteilung': CalendarClock,
  'Eigener Arbeitsplatz': Monitor,
  'Hardware wird gestellt': Laptop,
  'Kantine nutzbar': Utensils,
  'Referenz zugesagt': FileCheck,
  'Anschlussprojekte in Aussicht': Repeat,
  'Zugang zu Schulungen und Zertifizierungen': GraduationCap,
};

export const benefitSymbol = (benefit: string): ComponentType<{ className?: string }> => SYMBOLE[benefit] ?? Star;
