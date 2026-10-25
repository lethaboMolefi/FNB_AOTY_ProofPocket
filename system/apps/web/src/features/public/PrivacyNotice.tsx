// The privacy notice founders agree to when they join (POPIA s18). Source: docs/security/popia/privacy-notice.md.
import { DATA_REQUEST_DAYS, PRIVACY_NOTICE_VERSION, shortDate } from "@proofpocket/shared";
import { Link } from "react-router-dom";
import { AuthPageShell } from "../auth/SignIn";

const SECTIONS: [string, string[]][] = [
  ["Who we are", ["ProofPocket (Team KamosoByte) keeps one shared business record for founders, their incubators and funders. We never hold or move money."]],
  ["What we collect", [
    "Your name, email address and your business details (name, sector, town, registration number).",
    "Documents you upload to be checked: company registration, owner ID, bank confirmation, proof of address and others you choose.",
    "Your books: money in and out, stock, suppliers, payment requests and proofs your clients send.",
    "Your saved payment details. Account numbers are encrypted; others only ever see the last four digits.",
    "Sign-in records and an audit log of important actions, to keep your account and your money safe.",
  ]],
  ["Why we use it", [
    "To check your documents and show you as Verified.",
    "To work out your readiness score and show your progress.",
    "To let your incubator support you, and verified funders see only what you allow under Privacy & sharing.",
    "To spot fraud: reused proofs of payment, changed supplier bank details and suspicious messages.",
  ]],
  ["Who can see it", [
    "Your incubator's advisers, if you choose an incubator.",
    "Verified funders, only as much as you allow (nothing, a summary, or full books). Applying to a programme shares your profile with that funder only.",
    "ProofPocket's admin checkers, to check documents and handle reports.",
    "No one else. We don't sell your data or share it for advertising.",
  ]],
  ["Where it's kept", [
    "In Google Cloud in Johannesburg (africa-south1). Sign-in is handled by Google Firebase, which may process your email address outside South Africa under Google's data protection terms.",
  ]],
  ["How long we keep it", [
    "Business records (books, documents, payments) for 5 years after your last activity, as South African tax law requires.",
    "Unfinished uploads are deleted after a day. The audit log is kept for 5 years.",
  ]],
  ["Your rights", [
    "See and download everything we keep about your business: Privacy & sharing → Your data → Download my data.",
    `Ask us to correct or delete your data from the same place. We reply within ${DATA_REQUEST_DAYS} days. Some records must be kept by law; we'll tell you which.`,
    "Object to how we use your data, or complain to the Information Regulator (inforegulator.org.za).",
  ]],
];

export default function PrivacyNotice() {
  return (
    <AuthPageShell>
      <div><h1>Privacy notice</h1><p className="muted mt-1.5">Version of {shortDate(PRIVACY_NOTICE_VERSION)}. How ProofPocket uses your information, in plain language.</p></div>
      {SECTIONS.map(([title, items]) => (
        <section key={title} className="panel stack" aria-labelledby={`pn-${title}`}>
          <h2 id={`pn-${title}`} className="!mb-0">{title}</h2>
          <ul className="small stack" style={{ gap: 6, paddingLeft: 18, listStyle: "disc" }}>{items.map((i) => <li key={i}>{i}</li>)}</ul>
        </section>
      ))}
      <p className="small"><Link to="/">Back to ProofPocket</Link></p>
    </AuthPageShell>
  );
}
