// Phone "More": every founder page not on the bottom tab bar, grouped as in the sidebar.
import { FOUNDER_TABS, founderNavFor } from "../../app/nav";
import { MorePage } from "../../components/layout/MorePage";
import { useMe } from "../../lib/me";

export default function More() {
  const { data: me } = useMe();
  return <MorePage base="/app" groups={founderNavFor(me?.company?.businessType)} tabs={FOUNDER_TABS} sub="ProofPocket never holds money." />;
}
