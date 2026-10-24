// Every example account, with a role label for the credentials list.
import { COMPANIES, FUNDERS, INCUBATORS } from "./data";

export function exampleAccounts(adminEmail: string): { email: string; who: string; role: string }[] {
  return [
    ...COMPANIES.map((c) => ({ email: c.founder.email, who: `${c.founder.name}, ${c.name}`, role: "Founder" })),
    ...FUNDERS.map((f) => ({ email: f.user.email, who: f.name, role: "Funder" })),
    ...INCUBATORS.flatMap((n) => n.advisers.map((a) => ({ email: a.email, who: `${a.name}, ${n.name}`, role: "Adviser" }))),
    { email: adminEmail, who: "ProofPocket checker", role: "Admin" },
  ];
}
