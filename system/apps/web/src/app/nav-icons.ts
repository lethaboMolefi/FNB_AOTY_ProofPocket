// One icon per page, for every role's sidebar, phone tab bar and More page (lucide, one style everywhere).
import {
  Activity, BarChart3, BookOpen, Building, Building2, ClipboardCheck, CreditCard, Ellipsis, Eye, FileCheck, Flag, Gavel, HeartPulse, Home, Inbox,
  LayoutDashboard, LayoutGrid, LifeBuoy, ListChecks, type LucideIcon, Megaphone, Package, Settings, ShieldAlert, ShieldCheck, SlidersHorizontal,
  Network, ScrollText, Store, TrendingUp, UserCheck, UserCog, Users, Workflow,
} from "lucide-react";

export const NAV_ICON: Record<string, LucideIcon> = {
  // founder
  home: Home, start: FileCheck, books: BookOpen, stock: Package, payments: CreditCard, cashflow: BarChart3, markets: Store, funding: TrendingUp,
  procurement: Building, protection: ShieldCheck, privacy: Eye, settings: Settings, uml: Network, "admin-log": ScrollText,
  // funder
  pipeline: Workflow, applications: Inbox, programmes: ListChecks, setup: SlidersHorizontal,
  // adviser
  cohort: LayoutGrid, checks: FileCheck, attention: ShieldAlert, support: LifeBuoy,
  // admin
  overview: LayoutDashboard, activity: Activity, people: Users, health: HeartPulse, organisations: Building2, reports: Flag, features: Megaphone,
  flagged: ClipboardCheck, tenders: Gavel, approvals: UserCheck, profile: UserCog,
  // phone tab bar
  more: Ellipsis,
};

export const navIcon = (path: string): LucideIcon => NAV_ICON[path] ?? LayoutGrid;
