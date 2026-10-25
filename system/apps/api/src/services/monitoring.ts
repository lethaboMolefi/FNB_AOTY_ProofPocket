// Admin monitoring: platform overview, the activity (audit) log, people and companies, and security & health.
// Money appears only as platform totals here; one company's figures are in its detail view, which is audited.
import { R, todayZA } from "@proofpocket/shared";
import { sql } from "drizzle-orm";
import type { Db, Tx } from "../db/client";
import { withContext } from "../db/client";
import { audit } from "../lib/audit";
import { rowFigures } from "./company-view";
import { loadSnapshots } from "./snapshot";

const rows = async <T>(tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as T[];
const num = (v: unknown) => Number(v ?? 0);
/** Text typed into a search, safe inside LIKE (backslash is Postgres's default escape). */
const like = (v: string) => v.replace(/[\\%_]/g, "\\$&");

export async function overview(tx: Tx) {
  const today = todayZA();
  const month = today.slice(0, 7);
  const [c] = await rows<Record<string, string>>(tx, sql`select
      (select count(*) from companies where joined_at is not null and verified_at is null) as starters,
      (select count(*) from companies where verified_at is not null) as verified,
      (select count(*) from companies where joined_at is null) as unfinished,
      (select count(*) from organisations where type = 'funder') as funders,
      (select count(*) from organisations where type = 'incubator') as incubators,
      (select count(*) from organisations where type = 'buyer') as buyers,
      (select count(*) from users) as users,
      (select count(*) from documents d join companies co on co.id = d.company_id where d.status = 'pending' and co.joined_at is not null) as docs_waiting,
      (select count(*) from portal_applications where status = 'pending') as portal_apps,
      (select count(*) from reports where status = 'open') as reports_open,
      (select count(*) from payment_requests where status = 'flagged') as flagged,
      (select coalesce(sum(amount) filter (where direction = 'in'), 0) from ledger_entries where voided_at is null and to_char(entry_date, 'YYYY-MM') = ${month}) as money_in,
      (select coalesce(sum(amount) filter (where direction = 'out'), 0) from ledger_entries where voided_at is null and to_char(entry_date, 'YYYY-MM') = ${month}) as money_out,
      (select count(*) from ledger_entries where voided_at is null and to_char(entry_date, 'YYYY-MM') = ${month}) as entries`);
  const payments = await rows<{ status: string; n: string }>(tx, sql`select status::text, count(*) as n from payment_requests group by 1 order by 1`);
  const applications = await rows<{ status: string; n: string }>(tx, sql`select status::text, count(*) as n from applications group by 1 order by 1`);
  // Last 30 days, South African days.
  const trend = await rows<{ day: string; signups: string; joins: string; verified: string }>(tx, sql`
    select to_char(g.d, 'YYYY-MM-DD') as day,
      (select count(*) from users u where (u.created_at at time zone 'Africa/Johannesburg')::date = g.d::date) as signups,
      (select count(*) from companies x where (x.joined_at at time zone 'Africa/Johannesburg')::date = g.d::date) as joins,
      (select count(*) from companies x where (x.verified_at at time zone 'Africa/Johannesburg')::date = g.d::date) as verified
    from generate_series(${today}::date - 29, ${today}::date, interval '1 day') as g(d)
    order by g.d`);
  const t = Object.fromEntries(Object.entries(c!).map(([k, v]) => [k, num(v)]));
  return {
    today,
    founders: { starters: t.starters!, verified: t.verified!, unfinished: t.unfinished! },
    organisations: { funders: t.funders!, incubators: t.incubators!, buyers: t.buyers! },
    users: t.users!,
    waiting: { documents: t.docs_waiting!, portalApplications: t.portal_apps!, reports: t.reports_open!, flaggedPayments: t.flagged! },
    money: { month, moneyIn: t.money_in!, moneyOut: t.money_out!, entries: t.entries!, label: `${R(t.money_in!)} in, ${R(t.money_out!)} out` },
    payments: payments.map((p) => ({ status: p.status, count: num(p.n) })),
    applications: applications.map((a) => ({ status: a.status, count: num(a.n) })),
    trend: trend.map((d) => ({ day: d.day, signups: num(d.signups), joins: num(d.joins), verified: num(d.verified) })),
  };
}

export interface ActivityFilters { action?: string; person?: string; company?: string; from?: string; to?: string; page: number }
const PAGE = 50;

export async function activity(tx: Tx, f: ActivityFilters) {
  const where = [sql`true`];
  if (f.action) where.push(sql`a.action like ${like(f.action) + "%"}`);
  if (f.person) where.push(sql`u.email ilike ${"%" + like(f.person) + "%"}`);
  if (f.company) where.push(sql`co.name ilike ${"%" + like(f.company) + "%"}`);
  if (f.from) where.push(sql`(a.at at time zone 'Africa/Johannesburg')::date >= ${f.from}::date`);
  if (f.to) where.push(sql`(a.at at time zone 'Africa/Johannesburg')::date <= ${f.to}::date`);
  const cond = sql.join(where, sql` and `);
  const list = await rows<{ id: string; at: string; actor_role: string | null; email: string | null; action: string; entity: string; entity_id: string | null; company: string | null; before: unknown; after: unknown }>(tx, sql`
    select a.id, a.at, a.actor_role, u.email, a.action, a.entity, a.entity_id, co.name as company, a.before, a.after
    from audit_log a left join users u on u.id = a.actor_id left join companies co on co.id = a.company_id
    where ${cond} order by a.id desc limit ${PAGE + 1} offset ${f.page * PAGE}`);
  const actions = await rows<{ action: string }>(tx, sql`select distinct split_part(action, '.', 1) as action from audit_log order by 1`);
  return {
    page: f.page, more: list.length > PAGE,
    entries: list.slice(0, PAGE).map((r) => ({ id: String(r.id), at: r.at, role: r.actor_role, person: r.email, action: r.action, entity: r.entity, entityId: r.entity_id, company: r.company, before: r.before, after: r.after })),
    actionGroups: actions.map((a) => a.action),
  };
}

export async function chain(tx: Tx) {
  const [v] = await rows<{ rows_checked: string; first_broken_seq: string | null }>(tx, sql`select * from audit_log_verify()`);
  return { rowsChecked: num(v!.rows_checked), intact: v!.first_broken_seq === null, firstBroken: v!.first_broken_seq === null ? null : num(v!.first_broken_seq) };
}

export async function people(tx: Tx, f: { q?: string; role?: string; page: number }) {
  const where = [sql`true`];
  if (f.q) where.push(sql`(u.email ilike ${"%" + like(f.q) + "%"} or u.display_name ilike ${"%" + like(f.q) + "%"})`);
  if (f.role) where.push(sql`u.role = ${f.role}::user_role`);
  const list = await rows<{ id: string; email: string; name: string; role: string; org: string | null; created_at: string; last_seen_at: string | null; example: boolean; enabled: boolean | null; failed: number | null; locked_until: string | null }>(tx, sql`
    select u.id, u.email, u.display_name as name, u.role::text, o.name as org, u.created_at, u.last_seen_at, u.is_example as example,
      t.enabled, t.failed_attempts as failed, t.locked_until
    from users u left join organisations o on o.id = u.org_id left join admin_two_factor_status() t on t.user_id = u.id
    where ${sql.join(where, sql` and `)} order by u.last_seen_at desc nulls last, u.created_at desc limit ${PAGE + 1} offset ${f.page * PAGE}`);
  const staff = new Set(["funder", "adviser", "admin"]);
  return {
    page: f.page, more: list.length > PAGE,
    people: list.slice(0, PAGE).map((u) => ({
      id: u.id, email: u.email, name: u.name, role: u.role, organisation: u.org, createdAt: u.created_at, lastSeenAt: u.last_seen_at, example: u.example,
      twoFactor: u.locked_until && new Date(u.locked_until) > new Date() ? "locked" : u.enabled ? "on" : staff.has(u.role) ? "required_not_set" : "off",
    })),
  };
}

export async function companies(tx: Tx, f: { q?: string; status?: "starter" | "verified" | "unfinished"; page: number }) {
  const where = [sql`true`];
  if (f.q) where.push(sql`(c.name ilike ${"%" + like(f.q) + "%"} or u.email ilike ${"%" + like(f.q) + "%"})`);
  if (f.status === "starter") where.push(sql`c.joined_at is not null and c.verified_at is null`);
  if (f.status === "verified") where.push(sql`c.verified_at is not null`);
  if (f.status === "unfinished") where.push(sql`c.joined_at is null`);
  const list = await rows<{ id: string; name: string; owner: string; incubator: string | null; joined_at: string | null; verified_at: string | null; sharing: string; docs_checked: string; example: boolean; created_at: string }>(tx, sql`
    select c.id, c.name, u.email as owner, o.name as incubator, c.joined_at, c.verified_at, c.funder_sharing::text as sharing, c.is_example as example, c.created_at,
      (select count(*) from documents d where d.company_id = c.id and d.status = 'verified') as docs_checked
    from companies c join users u on u.id = c.owner_id left join organisations o on o.id = c.incubator_id
    where ${sql.join(where, sql` and `)} order by c.created_at desc limit ${PAGE + 1} offset ${f.page * PAGE}`);
  const page = list.slice(0, PAGE);
  const snaps = await loadSnapshots(tx, page.map((c) => c.id));
  return {
    page: f.page, more: list.length > PAGE,
    companies: page.map((c) => {
      const s = snaps.get(c.id);
      const fig = s ? rowFigures(s) : null;
      return {
        id: c.id, name: c.name, owner: c.owner, incubator: c.incubator, example: c.example, createdAt: c.created_at,
        status: c.verified_at ? "verified" : c.joined_at ? "starter" : "unfinished", sharing: c.sharing, documentsChecked: num(c.docs_checked),
        score: fig?.score ?? null, recordMonths: fig?.recordMonths ?? null,
      };
    }),
  };
}

const SECURITY_ACTIONS = ["two_factor.%", "admin.%", "user.invited", "organisation.%", "portal_application.%", "privacy.%", "file.fingerprint_mismatch", "watchlist.%"];

export async function health(tx: Tx, version: string | undefined) {
  const tf = await rows<{ user_id: string; email: string; role: string; enabled: boolean | null; failed: number | null; locked_until: string | null }>(tx, sql`
    select u.id as user_id, u.email, u.role::text, t.enabled, t.failed_attempts as failed, t.locked_until
    from users u left join admin_two_factor_status() t on t.user_id = u.id`);
  const now = new Date();
  const staff = new Set(["funder", "adviser", "admin"]);
  const recentSecurity = await rows<{ at: string; action: string; role: string | null; email: string | null }>(tx, sql`
    select a.at, a.action, a.actor_role as role, u.email from audit_log a left join users u on u.id = a.actor_id
    where ${sql.join(SECURITY_ACTIONS.map((p) => sql`a.action like ${p}`), sql` or `)} order by a.id desc limit 25`);
  const jobs = await rows<{ action: string; at: string; after: Record<string, unknown> }>(tx, sql`
    select distinct on (action) action, at, after from audit_log where action in ('job.daily', 'job.weekly') order by action, id desc`);
  const emails = await rows<{ at: string; after: { subject?: string } }>(tx, sql`select at, after from audit_log where action = 'email.failed' order by id desc limit 20`);
  const [emailWeek] = await rows<{ n: string }>(tx, sql`select count(*) as n from audit_log where action = 'email.failed' and at > now() - interval '7 days'`);
  const limits = await rows<{ limiter: string; clients: string; hits: string; busiest: number }>(tx, sql`select * from admin_rate_limit_summary()`);
  const [db] = await rows<{ now: string; version: string }>(tx, sql`select now()::text as now, current_setting('server_version') as version`);
  return {
    version: version ?? "development",
    database: { reachable: true, time: db!.now, version: db!.version },
    chain: await chain(tx),
    twoFactor: {
      locked: tf.filter((u) => u.locked_until && new Date(u.locked_until) > now).map((u) => ({ email: u.email, role: u.role, until: u.locked_until })),
      staffWithout: tf.filter((u) => staff.has(u.role) && !u.enabled).map((u) => ({ email: u.email, role: u.role })),
      foundersOn: tf.filter((u) => u.role === "founder" && u.enabled).length,
      foundersOff: tf.filter((u) => u.role === "founder" && !u.enabled).length,
    },
    recentSecurity: recentSecurity.map((r) => ({ at: r.at, action: r.action, role: r.role, person: r.email })),
    jobs: jobs.map((j) => ({ kind: j.action === "job.daily" ? "daily" : "weekly", at: j.at, result: j.after })),
    emailFailures: { lastWeek: num(emailWeek!.n), recent: emails.map((e) => ({ at: e.at, subject: e.after?.subject ?? "" })) },
    rateLimits: limits.map((l) => ({ limiter: l.limiter, clients: num(l.clients), hits: num(l.hits), busiest: num(l.busiest) })),
  };
}

/** For the mailer: records a failed send in the audit log (subject only). */
export const recordEmailFailure = (db: Db) => (subject: string) =>
  withContext(db, { role: "auth" }, (tx) => audit(tx, { userId: null, role: "system" }, { action: "email.failed", entity: "email", after: { subject } })).then(() => undefined);
