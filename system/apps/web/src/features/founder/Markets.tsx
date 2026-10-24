// Profile & marketing (v2/app.js vMarkets). Posts are shared from the founder's own accounts (share links only).
import { shortDate } from "@proofpocket/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Notice, Pill, Spinner, useToast } from "../../components/ui";
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
  const [p, setP] = useState(d.profile);
  const [err, setErr] = useState("");
  const save = async (e: FormEvent) => {
    e.preventDefault(); setErr("");
    try { toast((await api<{ message: string }>("/founder/profile", { method: "PUT", body: p })).message); void qc.invalidateQueries({ queryKey: ["founder", "markets"] }); }
    catch (x) { setErr((x as ApiError).message); }
  };
  return (
    <form className="panel stack" onSubmit={save} noValidate>
      <h2>Your public profile</h2>
      <label className="field"><span>One line about your business</span><input type="text" maxLength={90} value={p.tagline} onChange={(e) => setP({ ...p, tagline: e.target.value })} /></label>
      <label className="field"><span>Services and prices (one per line)</span><textarea value={p.services} onChange={(e) => setP({ ...p, services: e.target.value })} /></label>
      <div className="form-grid">
        <label className="field"><span>WhatsApp number</span><input type="tel" value={p.whatsapp} onChange={(e) => setP({ ...p, whatsapp: e.target.value })} /></label>
        <label className="field"><span>Instagram</span><input type="text" value={p.instagram} onChange={(e) => setP({ ...p, instagram: e.target.value })} /></label>
        <label className="field"><span>Hours</span><input type="text" value={p.hours} onChange={(e) => setP({ ...p, hours: e.target.value })} /></label>
      </div>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="row between"><span className="hint mono">{d.url.replace(/^https?:\/\//, "")}</span><button className="btn primary" type="submit">Save profile</button></div>
    </form>
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
    <section className="panel stack">
      <h2>Verified QR code</h2>
      <p className="small muted">Print it at your stall or add it to your posts. Scanning it opens your profile and shows whether you're verified.</p>
      <div className="row" style={{ gap: 16, alignItems: "center" }}>
        <div className="qrbox">{qr ? <img src={qr} alt={`QR code for ${d.name}'s profile`} width={150} height={150} /> : <span className="hint">Loading…</span>}</div>
        <div className="stack" style={{ gap: 6 }}>
          {d.verified ? <Pill tone="good">Verified on ProofPocket</Pill> : <Pill tone="warn">Starter: not verified yet</Pill>}
          <span className="small">{d.name}</span>
          <button className="btn sm" onClick={() => void copy()}>Copy profile link</button>
          <a className="btn sm ghost" href={d.url} target="_blank" rel="noopener noreferrer">Open your page</a>
        </div>
      </div>
    </section>
  );
}

const shareText = (d: Data, text: string) => `${text}\n\n${d.name} · ${d.verified ? "Verified on ProofPocket" : "On ProofPocket"}: ${d.url}`;

function Posts({ d }: { d: Data }) {
  const toast = useToast();
  const qc = useQueryClient();
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
    <>
      <form className="panel stack" onSubmit={(e) => { e.preventDefault(); void create(false); }} noValidate>
        <h2>Create a post</h2>
        <label className="field"><span>What do you want to tell customers?</span><textarea maxLength={400} placeholder="e.g. Gel overlays this Saturday, R250. Book on WhatsApp." value={text} onChange={(e) => setText(e.target.value)} /></label>
        {err && <p className="err" role="alert">{err}</p>}
        <div className="row between">
          <span className="hint">Posts go out from your own accounts with your profile link.{d.verified ? " Verified businesses can ask for a weekly feature." : ""}</span>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn primary" type="submit">Save post</button>
            {d.verified && <button className="btn" type="button" onClick={() => void create(true)}>Save and request a feature</button>}
          </div>
        </div>
      </form>
      <section className="panel">
        <h2>Your posts</h2>
        {d.posts.length ? d.posts.map((p) => {
          const enc = encodeURIComponent(shareText(d, p.text));
          return (
            <div key={p.id} className="li">
              <div className="li-main"><span>{p.text}</span><span className="hint">{shortDate(p.date)}{p.shared.length ? ` · shared to ${p.shared.join(", ")}` : ""}</span>
                {p.feature === "rejected" && p.reviewNote && <span className="hint">Feature not approved: {p.reviewNote}</span>}</div>
              <div className="li-side">
                <div className="row" style={{ gap: 6 }}>
                  <a className="btn sm" href={`https://wa.me/?text=${enc}`} target="_blank" rel="noopener noreferrer" onClick={() => shared(p.id, "WhatsApp")}>WhatsApp</a>
                  <a className="btn sm" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(d.url)}`} target="_blank" rel="noopener noreferrer" onClick={() => shared(p.id, "Facebook")}>Facebook</a>
                  <a className="btn sm" href={`https://twitter.com/intent/tweet?text=${enc}`} target="_blank" rel="noopener noreferrer" onClick={() => shared(p.id, "X")}>X</a>
                </div>
                {p.feature === "featured" ? <Pill tone="good">Featured this week</Pill> : p.feature === "requested" ? <Pill tone="warn">Feature requested</Pill> : p.feature === "rejected" ? <Pill tone="plain">Not featured</Pill> : null}
              </div>
            </div>
          );
        }) : <p className="muted">No posts yet.</p>}
      </section>
    </>
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
    <section className="panel">
      <h2>Buyers looking for suppliers</h2>
      <div className="grid-2">{d.buyers.map((b) => (
        <div key={b.id} className="panel stack" style={{ background: "var(--surface-2)" }}>
          <div className="panel-head" style={{ margin: 0 }}><h3>{b.name}</h3>{b.goodFit ? <Pill tone="info">Good fit</Pill> : <Pill tone="plain">{b.kind ?? "Buyer"}</Pill>}</div>
          <p className="small">{b.wants}</p>
          <div className="row between">
            <span className="hint">{d.hasIncubator ? "Your adviser arranges the introduction" : "ProofPocket arranges the introduction"}</span>
            {b.requested ? <Pill tone={b.requested === "declined" ? "plain" : "good"}>{b.requested === "arranged" ? "Being arranged" : b.requested === "declined" ? "Not taken further" : "Requested"}</Pill>
              : d.verified ? <button className={`btn sm ${b.goodFit ? "primary" : ""}`} onClick={() => void intro(b.id)}>Request introduction</button> : <Pill tone="plain">Verified only</Pill>}
          </div>
        </div>
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
      {!d.verified && <Notice tone="warn" icon="!" action={<Link className="btn sm ml-auto" to="/app/start">Get verified</Link>}>
        <b>Your profile isn't in the public directory yet</b> <span className="small">Finish the four verification steps to get the Verified badge and be listed. You can still share posts from your own accounts now.</span>
      </Notice>}
      <div className="grid-2"><ProfileForm key={JSON.stringify(d.profile)} d={d} /><QrPanel d={d} /></div>
      <Posts d={d} />
      <Buyers d={d} />
    </>
  );
}
