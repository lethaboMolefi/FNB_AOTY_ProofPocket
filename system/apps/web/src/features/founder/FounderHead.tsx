import { LevelPill, PageHead } from "../../components/ui";
import { useMe } from "../../lib/me";

/** Page head for founder screens: "{Business} · {town}, {province}", title, subtitle, Starter/Verified (v2 fHead). */
export function FounderHead({ title, sub }: { title: string; sub?: string }) {
  const c = useMe().data?.company;
  return <PageHead label={c ? `${c.name} · ${c.town}, ${c.province}` : undefined} title={title} sub={sub} side={c && <LevelPill verified={c.verified} />} />;
}
