import { PrismaClient, Role } from '@prisma/client';
import { hashPassword } from '../src/utils/password';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting user seed...');

  // Create Admin User
  const adminEmail = 'admin@aquaflow.com';
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: 'Admin User',
      email: adminEmail,
      passwordHash: await hashPassword('admin123'),
      role: Role.admin,
    },
  });
  console.log('✅ Admin user created:', admin.email);

  // Create Manager User
  const managerEmail = 'manager@aquaflow.com';
  const manager = await prisma.user.upsert({
    where: { email: managerEmail },
    update: {},
    create: {
      name: 'Farm Manager',
      email: managerEmail,
      passwordHash: await hashPassword('manager123'),
      role: Role.manager,
    },
  });
  console.log('✅ Manager user created:', manager.email);

  // Create Viewer User
  const viewerEmail = 'viewer@aquaflow.com';
  const viewer = await prisma.user.upsert({
    where: { email: viewerEmail },
    update: {},
    create: {
      name: 'Viewer User',
      email: viewerEmail,
      passwordHash: await hashPassword('viewer123'),
      role: Role.viewer,
    },
  });
  console.log('✅ Viewer user created:', viewer.email);

  // Create Additional Test Users (viewers)
  const testUser1 = await prisma.user.upsert({
    where: { email: 'john@example.com' },
    update: {},
    create: {
      name: 'John Doe',
      email: 'john@example.com',
      passwordHash: await hashPassword('password123'),
      role: Role.viewer,
    },
  });
  console.log('✅ Test user 1 created:', testUser1.email);

  const testUser2 = await prisma.user.upsert({
    where: { email: 'jane@example.com' },
    update: {},
    create: {
      name: 'Jane Smith',
      email: 'jane@example.com',
      passwordHash: await hashPassword('password123'),
      role: Role.viewer,
    },
  });
  console.log('✅ Test user 2 created:', testUser2.email);

  console.log('🎉 User seeding completed successfully!');
  console.log('\n📝 Login credentials:');
  console.log('Admin    - Email: admin@aquaflow.com    | Password: admin123');
  console.log('Manager  - Email: manager@aquaflow.com  | Password: manager123');
  console.log('Viewer   - Email: viewer@aquaflow.com   | Password: viewer123');
  console.log('Test 1   - Email: john@example.com      | Password: password123');
  console.log('Test 2   - Email: jane@example.com      | Password: password123');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding users:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
