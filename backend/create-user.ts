import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createUser() {
  const email = 'admin@aquaflow.com';
  const password = 'admin123';
  const name = 'Admin User';
  const role = 'admin';

  try {
    // Check if user exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.log(`User ${email} already exists`);
      // Update password for existing user
      const passwordHash = await bcrypt.hash(password, 12);
      await prisma.user.update({
        where: { email },
        data: { passwordHash },
      });
      console.log(`✅ Password updated for ${email}`);
      console.log(`   Email: ${email}`);
      console.log(`   Password: ${password}`);
    } else {
      // Create new user
      const passwordHash = await bcrypt.hash(password, 12);
      await prisma.user.create({
        data: {
          email,
          name,
          passwordHash,
          role,
        },
      });
      console.log(`✅ User created successfully!`);
      console.log(`   Email: ${email}`);
      console.log(`   Password: ${password}`);
      console.log(`   Role: ${role}`);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createUser();
