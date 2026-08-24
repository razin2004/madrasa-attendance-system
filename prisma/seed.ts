import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding ShiftGuard Database for Phase 1...');

  const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL || 'doctorbooksystem@gmail.com').toLowerCase().trim();
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdminPass@2026';
  const superAdminName = process.env.SUPER_ADMIN_NAME || 'ShiftGuard Super Admin';

  const existingSuperAdmin = await prisma.user.findFirst({
    where: {
      email: superAdminEmail,
      role: 'SUPER_ADMIN',
    },
  });

  const passwordHash = await bcrypt.hash(superAdminPassword, 10);

  if (!existingSuperAdmin) {
    const admin = await prisma.user.create({
      data: {
        name: superAdminName,
        email: superAdminEmail,
        passwordHash,
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        mustChangePassword: false,
      },
    });
    console.log(`✅ Super Admin created: ${admin.email} (ID: ${admin.id})`);
  } else {
    // Update password hash to match current env
    await prisma.user.update({
      where: { id: existingSuperAdmin.id },
      data: {
        passwordHash,
        name: superAdminName,
        status: 'ACTIVE',
      },
    });
    console.log(`ℹ️ Super Admin updated: ${existingSuperAdmin.email}`);
  }

  console.log('🌱 Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
