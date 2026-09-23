import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: 'doctorbooksystem@gmail.com', role: 'SUPER_ADMIN' },
  });

  if (!user) {
    console.log('User not found');
    return;
  }

  console.log('Checking passwords for:', user.email);
  const testPasswords = ['ShiftGuard@2026', '12345', 'SuperAdminPass@2026', 'admin'];

  for (const pass of testPasswords) {
    const match = await bcrypt.compare(pass, user.passwordHash);
    console.log(`Password "${pass}": ${match ? '✅ MATCH!' : '❌ Incorrect'}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
