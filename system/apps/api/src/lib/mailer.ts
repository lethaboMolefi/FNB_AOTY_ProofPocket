// Outgoing email. Production sends through Gmail SMTP with an app password; development prints to the log.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import nodemailer from "nodemailer";
import type { Logger } from "pino";
import type { Config } from "../config";

export interface Mail { to: string; subject: string; text: string }
export interface Mailer { send(mail: Mail): Promise<void> }

export function createMailer(config: Config, log: Logger): Mailer {
  if (config.MAIL_MODE === "file") {
    // Tests read the latest email (and its PIN) from this folder. Created on each send in case it was cleared.
    return {
      async send(mail) {
        mkdirSync(config.MAIL_DIR, { recursive: true });
        const name = `${Date.now()}-${mail.to.replace(/[^a-z0-9@.]/gi, "_")}.json`;
        writeFileSync(join(config.MAIL_DIR, name), JSON.stringify(mail));
      },
    };
  }
  if (config.MAIL_MODE === "console") {
    return {
      async send(mail) {
        // Development only (refused in production by config): lets you sign in without a mailbox.
        log.info({ to: mail.to, subject: mail.subject }, `[mail] ${mail.text}`);
      },
    };
  }
  const transport = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_PORT === 465,
    auth: { user: config.SMTP_USER, pass: config.SMTP_PASS },
  });
  return {
    // Emails are notifications: a mail outage is logged and must not fail the request that triggered it.
    async send(mail) {
      try {
        await transport.sendMail({ from: config.MAIL_FROM, to: mail.to, subject: mail.subject, text: mail.text });
      } catch (err) {
        log.warn({ subject: mail.subject, err: (err as Error).message }, "email not sent");
      }
    },
  };
}

/** Records every email in memory. Used by the API tests. */
export function memoryMailer(): Mailer & { sent: Mail[] } {
  const sent: Mail[] = [];
  return { sent, async send(mail) { sent.push(mail); } };
}
