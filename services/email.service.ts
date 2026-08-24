import nodemailer from 'nodemailer';
import { prisma } from '@/lib/prisma';
import { normalizeEmail } from '@/lib/security';

export type EmailProviderType = 'BREVO_SLOT_1' | 'BREVO_SLOT_2' | 'SMTP' | 'DEV_MOCK';

export interface SendEmailOptions {
  recipient: string;
  type: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  organizationId?: string | null;
}

export interface SendEmailResult {
  success: boolean;
  logId?: string;
  provider?: EmailProviderType;
  messageId?: string;
  error?: string;
}

/**
 * Execute Brevo transactional email API call
 */
async function sendViaBrevo(
  apiKey: string,
  senderName: string,
  senderEmail: string,
  recipient: string,
  subject: string,
  htmlContent: string,
  textContent: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey.trim(),
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: recipient }],
        subject,
        htmlContent,
        textContent,
      }),
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return { success: true, messageId: data.messageId || 'brevo-dispatched' };
    } else {
      const errData = await res.json().catch(() => ({}));
      return {
        success: false,
        error: `Brevo HTTP ${res.status}: ${errData.message || res.statusText}`,
      };
    }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Brevo network exception' };
  }
}

/**
 * Execute Nodemailer SMTP call
 */
async function sendViaSmtp(
  recipient: string,
  subject: string,
  htmlContent: string,
  textContent: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER || process.env.SMTP_EMAIL || '';
  const pass = (process.env.SMTP_PASS || process.env.SMTP_PASSWORD || '').replace(/\s+/g, '');
  const from = process.env.EMAIL_FROM || (user ? `ShiftGuard <${user}>` : 'ShiftGuard Notifications <noreply@shiftguard.com>');

  if (!user || !pass) {
    return { success: false, error: 'SMTP credentials not configured.' };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
    });

    const info = await transporter.sendMail({
      from,
      to: recipient,
      subject,
      text: textContent,
      html: htmlContent,
    });

    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    return { success: false, error: err?.message || 'SMTP dispatch error' };
  }
}

/**
 * High-resilience email dispatcher with environment-aware routing
 * - On Localhost / Development: Uses SMTP (Gmail Nodemailer) as Tier 1 primary provider.
 * - In Production: Uses Brevo API (Slot 1 & Slot 2) as Tier 1 primary provider, fallback to SMTP.
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const normalizedRecipient = normalizeEmail(options.recipient);
  const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.SMTP_EMAIL || 'noreply@shiftguard.com';
  const senderName = process.env.BREVO_SENDER_NAME || 'ShiftGuard';

  // 1. Create initial PENDING EmailLog in DB
  let emailLog: any = null;
  try {
    emailLog = await prisma.emailLog.create({
      data: {
        organizationId: options.organizationId ?? null,
        recipient: normalizedRecipient,
        type: options.type,
        subject: options.subject,
        status: 'PENDING',
      },
    });
  } catch (dbErr) {
    console.error('Failed to create initial EmailLog in DB:', dbErr);
  }

  let finalSuccess = false;
  let finalProvider: EmailProviderType = 'DEV_MOCK';
  let finalMessageId: string | undefined;
  let finalError: string | undefined;

  const key1 = process.env.BREVO_API_KEY;
  const key2 = process.env.BREVO_API_KEY_2;
  const hasSmtpConfig = !!(process.env.SMTP_USER || process.env.SMTP_EMAIL) && !!(process.env.SMTP_PASS || process.env.SMTP_PASSWORD);
  const preferSmtp = process.env.EMAIL_PROVIDER === 'smtp' || hasSmtpConfig;

  if (preferSmtp) {
    // -----------------------------------------------------------------------
    // ROUTING: PRIMARY SMTP -> BREVO SLOT 1 -> BREVO SLOT 2 -> MOCK
    // -----------------------------------------------------------------------

    // Tier 1: SMTP Nodemailer
    const rSmtp = await sendViaSmtp(
      normalizedRecipient,
      options.subject,
      options.htmlContent,
      options.textContent
    );

    if (rSmtp.success) {
      finalSuccess = true;
      finalProvider = 'SMTP';
      finalMessageId = rSmtp.messageId;
      console.log(`✉️ [SMTP DISPATCH SUCCESS] From: ${process.env.EMAIL_FROM || process.env.SMTP_USER || 'ShiftGuard'} | To: ${normalizedRecipient} | MessageID: ${rSmtp.messageId}`);
    } else {
      finalError = `SMTP failed: ${rSmtp.error}`;

      // Tier 2: Brevo Slot 1 Fallback
      if (key1 && key1.trim().length > 10) {
        const r1 = await sendViaBrevo(key1, senderName, senderEmail, normalizedRecipient, options.subject, options.htmlContent, options.textContent);
        if (r1.success) {
          finalSuccess = true;
          finalProvider = 'BREVO_SLOT_1';
          finalMessageId = r1.messageId;
          finalError = undefined;
          console.log(`✉️ [BREVO SLOT 1 SUCCESS] Sent to: ${normalizedRecipient} | MessageID: ${r1.messageId}`);
        } else {
          finalError += ` | Slot 1 failed: ${r1.error}`;
        }
      }

      // Tier 3: Brevo Slot 2 Fallback
      if (!finalSuccess && key2 && key2.trim().length > 10) {
        const r2 = await sendViaBrevo(key2, senderName, senderEmail, normalizedRecipient, options.subject, options.htmlContent, options.textContent);
        if (r2.success) {
          finalSuccess = true;
          finalProvider = 'BREVO_SLOT_2';
          finalMessageId = r2.messageId;
          finalError = undefined;
          console.log(`✉️ [BREVO SLOT 2 SUCCESS] Sent to: ${normalizedRecipient} | MessageID: ${r2.messageId}`);
        } else {
          finalError += ` | Slot 2 failed: ${r2.error}`;
        }
      }
    }
  } else {
    // -----------------------------------------------------------------------
    // ROUTING: BREVO SLOT 1 -> BREVO SLOT 2 -> SMTP
    // -----------------------------------------------------------------------

    // Tier 1: Brevo Slot 1
    if (key1 && key1.trim().length > 10) {
      const r1 = await sendViaBrevo(key1, senderName, senderEmail, normalizedRecipient, options.subject, options.htmlContent, options.textContent);
      if (r1.success) {
        finalSuccess = true;
        finalProvider = 'BREVO_SLOT_1';
        finalMessageId = r1.messageId;
        console.log(`✉️ [BREVO SLOT 1 SUCCESS] Sent to: ${normalizedRecipient} | MessageID: ${r1.messageId}`);
      } else {
        finalError = `Slot 1 failed: ${r1.error}`;
      }
    }

    // Tier 2: Brevo Slot 2
    if (!finalSuccess && key2 && key2.trim().length > 10) {
      const r2 = await sendViaBrevo(key2, senderName, senderEmail, normalizedRecipient, options.subject, options.htmlContent, options.textContent);
      if (r2.success) {
        finalSuccess = true;
        finalProvider = 'BREVO_SLOT_2';
        finalMessageId = r2.messageId;
        finalError = undefined;
        console.log(`✉️ [BREVO SLOT 2 SUCCESS] Sent to: ${normalizedRecipient} | MessageID: ${r2.messageId}`);
      } else {
        finalError = `${finalError ? finalError + ' | ' : ''}Slot 2 failed: ${r2.error}`;
      }
    }

    // Tier 3: SMTP Fallback
    if (!finalSuccess) {
      const rSmtp = await sendViaSmtp(normalizedRecipient, options.subject, options.htmlContent, options.textContent);
      if (rSmtp.success) {
        finalSuccess = true;
        finalProvider = 'SMTP';
        finalMessageId = rSmtp.messageId;
        finalError = undefined;
        console.log(`✉️ [SMTP DISPATCH SUCCESS] Sent to: ${normalizedRecipient} | MessageID: ${rSmtp.messageId}`);
      } else {
        finalError = `${finalError ? finalError + ' | ' : ''}SMTP failed: ${rSmtp.error}`;
      }
    }
  }

  if (!finalSuccess) {
    console.error(`❌ [EMAIL DISPATCH FAILED] To: ${normalizedRecipient} | Reason: ${finalError || 'Unknown provider error'}`);
  }

  // Tier 4: Dev Fallback if no provider worked in development mode
  if (!finalSuccess && process.env.NODE_ENV !== 'production') {
    console.log(`\n======================================================`);
    console.log(`[DEV EMAIL MOCK DISPATCH]`);
    console.log(`To: ${normalizedRecipient}`);
    console.log(`Type: ${options.type}`);
    console.log(`Subject: ${options.subject}`);
    console.log(`------------------------------------------------------`);
    console.log(options.textContent);
    console.log(`======================================================\n`);
    finalSuccess = true;
    finalProvider = 'DEV_MOCK';
    finalMessageId = `mock-${Date.now()}`;
  }

  // Update EmailLog in DB with result
  if (emailLog) {
    try {
      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: {
          status: finalSuccess ? 'SENT' : 'FAILED',
          providerMessageId: finalMessageId ?? null,
          failureReason: finalError ?? null,
          sentAt: finalSuccess ? new Date() : null,
        },
      });
    } catch (updateErr) {
      console.error('Failed to update EmailLog in DB:', updateErr);
    }
  }

  return {
    success: finalSuccess,
    logId: emailLog?.id,
    provider: finalProvider,
    messageId: finalMessageId,
    error: finalError,
  };
}
