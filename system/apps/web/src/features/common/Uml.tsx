// UML diagrams (admins and founders): drawn at build time from the Mermaid sources and served by the API, which
// refuses everyone else (403). View each one here and download it as SVG, PNG, PDF or its Mermaid source.
import { useQuery } from "@tanstack/react-query";
import { FileCode2, FileImage, FileText, Image as ImageIcon, Network } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader } from "../../components/PageHeader";
import { Spinner, useToast } from "../../components/ui";
import { apiBlob, api } from "../../lib/api";

interface Diagram { id: string; title: string; kind: string }

const SUB = "How ProofPocket is built: who does what, the data model, and the main flows step by step. Download any diagram as SVG, PNG, PDF or its Mermaid source.";

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const FORMATS = [["SVG", "svg", "svg", FileImage], ["PNG", "png", "png", ImageIcon], ["PDF", "pdf", "pdf", FileText], ["Source", "source", "mmd", FileCode2]] as const;

function Viewer({ d }: { d: Diagram }) {
  const toast = useToast();
  // The drawing comes from the API (founders and admins only), drawn at build time; shown here as an image.
  const svg = useQuery({ queryKey: ["uml", d.id, "svg"], queryFn: () => apiBlob(`/uml/${d.id}/svg?view=1`), staleTime: Infinity });
  const url = useMemo(() => (svg.data ? URL.createObjectURL(svg.data) : null), [svg.data]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  const download = async (format: string, ext: string) => {
    try { save(await apiBlob(`/uml/${d.id}/${format}`), `${d.id}.${ext}`); } catch { toast("Couldn't download the file. Try again."); }
  };
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-3">
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-base">{d.title}</CardTitle>
          <CardDescription>{d.kind} diagram</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Download">
          {FORMATS.map(([label, format, ext, Icon]) => (
            <Button key={format} size="sm" variant="outline" onClick={() => void download(format, ext)}><Icon className="h-4 w-4" />{label}</Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {svg.isError ? <Callout tone="bad">This diagram couldn't be loaded. Try again.</Callout>
          : url ? <div className="overflow-auto rounded-lg border border-border bg-white p-3"><img src={url} alt={`${d.title} (${d.kind} diagram)`} className="mx-auto max-w-none" /></div>
          : <Spinner />}
      </CardContent>
    </Card>
  );
}

export default function Uml() {
  const q = useQuery({ queryKey: ["uml"], queryFn: () => api<{ diagrams: Diagram[] }>("/uml") });
  const [pick, setPick] = useState<string | null>(null);
  if (!q.data) return <><PageHeader title="UML diagrams" sub={SUB} /><Spinner /></>;
  const ds = q.data.diagrams;
  if (!ds.length) return <><PageHeader title="UML diagrams" sub={SUB} /><EmptyState icon={Network}>No diagrams yet.</EmptyState></>;
  const current = ds.find((d) => d.id === pick) ?? ds[0]!;
  const kinds = [...new Set(ds.map((d) => d.kind))];
  return (
    <>
      <PageHeader title="UML diagrams" sub={SUB} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 desktop:grid-cols-[260px_minmax(0,1fr)]">
        <NativeSelect className="desktop:hidden" label="Diagram" value={current.id} onChange={(e) => setPick(e.target.value)}>
          {kinds.map((k) => <optgroup key={k} label={k}>{ds.filter((d) => d.kind === k).map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}</optgroup>)}
        </NativeSelect>
        <nav aria-label="Diagrams" className="hidden self-start desktop:block">
          {kinds.map((k) => (
            <div key={k} className="mb-3">
              <p className="px-3 pb-1 text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground">{k}</p>
              {ds.filter((d) => d.kind === k).map((d) => (
                <button key={d.id} type="button" aria-current={d.id === current.id ? "page" : undefined} onClick={() => setPick(d.id)}
                  className={cn("block w-full rounded-lg px-3 py-1.5 text-left text-sm transition-colors", d.id === current.id ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground")}>
                  {d.title}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <Viewer key={current.id} d={current} />
      </div>
    </>
  );
}
