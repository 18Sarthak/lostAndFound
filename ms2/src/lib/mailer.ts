// src/lib/mailer.ts
// Mailer interface + two implementations: Resend (production) and Console (dev/fallback).
import { env } from '../config/env.js';
import { logger } from './logger.js';

export interface MailPayload {
  to: string;
  subject: string;
  html: string;
}

export interface Mailer {
  send(payload: MailPayload): Promise<void>;
}

// ── Console mailer (dev/no-key fallback) ─────────────────────────────────────
class ConsoleMailer implements Mailer {
  async send(payload: MailPayload): Promise<void> {
    logger.info(
      { to: payload.to, subject: payload.subject },
      '📧 [DEV MAILER] Email would be sent (set RESEND_API_KEY for real delivery)',
    );
    // Extract and prominently print the OTP code from the HTML
    const codeMatch = payload.html.match(/>\s*(\d{6})\s*</)?.[1];
    if (codeMatch) {
      logger.info(
        { email: payload.to },
        `\n\n  ╔══════════════════════════╗\n  ║  OTP CODE: ${codeMatch}       ║\n  ╚══════════════════════════╝\n`,
      );
    } else {
      logger.info({ preview: payload.html.replace(/<[^>]+>/g, ' ').trim().slice(0, 300) }, 'Email content');
    }
  }
}

// ── Resend mailer factory (async, ESM-safe) ───────────────────────────────────
async function createResendMailer(apiKey: string): Promise<Mailer> {
  const { Resend } = await import('resend');
  const resend = new Resend(apiKey);
  return {
    async send(payload: MailPayload) {
      const { error } = await resend.emails.send({
        from: env.MAIL_FROM,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
      });
      if (error) throw new Error(`Resend error: ${error.message}`);
    },
  };
}

// Mailer singleton — lazily initialised on first send
let _mailer: Mailer | null = null;

async function getMailer(): Promise<Mailer> {
  if (_mailer) return _mailer;
  if (env.RESEND_API_KEY) {
    try {
      _mailer = await createResendMailer(env.RESEND_API_KEY);
      return _mailer;
    } catch {
      logger.warn('Failed to initialise Resend mailer, falling back to console');
    }
  }
  _mailer = new ConsoleMailer();
  return _mailer;
}

/** Send an email. Uses Resend if RESEND_API_KEY is set, otherwise console. */
export const mailer: Mailer = {
  async send(payload: MailPayload): Promise<void> {
    const m = await getMailer();
    return m.send(payload);
  },
};

// ── Email templates ────────────────────────────────────────────────────────────
export function otpEmailHtml(code: string, expiryMinutes: number): string {
  return `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #1a1a2e;">Your Lost &amp; Found verification code</h2>
  <p>Use the code below to sign in. It expires in <strong>${expiryMinutes} minutes</strong>.</p>
  <div style="background: #f4f4f8; border-radius: 8px; padding: 24px; text-align: center; font-size: 32px; letter-spacing: 8px; font-weight: bold; color: #1a1a2e;">
    ${code}
  </div>
  <p style="color: #666; font-size: 12px; margin-top: 24px;">
    If you did not request this code, you can safely ignore this email.
  </p>
</body>
</html>`;
}

export function notificationEmailHtml(title: string, body: string, link?: string): string {
  return `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #1a1a2e;">${title}</h2>
  <p>${body}</p>
  ${link ? `<a href="${link}" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #6c63ff; color: white; border-radius: 6px; text-decoration: none;">View Details</a>` : ''}
</body>
</html>`;
}
