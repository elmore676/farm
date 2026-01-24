import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createTestUsers() {
  const users = [
    {
      email: 'admin@aquaflow.com',
      password: 'admin123',
      name: 'Admin User',
      role: 'admin' as const,
    },
    {
      email: 'manager@aquaflow.com',
      password: 'manager123',
      name: 'Manager User',
      role: 'manager' as const,
    },
    {
      email: 'viewer@aquaflow.com',
      password: 'viewer123',
      name: 'Viewer User',
      role: 'viewer' as const,
    },
  ];

  for (const userData of users) {
    try {
      const existing = await prisma.user.findUnique({ where: { email: userData.email } });
      const passwordHash = await bcrypt.hash(userData.password, 12);

      if (existing) {
        await prisma.user.update({
          where: { email: userData.email },
          data: { passwordHash, name: userData.name, role: userData.role },
        });
        console.log(`✅ Updated: ${userData.email} (${userData.role})`);
      } else {
        await prisma.user.create({
          data: {
            email: userData.email,
            name: userData.name,
            passwordHash,
            role: userData.role,
          },
        });
        console.log(`✅ Created: ${userData.email} (${userData.role})`);
      }
      console.log(`   Password: ${userData.password}`);
    } catch (error) {
      console.error(`❌ Error for ${userData.email}:`, error);
    }
  }

  await prisma.$disconnect();
}

createTestUsers();
