// Profile & marketing (v2/app.js vMarkets). Posts are shared from the founder's own accounts (share links only).
import { shortDate } from "@proofpocket/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, ClipboardCopy, ExternalLink, Handshake, Sparkles } from "lucide-react";
import { useEffect, useId, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TextField } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Spinner, useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { FounderHead } from "./FounderHead";

interface Data {
  verified: boolean; url: string; name: string; hasIncubator: boolean;
  profile: { tagline: string; services: string; whatsapp: string; instagram: string; hours: string };
  posts: { id: string; text: string; date: string; shared: string[]; feature: "none" | "requested" | "featured" | "rejected"; reviewNote: string | null }[];
  buyers: { id: string; name: string; kind: string | null; wants: string | null; goodFit: boolean; requested: string | null }[];
}
const SUB = "Your public page, a verified QR code, and posts you share from your own WhatsApp and social media.";

function ProfileForm({ d }: { d: Data }) {
  const toast = useToast();
  const qc = useQueryClient();
  const servicesId = useId();
  const [p, setP] = useState(d.profile);
  const [err, setErr] = useState("");
  const save = async (e: FormEvent) => {
    e.preventDefault(); setErr("");
    try { toast((await api<{ message: string }>("/founder/profile", { method: "PUT", body: p })).message); void qc.invalidateQueries({ queryKey: ["founder", "markets"] }); }
    catch (x) { setErr((x as ApiError).message); }
  };
  return (
    <Card>
      <form onSubmit={save} noValidate>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your public profile</CardTitle>
          <CardDescription>What customers, buyers and funders see on your public page.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <TextField label="One line about your business" maxLength={90} value={p.tagline} onChange={(e) => setP({ ...p, tagline: e.target.value })} />
          <div className="space-y-1.5">
            <Label htmlFor={servicesId}>Services and prices (one per line)</Label>
            <Textarea id={servicesId} rows={4} value={p.services} onChange={(e) => setP({ ...p, services: e.target.value })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <TextField label="WhatsApp number" type="tel" value={p.whatsapp} onChange={(e) => setP({ ...p, whatsapp: e.target.value })} />
            <TextField label="Instagram" value={p.instagram} onChange={(e) => setP({ ...p, instagram: e.target.value })} />
            <TextField label="Hours" value={p.hours} onChange={(e) => setP({ ...p, hours: e.target.value })} />
          </div>
          {err && <Callout tone="bad" role="alert">{err}</Callout>}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-xs text-muted-foreground">{d.url.replace(/^https?:\/\//, "")}</span>
            <Button type="submit">Save profile</Button>
          </div>
        </CardContent>
      </form>
    </Card>
  );
}

function QrPanel({ d }: { d: Data }) {
  const toast = useToast();
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void import("qrcode").then((QR) => QR.toDataURL(d.url, { margin: 1, width: 220, color: { dark: "#181C27", light: "#FFFFFF" } })).then((u) => { if (live) setQr(u); });
    return () => { live = false; };
  }, [d.url]);
  const copy = async () => { try { await navigator.clipboard.writeText(d.url); toast("Profile link copied"); } catch { toast(d.url); } };
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div className="space-y-1.5">
          <CardTitle className="text-base">Verified QR code</CardTitle>
          <CardDescription>Print it at your stall or add it to your posts. Scanning it opens your profile and shows whether you're verified.</CardDescription>
        </div>
        {d.verified ? <Badge variant="success" className="shrink-0 gap-1"><BadgeCheck className="h-3.5 w-3.5" />Verified on ProofPocket</Badge> : <Badge variant="warning" className="shrink-0">Starter: not verified yet</Badge>}
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-5">
        <div className="qrbox">{qr ? <img src={qr} alt={`QR code for ${d.name}'s profile`} width={150} height={150} /> : <span className="text-xs text-muted-foreground">Loading…</span>}</div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{d.name}</span>
          <Button size="sm" variant="outline" onClick={() => void copy()}><ClipboardCopy className="h-4 w-4" />Copy profile link</Button>
          <Button size="sm" variant="ghost" asChild><a href={d.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />Open your page</a></Button>
        </div>
      </CardContent>
    </Card>
  );
}

const shareText = (d: Data, text: string) => `${text}\n\n${d.name} · ${d.verified ? "Verified on ProofPocket" : "On ProofPocket"}: ${d.url}`;
const FEATURE: Record<Data["posts"][number]["feature"], [string, "success" | "warning" | "secondary"] | null> = {
  none: null, featured: ["Featured this week", "success"], requested: ["Feature requested", "warning"], rejected: ["Not featured", "secondary"],
};

function Posts({ d }: { d: Data }) {
  const toast = useToast();
  const qc = useQueryClient();
  const textId = useId();
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const create = async (requestFeature: boolean) => {
    setErr("");
    if (!text.trim()) { setErr("Write something first"); return; }
    try { toast((await api<{ message: string }>("/founder/posts", { body: { text, requestFeature } })).message); setText(""); void qc.invalidateQueries({ queryKey: ["founder", "markets"] }); }
    catch (x) { setErr((x as ApiError).message); }
  };
  const shared = (id: string, net: string) => { void api(`/founder/posts/${id}/shared`, { body: { net } }).then(() => qc.invalidateQueries({ queryKey: ["founder", "markets"] })); };
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Create a post</CardTitle>
        <CardDescription>Posts go out from your own accounts with your profile link.{d.verified ? " Verified businesses can ask for a weekly feature." : ""}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void create(false); }} noValidate>
          <div className="space-y-1.5">
            <Label htmlFor={textId}>What do you want to tell customers?</Label>
            <Textarea id={textId} rows={3} maxLength={400} placeholder="e.g. Gel overlays this Saturday, R250. Book on WhatsApp." value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          {err && <Callout tone="bad" role="alert">{err}</Callout>}
          <div className="flex flex-wrap justify-end gap-2">
            {d.verified && <Button type="button" variant="outline" onClick={() => void create(true)}><Sparkles className="h-4 w-4" />Save and request a feature</Button>}
            <Button type="submit">Save post</Button>
          </div>
        </form>
        <Separator />
        <h3 className="text-sm font-semibold">Your posts</h3>
        {d.posts.length ? <ul className="space-y-3">{d.posts.map((p) => {
          const enc = encodeURIComponent(shareText(d, p.text));
          const badge = FEATURE[p.feature];
          return (
            <li key={p.id} className="space-y-2 rounded-lg border border-line p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="flex-1 text-sm">{p.text}</p>
                {badge && <Badge variant={badge[1]} className="shrink-0">{badge[0]}</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">{shortDate(p.date)}{p.shared.length ? ` · shared to ${p.shared.join(", ")}` : ""}</p>
              {p.feature === "rejected" && p.reviewNote && <p className="text-xs text-muted-foreground">Feature not approved: {p.reviewNote}</p>}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" asChild><a href={`https://wa.me/?text=${enc}`} target="_blank" rel="noopener noreferrer" onClick={() => shared(p.id, "WhatsApp")}>WhatsApp</a></Button>
                <Button size="sm" variant="outline" asChild><a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(d.url)}`} target="_blank" rel="noopener noreferrer" onClick={() => shared(p.id, "Facebook")}>Facebook</a></Button>
                <Button size="sm" variant="outline" asChild><a href={`https://twitter.com/intent/tweet?text=${enc}`} target="_blank" rel="noopener noreferrer" onClick={() => shared(p.id, "X")}>X</a></Button>
              </div>
            </li>
          );
        })}</ul> : <p className="text-sm text-muted-foreground">No posts yet.</p>}
      </CardContent>
    </Card>
  );
}

function Buyers({ d }: { d: Data }) {
  const toast = useToast();
  const qc = useQueryClient();
  const intro = async (id: string) => {
    try { toast((await api<{ message: string }>(`/founder/intros/${id}`, { body: {} })).message); void qc.invalidateQueries({ queryKey: ["founder", "markets"] }); }
    catch (x) { toast((x as ApiError).message); }
  };
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">Buyers looking for suppliers</h2>
      <div className="grid gap-4 desktop:grid-cols-2">{d.buyers.map((b) => (
        <Card key={b.id}>
          <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-2">
            <CardTitle as="h3" className="text-base">{b.name}</CardTitle>
            {b.goodFit ? <Badge className="shrink-0">Good fit</Badge> : <Badge variant="secondary" className="shrink-0">{b.kind ?? "Buyer"}</Badge>}
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">{b.wants}</p>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{d.hasIncubator ? "Your adviser arranges the introduction" : "ProofPocket arranges the introduction"}</span>
              {b.requested ? <Badge variant={b.requested === "declined" ? "secondary" : "success"}>{b.requested === "arranged" ? "Being arranged" : b.requested === "declined" ? "Not taken further" : "Requested"}</Badge>
                : d.verified ? <Button size="sm" variant={b.goodFit ? "default" : "outline"} onClick={() => void intro(b.id)}><Handshake className="h-4 w-4" />Request introduction</Button>
                : <Badge variant="secondary">Verified only</Badge>}
            </div>
          </CardContent>
        </Card>
      ))}</div>
    </section>
  );
}

export default function Markets() {
  const q = useQuery({ queryKey: ["founder", "markets"], queryFn: () => api<Data>("/founder/markets") });
  if (!q.data) return <><FounderHead title="Profile & marketing" sub={SUB} /><Spinner /></>;
  const d = q.data;
  return (
    <>
      <FounderHead title="Profile & marketing" sub={SUB} />
      {!d.verified && <Callout tone="warn" action={<Button size="sm" variant="outline" asChild><Link to="/app/start">Get verified</Link></Button>}>
        <b>Your profile isn't in the public directory yet.</b> Finish the four verification steps to get the Verified badge and be listed. You can still share posts from your own accounts now.
      </Callout>}
      <div className="grid gap-6 desktop:grid-cols-2"><ProfileForm key={JSON.stringify(d.profile)} d={d} /><QrPanel d={d} /></div>
      <Posts d={d} />
      <Buyers d={d} />
    </>
  );
}
