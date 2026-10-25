// A button that opens the file picker (PDF or photo), uploads, and reports the result.
import { Loader2, Upload } from "lucide-react";
import { useId, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ApiError } from "../lib/api";
import { uploadFile, type Uploaded } from "../lib/upload";

export function FilePick({ label, purpose = "document", primary, accept = ".pdf,image/*", onUploaded, onError, base, headers }: {
  label: string;
  purpose?: "document" | "receipt" | "statement" | "proof";
  primary?: boolean;
  accept?: string;
  base?: string;
  headers?: Record<string, string>;
  onUploaded: (f: Uploaded) => void | Promise<void>;
  onError?: (message: string) => void;
}) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  return (
    <label htmlFor={id} className={cn(buttonVariants({ size: "sm", variant: primary ? "default" : "outline" }), "relative cursor-pointer focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2", busy && "pointer-events-none opacity-60")} aria-busy={busy}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
      {busy ? "Uploading…" : label}
      <input
        id={id} type="file" accept={accept} className="sr-only" disabled={busy}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          try { await onUploaded(await uploadFile(file, purpose, base, headers)); }
          catch (err) { onError?.(err instanceof ApiError ? err.message : "The upload didn't go through. Try again."); }
          finally { setBusy(false); }
        }}
      />
    </label>
  );
}
