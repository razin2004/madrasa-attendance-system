import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUsers() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      organizationId: true,
      organization: {
        select: {
          organizationCode: true,
          name: true,
        },
      },
    },
  });

  console.log('=== ALL USERS IN DATABASE ===');
  console.table(users);
  await prisma.$disconnect();
}

checkUsers().catch(console.error);
