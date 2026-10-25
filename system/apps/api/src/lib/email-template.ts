// The HTML version of every email: one branded layout with the plain text as its body.
// Inline styles and tables because email apps ignore stylesheets. Colours are the web app's tokens.
import type { Mail } from "./mailer";

const C = { ink: "#181C27", muted: "#5A6275", line: "#E6E8EE", page: "#F7F7FA", accent: "#5B3FA0", accentInk: "#FFFFFF" };
// Single quotes: this goes inside style="…" attributes.
const FONT = `'IBM Plex Sans', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const isWebUrl = (url: string) => /^https?:\/\//i.test(url);

/** Escapes a paragraph and links its http(s) addresses, leaving trailing punctuation outside the link. */
function paragraphHtml(text: string) {
  return escapeHtml(text)
    .replace(/https?:\/\/[^\s<]+?(?=[.,;:!?)]*(?:\s|$))/gi, (url) => `<a href="${url}" style="color:${C.accent};text-decoration:underline">${url}</a>`)
    .replace(/\n/g, "<br>");
}

export function renderEmailHtml(mail: Mail, webUrl: string): string {
  const action = mail.action && isWebUrl(mail.action.url) ? mail.action : undefined;
  const paragraphs = mail.text.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p && p !== action?.url);
  const body = paragraphs.map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${C.ink}">${paragraphHtml(p)}</p>`).join("\n");
  const home = escapeHtml(webUrl);
  const button = action
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px"><tr><td style="border-radius:8px;background:${C.accent}">
<a href="${escapeHtml(action.url)}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;color:${C.accentInk};text-decoration:none;border-radius:8px">${escapeHtml(action.label)}</a>
</td></tr></table>
<p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:${C.muted}">Or copy this link into your browser:<br><span style="color:${C.ink};word-break:break-all">${escapeHtml(action.url)}</span></p>`
    : "";

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(mail.subject)}</title></head>
<body style="margin:0;padding:0;background:${C.page};font-family:${FONT}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page}"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:${FONT}">
<tr><td style="padding:0 4px 16px">
<a href="${home}" style="text-decoration:none;color:${C.ink}"><span style="display:inline-block;width:28px;height:28px;border-radius:7px;background:${C.accent};color:${C.accentInk};font-weight:700;font-size:15px;line-height:28px;text-align:center;vertical-align:middle">P</span>
<span style="font-size:18px;font-weight:700;letter-spacing:-0.01em;vertical-align:middle;padding-left:8px">ProofPocket</span></a>
</td></tr>
<tr><td style="background:#FFFFFF;border:1px solid ${C.line};border-radius:12px;padding:28px 28px 12px">
<h1 style="margin:0 0 18px;font-size:21px;line-height:1.3;font-weight:700;color:${C.ink}">${escapeHtml(mail.subject)}</h1>
${body}
${button}
</td></tr>
<tr><td style="padding:18px 4px 0;font-size:12px;line-height:1.6;color:${C.muted}">
<p style="margin:0 0 6px">ProofPocket will never phone you or message you to ask for your password or a code.</p>
<p style="margin:0">You're getting this email because you have a <a href="${home}" style="color:${C.muted};text-decoration:underline">ProofPocket</a> account. Your books, payments and proof, in one place.</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}
