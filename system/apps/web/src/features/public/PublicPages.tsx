// Public pages that need no account. Filled in by later phases; the routes exist now so links and QR codes resolve.
import { useParams } from "react-router-dom";
import { TopBar } from "../../components/layout/TopBar";
import { Notice, PageHead } from "../../components/ui";

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopBar home="/directory" />
      <main id="main" className="mx-auto flex max-w-[960px] flex-col gap-5 px-4 pb-12 pt-5">{children}</main>
    </>
  );
}

const Building = ({ phase, what }: { phase: number; what: string }) => (
  <Notice tone="info" icon="i"><span className="small"><b>Being built.</b> {what} arrives in phase {phase}.</span></Notice>
);

export function Directory() {
  return (
    <PublicShell>
      <PageHead label="ProofPocket directory" title="Verified local businesses"
        sub="Every business here has shown ProofPocket its CIPC registration, owner ID, business bank account and address. Scan a business's QR code to check it." />
      <Building phase={5} what="The directory" />
    </PublicShell>
  );
}

export function BusinessProfile() {
  const { slug } = useParams();
  return (
    <PublicShell>
      <PageHead label="Business profile" title={slug ?? ""} />
      <Building phase={5} what="The public profile page" />
    </PublicShell>
  );
}

export function PayPage() {
  const { ref } = useParams();
  return (
    <PublicShell>
      <PageHead label="Payment request" title={ref?.split("-").slice(0, 2).join("-") ?? ""} />
      <Notice tone="warn" icon="!"><span className="small">Only pay to the details on this page. ProofPocket will never ask you to pay a different account.</span></Notice>
      <Building phase={4} what="The payment page" />
    </PublicShell>
  );
}

export function Join() {
  return (
    <PublicShell>
      <PageHead label="Join ProofPocket" title="Start your business record"
        sub="Anyone can start. Registered businesses that pass the document check get the Verified badge, which funders, buyers and customers look for." />
      <Building phase={2} what="The join wizard" />
    </PublicShell>
  );
}
