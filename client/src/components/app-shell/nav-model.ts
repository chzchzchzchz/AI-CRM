import {
  Activity,
  Blocks,
  Building2,
  CalendarClock,
  ChartNoAxesColumn,
  CheckCheck,
  ClipboardList,
  Contact,
  Database,
  FileSpreadsheet,
  FileText,
  Home,
  Layers,
  type LucideIcon,
  Mic,
  Radar,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Target,
  TrendingUp,
  Upload,
  Users,
  Workflow,
} from "lucide-react";

export type NavItem = {
  path: string;
  label: string;
  icon: LucideIcon;
  /** Extra prefixes that should also light this item up. */
  match?: string[];
  adminOnly?: boolean;
};

export type NavSection = {
  id: string;
  label: string;
  items: NavItem[];
};

/**
 * Twenty-six destinations is too many for a flat list, so they are grouped by
 * the question the user is answering — who to work, what is happening, what to
 * send, where the data comes from — rather than by which team built them.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    id: "workspace",
    label: "Workspace",
    items: [
      { path: "/", label: "Today", icon: Home },
      { path: "/accounts", label: "Accounts", icon: Building2, match: ["/accounts/"] },
      { path: "/contacts", label: "Contacts", icon: Contact, match: ["/contacts/"] },
      { path: "/opportunities", label: "Pipeline", icon: TrendingUp },
      { path: "/top-accounts", label: "Top Accounts", icon: Target },
      { path: "/calls", label: "Calls", icon: CalendarClock },
    ],
  },
  {
    id: "intelligence",
    label: "Intelligence",
    items: [
      { path: "/insights", label: "Insights", icon: ChartNoAxesColumn },
      { path: "/sixsense-analytics", label: "Intent Signals", icon: Radar },
      { path: "/bulk-insights", label: "Bulk Insights", icon: Layers },
      { path: "/search", label: "Smart Search", icon: Search },
      { path: "/tools", label: "AI Tools", icon: Workflow },
    ],
  },
  {
    id: "engage",
    label: "Engage",
    items: [
      { path: "/outreach", label: "Outreach", icon: Send },
      { path: "/sequences", label: "Sequences", icon: Layers },
      { path: "/content-studio", label: "Content Studio", icon: FileText },
      { path: "/webinar-generator", label: "Webinars", icon: Activity },
      { path: "/transcript-analyzer", label: "Transcripts", icon: Mic },
      { path: "/rfps", label: "RFPs", icon: ClipboardList, adminOnly: true },
    ],
  },
  {
    id: "data",
    label: "Data",
    items: [
      { path: "/import", label: "Import Data", icon: Upload },
      { path: "/data-hub", label: "Data Hub", icon: Database },
      { path: "/lead-processor", label: "Lead Processor", icon: Users },
      { path: "/csv-processor", label: "CSV Processor", icon: FileSpreadsheet },
      { path: "/validation", label: "Validation", icon: CheckCheck },
      { path: "/integrations", label: "Integrations", icon: Blocks },
      { path: "/salesforce-sync", label: "Salesforce Sync", icon: Workflow },
      { path: "/sixsense-sync", label: "6sense Sync", icon: Radar },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    items: [
      { path: "/admin", label: "Settings", icon: Settings, adminOnly: true },
      { path: "/admin/approval", label: "Approvals", icon: ShieldCheck, adminOnly: true },
    ],
  },
];

/** Flat list, handy for the command palette and for title lookups. */
export const ALL_NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap(s => s.items);

export function isItemActive(item: NavItem, location: string): boolean {
  if (item.path === "/") return location === "/";
  if (location === item.path) return true;
  if (location.startsWith(item.path + "/")) return true;
  return (item.match ?? []).some(prefix => location.startsWith(prefix));
}

/** Longest-prefix match so `/accounts/42` resolves to the Accounts entry. */
export function findActiveItem(location: string): NavItem | undefined {
  return ALL_NAV_ITEMS.filter(item => isItemActive(item, location)).sort(
    (a, b) => b.path.length - a.path.length
  )[0];
}

export function visibleSections(role: string | undefined): NavSection[] {
  const isAdmin = role === "admin";
  return NAV_SECTIONS.map(section => ({
    ...section,
    items: section.items.filter(item => !item.adminOnly || isAdmin),
  })).filter(section => section.items.length > 0);
}
