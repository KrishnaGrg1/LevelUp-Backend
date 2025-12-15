import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seeding...');

  // Clear existing data (in reverse order of dependencies)
  await prisma.aIChatHistory.deleteMany();
  await prisma.message.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.quest.deleteMany();
  await prisma.clanMember.deleteMany();
  await prisma.clan.deleteMany();
  await prisma.communityMember.deleteMany();
  await prisma.community.deleteMany();
  await prisma.userOnboarding.deleteMany();
  await prisma.category.deleteMany();
  await prisma.otp.deleteMany();
  await prisma.session.deleteMany();
  await prisma.key.deleteMany();
  await prisma.user.deleteMany();

  console.log('Cleared existing data');

  // Create Categories
  const categories = await Promise.all([
    prisma.category.create({
      data: {
        name: 'Technology',
        description: 'All things tech and programming',
      },
    }),
    prisma.category.create({
      data: {
        name: 'Fitness',
        description: 'Health and fitness communities',
      },
    }),
    prisma.category.create({
      data: {
        name: 'Education',
        description: 'Learning and academic growth',
      },
    }),
    prisma.category.create({
      data: {
        name: 'Gaming',
        description: 'Video games and esports',
      },
    }),
    prisma.category.create({
      data: {
        name: 'Art & Design',
        description: 'Creative and artistic pursuits',
      },
    }),
  ]);

  console.log('Created categories');

  // Create Users with hashed passwords
  const hashedPassword = await bcrypt.hash('Password123!', 10);

  const users = await Promise.all([
    prisma.user.create({
      data: {
        UserName: 'admin_user',
        email: 'admin@levelup.com',
        password: hashedPassword,
        xp: 50000,
        level: 50,
        tokens: 500,
        isVerified: true,
        isAdmin: true,
        hasOnboarded: true,
        profilePicture: 'https://i.pravatar.cc/150?img=1',
      },
    }),
    prisma.user.create({
      data: {
        UserName: 'john_doe',
        email: 'john@example.com',
        password: hashedPassword,
        xp: 15000,
        level: 25,
        tokens: 150,
        isVerified: true,
        hasOnboarded: true,
        profilePicture: 'https://i.pravatar.cc/150?img=2',
      },
    }),
    prisma.user.create({
      data: {
        UserName: 'jane_smith',
        email: 'jane@example.com',
        password: hashedPassword,
        xp: 22000,
        level: 35,
        tokens: 220,
        isVerified: true,
        hasOnboarded: true,
        profilePicture: 'https://i.pravatar.cc/150?img=3',
      },
    }),
    prisma.user.create({
      data: {
        UserName: 'mike_wilson',
        email: 'mike@example.com',
        password: hashedPassword,
        xp: 8500,
        level: 15,
        tokens: 85,
        isVerified: true,
        hasOnboarded: true,
        profilePicture: 'https://i.pravatar.cc/150?img=4',
      },
    }),
    prisma.user.create({
      data: {
        UserName: 'sarah_jones',
        email: 'sarah@example.com',
        password: hashedPassword,
        xp: 30000,
        level: 40,
        tokens: 300,
        isVerified: true,
        hasOnboarded: true,
        profilePicture: 'https://i.pravatar.cc/150?img=5',
      },
    }),
    prisma.user.create({
      data: {
        UserName: 'alex_brown',
        email: 'alex@example.com',
        password: hashedPassword,
        xp: 5000,
        level: 10,
        tokens: 50,
        isVerified: true,
        hasOnboarded: true,
        profilePicture: 'https://i.pravatar.cc/150?img=6',
      },
    }),
    prisma.user.create({
      data: {
        UserName: 'emma_davis',
        email: 'emma@example.com',
        password: hashedPassword,
        xp: 12000,
        level: 20,
        tokens: 120,
        isVerified: true,
        hasOnboarded: true,
        profilePicture: 'https://i.pravatar.cc/150?img=7',
      },
    }),
    prisma.user.create({
      data: {
        UserName: 'chris_taylor',
        email: 'chris@example.com',
        password: hashedPassword,
        xp: 18000,
        level: 28,
        tokens: 180,
        isVerified: true,
        hasOnboarded: true,
        profilePicture: 'https://i.pravatar.cc/150?img=8',
      },
    }),
  ]);

  console.log('Created users');

  // Create User Onboardings
  await Promise.all([
    prisma.userOnboarding.create({
      data: {
        userId: users[1].id,
        heardAboutUs: 'Social Media',
        goal: 'Improve coding skills',
        experience: 'INTERMEDIATE',
        categories: {
          connect: [{ id: categories[0].id }],
        },
      },
    }),
    prisma.userOnboarding.create({
      data: {
        userId: users[2].id,
        heardAboutUs: 'Friend Referral',
        goal: 'Get fit and healthy',
        experience: 'BEGINNER',
        categories: {
          connect: [{ id: categories[1].id }],
        },
      },
    }),
    prisma.userOnboarding.create({
      data: {
        userId: users[3].id,
        heardAboutUs: 'Search Engine',
        goal: 'Learn new technologies',
        experience: 'ADVANCED',
        categories: {
          connect: [{ id: categories[0].id }, { id: categories[2].id }],
        },
      },
    }),
  ]);

  console.log('Created user onboardings');

  // Create Communities
  const communities = await Promise.all([
    prisma.community.create({
      data: {
        name: 'Web Developers Hub',
        description: 'A community for web developers to learn and grow together',
        photo: 'https://picsum.photos/seed/community1/400/300',
        isPrivate: false,
        memberLimit: 100,
        xp: 125000,
        ownerId: users[0].id,
        categoryId: categories[0].id,
      },
    }),
    prisma.community.create({
      data: {
        name: 'Fitness Warriors',
        description: 'Get fit, stay motivated, achieve your goals',
        photo: 'https://picsum.photos/seed/community2/400/300',
        isPrivate: false,
        memberLimit: 150,
        xp: 98000,
        ownerId: users[2].id,
        categoryId: categories[1].id,
      },
    }),
    prisma.community.create({
      data: {
        name: 'AI & Machine Learning',
        description: 'Exploring the future of artificial intelligence',
        photo: 'https://picsum.photos/seed/community3/400/300',
        isPrivate: false,
        memberLimit: 80,
        xp: 156000,
        ownerId: users[4].id,
        categoryId: categories[0].id,
      },
    }),
    prisma.community.create({
      data: {
        name: 'Gaming Legends',
        description: 'For serious gamers and esports enthusiasts',
        photo: 'https://picsum.photos/seed/community4/400/300',
        isPrivate: false,
        memberLimit: 200,
        xp: 210000,
        ownerId: users[1].id,
        categoryId: categories[3].id,
      },
    }),
    prisma.community.create({
      data: {
        name: 'Creative Minds',
        description: 'Artists, designers, and creators unite',
        photo: 'https://picsum.photos/seed/community5/400/300',
        isPrivate: true,
        memberLimit: 50,
        xp: 45000,
        ownerId: users[3].id,
        categoryId: categories[4].id,
      },
    }),
  ]);

  console.log('Created communities');

  // Create Community Members
  const communityMembers = await Promise.all([
    // Web Developers Hub members
    prisma.communityMember.create({
      data: {
        userId: users[0].id,
        communityId: communities[0].id,
        role: 'ADMIN',
        totalXP: 35000,
        level: 18,
        status: 'Advanced',
        isPinned: true,
      },
    }),
    prisma.communityMember.create({
      data: {
        userId: users[1].id,
        communityId: communities[0].id,
        role: 'MEMBER',
        totalXP: 28000,
        level: 15,
        status: 'Intermediate',
      },
    }),
    prisma.communityMember.create({
      data: {
        userId: users[3].id,
        communityId: communities[0].id,
        role: 'MEMBER',
        totalXP: 15000,
        level: 10,
        status: 'Intermediate',
      },
    }),
    prisma.communityMember.create({
      data: {
        userId: users[6].id,
        communityId: communities[0].id,
        role: 'MEMBER',
        totalXP: 12000,
        level: 8,
        status: 'Beginner',
      },
    }),
    // Fitness Warriors members
    prisma.communityMember.create({
      data: {
        userId: users[2].id,
        communityId: communities[1].id,
        role: 'ADMIN',
        totalXP: 42000,
        level: 20,
        status: 'Advanced',
        isPinned: true,
      },
    }),
    prisma.communityMember.create({
      data: {
        userId: users[5].id,
        communityId: communities[1].id,
        role: 'MEMBER',
        totalXP: 18000,
        level: 12,
        status: 'Intermediate',
      },
    }),
    prisma.communityMember.create({
      data: {
        userId: users[7].id,
        communityId: communities[1].id,
        role: 'MEMBER',
        totalXP: 22000,
        level: 14,
        status: 'Intermediate',
      },
    }),
    // AI & ML members
    prisma.communityMember.create({
      data: {
        userId: users[4].id,
        communityId: communities[2].id,
        role: 'ADMIN',
        totalXP: 55000,
        level: 25,
        status: 'Advanced',
        isPinned: true,
      },
    }),
    prisma.communityMember.create({
      data: {
        userId: users[1].id,
        communityId: communities[2].id,
        role: 'MEMBER',
        totalXP: 32000,
        level: 16,
        status: 'Advanced',
      },
    }),
    // Gaming Legends members
    prisma.communityMember.create({
      data: {
        userId: users[1].id,
        communityId: communities[3].id,
        role: 'ADMIN',
        totalXP: 68000,
        level: 30,
        status: 'Advanced',
        isPinned: true,
      },
    }),
    prisma.communityMember.create({
      data: {
        userId: users[3].id,
        communityId: communities[3].id,
        role: 'MEMBER',
        totalXP: 45000,
        level: 22,
        status: 'Advanced',
      },
    }),
  ]);

  console.log('Created community members');

  // Create Clans
  const clans = await Promise.all([
    prisma.clan.create({
      data: {
        name: 'React Masters',
        slug: 'react-masters',
        description: 'Masters of React and modern frontend',
        isPrivate: false,
        xp: 45000,
        limit: 30,
        ownerId: users[0].id,
        communityId: communities[0].id,
        welcomeMessage: 'Welcome to React Masters!',
        stats: { memberCount: 3, battlesWon: 15 },
      },
    }),
    prisma.clan.create({
      data: {
        name: 'Node Ninjas',
        slug: 'node-ninjas',
        description: 'Backend warriors with Node.js',
        isPrivate: false,
        xp: 38000,
        limit: 25,
        ownerId: users[1].id,
        communityId: communities[0].id,
        welcomeMessage: 'Welcome to Node Ninjas!',
        stats: { memberCount: 2, battlesWon: 12 },
      },
    }),
    prisma.clan.create({
      data: {
        name: 'Iron Pumpers',
        slug: 'iron-pumpers',
        description: 'Lift heavy, grow strong',
        isPrivate: false,
        xp: 52000,
        limit: 40,
        ownerId: users[2].id,
        communityId: communities[1].id,
        welcomeMessage: 'Welcome to Iron Pumpers!',
        stats: { memberCount: 2, battlesWon: 18 },
      },
    }),
    prisma.clan.create({
      data: {
        name: 'Cardio Kings',
        slug: 'cardio-kings',
        description: 'Run fast, live longer',
        isPrivate: false,
        xp: 28000,
        limit: 35,
        ownerId: users[5].id,
        communityId: communities[1].id,
        welcomeMessage: 'Welcome to Cardio Kings!',
        stats: { memberCount: 2, battlesWon: 8 },
      },
    }),
    prisma.clan.create({
      data: {
        name: 'Deep Learning Squad',
        slug: 'deep-learning-squad',
        description: 'Neural networks and deep learning experts',
        isPrivate: false,
        xp: 62000,
        limit: 20,
        ownerId: users[4].id,
        communityId: communities[2].id,
        welcomeMessage: 'Welcome to Deep Learning Squad!',
        stats: { memberCount: 2, battlesWon: 22 },
      },
    }),
  ]);

  console.log('Created clans');

  // Create Clan Members
  await Promise.all([
    // React Masters
    prisma.clanMember.create({
      data: {
        userId: users[0].id,
        clanId: clans[0].id,
        communityId: communities[0].id,
        totalXP: 18000,
      },
    }),
    prisma.clanMember.create({
      data: {
        userId: users[1].id,
        clanId: clans[0].id,
        communityId: communities[0].id,
        totalXP: 15000,
      },
    }),
    prisma.clanMember.create({
      data: {
        userId: users[6].id,
        clanId: clans[0].id,
        communityId: communities[0].id,
        totalXP: 12000,
      },
    }),
    // Node Ninjas
    prisma.clanMember.create({
      data: {
        userId: users[3].id,
        clanId: clans[1].id,
        communityId: communities[0].id,
        totalXP: 20000,
      },
    }),
    // Iron Pumpers
    prisma.clanMember.create({
      data: {
        userId: users[2].id,
        clanId: clans[2].id,
        communityId: communities[1].id,
        totalXP: 28000,
      },
    }),
    prisma.clanMember.create({
      data: {
        userId: users[7].id,
        clanId: clans[2].id,
        communityId: communities[1].id,
        totalXP: 24000,
      },
    }),
    // Cardio Kings
    prisma.clanMember.create({
      data: {
        userId: users[5].id,
        clanId: clans[3].id,
        communityId: communities[1].id,
        totalXP: 14000,
      },
    }),
    // Deep Learning Squad
    prisma.clanMember.create({
      data: {
        userId: users[4].id,
        clanId: clans[4].id,
        communityId: communities[2].id,
        totalXP: 32000,
      },
    }),
    prisma.clanMember.create({
      data: {
        userId: users[1].id,
        clanId: clans[4].id,
        communityId: communities[2].id,
        totalXP: 30000,
      },
    }),
  ]);

  console.log('Created clan members');

  // Create Quests
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  await Promise.all([
    // Completed quests
    prisma.quest.create({
      data: {
        userId: users[1].id,
        communityId: communities[0].id,
        communityMemberId: communityMembers[1].id,
        description: 'Build a responsive navbar with React',
        xpValue: 500,
        isCompleted: true,
        date: yesterday,
        type: 'Daily',
        source: 'AI',
        periodStatus: 'YESTERDAY',
        periodSeq: 1,
        viewedAt: yesterday,
        startedAt: yesterday,
        completedAt: new Date(yesterday.getTime() + 2 * 60 * 60 * 1000),
        estimatedMinutes: 60,
      },
    }),
    prisma.quest.create({
      data: {
        userId: users[2].id,
        communityId: communities[1].id,
        communityMemberId: communityMembers[4].id,
        description: 'Complete 30 minutes cardio workout',
        xpValue: 300,
        isCompleted: true,
        date: yesterday,
        type: 'Daily',
        source: 'AI',
        periodStatus: 'YESTERDAY',
        periodSeq: 1,
        viewedAt: yesterday,
        startedAt: yesterday,
        completedAt: new Date(yesterday.getTime() + 40 * 60 * 1000),
        estimatedMinutes: 30,
      },
    }),
    prisma.quest.create({
      data: {
        userId: users[4].id,
        communityId: communities[2].id,
        communityMemberId: communityMembers[7].id,
        description: 'Train a neural network model',
        xpValue: 1000,
        isCompleted: true,
        date: lastWeek,
        type: 'Weekly',
        source: 'AI',
        periodStatus: 'LAST_WEEK',
        periodSeq: 1,
        viewedAt: lastWeek,
        startedAt: lastWeek,
        completedAt: new Date(lastWeek.getTime() + 5 * 60 * 60 * 1000),
        estimatedMinutes: 240,
      },
    }),
    // Active/pending quests
    prisma.quest.create({
      data: {
        userId: users[1].id,
        communityId: communities[0].id,
        communityMemberId: communityMembers[1].id,
        description: 'Create a REST API with Express',
        xpValue: 600,
        isCompleted: false,
        date: now,
        type: 'Daily',
        source: 'AI',
        periodStatus: 'TODAY',
        periodSeq: 1,
        viewedAt: now,
        startedAt: now,
        estimatedMinutes: 90,
      },
    }),
    prisma.quest.create({
      data: {
        userId: users[3].id,
        communityId: communities[0].id,
        communityMemberId: communityMembers[2].id,
        description: 'Refactor legacy code using TypeScript',
        xpValue: 800,
        isCompleted: false,
        date: now,
        type: 'Daily',
        source: 'AI',
        periodStatus: 'TODAY',
        periodSeq: 2,
        viewedAt: now,
        estimatedMinutes: 120,
      },
    }),
    prisma.quest.create({
      data: {
        userId: users[5].id,
        communityId: communities[1].id,
        communityMemberId: communityMembers[5].id,
        description: 'Complete full body strength training',
        xpValue: 400,
        isCompleted: false,
        date: now,
        type: 'Daily',
        source: 'TEMPLATE',
        periodStatus: 'TODAY',
        periodSeq: 1,
        viewedAt: now,
        estimatedMinutes: 45,
      },
    }),
  ]);

  console.log('Created quests');

  // Create Tickets
  await Promise.all([
    prisma.ticket.create({
      data: {
        userId: users[3].id,
        subject: 'BUG_REPORT',
        message: 'Unable to upload profile picture, getting 500 error',
        status: 'WORKING_ON',
        priority: 'HIGH',
        expectedDateOfCompletion: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.ticket.create({
      data: {
        userId: users[5].id,
        subject: 'FEATURE_REQUEST',
        message: 'Please add dark mode to the application',
        status: 'PENDING',
        priority: 'MEDIUM',
      },
    }),
    prisma.ticket.create({
      data: {
        userId: users[6].id,
        subject: 'ACCOUNT_ISSUE',
        message: 'Cannot reset my password, not receiving emails',
        status: 'APPROVED',
        priority: 'CRITICAL',
        expectedDateOfCompletion: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000),
      },
    }),
  ]);

  console.log('Created tickets');

  // Create Messages
  await Promise.all([
    prisma.message.create({
      data: {
        content: 'Welcome everyone to Web Developers Hub!',
        communityId: communities[0].id,
        senderId: users[0].id,
      },
    }),
    prisma.message.create({
      data: {
        content: 'Excited to learn React here!',
        communityId: communities[0].id,
        senderId: users[1].id,
      },
    }),
    prisma.message.create({
      data: {
        content: 'React Masters squad, lets discuss the new project',
        communityId: communities[0].id,
        clanId: clans[0].id,
        senderId: users[0].id,
      },
    }),
    prisma.message.create({
      data: {
        content: 'Great workout today team!',
        communityId: communities[1].id,
        senderId: users[2].id,
      },
    }),
    prisma.message.create({
      data: {
        content: 'Who is up for morning cardio tomorrow?',
        communityId: communities[1].id,
        clanId: clans[3].id,
        senderId: users[5].id,
      },
    }),
  ]);

  console.log('Created messages');

  // Create AI Chat History
  await Promise.all([
    prisma.aIChatHistory.create({
      data: {
        userId: users[1].id,
        sessionId: 'session_001',
        prompt: 'Generate a daily quest for learning React hooks',
        response: 'Quest: Build a custom React hook for form validation. Complete within 60 minutes.',
        tokensUsed: 150,
        responseTime: 1200,
      },
    }),
    prisma.aIChatHistory.create({
      data: {
        userId: users[2].id,
        sessionId: 'session_002',
        prompt: 'Suggest a fitness routine for beginners',
        response: 'Start with 20 min cardio, 15 min strength training, 5 min stretching. Do this 3x per week.',
        tokensUsed: 180,
        responseTime: 1500,
      },
    }),
    prisma.aIChatHistory.create({
      data: {
        userId: users[4].id,
        sessionId: 'session_003',
        prompt: 'Explain backpropagation in neural networks',
        response: 'Backpropagation is an algorithm for computing gradients in neural networks by propagating errors backward through layers...',
        tokensUsed: 250,
        responseTime: 2000,
      },
    }),
  ]);

  console.log('Created AI chat history');

  console.log('✅ Database seeding completed successfully!');
  console.log('\nSeeded data summary:');
  console.log(`- ${categories.length} categories`);
  console.log(`- ${users.length} users`);
  console.log(`- ${communities.length} communities`);
  console.log(`- ${communityMembers.length} community members`);
  console.log(`- ${clans.length} clans`);
  console.log('- 9 clan members');
  console.log('- 6 quests');
  console.log('- 3 tickets');
  console.log('- 5 messages');
  console.log('- 3 AI chat histories');
  console.log('\nTest credentials:');
  console.log('Email: admin@levelup.com');
  console.log('Email: john@example.com');
  console.log('Password: Password123!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
