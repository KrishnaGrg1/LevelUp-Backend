import { 
  PrismaClient, 
  Experience, 
  Role, 
  MemberStatus, 
  QuestType, 
  QuestSource, 
  PeriodStatus, 
  SubjectType, 
  TicketStatus, 
  TicketPriority 
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  /* ----------------------------
   CLEAN DATABASE
  ---------------------------- */
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

  /* ----------------------------
   CATEGORIES (5)
  ---------------------------- */
  const categories = await prisma.category.createMany({
    data: [
      { name: 'Technology', description: 'Tech & programming' },
      { name: 'Fitness', description: 'Health & workouts' },
      { name: 'Education', description: 'Learning & academics' },
      { name: 'Gaming', description: 'Games & esports' },
      { name: 'Art', description: 'Creative arts & design' },
    ],
  });

  const allCategories = await prisma.category.findMany();

  /* ----------------------------
   USERS (30)
  ---------------------------- */
  const password = await bcrypt.hash('Password123!', 10);

  const users = await Promise.all(
    Array.from({ length: 30 }).map((_, i) =>
      prisma.user.create({
        data: {
          UserName: `user_${i + 1}`,
          email: `user${i + 1}@example.com`,
          password,
          xp: 1000 * (i + 1),
          level: Math.floor(i / 2) + 1,
          tokens: 50 + i,
          isVerified: true,
          hasOnboarded: true,
          profilePicture: `https://i.pravatar.cc/150?img=${i + 1}`,
          isAdmin: i === 0,
        },
      })
    )
  );

  /* ----------------------------
   USER ONBOARDING (30)
  ---------------------------- */
  await Promise.all(
    users.map((user, i) =>
      prisma.userOnboarding.create({
        data: {
          userId: user.id,
          heardAboutUs: 'Internet',
          goal: `Goal ${i + 1}`,
          experience: [Experience.BEGINNER, Experience.INTERMEDIATE, Experience.ADVANCED][i % 3] as Experience,
          categories: {
            connect: [{ id: allCategories[i % allCategories.length].id }],
          },
        },
      })
    )
  );

  /* ----------------------------
   COMMUNITIES (5)
  ---------------------------- */
  const communities = await Promise.all(
    ['Web Devs', 'Fitness Hub', 'AI Lab', 'Gamers Zone', 'Design Club'].map(
      (name, i) =>
        prisma.community.create({
          data: {
            name,
            description: `${name} community`,
            photo: `https://picsum.photos/seed/${i}/400/300`,
            isPrivate: false,
            memberLimit: 100,
            xp: 50000,
            ownerId: users[i].id,
            categoryId: allCategories[i].id,
          },
        })
    )
  );

  /* ----------------------------
   COMMUNITY MEMBERS (30)
  ---------------------------- */
  const communityMembers = await Promise.all(
    users.map((user, i) =>
      prisma.communityMember.create({
        data: {
          userId: user.id,
          communityId: communities[i % communities.length].id,
          role: i < 5 ? Role.ADMIN : Role.MEMBER,
          totalXP: 5000 + i * 500,
          level: Math.floor(i / 2) + 1,
          status: [MemberStatus.Beginner, MemberStatus.Intermediate, MemberStatus.Advanced][i % 3],
          isPinned: i < 3,
        },
      })
    )
  );

  /* ----------------------------
   CLANS (5)
  ---------------------------- */
  const clans = await Promise.all(
    ['React Clan', 'Node Clan', 'Fitness Clan', 'AI Clan', 'Gaming Clan'].map(
      (name, i) =>
        prisma.clan.create({
          data: {
            name,
            slug: name.toLowerCase().replace(/\s/g, '-'),
            description: `${name} description`,
            isPrivate: false,
            xp: 20000,
            limit: 25,
            ownerId: users[i].id,
            communityId: communities[i].id,
            welcomeMessage: `Welcome to ${name}`,
            stats: {
              memberCount: 6,
              battlesWon: i * 5,
            },
          },
        })
    )
  );

  /* ----------------------------
   CLAN MEMBERS (30)
  ---------------------------- */
  await Promise.all(
    users.map((user, i) =>
      prisma.clanMember.create({
        data: {
          userId: user.id,
          clanId: clans[i % clans.length].id,
          communityId: communities[i % communities.length].id,
          totalXP: 3000 + i * 400,
        },
      })
    )
  );

  /* ----------------------------
   QUESTS (30)
  ---------------------------- */
  await Promise.all(
    users.map((user, i) =>
      prisma.quest.create({
        data: {
          userId: user.id,
          communityId: communities[i % communities.length].id,
          communityMemberId: communityMembers[i].id,
          description: `Quest ${i + 1}`,
          xpValue: 200 + i * 10,
          isCompleted: i % 2 === 0,
          date: new Date(),
          type: i % 3 === 0 ? QuestType.Weekly : QuestType.Daily,
          source: QuestSource.AI,
          periodStatus: PeriodStatus.TODAY,
          periodSeq: i + 1,
          estimatedMinutes: 30 + i,
        },
      })
    )
  );

  /* ----------------------------
   TICKETS (10)
  ---------------------------- */
  await Promise.all(
    Array.from({ length: 10 }).map((_, i) =>
      prisma.ticket.create({
        data: {
          userId: users[i].id,
          subject: SubjectType.BUG_REPORT,
          message: `Issue ${i + 1}`,
          status: [TicketStatus.PENDING, TicketStatus.WORKING_ON, TicketStatus.APPROVED][i % 3],
          priority: [TicketPriority.LOW, TicketPriority.MEDIUM, TicketPriority.HIGH][i % 3],
        },
      })
    )
  );

  /* ----------------------------
   MESSAGES (15)
  ---------------------------- */
  await Promise.all(
    Array.from({ length: 15 }).map((_, i) =>
      prisma.message.create({
        data: {
          content: `Message ${i + 1}`,
          senderId: users[i].id,
          communityId: communities[i % communities.length].id,
        },
      })
    )
  );

  /* ----------------------------
   AI CHAT HISTORY (10)
  ---------------------------- */
  await Promise.all(
    Array.from({ length: 10 }).map((_, i) =>
      prisma.aIChatHistory.create({
        data: {
          userId: users[i].id,
          sessionId: `session_${i}`,
          prompt: `Prompt ${i}`,
          response: `Response ${i}`,
          tokensUsed: 100 + i * 10,
          responseTime: 1000 + i * 100,
        },
      })
    )
  );

  console.log('✅ Seeding completed successfully');
}

main()
  .catch(console.error)
  .finally(async () => prisma.$disconnect());
