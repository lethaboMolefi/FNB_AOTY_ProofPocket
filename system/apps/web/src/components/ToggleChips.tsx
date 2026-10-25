// Pick several from a list: shadcn Buttons that toggle (aria-pressed), in a labelled group.
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ToggleChips<T extends string>({ legend, options, value, onChange }: {
  legend: string; options: readonly { value: T; label: string }[]; value: T[]; onChange: (v: T[]) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">{options.map((o) => {
        const on = value.includes(o.value);
        return (
          <Button key={o.value} type="button" size="sm" variant={on ? "default" : "outline"} aria-pressed={on}
            className={cn("rounded-full", !on && "text-muted-foreground")}
            onClick={() => onChange(on ? value.filter((x) => x !== o.value) : [...value, o.value])}>{o.label}</Button>
        );
      })}</div>
    </fieldset>
  );
}
