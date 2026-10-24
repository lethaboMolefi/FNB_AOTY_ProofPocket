// Business settings (v2 had none; inventory 12.9): two-step sign-in now, business details in phase 3.
import { TwoFactorCard } from "../auth/TwoFactor";
import { FounderHead } from "./FounderHead";

export default function Settings() {
  return (
    <>
      <FounderHead title="Business settings" sub="Two-step sign-in, opening balance, people and the year you started trading." />
      <TwoFactorCard />
    </>
  );
}
