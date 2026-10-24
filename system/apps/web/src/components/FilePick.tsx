// A button that opens the file picker (PDF or photo), uploads, and reports the result.
import { useId, useState } from "react";
import { ApiError } from "../lib/api";
import { uploadFile, type Uploaded } from "../lib/upload";

export function FilePick({ label, purpose = "document", primary, accept = ".pdf,image/*", onUploaded, onError, base }: {
  label: string;
  purpose?: "document" | "receipt" | "statement" | "proof";
  primary?: boolean;
  accept?: string;
  base?: string;
  onUploaded: (f: Uploaded) => void | Promise<void>;
  onError?: (message: string) => void;
}) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  return (
    <label htmlFor={id} className={`btn sm ${primary ? "primary" : ""} ${busy ? "opacity-60" : ""}`} aria-busy={busy}>
      {busy ? "Uploading…" : label}
      <input
        id={id} type="file" accept={accept} className="sr-only" disabled={busy}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          try { await onUploaded(await uploadFile(file, purpose, base)); }
          catch (err) { onError?.(err instanceof ApiError ? err.message : "The upload didn't go through. Try again."); }
          finally { setBusy(false); }
        }}
      />
    </label>
  );
}
