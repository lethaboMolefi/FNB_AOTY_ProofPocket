// Profile & Marketing — public profile, posts, QR link.
import { shortDate } from "@proofpocket/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  BadgeCheck, ClipboardCopy, ExternalLink, Loader2, MessageCircle, Plus, Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Spinner, useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { FounderHead } from "./FounderHead";

interface Profile {
  tagline: string; services: string; whatsapp: string; instagram: string; hours: string;
}
interface Post {
  id: string; text: string; postedOn: string; sharedTo: string[]; feature: string; featuredUntil: string | null;
}
interface MarketsData {
  profile: Profile;
  company: { name: string; slug: string; verified: boolean; publicLink: string | null; qrData: string | null };
  posts: Post[];
}

function ProfileForm({ profile, onSaved }: { profile: Profile; onSaved: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [f, setF] = useState<Profile>({ ...profile });

  const save = useMutation({
    mutationFn: () => api<{ message: string }>("/founder/markets/profile", { method: "PUT", body: f }),
    onSuccess: (r) => { toast(r.message); void qc.invalidateQueries({ queryKey: ["founder", "markets"] }); onSaved(); },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Try again."),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Your profile</CardTitle>
        <CardDescription>What clients and funders see on your public page.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="m-tagline">Tagline</Label>
            <span className="text-xs text-muted-foreground">{f.tagline.length}/90</span>
          </div>
          <Input
            id="m-tagline" maxLength={90}
            placeholder="e.g. Township nails and lashes, Soweto"
            value={f.tagline}
            onChange={(e) => setF({ ...f, tagline: e.target.value })}
            className="mt-1.5"
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="m-services">What you offer</Label>
            <span className="text-xs text-muted-foreground">{f.services.length}/500</span>
          </div>
          <textarea
            id="m-services" maxLength={500} rows={3}
            placeholder="Describe your services or products…"
            value={f.services}
            onChange={(e) => setF({ ...f, services: e.target.value })}
            className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="m-wa">WhatsApp number</Label>
            <Input id="m-wa" placeholder="+27 71 234 5678"
              value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="m-ig">Instagram handle</Label>
            <Input id="m-ig" placeholder="@nala_nails"
              value={f.instagram} onChange={(e) => setF({ ...f, instagram: e.target.value })} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="m-hours">Trading hours</Label>
            <Input id="m-hours" placeholder="Mon–Sat 8am–6pm"
              value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} className="mt-1.5" />
          </div>
        </div>
        <div className="flex justify-end pt-1">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save profile
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function NewPostForm() {
  const toast = useToast();
  const qc = useQueryClient();
  const [text, setText] = useState("");

  const create = useMutation({
    mutationFn: () => api<{ message: string }>("/founder/markets/posts", { body: { text: text.trim() } }),
    onSuccess: (r) => { toast(r.message); setText(""); void qc.invalidateQueries({ queryKey: ["founder", "markets"] }); },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Try again."),
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="post-text">What's new?</Label>
        <span className="text-xs text-muted-foreground">{text.length}/400</span>
      </div>
      <textarea
        id="post-text" maxLength={400} rows={3}
        placeholder="Share an update, offer or news about your business…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
      />
      <div className="flex justify-end">
        <Button size="sm" onClick={() => create.mutate()} disabled={create.isPending || !text.trim()}>
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Post update
        </Button>
      </div>
    </div>
  );
}

export default function Markets() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["founder", "markets"], queryFn: () => api<MarketsData>("/founder/markets") });

  const deletePost = useMutation({
    mutationFn: (id: string) => api<{ message: string }>(`/founder/markets/posts/${id}`, { method: "DELETE" }),
    onSuccess: (r) => { toast(r.message); void qc.invalidateQueries({ queryKey: ["founder", "markets"] }); },
  });

  if (!q.data) return <><FounderHead title="Profile & marketing" /><Spinner /></>;
  const d = q.data;
  const c = d.company;

  return (
    <>
      <FounderHead
        title="Profile & marketing"
        sub="Your public page, verified QR code, and posts you share to WhatsApp and social media."
      />

      {/* Public link card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Your public page</CardTitle>
              <CardDescription className="mt-0.5">Clients and funders can find and pay you here.</CardDescription>
            </div>
            {c.verified
              ? <Badge variant="success" className="shrink-0"><BadgeCheck className="h-3.5 w-3.5 mr-1" />Verified</Badge>
              : <Badge variant="secondary" className="shrink-0">Starter</Badge>
            }
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {c.publicLink ? (
            <div className="flex gap-2">
              <Input readOnly value={c.publicLink} className="font-mono text-xs" />
              <Button size="sm" variant="outline"
                onClick={() => { void navigator.clipboard.writeText(c.publicLink!); toast("Link copied."); }}>
                <ClipboardCopy className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href={c.publicLink} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Your public link is set up once your account is active.
            </p>
          )}
        </CardContent>
      </Card>

      <ProfileForm profile={d.profile} onSaved={() => {}} />

      {/* Posts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Updates & posts</CardTitle>
          <CardDescription>Share what's happening with your business. Copy the text and paste it into WhatsApp or Instagram.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <NewPostForm />

          {d.posts.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                {d.posts.map((post) => {
                  const waText = encodeURIComponent(`${post.text}${c.publicLink ? `\n\n${c.publicLink}` : ""}`);
                  const waLink = `https://wa.me/?text=${waText}`;
                  return (
                    <div key={post.id} className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-foreground flex-1">{post.text}</p>
                        <Button
                          size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => deletePost.mutate(post.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{shortDate(post.postedOn)}</span>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 text-green-700 border-green-200 hover:bg-green-50" asChild>
                          <a href={waLink} target="_blank" rel="noreferrer">
                            <MessageCircle className="h-3.5 w-3.5" />
                            Share on WhatsApp
                          </a>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
