// Wörterbücher der Sektions-Inhalte: je Sektion eine Datei mit { en, sv, nb }, Schlüssel = deutscher Text.
// Gleiche deutsche Schlüssel in mehreren Dateien müssen gleich übersetzt sein (sonst gewinnt die letzte).
// Schwedisch und Norwegisch sind nicht muttersprachlich gegengelesen.
import type { Woerterbuch } from "./typ";
import einstieg from "./einstieg";
import logos from "./logos";
import klammer from "./klammer";
import satzweg from "./satzweg";
import bahnen from "./bahnen";
import preis from "./preis";
import plattform from "./plattform";
import notizen from "./notizen";
import aufgaben from "./aufgaben";
import fragen from "./fragen";
import karriere from "./karriere";

const TEILE: Woerterbuch[] = [einstieg, logos, klammer, satzweg, bahnen, preis, plattform, notizen, aufgaben, fragen, karriere];

const zusammen = (sprache: keyof Woerterbuch) => Object.assign({}, ...TEILE.map((t) => t[sprache])) as Record<string, string>;

export const WOERTER: Woerterbuch = { en: zusammen("en"), sv: zusammen("sv"), nb: zusammen("nb") };
