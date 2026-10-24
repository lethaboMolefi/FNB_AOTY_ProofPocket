// Business settings — rebuilt with shadcn.
import { todayZA } from "@proofpocket/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { TwoFactorCard } from "../auth/TwoFactor";
import { FounderHead } from "./FounderHead";
import { useToast } from "../../components/ui";

interface SettingsData {
  openingBalance: number;
  openingBalanceDate: string;
  employees: number;
  foundedYear: number;
  stage: "Early" | "Growth";
}

function BusinessForm({ s }: { s: SettingsData }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({
    ...s,
    openingBalance: String(s.openingBalance),
    employees: String(s.employees),
    foundedYear: String(s.foundedYear),
  });

  const save = useMutation({
    mutationFn: () => api<{ message: string }>("/founder/settings", {
      method: "PUT",
      body: {
        openingBalance: Number(f.openingBalance) || 0,
        openingBalanceDate: f.openingBalanceDate,
        employees: Number(f.employees) || 1,
        foundedYear: Number(f.foundedYear),
        stage: f.stage,
      },
    }),
    onSuccess: async (r) => {
      toast(r.message);
      await qc.invalidateQueries({ queryKey: ["founder"] });
      await qc.invalidateQueries({ queryKey: ["me"] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Your business</CardTitle>
        <CardDescription>
          Cash on hand starts from your opening balance on its date, plus every entry since.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form noValidate onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="opening-balance">Opening balance (R)</Label>
              <Input
                id="opening-balance"
                type="number"
                step="0.01"
                value={f.openingBalance}
                onChange={(e) => setF({ ...f, openingBalance: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="opening-date">On this date</Label>
              <Input
                id="opening-date"
                type="date"
                max={todayZA()}
                value={f.openingBalanceDate}
                onChange={(e) => setF({ ...f, openingBalanceDate: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="employees">People working in the business</Label>
              <Input
                id="employees"
                type="number"
                min={1}
                value={f.employees}
                onChange={(e) => setF({ ...f, employees: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="founded-year">Trading since (year)</Label>
              <Input
                id="founded-year"
                type="number"
                min={1950}
                max={Number(todayZA().slice(0, 4))}
                value={f.foundedYear}
                onChange={(e) => setF({ ...f, foundedYear: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Business stage</Label>
              <Select value={f.stage} onValueChange={(v) => setF({ ...f, stage: v as SettingsData["stage"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Early">Early</SelectItem>
                  <SelectItem value="Growth">Growth</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {save.error && (
            <p className="text-sm text-destructive" role="alert">{(save.error as ApiError).message}</p>
          )}

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : "Save changes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  const q = useQuery({ queryKey: ["founder", "settings"], queryFn: () => api<SettingsData>("/founder/settings") });
  return (
    <>
      <FounderHead title="Business settings" sub="Two-step sign-in, opening balance, people and the year you started trading." />
      <TwoFactorCard />
      {q.data ? <BusinessForm key={JSON.stringify(q.data)} s={q.data} /> : <Spinner />}
    </>
  );
}
