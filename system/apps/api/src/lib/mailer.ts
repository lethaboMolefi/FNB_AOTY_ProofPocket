// Outgoing email. Production sends through Gmail SMTP with an app password; development prints to the log.
import nodemailer from "nodemailer";
import type { Logger } from "pino";
import type { Config } from "../config";

export interface Mail { to: string; subject: string; text: string }
export interface Mailer { send(mail: Mail): Promise<void> }

export function createMailer(config: Config, log: Logger): Mailer {
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
    async send(mail) {
      await transport.sendMail({ from: config.MAIL_FROM, to: mail.to, subject: mail.subject, text: mail.text });
    },
  };
}

/** Records every email in memory. Used by the API tests. */
export function memoryMailer(): Mailer & { sent: Mail[] } {
  const sent: Mail[] = [];
  return { sent, async send(mail) { sent.push(mail); } };
}
