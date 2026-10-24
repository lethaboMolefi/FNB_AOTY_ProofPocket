// Response shapes of the founder API (kept next to the screens that use them).
import type { DocState, DocType } from "@proofpocket/shared";

export interface DocumentsResponse {
  company: { name: string; legalName: string | null; cipcNumber: string | null; verified: boolean; joined: boolean; registered: boolean; incubatorId: string | null };
  checker: { kind: "adviser" | "admin"; name: string };
  steps: { key: DocType; title: string; how: string; name: string; neededToVerify: boolean }[];
  documents: { docType: DocType; state: DocState; name: string; fileName: string | null; sha256: string | null; expiresOn: string | null; sentBackReason: string | null }[];
}
