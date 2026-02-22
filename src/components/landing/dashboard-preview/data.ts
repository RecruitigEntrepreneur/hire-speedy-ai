import { BarChart3, Users, CheckCircle2, TrendingUp } from "lucide-react";

export type Tab = "dashboard" | "jobs" | "kandidaten" | "analytics" | "messages";

export const SIDEBAR_ITEMS: { label: string; tab: Tab | null; badge?: number }[] = [
  { label: "Dashboard", tab: "dashboard" },
  { label: "Jobs", tab: "jobs" },
  { label: "Kandidaten", tab: "kandidaten" },
  { label: "Analytics", tab: "analytics" },
  { label: "Messages", tab: "messages", badge: 2 },
  { label: "Settings", tab: null },
];

export const METRICS = [
  { label: "Aktive Jobs", end: 12, icon: BarChart3, trend: "+3" },
  { label: "Submissions", end: 248, icon: Users, trend: "+47" },
  { label: "Interviews", end: 18, icon: CheckCircle2, trend: "+5" },
  { label: "Match Rate", end: 94, icon: TrendingUp, trend: "↑8%", suffix: "%" },
];

export const PIPELINE = [
  { name: "Anna M.", role: "Senior Developer", score: 94, skills: ["React", "TypeScript", "Node"] },
  { name: "Thomas K.", role: "Product Manager", score: 89, skills: ["Strategy", "Scrum", "SQL"] },
  { name: "Lisa S.", role: "UX Lead", score: 87, skills: ["Figma", "Research", "CSS"] },
];

export const JOBS = [
  { title: "Senior Frontend Engineer", company: "TechVentures GmbH", status: "Aktiv", count: 14 },
  { title: "Product Manager", company: "ScaleUp AG", status: "Aktiv", count: 8 },
  { title: "DevOps Lead", company: "CloudFirst", status: "Pause", count: 3 },
  { title: "UX Designer", company: "DesignLab", status: "Geschlossen", count: 22 },
];

export const KANDIDATEN = [
  { name: "Sarah B.", role: "Full-Stack Dev", score: 96, skills: ["React", "Node", "AWS"] },
  { name: "Max W.", role: "Backend Engineer", score: 91, skills: ["Go", "K8s", "PostgreSQL"] },
  { name: "Elena R.", role: "Product Lead", score: 88, skills: ["Strategy", "Agile", "Analytics"] },
];

export const ANALYTICS_WEEKLY = [
  { label: "Mo", value: 32 },
  { label: "Di", value: 45 },
  { label: "Mi", value: 28 },
  { label: "Do", value: 64 },
  { label: "Fr", value: 52 },
  { label: "Sa", value: 18 },
  { label: "So", value: 9 },
];

export const FUNNEL_DATA = [
  { label: "Submitted", value: 248 },
  { label: "Reviewed", value: 94 },
  { label: "Interview", value: 18 },
  { label: "Hired", value: 6 },
];

export const MESSAGES = [
  { name: "Julia F.", text: "Kandidat hat zugesagt! 🎉", time: "vor 12 Min", unread: true },
  { name: "Marc D.", text: "Interview verschoben auf Do", time: "vor 1 Std", unread: true },
  { name: "Sarah K.", text: "CV von neuen Kandidaten liegt vor", time: "vor 3 Std", unread: false },
];

export const NOTIFICATIONS = [
  { text: "Neuer Kandidat: Sarah B. — 96% Match", time: "vor 5 Min" },
  { text: "Interview morgen: Thomas K.", time: "vor 1 Std" },
  { text: "Job geschlossen: UX Designer", time: "vor 3 Std" },
];
