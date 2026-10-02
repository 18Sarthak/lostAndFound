// prisma/seed.ts
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database…');

  // ── Categories ──────────────────────────────────────────────────────────────
  const categories = [
    { name: 'Phone', slug: 'phone', icon: '📱' },
    { name: 'Wallet', slug: 'wallet', icon: '👜' },
    { name: 'ID Card', slug: 'id-card', icon: '🪪' },
    { name: 'Keys', slug: 'keys', icon: '🔑' },
    { name: 'Bag', slug: 'bag', icon: '🎒' },
    { name: 'Bottle', slug: 'bottle', icon: '🍶' },
    { name: 'Books', slug: 'books', icon: '📚' },
    { name: 'Laptop / Electronics', slug: 'electronics', icon: '💻' },
    { name: 'Clothing', slug: 'clothing', icon: '👕' },
    { name: 'Jewellery', slug: 'jewellery', icon: '💍' },
    { name: 'Documents', slug: 'documents', icon: '📄' },
    { name: 'Other', slug: 'other', icon: '📦' },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }
  console.log(`✅ ${categories.length} categories seeded`);

  // ── Handover Points ─────────────────────────────────────────────────────────
  const handoverPoints = [
    {
      id: 'seed-hp-main-security-desk',
      name: 'Main Security Desk',
      description: 'Located at the main entrance of the campus',
      latitude: 12.9716,
      longitude: 77.5946,
      openingHours: 'Mon–Sun 8:00 AM – 8:00 PM',
    },
    {
      id: 'seed-hp-library-front-desk',
      name: 'Library Front Desk',
      description: 'Ground floor of the central library',
      latitude: 12.9726,
      longitude: 77.5956,
      openingHours: 'Mon–Sat 9:00 AM – 6:00 PM',
    },
    {
      id: 'seed-hp-student-affairs-office',
      name: 'Student Affairs Office',
      description: 'Block A, Room 101',
      latitude: 12.9706,
      longitude: 77.5936,
      openingHours: 'Mon–Fri 10:00 AM – 5:00 PM',
    },
  ];

  for (const hp of handoverPoints) {
    await prisma.handoverPoint.upsert({
      where: { id: hp.id },
      update: {},
      create: hp,
    });
  }
  console.log(`✅ ${handoverPoints.length} handover points seeded`);

  // ── Admin User ──────────────────────────────────────────────────────────────
  const adminEmail = 'admin@lostfound.local';
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: 'Platform Admin',
      emailVerified: true,
      role: 'ADMIN',
    },
  });
  console.log(`✅ Admin user: ${admin.email} (id: ${admin.id})`);

  // ── Sample Users ────────────────────────────────────────────────────────────
  const alice = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: { email: 'alice@example.com', name: 'Alice Smith', emailVerified: true },
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {},
    create: { email: 'bob@example.com', name: 'Bob Jones', emailVerified: true },
  });

  // ── Sample Items ────────────────────────────────────────────────────────────
  const phoneCat = await prisma.category.findUnique({ where: { slug: 'phone' } });
  const keysCat = await prisma.category.findUnique({ where: { slug: 'keys' } });
  const walletCat = await prisma.category.findUnique({ where: { slug: 'wallet' } });
  const mainDesk = await prisma.handoverPoint.findFirst({
    where: { name: 'Main Security Desk' },
  });

  if (phoneCat && keysCat && walletCat && mainDesk) {
    const existingItems = await prisma.item.count();
    if (existingItems === 0) {
      await prisma.item.createMany({
        data: [
          {
            type: 'LOST',
            status: 'ACTIVE',
            title: 'Lost black iPhone 14',
            description:
              'Lost my black iPhone 14 with a cracked screen protector near the cafeteria. Has a Marvel sticker on the back.',
            categoryId: phoneCat.id,
            locationName: 'Cafeteria, Block C',
            latitude: 12.9718,
            longitude: 77.5948,
            eventDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            expiresAt: new Date(Date.now() + 58 * 24 * 60 * 60 * 1000),
            userId: alice.id,
          },
          {
            type: 'FOUND',
            status: 'ACTIVE',
            title: 'Found a set of keys near Library',
            description:
              'Found a bunch of keys with a red keychain and a USB drive attached. Found near the library entrance.',
            categoryId: keysCat.id,
            locationName: 'Library Entrance',
            latitude: 12.9724,
            longitude: 77.5954,
            eventDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            verificationQuestion: 'What is attached to the keychain besides keys?',
            verificationAnswer: 'usb drive',
            handoverPointId: mainDesk.id,
            expiresAt: new Date(Date.now() + 59 * 24 * 60 * 60 * 1000),
            userId: bob.id,
          },
          {
            type: 'LOST',
            status: 'ACTIVE',
            title: 'Lost brown leather wallet',
            description:
              'Lost my brown leather wallet with student ID card, some cash, and two bank cards inside. Last seen in the computer lab.',
            categoryId: walletCat.id,
            locationName: 'Computer Lab, Block D',
            latitude: 12.9710,
            longitude: 77.5940,
            eventDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            expiresAt: new Date(Date.now() + 57 * 24 * 60 * 60 * 1000),
            userId: bob.id,
          },
        ],
      });
      console.log('✅ 3 sample items seeded');
    } else {
      console.log('ℹ️  Items already exist, skipping sample items');
    }
  }

  console.log('🎉 Seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });