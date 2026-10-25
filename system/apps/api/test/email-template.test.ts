import { describe, expect, it } from "vitest";
import { renderEmailHtml } from "../src/lib/email-template";

const WEB = "https://proofpocket.example";

describe("email template", () => {
  it("puts the subject as the heading and each paragraph in its own block", () => {
    const html = renderEmailHtml({ to: "a@b.co", subject: "You're verified on ProofPocket", text: "First paragraph.\n\nSecond one\nwith a line break." }, WEB);
    expect(html).toContain("<h1");
    expect(html).toContain("You&#39;re verified on ProofPocket");
    expect(html).toContain("First paragraph.</p>");
    expect(html).toContain("Second one<br>with a line break.</p>");
    expect(html.startsWith("<!doctype html>")).toBe(true);
    // Every style attribute stays closed: no double quote inside style="…".
    expect(html).not.toMatch(/style="[^"]*font-family:\s*"/);
  });

  it("escapes anything that could be HTML", () => {
    const html = renderEmailHtml({ to: "a@b.co", subject: "<b>x</b>", text: `Spaza "Mama's" <script>alert(1)</script> & co` }, WEB);
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>x</b>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp; co");
  });

  it("shows the action as a button and drops the paragraph that is only its link", () => {
    const html = renderEmailHtml({ to: "a@b.co", subject: "S", text: `You're in.\n\n${WEB}/app`, action: { label: "Open ProofPocket", url: `${WEB}/app` } }, WEB);
    expect(html).toContain(`href="${WEB}/app"`);
    expect(html).toContain("Open ProofPocket</a>");
    expect(html.match(new RegExp(`${WEB}/app`, "g"))).toHaveLength(2); // the button and the "or copy this link" line
  });

  it("links web addresses in the text without swallowing the full stop after them", () => {
    const html = renderEmailHtml({ to: "a@b.co", subject: "S", text: `Sign in at ${WEB}/sign-in. Then set it up.` }, WEB);
    expect(html).toContain(`<a href="${WEB}/sign-in"`);
    expect(html).toContain(`${WEB}/sign-in</a>. Then set it up.`);
  });

  it("has the safety reminder and links home in the footer", () => {
    const html = renderEmailHtml({ to: "a@b.co", subject: "S", text: "Body." }, WEB);
    expect(html).toContain("ProofPocket will never phone you or message you to ask for your password or a code.");
    expect(html).toContain(`href="${WEB}"`);
  });

  it("only links http and https addresses", () => {
    const html = renderEmailHtml({ to: "a@b.co", subject: "S", text: "Click javascript:alert(1) now", action: { label: "Go", url: "javascript:alert(1)" } }, WEB);
    expect(html).not.toContain('href="javascript:');
  });
});
