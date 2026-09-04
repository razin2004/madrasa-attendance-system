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
    const cleanApiKey = apiKey.trim();
    const cleanRecipient = recipient.trim().toLowerCase();
    const cleanSenderEmail = senderEmail.trim().toLowerCase();
    const cleanSenderName = senderName.trim() || 'ShiftGuard';

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': cleanApiKey,
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: cleanSenderName, email: cleanSenderEmail },
        to: [{ email: cleanRecipient }],
        subject,
        htmlContent,
        textContent,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      return { success: true, messageId: data.messageId || 'brevo-dispatched' };
    } else {
      const errorDetail = data.message || data.code || res.statusText;
      const formattedErr = `Brevo HTTP ${res.status}: ${errorDetail}`;
      console.error(`❌ [BREVO API ERROR] ${formattedErr} (Sender: ${cleanSenderEmail})`);
      return { success: false, error: formattedErr };
    }
  } catch (err: any) {
    const excMsg = err?.message || 'Brevo network exception';
    console.error(`❌ [BREVO EXCEPTION] ${excMsg}`);
    return { success: false, error: excMsg };
  }
}

/**
 * Execute Nodemailer SMTP call (Gmail / Brevo SMTP / Custom SMTP)
 */
async function sendViaSmtp(
  recipient: string,
  subject: string,
  htmlContent: string,
  textContent: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = (process.env.SMTP_USER || process.env.SMTP_EMAIL || '').trim();
  const pass = (process.env.SMTP_PASS || process.env.SMTP_PASSWORD || '').replace(/\s+/g, '');
  const from = process.env.EMAIL_FROM || (user ? `ShiftGuard <${user}>` : 'ShiftGuard Notifications <noreply@shiftguard.com>');

  if (!user || !pass) {
    return { success: false, error: 'SMTP credentials (SMTP_USER & SMTP_PASS) not set in environment.' };
  }

  try {
    const isSecure = port === 465;
    const transportOpts: any = {
      host,
      port,
      secure: isSecure,
      auth: { user, pass },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    };

    if (host.includes('gmail.com')) {
      transportOpts.service = 'gmail';
    } else if (!isSecure && port === 587) {
      transportOpts.requireTLS = true;
    }

    const transporter = nodemailer.createTransport(transportOpts);

    const info = await transporter.sendMail({
      from,
      to: recipient,
      subject,
      text: textContent,
      html: htmlContent,
    });

    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    const smtpErr = err?.message || 'SMTP dispatch failure';
    console.error(`❌ [SMTP DISPATCH ERROR] ${smtpErr} (Host: ${host}:${port}, User: ${user})`);
    return { success: false, error: smtpErr };
  }
}

/**
 * High-resilience email dispatcher with environment-aware routing & multi-tier fallbacks
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  if (!options || !options.recipient || typeof options.recipient !== 'string' || !options.recipient.trim().includes('@')) {
    console.error('❌ [EMAIL DISPATCH ERROR] Invalid or missing recipient email:', options?.recipient);
    return { success: false, error: 'Invalid or missing recipient email address.' };
  }
  if (!options.subject || !options.subject.trim()) {
    console.error('❌ [EMAIL DISPATCH ERROR] Missing email subject for recipient:', options.recipient);
    return { success: false, error: 'Email subject is required.' };
  }
  if (!options.htmlContent || !options.htmlContent.trim()) {
    console.error('❌ [EMAIL DISPATCH ERROR] Missing email HTML content for recipient:', options.recipient);
    return { success: false, error: 'Email HTML content is required.' };
  }

  const normalizedRecipient = normalizeEmail(options.recipient);
  const senderEmail = (
    process.env.BREVO_SENDER_EMAIL ||
    process.env.SMTP_USER ||
    process.env.SMTP_EMAIL ||
    'noreply@shiftguard.com'
  ).trim();
  const senderName = (process.env.BREVO_SENDER_NAME || 'ShiftGuard').trim();

  // 1. Create initial PENDING EmailLog in DB
  let emailLog: any = null;
  try {
    emailLog = await prisma.emailLog.create({
      data: {
        organizationId: options.organizationId ?? null,
        recipient: normalizedRecipient,
        type: options.type || 'TRANSACTIONAL',
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

  const key1 = process.env.BREVO_API_KEY?.trim();
  const key2 = process.env.BREVO_API_KEY_2?.trim();
  const hasBrevo1 = Boolean(key1 && key1.length > 10);
  const hasBrevo2 = Boolean(key2 && key2.length > 10);
  const hasSmtpConfig = Boolean(
    (process.env.SMTP_USER || process.env.SMTP_EMAIL) &&
    (process.env.SMTP_PASS || process.env.SMTP_PASSWORD)
  );

  const isDev = process.env.NODE_ENV !== 'production';
  const forcedProvider = process.env.EMAIL_PROVIDER?.trim().toLowerCase();

  // Order of Provider Execution
  // - If forcedProvider === 'smtp', try SMTP first
  // - If forcedProvider === 'brevo', try Brevo 1 & 2 first
  // - In Local Running (Development): Default to SMTP if configured, then Brevo 1 & 2
  // - In Real Running (Production): Default to Brevo 1 & 2, then SMTP fallback
  const providerOrder: ('BREVO_1' | 'BREVO_2' | 'SMTP')[] = [];

  if (forcedProvider === 'smtp') {
    if (hasSmtpConfig) providerOrder.push('SMTP');
    if (hasBrevo1) providerOrder.push('BREVO_1');
    if (hasBrevo2) providerOrder.push('BREVO_2');
  } else if (forcedProvider === 'brevo') {
    if (hasBrevo1) providerOrder.push('BREVO_1');
    if (hasBrevo2) providerOrder.push('BREVO_2');
    if (hasSmtpConfig) providerOrder.push('SMTP');
  } else if (isDev) {
    // Local environment: SMTP takes priority if set up
    if (hasSmtpConfig) providerOrder.push('SMTP');
    if (hasBrevo1) providerOrder.push('BREVO_1');
    if (hasBrevo2) providerOrder.push('BREVO_2');
  } else {
    // Production environment: Brevo API takes top priority
    if (hasBrevo1) providerOrder.push('BREVO_1');
    if (hasBrevo2) providerOrder.push('BREVO_2');
    if (hasSmtpConfig) providerOrder.push('SMTP');
  }

  const attemptedErrors: string[] = [];

  for (const provider of providerOrder) {
    if (finalSuccess) break;

    if (provider === 'BREVO_1' && key1) {
      const r = await sendViaBrevo(
        key1,
        senderName,
        senderEmail,
        normalizedRecipient,
        options.subject,
        options.htmlContent,
        options.textContent
      );
      if (r.success) {
        finalSuccess = true;
        finalProvider = 'BREVO_SLOT_1';
        finalMessageId = r.messageId;
        console.log(`✉️ [BREVO SLOT 1 SUCCESS] Sent to: ${normalizedRecipient} | MessageID: ${r.messageId}`);
      } else {
        attemptedErrors.push(`Brevo Slot 1: ${r.error}`);
      }
    } else if (provider === 'BREVO_2' && key2) {
      const r = await sendViaBrevo(
        key2,
        senderName,
        senderEmail,
        normalizedRecipient,
        options.subject,
        options.htmlContent,
        options.textContent
      );
      if (r.success) {
        finalSuccess = true;
        finalProvider = 'BREVO_SLOT_2';
        finalMessageId = r.messageId;
        console.log(`✉️ [BREVO SLOT 2 SUCCESS] Sent to: ${normalizedRecipient} | MessageID: ${r.messageId}`);
      } else {
        attemptedErrors.push(`Brevo Slot 2: ${r.error}`);
      }
    } else if (provider === 'SMTP') {
      const r = await sendViaSmtp(
        normalizedRecipient,
        options.subject,
        options.htmlContent,
        options.textContent
      );
      if (r.success) {
        finalSuccess = true;
        finalProvider = 'SMTP';
        finalMessageId = r.messageId;
        console.log(`✉️ [SMTP SUCCESS] Sent to: ${normalizedRecipient} | MessageID: ${r.messageId}`);
      } else {
        attemptedErrors.push(`SMTP: ${r.error}`);
      }
    }
  }

  if (!finalSuccess) {
    finalError = attemptedErrors.length > 0
      ? attemptedErrors.join(' | ')
      : 'No active email providers configured in environment (Set SMTP_USER/SMTP_PASS or BREVO_API_KEY).';

    console.error(`❌ [EMAIL DISPATCH FAILED] To: ${normalizedRecipient} | Errors: ${finalError}`);

    // Dev mode fallback to console log mock to avoid breaking local workflow if SMTP/Brevo is absent
    if (isDev) {
      finalSuccess = true;
      finalProvider = 'DEV_MOCK';
      console.log(`[DEV MOCK EMAIL DISPATCH] To: ${normalizedRecipient} | Subject: ${options.subject}`);
    }
  }

  // 2. Update DB EmailLog status
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
    } catch (dbErr) {
      console.error('Failed to update EmailLog in DB:', dbErr);
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
