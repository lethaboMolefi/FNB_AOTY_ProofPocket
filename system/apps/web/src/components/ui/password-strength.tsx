// Real-time password strength indicator with requirement checks.
import { Check, X } from "lucide-react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface Check {
  label: string;
  met: boolean;
}

interface PasswordStrengthProps {
  password: string;
  email?: string;
  className?: string;
}

// Keep these in sync with packages/shared/src/schemas/auth.ts (passwordFor)
const COMMON = new Set([
  "password", "password1", "password123", "passw0rd", "qwerty123", "qwertyuiop",
  "1234567890", "12345678910", "123456789", "iloveyou1", "letmein123",
  "welcome123", "admin12345", "abc1234567", "proofpocket", "sunshine12", "football12", "monkey12345",
]);

export function PasswordStrength({ password, email, className }: PasswordStrengthProps) {
  const checks: Check[] = useMemo(() => {
    const name = (email ?? "").split("@")[0]?.toLowerCase() ?? "";
    return [
      { label: "At least 10 characters", met: password.length >= 10 },
      { label: "Contains a letter", met: /[a-zA-Z]/.test(password) },
      { label: "Contains a number", met: /\d/.test(password) },
      { label: "Contains a special character", met: /[^a-zA-Z0-9]/.test(password) },
      { label: "Not your email name", met: name.length < 4 || !password.toLowerCase().includes(name) },
      { label: "Not a common password", met: password.length > 0 && !COMMON.has(password.toLowerCase()) },
    ];
  }, [password, email]);

  const score = checks.filter((c) => c.met).length;

  const strengthLabel = password.length === 0 ? "" : score <= 2 ? "Weak" : score <= 4 ? "Fair" : "Strong";
  const strengthColor = password.length === 0
    ? "bg-border"
    : score <= 2 ? "bg-destructive" : score <= 4 ? "bg-amber-500" : "bg-emerald-600";

  if (password.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)} role="status" aria-live="polite">
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div className="flex h-1.5 flex-1 gap-1">
          {checks.slice(0, 4).map((_, i) => (
            <div
              key={i}
              className={cn("h-full flex-1 rounded-full transition-colors", i < score ? strengthColor : "bg-border")}
            />
          ))}
        </div>
        <span className={cn("text-xs font-medium tabular-nums", strengthColor === "bg-destructive" ? "text-destructive" : strengthColor === "bg-amber-500" ? "text-amber-600" : "text-emerald-600")}>
          {strengthLabel}
        </span>
      </div>

      {/* Requirement checklist */}
      <ul className="grid grid-cols-1 gap-1.5">
        {checks.map((c) => (
          <li key={c.label} className="flex items-center gap-2 text-xs">
            {c.met ? (
              <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            ) : (
              <X className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            )}
            <span className={c.met ? "text-foreground" : "text-muted-foreground"}>{c.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
