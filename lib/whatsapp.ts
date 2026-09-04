/**
 * WhatsApp Helper Utilities for ShiftGuard Staff Onboarding & Credentials Sharing
 */

export function formatWhatsAppPhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, '');
  if (!digits || digits.length < 7) return null;
  return digits;
}

export function openWhatsAppInvite({
  phone,
  staffName,
  orgName,
  organizationCode,
  staffId,
  email,
  activationUrl,
}: {
  phone?: string | null;
  staffName: string;
  orgName?: string;
  organizationCode: string;
  staffId: string;
  email: string;
  activationUrl?: string;
}) {
  const cleanPhone = formatWhatsAppPhone(phone);
  
  let msg = `Hello ${staffName},\n\nWelcome to ${orgName || organizationCode}! Your staff account has been set up on ShiftGuard.\n\n• Organization Code: ${organizationCode}\n• Staff ID: ${staffId}\n• Login Email: ${email}`;

  if (activationUrl) {
    msg += `\n\nPlease click the link below to set up your password:\n${activationUrl}\n\n(Link is valid for 24 hours)`;
  } else {
    msg += `\n\nPlease check your email (${email}) for your password setup invitation link.`;
  }

  const encodedMsg = encodeURIComponent(msg);
  const waUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodedMsg}`
    : `https://api.whatsapp.com/send?text=${encodedMsg}`;

  if (typeof window !== 'undefined') {
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  }
}

export function openWhatsAppPasswordShare({
  phone,
  staffName,
  orgName,
  organizationCode,
  staffId,
  email,
  newPassword,
}: {
  phone?: string | null;
  staffName: string;
  orgName?: string;
  organizationCode: string;
  staffId: string;
  email: string;
  newPassword?: string;
}) {
  const cleanPhone = formatWhatsAppPhone(phone);
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const loginUrl = `${origin}/login`;

  const msg = `Hello ${staffName},\n\nYour ShiftGuard account password for ${orgName || organizationCode} has been updated by your organization administrator.\n\n• Organization Code: ${organizationCode}\n• Staff ID: ${staffId}\n• Login Email: ${email}\n• New Password: ${newPassword || '********'}\n\nLogin Portal: ${loginUrl}`;

  const encodedMsg = encodeURIComponent(msg);
  const waUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodedMsg}`
    : `https://api.whatsapp.com/send?text=${encodedMsg}`;

  if (typeof window !== 'undefined') {
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  }
}
