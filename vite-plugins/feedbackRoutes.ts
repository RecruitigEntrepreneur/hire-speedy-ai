/**
 * Routen-Tabelle für die Feedback-Lasche: welcher Pfad gehört zu welcher Datei.
 *
 * Wird beim Bauen aus src/App.tsx gelesen (keine KI, keine Pflege von Hand)
 * und als virtuelles Modul `virtual:feedback-routes` bereitgestellt. Die
 * Lasche schickt damit Route und Datei mit, das Ticket nennt sie dem
 * Entwickler-Team. Ändert sich App.tsx, wird die Tabelle neu erzeugt.
 */
import fs from "fs";
import path from "path";
import type { Plugin } from "vite";

export interface FeedbackRoute {
  path: string;
  component: string;
  file: string;
}

const VIRTUAL_ID = "virtual:feedback-routes";
const RESOLVED_ID = "\0" + VIRTUAL_ID;

/** Hüllen um die eigentliche Seite, die nicht als Seite zählen. */
const WRAPPERS = new Set(["ProtectedRoute", "Suspense", "Navigate", "RouteFallback", "ErrorBoundary", "Route"]);

function resolveFile(root: string, relative: string): string {
  const base = path.resolve(root, "src", relative);
  for (const candidate of [base, `${base}.tsx`, `${base}.ts`, path.join(base, "index.tsx"), path.join(base, "index.ts")]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return path.relative(root, candidate);
  }
  return path.relative(root, `${base}.tsx`);
}

export function buildFeedbackRoutes(root: string): FeedbackRoute[] {
  const appFile = path.resolve(root, "src/App.tsx");
  const source = fs.readFileSync(appFile, "utf8");

  const imports = new Map<string, string>();
  for (const m of source.matchAll(/import\s+(\w+)\s+from\s+["'](\.\/[^"']+)["']/g)) imports.set(m[1], m[2]);
  for (const m of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*["'](\.\/[^"']+)["']/g)) {
    for (const part of m[1].split(",")) {
      const [original, alias] = part.trim().split(/\s+as\s+/);
      const name = (alias ?? original)?.trim();
      if (name) imports.set(name, m[2]);
    }
  }
  for (const m of source.matchAll(/const\s+(\w+)\s*=\s*lazy\(\s*\(\)\s*=>\s*import\(\s*["'](\.\/[^"']+)["']\s*\)\s*\)/g)) {
    imports.set(m[1], m[2]);
  }

  const routes: FeedbackRoute[] = [];
  const routeRe = /<Route\s+path="([^"]+)"\s+element=\{/g;
  let match: RegExpExecArray | null;
  while ((match = routeRe.exec(source))) {
    const rest = source.slice(match.index + match[0].length, match.index + match[0].length + 800);
    // Bis zur nächsten Route — nicht bei <RouteFallback abschneiden.
    const element = rest.split(/<Route\s/)[0];
    const component = [...element.matchAll(/<([A-Z]\w*)/g)]
      .map((t) => t[1])
      .find((name) => !WRAPPERS.has(name) && imports.has(name));
    if (!component) continue;
    routes.push({ path: match[1], component, file: resolveFile(root, imports.get(component)!) });
  }
  return routes;
}

export function feedbackRoutes(root: string): Plugin {
  const appFile = path.resolve(root, "src/App.tsx");
  return {
    name: "feedback-routes",
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
    },
    load(id) {
      if (id !== RESOLVED_ID) return undefined;
      this.addWatchFile(appFile);
      try {
        return `export default ${JSON.stringify(buildFeedbackRoutes(root))};`;
      } catch (error) {
        this.warn(`Routen-Tabelle für Feedback nicht erzeugt: ${(error as Error).message}`);
        return "export default [];";
      }
    },
    handleHotUpdate({ file, server }) {
      if (path.resolve(file) !== appFile) return;
      const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
      if (mod) server.moduleGraph.invalidateModule(mod);
    },
  };
}
