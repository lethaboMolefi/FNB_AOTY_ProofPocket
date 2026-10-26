import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, Navigate, type RouteObject } from "react-router-dom";
import { Spinner } from "../components/ui";
import { NotFound, Placeholder } from "../features/common/Placeholder";
import { ADMIN_NAV, ADMIN_TABS, ADVISER_NAV, ADVISER_TABS, FOUNDER_NAV, FUNDER_NAV, FUNDER_SETUP, FUNDER_TABS, type NavPage } from "./nav";
import { RequireFunderSetup, RequireRole, RoleHome } from "./guards";

// Each portal is its own chunk, so a founder on a phone never downloads the funder or admin code.
const FounderShell = lazy(() => import("../components/layout/FounderShell").then((m) => ({ default: m.FounderShell })));
const PortalShell = lazy(() => import("../components/layout/PortalShell").then((m) => ({ default: m.PortalShell })));
const MorePage = lazy(() => import("../components/layout/MorePage").then((m) => ({ default: m.MorePage })));
const More = lazy(() => import("../features/founder/More"));
const SignIn = lazy(() => import("../features/auth/SignIn"));
const SignUp = lazy(() => import("../features/auth/SignUp"));
const ChangePassword = lazy(() => import("../features/auth/ChangePassword"));
const AccountStatus = lazy(() => import("../features/auth/ChangePassword").then((m) => ({ default: m.AccountStatus })));
const Uml = lazy(() => import("../features/common/Uml"));
const AdminLog = lazy(() => import("../features/founder/AdminLog"));
const Approvals = lazy(() => import("../features/admin/Approvals"));
const AdminProfile = lazy(() => import("../features/admin/Profile"));
const AdminTesting = lazy(() => import("../features/admin/Testing"));
const VerifyPin = lazy(() => import("../features/auth/VerifyPin"));
const pub = () => import("../features/public/Directory");
const Directory = lazy(() => pub().then((m) => ({ default: m.Directory })));
const BusinessProfile = lazy(() => pub().then((m) => ({ default: m.BusinessProfile })));
const PayPage = lazy(() => import("../features/public/PayPage"));
const PrivacyNotice = lazy(() => import("../features/public/PrivacyNotice"));
const Join = lazy(() => import("../features/join/Join"));
const Start = lazy(() => import("../features/founder/Start"));
const Checks = lazy(() => import("../features/checks/Checks"));
const Settings = lazy(() => import("../features/founder/Settings"));
const Home = lazy(() => import("../features/founder/Home"));
const Books = lazy(() => import("../features/founder/Books"));
const StockPage = lazy(() => import("../features/founder/Stock"));
const Cashflow = lazy(() => import("../features/founder/Cashflow"));
const Payments = lazy(() => import("../features/founder/Payments"));
const Protection = lazy(() => import("../features/founder/Protection"));
const Privacy = lazy(() => import("../features/founder/Privacy"));
const Markets = lazy(() => import("../features/founder/Markets"));
const Funding = lazy(() => import("../features/founder/Funding"));
const Procurement = lazy(() => import("../features/founder/Procurement"));
const FunderSetup = lazy(() => import("../features/funder/ProgrammeForm"));
const Pipeline = lazy(() => import("../features/funder/Pipeline"));
const FunderApplications = lazy(() => import("../features/funder/Applications"));
const FunderProgrammes = lazy(() => import("../features/funder/Programmes"));
const Cohort = lazy(() => import("../features/adviser/Cohort"));
const Attention = lazy(() => import("../features/adviser/Attention"));
const Support = lazy(() => import("../features/adviser/Support"));
const Organisations = lazy(() => import("../features/admin/Organisations"));
const AdminApplications = lazy(() => import("../features/admin/Applications"));
const AdminOverview = lazy(() => import("../features/admin/Overview"));
const AdminActivity = lazy(() => import("../features/admin/Activity"));
const AdminPeople = lazy(() => import("../features/admin/People"));
const AdminHealth = lazy(() => import("../features/admin/Health"));
const rev = () => import("../features/admin/Reviews");
const Reports = lazy(() => rev().then((m) => ({ default: m.Reports })));
const Features = lazy(() => rev().then((m) => ({ default: m.Features })));
const Flagged = lazy(() => rev().then((m) => ({ default: m.Flagged })));
const AdminTenders = lazy(() => rev().then((m) => ({ default: m.Tenders })));

const s = (el: ReactNode) => <Suspense fallback={<Spinner />}>{el}</Suspense>;
/** Screens that are built; everything else shows its placeholder until its phase. */
const BUILT: Record<string, ReactNode> = {
  "founder/start": s(<Start />),
  "founder/settings": s(<Settings />),
  "founder/home": s(<Home />),
  "founder/books": s(<Books />),
  "founder/stock": s(<StockPage />),
  "founder/cashflow": s(<Cashflow />),
  "founder/payments": s(<Payments />),
  "founder/protection": s(<Protection />),
  "founder/privacy": s(<Privacy />),
  "founder/markets": s(<Markets />),
  "founder/funding": s(<Funding />),
  "founder/procurement": s(<Procurement />),
  "founder/uml": s(<Uml />),
  "founder/admin-log": s(<AdminLog />),
  "funder/setup": s(<FunderSetup />),
  "funder/pipeline": s(<Pipeline />),
  "funder/applications": s(<FunderApplications />),
  "funder/programmes": s(<FunderProgrammes />),
  "adviser/cohort": s(<Cohort />),
  "adviser/attention": s(<Attention />),
  "adviser/support": s(<Support />),
  "admin/overview": s(<AdminOverview />),
  "admin/activity": s(<AdminActivity />),
  "admin/people": s(<AdminPeople />),
  "admin/health": s(<AdminHealth />),
  "admin/applications": s(<AdminApplications />),
  "admin/organisations": s(<Organisations />),
  "admin/reports": s(<Reports />),
  "admin/features": s(<Features />),
  "admin/flagged": s(<Flagged />),
  "admin/tenders": s(<AdminTenders />),
  "admin/approvals": s(<Approvals />),
  "admin/uml": s(<Uml />),
  "admin/profile": s(<AdminProfile />),
  "admin/testing": s(<AdminTesting />),
  "adviser/checks": s(<Checks scope="adviser" />),
  "admin/checks": s(<Checks scope="admin" />),
};
const pages = (portal: string, list: NavPage[]): RouteObject[] =>
  list.map((p) => ({ path: p.path, element: BUILT[`${portal}/${p.path}`] ?? <Placeholder page={p} /> }));

/** The line at the foot of each portal's sidebar. */
const NOTE = {
  funder: "ProofPocket never holds or moves money. Founders choose what funders see.",
  adviser: "ProofPocket never holds or moves money. Every check and support log is recorded.",
  admin: "ProofPocket never holds or moves money. What you open here is recorded in Activity.",
};
const more = (base: string, title: string, list: NavPage[], tabs: string[]): RouteObject =>
  ({ path: "more", element: <MorePage base={base} groups={[{ group: title, pages: list }]} tabs={tabs} /> });

export const routes: RouteObject[] = [
  { path: "/", element: <RoleHome /> },
  { path: "/sign-in", element: s(<SignIn />) },
  { path: "/sign-up", element: s(<SignUp />) },
  { path: "/change-password", element: s(<ChangePassword />) },
  { path: "/account-status", element: s(<AccountStatus />) },
  { path: "/verify", element: s(<VerifyPin />) },
  { path: "/join", element: s(<Join />) },
  // Public, no account.
  { path: "/directory", element: s(<Directory />) },
  { path: "/b/:slug", element: s(<BusinessProfile />) },
  { path: "/pay/:ref", element: s(<PayPage />) },
  { path: "/privacy-notice", element: s(<PrivacyNotice />) },
  {
    path: "/app",
    element: <RequireRole roles={["founder"]}>{s(<FounderShell />)}</RequireRole>,
    children: [
      { index: true, element: <Navigate to="home" replace /> },
      ...pages("founder", FOUNDER_NAV.flatMap((g) => g.pages)),
      { path: "more", element: s(<More />) },
    ],
  },
  {
    path: "/funder",
    element: <RequireRole roles={["funder"]}><RequireFunderSetup>{s(<PortalShell base="/funder" title="Funder portal" pages={FUNDER_NAV} tabs={FUNDER_TABS} note={NOTE.funder} />)}</RequireFunderSetup></RequireRole>,
    children: [{ index: true, element: <Navigate to="pipeline" replace /> }, ...pages("funder", [...FUNDER_NAV, FUNDER_SETUP]), more("/funder", "Funder portal", FUNDER_NAV, FUNDER_TABS)],
  },
  {
    path: "/adviser",
    element: <RequireRole roles={["adviser"]}>{s(<PortalShell base="/adviser" title="Support portal" pages={ADVISER_NAV} tabs={ADVISER_TABS} note={NOTE.adviser} />)}</RequireRole>,
    children: [{ index: true, element: <Navigate to="cohort" replace /> }, ...pages("adviser", ADVISER_NAV), more("/adviser", "Support portal", ADVISER_NAV, ADVISER_TABS)],
  },
  {
    path: "/admin",
    element: <RequireRole roles={["admin"]}>{s(<PortalShell base="/admin" title="ProofPocket admin" pages={ADMIN_NAV} tabs={ADMIN_TABS} note={NOTE.admin} />)}</RequireRole>,
    children: [{ index: true, element: <Navigate to="overview" replace /> }, ...pages("admin", ADMIN_NAV), more("/admin", "ProofPocket admin", ADMIN_NAV, ADMIN_TABS)],
  },
  { path: "*", element: <NotFound /> },
];

export const router = createBrowserRouter(routes);
