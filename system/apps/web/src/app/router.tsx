import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, Navigate, type RouteObject } from "react-router-dom";
import { Spinner } from "../components/ui";
import { NotFound, Placeholder } from "../features/common/Placeholder";
import { ADMIN_NAV, ADVISER_NAV, FOUNDER_NAV, FUNDER_NAV, FUNDER_SETUP, type NavPage } from "./nav";
import { RequireFunderSetup, RequireRole, RoleHome } from "./guards";

// Each portal is its own chunk, so a founder on a phone never downloads the funder or admin code.
const FounderShell = lazy(() => import("../components/layout/FounderShell").then((m) => ({ default: m.FounderShell })));
const PortalShell = lazy(() => import("../components/layout/PortalShell").then((m) => ({ default: m.PortalShell })));
const More = lazy(() => import("../features/founder/More"));
const SignIn = lazy(() => import("../features/auth/SignIn"));
const SignUp = lazy(() => import("../features/auth/SignUp"));
const VerifyPin = lazy(() => import("../features/auth/VerifyPin"));
const pub = () => import("../features/public/PublicPages");
const Directory = lazy(() => pub().then((m) => ({ default: m.Directory })));
const BusinessProfile = lazy(() => pub().then((m) => ({ default: m.BusinessProfile })));
const PayPage = lazy(() => pub().then((m) => ({ default: m.PayPage })));
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
const FundingReadiness = lazy(() => import("../features/founder/FundingReadiness"));
const Procurement = lazy(() => import("../features/founder/Procurement"));
const Markets = lazy(() => import("../features/founder/Markets"));

const s = (el: ReactNode) => <Suspense fallback={<Spinner />}>{el}</Suspense>;
/** Screens that are built; everything else shows its placeholder until its phase. */
const BUILT: Record<string, ReactNode> = {
  "founder/start":       s(<Start />),
  "founder/settings":    s(<Settings />),
  "founder/home":        s(<Home />),
  "founder/books":       s(<Books />),
  "founder/stock":       s(<StockPage />),
  "founder/cashflow":    s(<Cashflow />),
  "founder/payments":    s(<Payments />),
  "founder/protection":  s(<Protection />),
  "founder/privacy":     s(<Privacy />),
  "founder/funding":     s(<FundingReadiness />),
  "founder/procurement": s(<Procurement />),
  "founder/markets":     s(<Markets />),
  "adviser/checks":      s(<Checks scope="adviser" />),
  "admin/checks":        s(<Checks scope="admin" />),
};
const pages = (portal: string, list: NavPage[]): RouteObject[] =>
  list.map((p) => ({ path: p.path, element: BUILT[`${portal}/${p.path}`] ?? <Placeholder page={p} /> }));

export const routes: RouteObject[] = [
  { path: "/", element: <RoleHome /> },
  { path: "/sign-in", element: s(<SignIn />) },
  { path: "/sign-up", element: s(<SignUp />) },
  { path: "/verify", element: s(<VerifyPin />) },
  { path: "/join", element: s(<Join />) },
  // Public, no account.
  { path: "/directory", element: s(<Directory />) },
  { path: "/b/:slug", element: s(<BusinessProfile />) },
  { path: "/pay/:ref", element: s(<PayPage />) },
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
    element: <RequireRole roles={["funder"]}><RequireFunderSetup>{s(<PortalShell base="/funder" title="Funder portal" pages={FUNDER_NAV} />)}</RequireFunderSetup></RequireRole>,
    children: [{ index: true, element: <Navigate to="pipeline" replace /> }, ...pages("funder", [...FUNDER_NAV, FUNDER_SETUP])],
  },
  {
    path: "/adviser",
    element: <RequireRole roles={["adviser"]}>{s(<PortalShell base="/adviser" title="Support portal" pages={ADVISER_NAV} />)}</RequireRole>,
    children: [{ index: true, element: <Navigate to="cohort" replace /> }, ...pages("adviser", ADVISER_NAV)],
  },
  {
    path: "/admin",
    element: <RequireRole roles={["admin"]}>{s(<PortalShell base="/admin" title="ProofPocket admin" pages={ADMIN_NAV} />)}</RequireRole>,
    children: [{ index: true, element: <Navigate to="checks" replace /> }, ...pages("admin", ADMIN_NAV)],
  },
  { path: "*", element: <NotFound /> },
];

export const router = createBrowserRouter(routes);
