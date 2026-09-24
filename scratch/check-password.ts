import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function checkSuperAdminPassword() {
  const admin = await prisma.user.findFirst({
    where: { email: 'doctorbooksystem@gmail.com', role: 'SUPER_ADMIN' },
  });

  if (!admin) {
    console.log('Super Admin user NOT found!');
    return;
  }

  console.log('Found Super Admin:', admin.email);

  const testPass1 = '12345';
  const testPass2 = 'ShiftGuard@2026';
  const testPass3 = 'SuperAdminPass@2026';

  console.log('Test "12345":', await bcrypt.compare(testPass1, admin.passwordHash));
  console.log('Test "ShiftGuard@2026":', await bcrypt.compare(testPass2, admin.passwordHash));
  console.log('Test "SuperAdminPass@2026":', await bcrypt.compare(testPass3, admin.passwordHash));

  await prisma.$disconnect();
}

checkSuperAdminPassword().catch(console.error);
