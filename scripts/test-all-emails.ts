import {
  templateOrgRegistrationApplicantConfirmation,
  templateOrgRegistrationReceived,
  templateOrgApprovedConfirmation,
  templateOrgAdminPasswordSetup,
  templateOrgRegistrationRejected,
  templateSuperAdminOTP,
  templateStaffActivationInvitation,
  templatePasswordResetLink,
  templateLeaveRequestSubmitted,
  templateLeaveApproved,
  templateLeaveRejected,
  templateAdminManualLeave,
  templateCorrectionRequestSubmitted,
  templateCorrectionApproved,
  templateCorrectionRejected,
  templateAdminManualAttendanceCreated,
  templateEmailChangeOTP,
  templateEmailChangeOldOTP,
  templateEmailChangeSuccess,
  EmailTemplatePayload,
} from '../services/email-templates';
import { sendEmail, SendEmailResult } from '../services/email.service';

interface TestEmailCase {
  id: string;
  type: string;
  name: string;
  getPayload: () => EmailTemplatePayload;
}

const testCases: TestEmailCase[] = [
  {
    id: '1',
    type: 'ORG_REGISTRATION_APPLICANT_CONFIRMATION',
    name: 'Org Registration Applicant Confirmation',
    getPayload: () =>
      templateOrgRegistrationApplicantConfirmation({
        orgName: 'Acme Test Corp',
        organizationCode: 'ACME01',
        contactPersonName: 'John Doe',
        contactEmail: 'john@acme.com',
        submittedAt: 'Sept 4, 2026, 2:00 PM',
      }),
  },
  {
    id: '2',
    type: 'ORG_REGISTRATION_RECEIVED',
    name: 'Org Registration Super Admin Notification',
    getPayload: () =>
      templateOrgRegistrationReceived({
        orgName: 'Acme Test Corp',
        organizationCode: 'ACME01',
        contactPersonName: 'John Doe',
        contactEmail: 'john@acme.com',
        phone: '+1 555-0199',
        submittedAt: 'Sept 4, 2026, 2:00 PM',
        reviewUrl: 'http://localhost:3000/super-admin/dashboard',
      }),
  },
  {
    id: '3',
    type: 'ORG_APPROVED_CONFIRMATION',
    name: 'Org Approved Confirmation',
    getPayload: () =>
      templateOrgApprovedConfirmation({
        orgName: 'Acme Test Corp',
        organizationCode: 'ACME01',
        contactPersonName: 'John Doe',
      }),
  },
  {
    id: '4',
    type: 'ORG_ADMIN_PASSWORD_SETUP',
    name: 'Org Admin Password Setup',
    getPayload: () =>
      templateOrgAdminPasswordSetup({
        orgName: 'Acme Test Corp',
        organizationCode: 'ACME01',
        contactPersonName: 'John Doe',
        adminEmail: 'john@acme.com',
        setupUrl: 'http://localhost:3000/activate-account?token=test-token-123',
        loginUrl: 'http://localhost:3000/ACME01/login',
        expiresInHours: 24,
      }),
  },
  {
    id: '5',
    type: 'ORG_REJECTED',
    name: 'Org Registration Rejected',
    getPayload: () =>
      templateOrgRegistrationRejected({
        orgName: 'Acme Test Corp',
        contactPersonName: 'John Doe',
        rejectionReason: 'Invalid documentation provided.',
      }),
  },
  {
    id: '6',
    type: 'SUPER_ADMIN_OTP',
    name: 'Super Admin OTP Verification',
    getPayload: () =>
      templateSuperAdminOTP({
        otpCode: '849201',
        expiresInMinutes: 5,
        adminName: 'Super Admin',
      }),
  },
  {
    id: '7',
    type: 'STAFF_ACTIVATION_INVITATION',
    name: 'Staff Account Setup Invitation',
    getPayload: () =>
      templateStaffActivationInvitation({
        staffName: 'Jane Smith',
        orgName: 'Acme Test Corp',
        activationUrl: 'http://localhost:3000/activate-account?token=staff-token-456',
        expiresInHours: 24,
      }),
  },
  {
    id: '8',
    type: 'PASSWORD_RESET',
    name: 'Password Reset Link',
    getPayload: () =>
      templatePasswordResetLink({
        userName: 'Jane Smith',
        resetUrl: 'http://localhost:3000/reset-password?token=reset-token-789',
        expiresInMinutes: 60,
      }),
  },
  {
    id: '9',
    type: 'LEAVE_REQUEST_SUBMITTED',
    name: 'Leave Request Submitted Notice',
    getPayload: () =>
      templateLeaveRequestSubmitted({
        orgName: 'Acme Test Corp',
        staffName: 'Jane Smith',
        staffId: 'STF-101',
        leaveType: 'ANNUAL',
        dateRange: '2026-09-10 to 2026-09-12',
        daysCount: 3,
        reason: 'Family vacation',
        reviewUrl: 'http://localhost:3000/ACME01/admin/leave/req-123',
      }),
  },
  {
    id: '10',
    type: 'LEAVE_APPROVED',
    name: 'Leave Request Approved Notice',
    getPayload: () =>
      templateLeaveApproved({
        orgName: 'Acme Test Corp',
        staffName: 'Jane Smith',
        leaveType: 'ANNUAL',
        dateRange: '2026-09-10 to 2026-09-12',
        daysCount: 3,
        reviewerComment: 'Approved, enjoy your vacation!',
        loginUrl: 'http://localhost:3000/ACME01/login',
      }),
  },
  {
    id: '11',
    type: 'LEAVE_REJECTED',
    name: 'Leave Request Rejected Notice',
    getPayload: () =>
      templateLeaveRejected({
        orgName: 'Acme Test Corp',
        staffName: 'Jane Smith',
        leaveType: 'ANNUAL',
        dateRange: '2026-09-10 to 2026-09-12',
        rejectionReason: 'Overlapping shift requirements.',
        loginUrl: 'http://localhost:3000/ACME01/login',
      }),
  },
  {
    id: '12',
    type: 'MANUAL_LEAVE_CREATED',
    name: 'Manual Leave Entry Notice',
    getPayload: () =>
      templateAdminManualLeave({
        orgName: 'Acme Test Corp',
        staffName: 'Jane Smith',
        leaveType: 'SICK',
        dateRange: '2026-09-04 to 2026-09-04',
        daysCount: 1,
        reason: 'Medical appointment',
        adminName: 'John Admin',
        loginUrl: 'http://localhost:3000/ACME01/login',
      }),
  },
  {
    id: '13',
    type: 'ATTENDANCE_CORRECTION_SUBMITTED',
    name: 'Attendance Correction Submitted',
    getPayload: () =>
      templateCorrectionRequestSubmitted({
        orgName: 'Acme Test Corp',
        staffName: 'Jane Smith',
        staffId: 'STF-101',
        type: 'CLOCK_IN',
        date: '2026-09-03',
        requestedTime: '08:30 to —',
        reason: 'Forgot to clock in on app.',
        reviewUrl: 'http://localhost:3000/ACME01/admin/attendance/corrections/corr-1',
      }),
  },
  {
    id: '14',
    type: 'ATTENDANCE_CORRECTION_APPROVED',
    name: 'Attendance Correction Approved',
    getPayload: () =>
      templateCorrectionApproved({
        orgName: 'Acme Test Corp',
        staffName: 'Jane Smith',
        date: '2026-09-03',
        type: 'CLOCK_IN',
        approvedTime: '08:30 to 17:00',
        reviewerComment: 'Verified via security log.',
        loginUrl: 'http://localhost:3000/ACME01/staff/attendance',
      }),
  },
  {
    id: '15',
    type: 'ATTENDANCE_CORRECTION_REJECTED',
    name: 'Attendance Correction Rejected',
    getPayload: () =>
      templateCorrectionRejected({
        orgName: 'Acme Test Corp',
        staffName: 'Jane Smith',
        date: '2026-09-03',
        type: 'CLOCK_IN',
        rejectionReason: 'No manager verification available.',
        loginUrl: 'http://localhost:3000/ACME01/staff/attendance',
      }),
  },
  {
    id: '16',
    type: 'MANUAL_ATTENDANCE_CREATED',
    name: 'Manual Attendance Punch Notice',
    getPayload: () =>
      templateAdminManualAttendanceCreated({
        orgName: 'Acme Test Corp',
        staffName: 'Jane Smith',
        date: '2026-09-03',
        clockInTime: '09:00',
        clockOutTime: '17:00',
        reason: 'Offsite deployment',
        adminName: 'John Admin',
        loginUrl: 'http://localhost:3000/ACME01/staff/attendance',
      }),
  },
  {
    id: '17',
    type: 'EMAIL_CHANGE_NEW_OTP',
    name: 'Email Change Verification Code (New Email)',
    getPayload: () =>
      templateEmailChangeOTP({
        orgName: 'Acme Test Corp',
        newEmail: 'newemail@acme.com',
        otpCode: '492018',
        expiresInMinutes: 15,
      }),
  },
  {
    id: '18',
    type: 'EMAIL_CHANGE_OLD_OTP',
    name: 'Email Change Authorization Code (Current Email)',
    getPayload: () =>
      templateEmailChangeOldOTP({
        orgName: 'Acme Test Corp',
        oldEmail: 'oldemail@acme.com',
        newEmail: 'newemail@acme.com',
        otpCode: '109482',
        expiresInMinutes: 15,
      }),
  },
  {
    id: '19',
    type: 'EMAIL_CHANGE_SUCCESS',
    name: 'Email Change Success Notice',
    getPayload: () =>
      templateEmailChangeSuccess({
        orgName: 'Acme Test Corp',
        oldEmail: 'oldemail@acme.com',
        newEmail: 'newemail@acme.com',
      }),
  },
];

async function runEmailTests() {
  console.log('----------------------------------------------------');
  console.log('🧪 Starting End-to-End Email Verification Suite');
  console.log('----------------------------------------------------');

  const testRecipient = process.argv[2] || process.env.TEST_EMAIL_RECIPIENT || 'test@example.com';
  const shouldDispatch = process.argv.includes('--send');

  console.log(`Target Recipient: ${testRecipient}`);
  console.log(`Mode: ${shouldDispatch ? 'LIVE DISPATCH (sendEmail)' : 'TEMPLATE RENDERING TEST ONLY (Pass --send to dispatch)'}`);
  console.log(`Total Email Templates: ${testCases.length}\n`);

  let renderedSuccessCount = 0;
  let dispatchSuccessCount = 0;

  for (const tc of testCases) {
    try {
      const payload = tc.getPayload();

      // Check payload validity
      if (!payload.subject || !payload.html || !payload.text) {
        throw new Error(`Template ${tc.name} generated incomplete payload.`);
      }

      renderedSuccessCount++;
      console.log(`✅ [RENDER OK] #${tc.id} ${tc.name} | Subject: "${payload.subject}"`);

      if (shouldDispatch) {
        const res: SendEmailResult = await sendEmail({
          recipient: testRecipient,
          type: tc.type,
          subject: payload.subject,
          htmlContent: payload.html,
          textContent: payload.text,
        });

        if (res.success) {
          dispatchSuccessCount++;
          console.log(`   └─ ✉️ [DISPATCH OK] Provider: ${res.provider} | LogID: ${res.logId}`);
        } else {
          console.error(`   └─ ❌ [DISPATCH FAILED] Error: ${res.error}`);
        }
      }
    } catch (err: any) {
      console.error(`❌ [FAILED] #${tc.id} ${tc.name}: ${err.message}`);
    }
  }

  console.log('\n----------------------------------------------------');
  console.log(`📊 Summary: ${renderedSuccessCount}/${testCases.length} Templates Rendered Successfully.`);
  if (shouldDispatch) {
    console.log(`✉️ Dispatch Summary: ${dispatchSuccessCount}/${testCases.length} Dispatched Successfully.`);
  }
  console.log('----------------------------------------------------');
}

runEmailTests().catch((err) => {
  console.error('Unhandled test runner error:', err);
  process.exit(1);
});
