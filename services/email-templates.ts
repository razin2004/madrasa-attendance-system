/**
 * Reusable HTML and Plaintext email templates for ShiftGuard
 * Enforces unified design system, dark mode card aesthetic, clear CTAs, and zero-trust security notices.
 */

export interface EmailTemplatePayload {
  subject: string;
  html: string;
  text: string;
}

const BRAND_NAME = 'ShiftGuard';

function emailWrapper(title: string, bodyContent: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #030712; color: #f9fafb; margin: 0; padding: 32px 16px; }
    .container { max-width: 600px; margin: 0 auto; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
    .header { background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); padding: 32px 28px; text-align: center; border-bottom: 1px solid #3730a3; }
    .logo { font-size: 24px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff; text-transform: uppercase; margin: 0; }
    .subtitle { font-size: 12px; font-weight: 600; color: #a5f3fc; letter-spacing: 0.8px; text-transform: uppercase; margin-top: 6px; }
    .content { padding: 36px 28px; color: #cbd5e1; line-height: 1.65; font-size: 14.5px; }
    .title { color: #ffffff; font-size: 22px; font-weight: 800; margin-top: 0; margin-bottom: 18px; letter-spacing: -0.4px; }
    .box { background-color: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 22px; margin: 24px 0; }
    .credential-item { margin-bottom: 14px; font-size: 14px; }
    .credential-item:last-child { margin-bottom: 0; }
    .credential-label { color: #94a3b8; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 3px; }
    .credential-value { color: #38bdf8; font-weight: 700; font-family: monospace; font-size: 16px; word-break: break-all; }
    .otp-code { font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #38bdf8; text-align: center; font-family: monospace; padding: 14px 0; }
    .btn { display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%); color: #ffffff !important; text-decoration: none; font-weight: 700; font-size: 15px; padding: 13px 30px; border-radius: 10px; text-align: center; margin: 18px 0; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.4); }
    .btn-secondary { display: inline-block; background: rgba(255, 255, 255, 0.08); color: #f1f5f9 !important; border: 1px solid #334155; text-decoration: none; font-weight: 600; font-size: 14px; padding: 11px 24px; border-radius: 8px; text-align: center; margin: 12px 0; }
    .badge { display: inline-block; font-size: 11px; font-weight: 700; color: #fbbf24; background-color: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); padding: 4px 10px; border-radius: 9999px; }
    .badge-success { color: #34d399; background-color: rgba(16, 185, 129, 0.15); border-color: rgba(16, 185, 129, 0.3); }
    .badge-danger { color: #fb7185; background-color: rgba(244, 63, 94, 0.15); border-color: rgba(244, 63, 94, 0.3); }
    .footer { padding: 24px 28px; background-color: #030712; border-top: 1px solid #1e293b; text-align: center; font-size: 12px; color: #64748b; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="logo">${BRAND_NAME}</h1>
      <div class="subtitle">Workforce &amp; Attendance Infrastructure</div>
    </div>
    <div class="content">
      ${bodyContent}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ShiftGuard Systems Inc. All rights reserved.</p>
      <p>Automated transactional security notification. Do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
`;
}

/**
 * 1A. Applicant Confirmation Email (Sent to Contact Person immediately after public registration)
 */
export function templateOrgRegistrationApplicantConfirmation(data: {
  orgName: string;
  organizationCode: string;
  contactPersonName: string;
  contactEmail: string;
  submittedAt: string;
}): EmailTemplatePayload {
  const subject = `ShiftGuard — Registration Received: ${data.orgName}`;
  const html = emailWrapper(
    'Registration Received',
    `
    <h2 class="title">Registration Received</h2>
    <p>Hello <strong>${data.contactPersonName}</strong>,</p>
    <p>Thank you for registering <strong>${data.orgName}</strong> with ShiftGuard.</p>
    <p>Your organization registration request has been successfully submitted and is currently awaiting review by our platform administration team.</p>

    <div class="box">
      <div class="credential-item">
        <div class="credential-label">Organization Name</div>
        <div class="credential-value" style="color: #ffffff;">${data.orgName}</div>
      </div>
      <div class="credential-item">
        <div class="credential-label">Organization Code</div>
        <div class="credential-value" style="color: #818cf8;">${data.organizationCode}</div>
      </div>
      <div class="credential-item">
        <div class="credential-label">Status</div>
        <div><span class="badge">Pending Review</span></div>
      </div>
      <div class="credential-item" style="margin-top: 10px;">
        <div class="credential-label">Submitted At</div>
        <div style="color: #94a3b8; font-size: 13px;">${data.submittedAt}</div>
      </div>
    </div>

    <h4 style="color: #ffffff; font-size: 15px; margin: 20px 0 8px 0;">What happens next?</h4>
    <p style="margin-bottom: 20px;">
      Our administrator will review your submitted organization credentials. Once your registration is reviewed and approved, we will notify you by email with your account activation and login instructions.
    </p>

    <p style="color: #94a3b8; font-size: 13px; margin: 0;">
      You do not need to take any further action at this time.
    </p>
    `
  );

  const text = `
SHIFTGUARD — REGISTRATION RECEIVED

Hello ${data.contactPersonName},

Thank you for registering ${data.orgName} with ShiftGuard.

Your organization registration request has been successfully submitted and is currently awaiting review.

Organization: ${data.orgName}
Organization Code: ${data.organizationCode}
Status: Pending Review
Submitted At: ${data.submittedAt}

What happens next:
Our administrator will review your registration. Once approved, you will receive an email with instructions to activate your administrator account.
  `.trim();

  return { subject, html, text };
}

/**
 * 1B. Super Admin Notification Email (Sent to Super Admin after public registration)
 */
export function templateOrgRegistrationReceived(data: {
  orgName: string;
  organizationCode?: string | null;
  contactPersonName: string;
  contactEmail: string;
  phone: string;
  submittedAt: string;
  reviewUrl: string;
}): EmailTemplatePayload {
  const subject = `ShiftGuard — New Organization Registration: ${data.orgName}`;
  const html = emailWrapper(
    'New Organization Registration Request',
    `
    <h2 class="title">New Organization Registration Request</h2>
    <p>An organization has submitted a registration request and is awaiting your review in the Super Admin Console.</p>

    <div class="box">
      <div class="credential-item">
        <div class="credential-label">Organization Name</div>
        <div class="credential-value" style="color: #ffffff;">${data.orgName}</div>
      </div>
      ${
        data.organizationCode
          ? `
      <div class="credential-item">
        <div class="credential-label">Requested Code</div>
        <div class="credential-value" style="color: #818cf8;">${data.organizationCode}</div>
      </div>
      `
          : ''
      }
      <div class="credential-item">
        <div class="credential-label">Contact Person</div>
        <div class="credential-value" style="color: #f1f5f9;">${data.contactPersonName}</div>
      </div>
      <div class="credential-item">
        <div class="credential-label">Contact Email</div>
        <div class="credential-value" style="color: #38bdf8;">${data.contactEmail}</div>
      </div>
      <div class="credential-item">
        <div class="credential-label">Contact Phone</div>
        <div class="credential-value" style="color: #f1f5f9;">${data.phone}</div>
      </div>
      <div class="credential-item">
        <div class="credential-label">Submitted At</div>
        <div style="color: #94a3b8; font-size: 13px;">${data.submittedAt}</div>
      </div>
      <div class="credential-item">
        <div class="credential-label">Status</div>
        <div><span class="badge">Pending Review</span></div>
      </div>
    </div>

    <div style="text-align: center;">
      <a href="${data.reviewUrl}" class="btn">Review Registration &rarr;</a>
    </div>
    `
  );

  const text = `
SHIFTGUARD — NEW ORGANIZATION REGISTRATION REQUEST

An organization has submitted a registration request and is awaiting your review.

Organization: ${data.orgName}
Requested Code: ${data.organizationCode || 'N/A'}
Contact Person: ${data.contactPersonName}
Contact Email: ${data.contactEmail}
Contact Phone: ${data.phone}
Submitted At: ${data.submittedAt}
Status: Pending Review

Review Registration:
${data.reviewUrl}
  `.trim();

  return { subject, html, text };
}

/**
 * 2A. Approval Confirmation Email (Email 1 sent to Contact Person upon Super Admin approval)
 */
export function templateOrgApprovedConfirmation(data: {
  orgName: string;
  organizationCode: string;
  contactPersonName: string;
}): EmailTemplatePayload {
  const subject = `ShiftGuard — Organization Registration Approved: ${data.orgName}`;
  const html = emailWrapper(
    'Organization Approved',
    `
    <h2 class="title" style="color: #34d399;">Registration Approved! 🎉</h2>
    <p>Hello <strong>${data.contactPersonName}</strong>,</p>
    <p>Good news — your registration request for <strong>${data.orgName}</strong> has been officially approved by ShiftGuard administration.</p>

    <div class="box" style="border-left: 4px solid #10b981;">
      <div class="credential-item">
        <div class="credential-label">Organization Name</div>
        <div class="credential-value" style="color: #ffffff;">${data.orgName}</div>
      </div>
      <div class="credential-item">
        <div class="credential-label">Organization Code</div>
        <div class="credential-value" style="color: #34d399;">${data.organizationCode}</div>
      </div>
      <div class="credential-item">
        <div class="credential-label">Status</div>
        <div><span class="badge badge-success">Approved &amp; Active</span></div>
      </div>
    </div>

    <p style="margin: 20px 0; font-size: 15px;">
      Your administrator account is now ready for setup.
    </p>

    <div style="background-color: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.3); padding: 16px; border-radius: 10px; margin: 20px 0;">
      <p style="color: #818cf8; font-size: 13.5px; margin: 0;">
        ✉️ <strong>Next Step:</strong> You will receive a separate email containing your secure password setup link and login instructions.
      </p>
    </div>
    `
  );

  const text = `
SHIFTGUARD — ORGANIZATION REGISTRATION APPROVED

Hello ${data.contactPersonName},

Good news — your registration request for ${data.orgName} has been approved.

Organization: ${data.orgName}
Organization Code: ${data.organizationCode}
Status: Approved & Active

Your administrator account is now ready for setup. You will receive a separate email containing your secure password setup link and login information.
  `.trim();

  return { subject, html, text };
}

/**
 * 2B. Password Setup & Login Email (Email 2 sent immediately after approval)
 */
export function templateOrgAdminPasswordSetup(data: {
  orgName: string;
  organizationCode: string;
  contactPersonName: string;
  adminEmail: string;
  setupUrl: string;
  loginUrl: string;
  expiresInHours: number;
}): EmailTemplatePayload {
  const subject = `ShiftGuard — Create Your Administrator Password`;
  const html = emailWrapper(
    'Complete Administrator Setup',
    `
    <h2 class="title">Complete Your Administrator Account</h2>
    <p>Hello <strong>${data.contactPersonName}</strong>,</p>
    <p>Your organization <strong>${data.orgName}</strong> has been approved. Create a secure password for your ShiftGuard administrator account to get started.</p>

    <div class="box" style="border-left: 4px solid #818cf8;">
      <div class="credential-item">
        <div class="credential-label">Organization Name</div>
        <div class="credential-value" style="color: #ffffff;">${data.orgName}</div>
      </div>
      <div class="credential-item">
        <div class="credential-label">Organization Code</div>
        <div class="credential-value" style="color: #818cf8;">${data.organizationCode}</div>
      </div>
      <div class="credential-item">
        <div class="credential-label">Administrator Account Email</div>
        <div class="credential-value" style="color: #38bdf8;">${data.adminEmail}</div>
      </div>
    </div>

    <div style="text-align: center; margin: 24px 0 16px 0;">
      <a href="${data.setupUrl}" class="btn">Create Your Password &rarr;</a>
    </div>

    <p style="text-align: center; font-size: 13.5px; color: #cbd5e1; margin-bottom: 20px;">
      After creating your password, you can sign in anytime at:<br />
      <a href="${data.loginUrl}" style="color: #818cf8; font-weight: 700; text-decoration: none;">${data.loginUrl}</a>
    </p>

    <div style="background-color: rgba(244, 63, 94, 0.08); border: 1px solid rgba(244, 63, 94, 0.25); padding: 14px 18px; border-radius: 10px; margin-top: 20px;">
      <p style="color: #fb7185; font-size: 12.5px; margin: 0;">
        🔒 <strong>Security notice:</strong> This password setup link is personalized, temporary (valid for ${data.expiresInHours} hours), and can only be used once. Do not share this link with anyone.
      </p>
    </div>
    `
  );

  const text = `
SHIFTGUARD — CREATE YOUR ADMINISTRATOR PASSWORD

Hello ${data.contactPersonName},

Your organization ${data.orgName} has been approved.

Create a secure password for your ShiftGuard administrator account to get started:

Organization: ${data.orgName}
Organization Code: ${data.organizationCode}
Account Email: ${data.adminEmail}

1. Create Your Password:
${data.setupUrl}

2. Sign In to ShiftGuard:
${data.loginUrl}

Security notice: This password setup link is valid for ${data.expiresInHours} hours and can only be used once.
  `.trim();

  return { subject, html, text };
}

/**
 * 3. Organization Rejection Email (Sent to Contact Person)
 */
export function templateOrgRegistrationRejected(data: {
  orgName: string;
  contactPersonName: string;
  rejectionReason?: string | null;
}): EmailTemplatePayload {
  const subject = `ShiftGuard — Update on Your Organization Registration`;
  const html = emailWrapper(
    'Registration Update',
    `
    <h2 class="title">Organization Registration Update</h2>
    <p>Hello <strong>${data.contactPersonName}</strong>,</p>
    <p>Thank you for submitting a registration application for <strong>${data.orgName}</strong>.</p>
    <p>After reviewing the submitted details, we regret to inform you that we are unable to approve your application at this time.</p>

    <div class="box" style="border-left: 4px solid #f43f5e;">
      <div class="credential-item">
        <div class="credential-label">Organization Name</div>
        <div class="credential-value" style="color: #ffffff;">${data.orgName}</div>
      </div>
      <div class="credential-item">
        <div class="credential-label">Status</div>
        <div><span class="badge badge-danger">Not Approved</span></div>
      </div>
      ${
        data.rejectionReason
          ? `
      <div class="credential-item" style="margin-top: 12px;">
        <div class="credential-label">Reason / Feedback</div>
        <div style="color: #fb7185; font-size: 13.5px; font-weight: 600;">${data.rejectionReason}</div>
      </div>
      `
          : ''
      }
    </div>

    <p style="color: #94a3b8; font-size: 13.5px;">
      If you believe this decision was made in error or if you have updated verification information, please contact ShiftGuard support or submit a new registration.
    </p>
    `
  );

  const text = `
SHIFTGUARD — UPDATE ON YOUR ORGANIZATION REGISTRATION

Hello ${data.contactPersonName},

Thank you for submitting a registration application for ${data.orgName}.

After careful review, we regret to inform you that your application could not be approved at this time.

Organization: ${data.orgName}
Status: Not Approved
${data.rejectionReason ? `Reason: ${data.rejectionReason}\n` : ''}

If you have questions, please reach out to our platform support team.
  `.trim();

  return { subject, html, text };
}

/**
 * 4. Super Admin Login OTP Verification
 */
export function templateSuperAdminOTP(data: {
  otpCode: string;
  expiresInMinutes: number;
  adminName: string;
}): EmailTemplatePayload {
  const subject = `ShiftGuard — Your Verification Code: ${data.otpCode}`;
  const html = emailWrapper(
    'Verification Code',
    `
    <h2 class="title">Your Verification Code</h2>
    <p>Hello <strong>${data.adminName}</strong>,</p>
    <p>Your ShiftGuard verification code is:</p>

    <div class="box" style="text-align: center;">
      <div class="credential-label">One-Time Security Code</div>
      <div class="otp-code">${data.otpCode}</div>
      <p style="color: #94a3b8; font-size: 13px; margin-top: 6px;">
        This code expires in <strong>${data.expiresInMinutes} minutes</strong>. Single-use only.
      </p>
    </div>

    <p style="color: #fb7185; font-size: 13px;">
      🔒 For your security, do not share this code with anyone. If you did not request this code, you can safely ignore this email.
    </p>
    `
  );

  const text = `
SHIFTGUARD — YOUR VERIFICATION CODE

Hello ${data.adminName},

Your ShiftGuard verification code is: ${data.otpCode}

This code expires in ${data.expiresInMinutes} minutes.
For your security, do not share this code with anyone.
  `.trim();

  return { subject, html, text };
}

/**
 * 5. Staff Account Setup Email (Sent when Org Admin creates staff account)
 */
export function templateStaffActivationInvitation(data: {
  staffName: string;
  orgName: string;
  activationUrl: string;
  expiresInHours: number;
}): EmailTemplatePayload {
  const subject = `ShiftGuard — Create Your Staff Account Password`;
  const html = emailWrapper(
    'Staff Account Setup',
    `
    <h2 class="title">Welcome to ${data.orgName}! 🎉</h2>
    <p>Hello <strong>${data.staffName}</strong>,</p>
    <p>Your ShiftGuard staff account has been created by your organization administrator.</p>
    <p>Please click the button below to set up your secure password and access your workspace profile:</p>

    <div class="box" style="text-align: center; border-left: 4px solid #818cf8;">
      <div class="credential-label">Account Setup &amp; Password Creation</div>
      <p style="color: #cbd5e1; font-size: 13.5px; margin: 12px 0 20px 0;">
        This setup link is personalized for you and valid for <strong>${data.expiresInHours} hours</strong>.
      </p>
      <a href="${data.activationUrl}" class="btn" style="margin: 0 auto;">Create Your Password &rarr;</a>
    </div>

    <p style="font-size: 12.5px; color: #94a3b8;">
      🔒 ShiftGuard never emails plaintext passwords. Do not share this link with anyone.
    </p>
    `
  );

  const text = `
SHIFTGUARD — STAFF ACCOUNT SETUP

Hello ${data.staffName},

Your ShiftGuard staff account at ${data.orgName} has been created.

Create your password to activate your account:
${data.activationUrl}

This link is valid for ${data.expiresInHours} hours.
  `.trim();

  return { subject, html, text };
}

/**
 * 6. Password Reset Link Email
 */
export function templatePasswordResetLink(data: {
  userName: string;
  resetUrl: string;
  expiresInMinutes: number;
}): EmailTemplatePayload {
  const subject = `ShiftGuard — Reset Your Password`;
  const html = emailWrapper(
    'Reset Your Password',
    `
    <h2 class="title">Reset Your Password</h2>
    <p>Hello <strong>${data.userName}</strong>,</p>
    <p>We received a request to reset your ShiftGuard account password.</p>

    <div class="box" style="text-align: center; border-left: 4px solid #38bdf8;">
      <div class="credential-label">Secure Password Reset</div>
      <p style="color: #cbd5e1; font-size: 13.5px; margin: 12px 0 20px 0;">
        Click the button below to set a new password. Valid for <strong>${data.expiresInMinutes} minutes</strong>.
      </p>
      <a href="${data.resetUrl}" class="btn" style="margin: 0 auto;">Reset Password &rarr;</a>
    </div>

    <p style="font-size: 12.5px; color: #94a3b8;">
      If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
    </p>
    `
  );

  const text = `
SHIFTGUARD — RESET YOUR PASSWORD

Hello ${data.userName},

We received a request to reset your ShiftGuard password.

Reset Password:
${data.resetUrl}

This link expires in ${data.expiresInMinutes} minutes. If you did not request this, please ignore this email.
  `.trim();

  return { subject, html, text };
}

/**
 * 7. Leave Request Submitted (Sent to Org Admin)
 */
export function templateLeaveRequestSubmitted(data: {
  orgName: string;
  staffName: string;
  staffId: string;
  leaveType: string;
  dateRange: string;
  daysCount: number;
  reason: string;
  reviewUrl: string;
}): EmailTemplatePayload {
  const subject = `ShiftGuard — Leave Request: ${data.staffName} (${data.leaveType})`;
  const html = emailWrapper(
    'New Leave Request',
    `
    <h2 class="title">New Leave Request Submitted</h2>
    <p>A staff member has submitted a leave request in <strong>${data.orgName}</strong>:</p>

    <div class="box">
      <div class="credential-item">
        <div class="credential-label">Staff Member</div>
        <div class="credential-value" style="color: #ffffff;">${data.staffName} (${data.staffId})</div>
      </div>
      <div class="credential-item">
        <div class="credential-label">Leave Type</div>
        <div class="credential-value" style="color: #818cf8;">${data.leaveType}</div>
      </div>
      <div class="credential-item">
        <div class="credential-label">Dates Requested</div>
        <div class="credential-value" style="color: #38bdf8;">${data.dateRange} (${data.daysCount} days)</div>
      </div>
      <div class="credential-item">
        <div class="credential-label">Reason</div>
        <div style="color: #cbd5e1; font-size: 14px;">${data.reason}</div>
      </div>
    </div>

    <div style="text-align: center;">
      <a href="${data.reviewUrl}" class="btn">Review Leave Request &rarr;</a>
    </div>
    `
  );

  const text = `
SHIFTGUARD — LEAVE REQUEST SUBMITTED

Staff Member: ${data.staffName} (${data.staffId})
Leave Type: ${data.leaveType}
Dates: ${data.dateRange} (${data.daysCount} days)
Reason: ${data.reason}

Review Request:
${data.reviewUrl}
  `.trim();

  return { subject, html, text };
}

/**
 * 8. Leave Request Approved (Sent to Staff)
 */
export function templateLeaveApproved(data: {
  orgName: string;
  staffName: string;
  leaveType: string;
  dateRange: string;
  daysCount: number;
  reviewerComment?: string | null;
  loginUrl: string;
}): EmailTemplatePayload {
  const subject = `ShiftGuard — Leave Request Approved: ${data.dateRange}`;
  const html = emailWrapper(
    'Leave Request Approved',
    `
    <h2 class="title" style="color: #34d399;">Leave Request Approved ✓</h2>
    <p>Hello <strong>${data.staffName}</strong>,</p>
    <p>Your leave request at <strong>${data.orgName}</strong> has been approved by your administrator.</p>

    <div class="box" style="border-left: 4px solid #10b981;">
      <div class="credential-item">
        <div class="credential-label">Leave Type</div>
        <div class="credential-value" style="color: #34d399;">${data.leaveType}</div>
      </div>
      <div class="credential-item">
        <div class="credential-label">Approved Dates</div>
        <div class="credential-value" style="color: #ffffff;">${data.dateRange} (${data.daysCount} days)</div>
      </div>
      ${
        data.reviewerComment
          ? `
      <div class="credential-item">
        <div class="credential-label">Admin Notes</div>
        <div style="color: #cbd5e1; font-size: 13.5px;">${data.reviewerComment}</div>
      </div>
      `
          : ''
      }
    </div>

    <div style="text-align: center;">
      <a href="${data.loginUrl}" class="btn">Open Staff Workspace &rarr;</a>
    </div>
    `
  );

  const text = `
SHIFTGUARD — LEAVE REQUEST APPROVED

Hello ${data.staffName},

Your leave request for ${data.dateRange} (${data.leaveType}) at ${data.orgName} has been approved.
${data.reviewerComment ? `Notes: ${data.reviewerComment}\n` : ''}

Sign in to your portal:
${data.loginUrl}
  `.trim();

  return { subject, html, text };
}

/**
 * 9. Leave Request Rejected (Sent to Staff)
 */
export function templateLeaveRejected(data: {
  orgName: string;
  staffName: string;
  leaveType: string;
  dateRange: string;
  rejectionReason?: string | null;
  loginUrl: string;
}): EmailTemplatePayload {
  const subject = `ShiftGuard — Leave Request Update: ${data.dateRange}`;
  const html = emailWrapper(
    'Leave Request Update',
    `
    <h2 class="title" style="color: #fb7185;">Leave Request Not Approved</h2>
    <p>Hello <strong>${data.staffName}</strong>,</p>
    <p>Your leave request at <strong>${data.orgName}</strong> for <strong>${data.dateRange}</strong> was not approved.</p>

    ${
      data.rejectionReason
        ? `
    <div class="box" style="border-left: 4px solid #f43f5e;">
      <div class="credential-label" style="color: #fb7185;">Feedback / Reason</div>
      <div style="color: #cbd5e1; font-size: 13.5px;">${data.rejectionReason}</div>
    </div>
    `
        : ''
    }

    <div style="text-align: center;">
      <a href="${data.loginUrl}" class="btn">Open Staff Workspace &rarr;</a>
    </div>
    `
  );

  const text = `
SHIFTGUARD — LEAVE REQUEST UPDATE

Hello ${data.staffName},

Your leave request for ${data.dateRange} (${data.leaveType}) at ${data.orgName} was not approved.
${data.rejectionReason ? `Reason: ${data.rejectionReason}\n` : ''}

Sign in to view details:
${data.loginUrl}
  `.trim();

  return { subject, html, text };
}

/**
 * 10. Manual Leave Recorded by Admin (Sent to Staff)
 */
export function templateAdminManualLeave(data: {
  orgName: string;
  staffName: string;
  leaveType: string;
  dateRange: string;
  daysCount: number;
  reason: string;
  adminName: string;
  loginUrl: string;
}): EmailTemplatePayload {
  const subject = `ShiftGuard — Notice: Leave Recorded by Administrator`;
  const html = emailWrapper(
    'Leave Recorded by Administrator',
    `
    <h2 class="title">Leave Recorded by Administrator</h2>
    <p>Hello <strong>${data.staffName}</strong>,</p>
    <p>An administrator (<strong>${data.adminName}</strong>) has recorded leave for your account at <strong>${data.orgName}</strong>:</p>

    <div class="box" style="border-left: 4px solid #818cf8;">
      <div class="credential-item">
        <div class="credential-label">Leave Type</div>
        <div class="credential-value" style="color: #818cf8;">${data.leaveType}</div>
      </div>
      <div class="credential-item">
        <div class="credential-label">Dates Recorded</div>
        <div class="credential-value" style="color: #ffffff;">${data.dateRange} (${data.daysCount} days)</div>
      </div>
      <div class="credential-item">
        <div class="credential-label">Reason</div>
        <div style="color: #cbd5e1; font-size: 13.5px;">${data.reason}</div>
      </div>
    </div>

    <div style="text-align: center;">
      <a href="${data.loginUrl}" class="btn">Open Staff Workspace &rarr;</a>
    </div>
    `
  );

  const text = `
SHIFTGUARD — LEAVE RECORDED BY ADMIN

Hello ${data.staffName},

An administrator (${data.adminName}) recorded leave for your account at ${data.orgName}:
Leave Type: ${data.leaveType}
Dates: ${data.dateRange} (${data.daysCount} days)
Reason: ${data.reason}

View your schedule:
${data.loginUrl}
  `.trim();

  return { subject, html, text };
}

/**
 * 11. Attendance Correction Request Submitted (Sent to Org Admin)
 */
export function templateCorrectionRequestSubmitted(data: {
  orgName: string;
  staffName: string;
  staffId: string;
  type: string;
  date: string;
  requestedTime: string;
  reason: string;
  reviewUrl: string;
}): EmailTemplatePayload {
  const subject = `ShiftGuard — Attendance Correction: ${data.staffName} (${data.date})`;
  const html = emailWrapper(
    'Attendance Correction Request',
    `
    <h2 class="title">Attendance Correction Request</h2>
    <p>A staff member has requested an attendance adjustment at <strong>${data.orgName}</strong>:</p>

    <div class="box">
      <div class="credential-item">
        <div class="credential-label">Staff Member</div>
        <div class="credential-value" style="color: #ffffff;">${data.staffName} (${data.staffId})</div>
      </div>
      <div class="credential-item">
        <div class="credential-label">Correction Type</div>
        <div class="credential-value" style="color: #38bdf8;">${data.type}</div>
      </div>
      <div class="credential-item">
        <div class="credential-label">Target Date</div>
        <div class="credential-value" style="color: #f1f5f9;">${data.date}</div>
      </div>
      <div class="credential-item">
        <div class="credential-label">Requested Time</div>
        <div class="credential-value" style="color: #818cf8;">${data.requestedTime}</div>
      </div>
      <div class="credential-item">
        <div class="credential-label">Reason</div>
        <div style="color: #cbd5e1; font-size: 13.5px;">${data.reason}</div>
      </div>
    </div>

    <div style="text-align: center;">
      <a href="${data.reviewUrl}" class="btn">Review Correction Request &rarr;</a>
    </div>
    `
  );

  const text = `
SHIFTGUARD — ATTENDANCE CORRECTION REQUEST

Staff: ${data.staffName} (${data.staffId})
Type: ${data.type}
Date: ${data.date}
Requested Time: ${data.requestedTime}
Reason: ${data.reason}

Review Request:
${data.reviewUrl}
  `.trim();

  return { subject, html, text };
}

/**
 * 12. Attendance Correction Approved (Sent to Staff)
 */
export function templateCorrectionApproved(data: {
  orgName: string;
  staffName: string;
  date: string;
  approvedTime: string;
  type: string;
  reviewerComment?: string | null;
  loginUrl: string;
}): EmailTemplatePayload {
  const subject = `ShiftGuard — Attendance Correction Approved: ${data.date}`;
  const html = emailWrapper(
    'Attendance Correction Approved',
    `
    <h2 class="title" style="color: #34d399;">Attendance Correction Approved ✓</h2>
    <p>Hello <strong>${data.staffName}</strong>,</p>
    <p>Your attendance correction request at <strong>${data.orgName}</strong> has been approved:</p>

    <div class="box" style="border-left: 4px solid #34d399;">
      <div class="credential-item">
        <div class="credential-label">Date</div>
        <div class="credential-value" style="color: #ffffff;">${data.date}</div>
      </div>
      <div class="credential-item">
        <div class="credential-label">Correction Type</div>
        <div class="credential-value" style="color: #38bdf8;">${data.type}</div>
      </div>
      <div class="credential-item">
        <div class="credential-label">Approved Time</div>
        <div class="credential-value" style="color: #34d399;">${data.approvedTime}</div>
      </div>
      ${
        data.reviewerComment
          ? `
      <div class="credential-item">
        <div class="credential-label">Reviewer Notes</div>
        <div style="color: #cbd5e1; font-size: 13.5px;">${data.reviewerComment}</div>
      </div>
      `
          : ''
      }
    </div>

    <div style="text-align: center;">
      <a href="${data.loginUrl}" class="btn">View Attendance Record &rarr;</a>
    </div>
    `
  );

  const text = `
SHIFTGUARD — ATTENDANCE CORRECTION APPROVED

Hello ${data.staffName},

Your attendance correction request for ${data.date} (${data.type}) at ${data.orgName} was approved: ${data.approvedTime}.
${data.reviewerComment ? `Notes: ${data.reviewerComment}\n` : ''}

View record:
${data.loginUrl}
  `.trim();

  return { subject, html, text };
}

/**
 * 13. Attendance Correction Rejected (Sent to Staff)
 */
export function templateCorrectionRejected(data: {
  orgName: string;
  staffName: string;
  date: string;
  type: string;
  rejectionReason: string;
  loginUrl: string;
}): EmailTemplatePayload {
  const subject = `ShiftGuard — Attendance Correction Update: ${data.date}`;
  const html = emailWrapper(
    'Attendance Correction Update',
    `
    <h2 class="title" style="color: #fb7185;">Attendance Correction Rejected</h2>
    <p>Hello <strong>${data.staffName}</strong>,</p>
    <p>Your attendance correction request at <strong>${data.orgName}</strong> for <strong>${data.date}</strong> was not approved.</p>

    <div class="box" style="border-left: 4px solid #f43f5e;">
      <div class="credential-item">
        <div class="credential-label">Date</div>
        <div class="credential-value" style="color: #ffffff;">${data.date}</div>
      </div>
      <div class="credential-item">
        <div class="credential-label">Reason for Rejection</div>
        <div style="color: #fb7185; font-size: 13.5px; font-weight: 600;">${data.rejectionReason}</div>
      </div>
    </div>

    <div style="text-align: center;">
      <a href="${data.loginUrl}" class="btn">Open Staff Workspace &rarr;</a>
    </div>
    `
  );

  const text = `
SHIFTGUARD — ATTENDANCE CORRECTION REJECTED

Hello ${data.staffName},

Your attendance correction request for ${data.date} at ${data.orgName} was rejected: ${data.rejectionReason}.

Open workspace:
${data.loginUrl}
  `.trim();

  return { subject, html, text };
}

/**
 * 14. Manual Attendance Added by Admin (Sent to Staff)
 */
export function templateAdminManualAttendanceCreated(data: {
  orgName: string;
  staffName: string;
  date: string;
  clockInTime: string;
  clockOutTime?: string | null;
  reason: string;
  adminName: string;
  loginUrl: string;
}): EmailTemplatePayload {
  const subject = `ShiftGuard — Notice: Manual Attendance Entry Added`;
  const html = emailWrapper(
    'Manual Attendance Entry',
    `
    <h2 class="title">Manual Attendance Entry Recorded</h2>
    <p>Hello <strong>${data.staffName}</strong>,</p>
    <p>An administrator (<strong>${data.adminName}</strong>) has added a manual attendance entry for your account at <strong>${data.orgName}</strong>:</p>

    <div class="box" style="border-left: 4px solid #f59e0b;">
      <div class="credential-item">
        <div class="credential-label">Date Recorded</div>
        <div class="credential-value" style="color: #ffffff;">${data.date}</div>
      </div>
      <div class="credential-item">
        <div class="credential-label">Hours</div>
        <div class="credential-value" style="color: #f59e0b;">${data.clockInTime}${data.clockOutTime ? ` — ${data.clockOutTime}` : ''} (MANUAL)</div>
      </div>
      <div class="credential-item">
        <div class="credential-label">Reason</div>
        <div style="color: #cbd5e1; font-size: 13.5px;">${data.reason}</div>
      </div>
    </div>

    <div style="text-align: center;">
      <a href="${data.loginUrl}" class="btn">View Attendance Record &rarr;</a>
    </div>
    `
  );

  const text = `
SHIFTGUARD — MANUAL ATTENDANCE ENTRY

Hello ${data.staffName},

An administrator (${data.adminName}) added a manual attendance entry for your account at ${data.orgName}:
Date: ${data.date}
Hours: ${data.clockInTime}${data.clockOutTime ? ` — ${data.clockOutTime}` : ''} (MANUAL)
Reason: ${data.reason}

View record:
${data.loginUrl}
  `.trim();

  return { subject, html, text };
}

/**
 * 22. Organization Email Change Request — OTP sent to NEW Email
 */
export function templateEmailChangeOTP(data: {
  orgName: string;
  newEmail: string;
  otpCode: string;
  expiresInMinutes: number;
}): EmailTemplatePayload {
  const subject = `ShiftGuard — Email Change Verification Code: ${data.otpCode}`;
  const html = emailWrapper(
    'Verify Email Change',
    `
    <h2 class="title">Verify New Email Address</h2>
    <p>You requested to update the official contact email address for <strong>${data.orgName}</strong> to <code>${data.newEmail}</code>.</p>
    
    <div class="box" style="text-align: center;">
      <div class="credential-label">6-Digit Verification Code</div>
      <div class="otp-code">${data.otpCode}</div>
      <p style="color: #94a3b8; font-size: 13px; margin-top: 6px;">
        This code expires in <strong>${data.expiresInMinutes} minutes</strong>.
      </p>
    </div>

    <p style="color: #94a3b8; font-size: 13px;">
      If you did not request this email change, please secure your account immediately.
    </p>
    `
  );

  const text = `
SHIFTGUARD — VERIFY NEW EMAIL ADDRESS

You requested to update the official contact email for ${data.orgName} to ${data.newEmail}.
Verification Code: ${data.otpCode}
This code expires in ${data.expiresInMinutes} minutes.
  `.trim();

  return { subject, html, text };
}

/**
 * 23. Organization Email Change Request — Security OTP sent to CURRENT (OLD) Email
 */
export function templateEmailChangeOldOTP(data: {
  orgName: string;
  oldEmail: string;
  newEmail: string;
  otpCode: string;
  expiresInMinutes: number;
}): EmailTemplatePayload {
  const subject = `ShiftGuard — Security Authorization Code (Current Email): ${data.otpCode}`;
  const html = emailWrapper(
    'Current Email Verification',
    `
    <h2 class="title">Current Email Authorization</h2>
    <p>A request was initiated to change the official contact email for <strong>${data.orgName}</strong> to <code>${data.newEmail}</code>.</p>

    <div class="box" style="text-align: center;">
      <div class="credential-label">Current Email Authorization Code</div>
      <div class="otp-code" style="color: #f59e0b;">${data.otpCode}</div>
      <p style="color: #94a3b8; font-size: 13px; margin-top: 6px;">
        This code sent to your current email (<code>${data.oldEmail}</code>) expires in <strong>${data.expiresInMinutes} minutes</strong>.
      </p>
    </div>

    <p style="color: #fb7185; font-size: 13px; font-weight: 600;">
      🔒 Enter this authorization code alongside the code sent to your new email to complete the update. If you did not authorize this change, please contact support immediately.
    </p>
    `
  );

  const text = `
SHIFTGUARD — CURRENT EMAIL AUTHORIZATION

A request was initiated to change the contact email for ${data.orgName} to ${data.newEmail}.
Current Email Authorization Code: ${data.otpCode}
Expires in ${data.expiresInMinutes} minutes.
  `.trim();

  return { subject, html, text };
}

/**
 * 24. Organization Email Change Success Confirmation — Sent to BOTH Emails
 */
export function templateEmailChangeSuccess(data: {
  orgName: string;
  oldEmail: string;
  newEmail: string;
}): EmailTemplatePayload {
  const subject = `ShiftGuard — Confirmation: Contact Email Updated for ${data.orgName}`;
  const html = emailWrapper(
    'Email Updated',
    `
    <h2 class="title">Contact Email Updated</h2>
    <p>The official contact email address for <strong>${data.orgName}</strong> has been successfully updated.</p>

    <div class="box">
      <div class="credential-item">
        <div class="credential-label">Previous Email</div>
        <div style="color: #94a3b8; font-size: 13.5px;">${data.oldEmail}</div>
      </div>
      <div class="credential-item">
        <div class="credential-label">New Official Email</div>
        <div style="color: #38bdf8; font-weight: 700; font-size: 14px;">${data.newEmail}</div>
      </div>
    </div>

    <p style="color: #34d399; font-size: 13.5px; font-weight: 600;">
      ✓ Verification complete. Future organization notifications will be sent to ${data.newEmail}.
    </p>
    `
  );

  const text = `
SHIFTGUARD — EMAIL UPDATED CONFIRMATION

The official contact email address for ${data.orgName} has been updated.
Previous Email: ${data.oldEmail}
New Official Email: ${data.newEmail}
  `.trim();

  return { subject, html, text };
}
