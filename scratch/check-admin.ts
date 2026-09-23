import { prisma } from '../lib/prisma';

async function main() {
  const users = await prisma.user.findMany({
    where: { role: 'SUPER_ADMIN' },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
    },
  });
  console.log('--- SUPER ADMIN USERS IN DB ---');
  console.log(JSON.stringify(users, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
