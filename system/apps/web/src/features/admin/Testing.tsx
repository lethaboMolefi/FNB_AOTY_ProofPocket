// Testing (admins): the demo site with its demo accounts, the latest automated test results, and every test case.
// The demo is a separate copy of ProofPocket with example data on its own server: nothing done there reaches live data.
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ClipboardCopy, Download, ExternalLink, Eye, EyeOff, FlaskConical, ListChecks, XCircle } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect, TextField } from "@/components/ui/field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader } from "../../components/PageHeader";
import { ToneBadge } from "../../components/ToneBadge";
import { Spinner, useToast } from "../../components/ui";
import { api, apiBlob } from "../../lib/api";
import { when } from "./when";

interface Suite { name: string; passed: number; failed: number; skipped: number; durationMs: number; failures: string[] }
interface Overview {
  demo: { url: string; password: string | null; accounts: { role: string; who: string; email: string }[] } | null;
  results: { ranAt: string; commit: string; suites: Suite[] } | null;
  documents: { id: string; title: string; available: boolean }[];
}
interface Case { section: string; id: string; feature: string; role: string; description: string; steps: string; expected: string; version: string; priority: string; result: string; evidence: string; manual: string }

const SUB = "Try every feature on the demo site with example data, see the latest automated test results, and work through the test cases. Nothing done on the demo reaches live data.";
const RESULT_TONE: Record<string, "good" | "bad" | "warn" | "plain"> = { Pass: "good", Fail: "bad", Blocked: "warn", "Not run": "plain" };
const md = (s: string) => s.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1");

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Demo({ demo }: { demo: NonNullable<Overview["demo"]> }) {
  const toast = useToast();
  const [show, setShow] = useState(false);
  const copy = async (text: string, what: string) => { try { await navigator.clipboard.writeText(text); toast(`${what} copied`); } catch { toast(text); } };
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-3">
        <div className="min-w-0 space-y-1.5">
          <CardTitle className="flex items-center gap-2 text-base"><FlaskConical className="h-4 w-4 text-primary" aria-hidden="true" />Demo site</CardTitle>
          <CardDescription>A separate copy of ProofPocket with example businesses, funders and advisers, on its own server. It never sends email. Funder, adviser and admin demo accounts set up Google Authenticator at first sign-in, as on the live site.</CardDescription>
        </div>
        <Button asChild><a href={demo.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />Open the demo</a></Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {demo.password ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-2 p-3 text-sm">
            <span className="text-muted-foreground">Password for every demo account</span>
            <span className="font-mono">{show ? demo.password : "•".repeat(14)}</span>
            <Button size="sm" variant="ghost" onClick={() => setShow(!show)} aria-pressed={show}>{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}{show ? "Hide" : "Show"}</Button>
            <Button size="sm" variant="ghost" onClick={() => void copy(demo.password!, "Password")}><ClipboardCopy className="h-4 w-4" />Copy</Button>
          </div>
        ) : <Callout tone="warn">The demo password isn't set on this site yet.</Callout>}
        <Table>
          <TableHeader><TableRow><TableHead>Demo account</TableHead><TableHead className="hidden sm:table-cell">Role</TableHead><TableHead><span className="sr-only">Copy</span></TableHead></TableRow></TableHeader>
          <TableBody>{demo.accounts.map((a) => (
            <TableRow key={a.email}>
              <TableCell className="break-all"><span className="block font-medium">{a.who}</span><span className="text-xs text-muted-foreground">{a.email}</span><span className="block text-xs text-muted-foreground sm:hidden">{a.role}</span></TableCell>
              <TableCell className="hidden sm:table-cell">{a.role}</TableCell>
              <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => void copy(a.email, "Email")}><ClipboardCopy className="h-4 w-4" /><span className="sr-only sm:not-sr-only">Copy email</span></Button></TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Results({ results }: { results: NonNullable<Overview["results"]> }) {
  const total = results.suites.reduce((a, s) => ({ passed: a.passed + s.passed, failed: a.failed + s.failed, skipped: a.skipped + s.skipped }), { passed: 0, failed: 0, skipped: 0 });
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">{total.failed ? <XCircle className="h-4 w-4 text-bad" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4 text-good" aria-hidden="true" />}Latest automated test results</CardTitle>
        <CardDescription>Ran {when(results.ranAt)} on version {results.commit}: {total.passed} passed, {total.failed} failed, {total.skipped} skipped.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Suite</TableHead><TableHead className="text-right">Passed</TableHead><TableHead className="text-right">Failed</TableHead><TableHead className="hidden text-right sm:table-cell">Skipped</TableHead><TableHead className="hidden text-right md:table-cell">Time</TableHead></TableRow></TableHeader>
          <TableBody>{results.suites.map((s) => (
            <Fragment key={s.name}>
              <TableRow>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="text-right tabular-nums text-good">{s.passed}</TableCell>
                <TableCell className={`text-right tabular-nums ${s.failed ? "font-semibold text-bad" : ""}`}>{s.failed}</TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">{s.skipped}</TableCell>
                <TableCell className="hidden text-right tabular-nums md:table-cell">{Math.round(s.durationMs / 1000)} s</TableCell>
              </TableRow>
              {s.failures.length > 0 && <TableRow className="hover:bg-transparent"><TableCell colSpan={5}><ul className="list-disc space-y-1 pl-5 text-xs text-bad">{s.failures.map((f) => <li key={f}>{f}</li>)}</ul></TableCell></TableRow>}
            </Fragment>
          ))}</TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Cases({ documents }: { documents: Overview["documents"] }) {
  const toast = useToast();
  const q = useQuery({ queryKey: ["admin", "testing", "cases"], queryFn: () => api<{ cases: Case[] }>("/testing/cases") });
  const [f, setF] = useState({ q: "", result: "", section: "" });
  const [open, setOpen] = useState<string | null>(null);
  const cases = useMemo(() => q.data?.cases ?? [], [q.data]);
  const sections = useMemo(() => [...new Set(cases.map((c) => c.section))], [cases]);
  const rows = cases.filter((c) => (!f.result || c.result === f.result) && (!f.section || c.section === f.section)
    && (!f.q || `${c.id} ${c.feature} ${c.role} ${c.description}`.toLowerCase().includes(f.q.toLowerCase())));
  const counts = cases.reduce<Record<string, number>>((a, c) => ({ ...a, [c.result]: (a[c.result] ?? 0) + 1 }), {});
  const download = async (id: string, title: string) => { try { save(await apiBlob(`/testing/documents/${id}`), `${title}.md`); } catch { toast("Couldn't download it. Try again."); } };
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-3">
        <div className="min-w-0 space-y-1.5">
          <CardTitle className="flex items-center gap-2 text-base"><ListChecks className="h-4 w-4 text-primary" aria-hidden="true" />Test cases</CardTitle>
          <CardDescription>{cases.length} cases · {Object.entries(counts).map(([k, n]) => `${n} ${k.toLowerCase() || "no result"}`).join(" · ")}</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">{documents.filter((d) => d.available).map((d) => (
          <Button key={d.id} size="sm" variant="outline" onClick={() => void download(d.id, d.title.replace(/\s+/g, "-"))}><Download className="h-4 w-4" />{d.title}</Button>
        ))}</div>
      </CardHeader>
      <CardContent className="space-y-4 p-0">
        <div className="grid gap-3 px-6 sm:grid-cols-3">
          <TextField label="Search cases" placeholder="ID, feature, role or description" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
          <NativeSelect label="Result" value={f.result} onChange={(e) => setF({ ...f, result: e.target.value })}>
            <option value="">All</option>{["Pass", "Fail", "Blocked", "Not run"].map((r) => <option key={r}>{r}</option>)}
          </NativeSelect>
          <NativeSelect label="Area" value={f.section} onChange={(e) => setF({ ...f, section: e.target.value })}>
            <option value="">All</option>{sections.map((s) => <option key={s}>{s}</option>)}
          </NativeSelect>
        </div>
        {!q.data ? <Spinner /> : !rows.length ? <EmptyState icon={ListChecks}>No test cases match.</EmptyState> : (
          <Table>
            <TableHeader><TableRow><TableHead>Case</TableHead><TableHead className="hidden lg:table-cell">Expected</TableHead><TableHead>Result</TableHead><TableHead><span className="sr-only">Details</span></TableHead></TableRow></TableHeader>
            <TableBody>{rows.slice(0, 300).map((c) => (
              <Fragment key={c.id}>
                <TableRow>
                  <TableCell><span className="font-mono text-xs text-muted-foreground">{c.id}</span><span className="block text-sm">{md(c.description)}</span><span className="block text-xs text-muted-foreground">{md(c.role)} · {c.version}</span></TableCell>
                  <TableCell className="hidden max-w-[28rem] text-sm lg:table-cell">{md(c.expected)}</TableCell>
                  <TableCell><ToneBadge tone={RESULT_TONE[c.result] ?? "plain"}>{c.result || "—"}</ToneBadge></TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="ghost" aria-expanded={open === c.id} onClick={() => setOpen(open === c.id ? null : c.id)}>{open === c.id ? "Hide" : "Details"}</Button></TableCell>
                </TableRow>
                {open === c.id && <TableRow className="hover:bg-transparent"><TableCell colSpan={4} className="bg-surface-2">
                  <dl className="grid grid-cols-[minmax(0,1fr)] gap-x-4 gap-y-2 text-sm sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)]">
                    {([["Area", c.section], ["Feature", c.feature], ["Steps", c.steps], ["Expected", c.expected], ["Priority", c.priority], ["Evidence", c.evidence], ["Manual result", c.manual]] as const).map(([k, v]) => (
                      <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="break-words">{md(v) || "—"}</dd></div>
                    ))}
                  </dl>
                </TableCell></TableRow>}
              </Fragment>
            ))}</TableBody>
          </Table>
        )}
        {rows.length > 300 && <p className="px-6 pb-4 text-xs text-muted-foreground">Showing the first 300 of {rows.length}. Narrow the search to see the rest.</p>}
      </CardContent>
    </Card>
  );
}

export default function Testing() {
  const q = useQuery({ queryKey: ["admin", "testing"], queryFn: () => api<Overview>("/testing") });
  if (!q.data) return <><PageHeader title="Testing" sub={SUB} /><Spinner /></>;
  const d = q.data;
  return (
    <>
      <PageHeader title="Testing" sub={SUB} />
      {d.demo ? <Demo demo={d.demo} /> : <Callout tone="info">The demo site isn't connected to this ProofPocket yet.</Callout>}
      {d.results ? <Results results={d.results} /> : <EmptyState icon={FlaskConical}>No test results yet. Run pnpm test:report.</EmptyState>}
      <Cases documents={d.documents} />
    </>
  );
}
