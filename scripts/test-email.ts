import { sendEmail } from '../services/email.service';

async function testLiveEmail() {
  console.log('Testing live email delivery...');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('EMAIL_PROVIDER:', process.env.EMAIL_PROVIDER);
  console.log('BREVO_API_KEY set:', !!process.env.BREVO_API_KEY);
  console.log('SMTP_EMAIL:', process.env.SMTP_EMAIL);

  const result = await sendEmail({
    recipient: 'doctorbooksystem@gmail.com',
    type: 'TEST_EMAIL',
    subject: 'ShiftGuard Live Email Test',
    htmlContent: '<h3>ShiftGuard Live Email Test</h3><p>If you receive this email, live email delivery is working correctly!</p>',
    textContent: 'ShiftGuard Live Email Test - If you receive this email, live email delivery is working correctly!',
  });

  console.log('\nResult:', JSON.stringify(result, null, 2));
}

testLiveEmail().catch(console.error);
