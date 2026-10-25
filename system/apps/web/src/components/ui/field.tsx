// Labelled form controls in the shadcn style. Each label is tied to its control (useId), so screen readers
// and getByLabel find it; errors and hints sit under the control.
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Input } from "./input";
import { Label } from "./label";

type Extra = { label: ReactNode; hint?: ReactNode; error?: string; className?: string };

export const TextField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & Extra>(
  function TextField({ label, hint, error, className, id, ...props }, ref) {
    const auto = useId();
    const fid = id ?? auto;
    return (
      <div className={cn("space-y-1.5", className)}>
        <Label htmlFor={fid}>{label}</Label>
        <Input id={fid} ref={ref} aria-invalid={!!error || undefined} aria-describedby={error || hint ? `${fid}-note` : undefined} {...props} />
        {(error || hint) && <p id={`${fid}-note`} className={cn("text-xs", error ? "text-bad" : "text-muted-foreground")}>{error ?? hint}</p>}
      </div>
    );
  },
);

export const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

/** A native select (works with the phone's own picker and with tests' selectOption). */
export const NativeSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & Extra>(
  function NativeSelect({ label, hint, error, className, id, children, ...props }, ref) {
    const auto = useId();
    const fid = id ?? auto;
    return (
      <div className={cn("space-y-1.5", className)}>
        <Label htmlFor={fid}>{label}</Label>
        <select id={fid} ref={ref} className={selectClass} aria-invalid={!!error || undefined} {...props}>{children}</select>
        {(error || hint) && <p className={cn("text-xs", error ? "text-bad" : "text-muted-foreground")}>{error ?? hint}</p>}
      </div>
    );
  },
);
