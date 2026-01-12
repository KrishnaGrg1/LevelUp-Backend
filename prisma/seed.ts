import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Real-like names for seeding
const userNames = [
  'james_anderson',
  'mary_johnson',
  'robert_williams',
  'patricia_brown',
  'michael_jones',
  'linda_garcia',
  'william_martinez',
  'barbara_rodriguez',
  'david_davis',
  'elizabeth_miller',
  'richard_wilson',
  'jennifer_moore',
  'joseph_taylor',
  'susan_thomas',
  'thomas_jackson',
  'jessica_white',
  'charles_harris',
  'sarah_martin',
  'christopher_thompson',
  'karen_lee',
  'daniel_walker',
  'nancy_hall',
  'matthew_allen',
  'lisa_young',
  'anthony_king',
  'betty_wright',
  'mark_lopez',
  'sandra_hill',
  'donald_scott',
  'ashley_green',
  'steven_adams',
  'kimberly_baker',
  'paul_nelson',
  'emily_carter',
  'andrew_mitchell',
  'donna_perez',
  'joshua_roberts',
  'michelle_turner',
  'kenneth_phillips',
  'carol_campbell',
  'kevin_parker',
  'amanda_evans',
  'brian_edwards',
  'melissa_collins',
  'george_stewart',
  'deborah_morris',
  'edward_rogers',
  'stephanie_reed',
  'ronald_cook',
  'rebecca_morgan',
];

const firstNames = [
  'James',
  'Mary',
  'Robert',
  'Patricia',
  'Michael',
  'Linda',
  'William',
  'Barbara',
  'David',
  'Elizabeth',
  'Richard',
  'Jennifer',
  'Joseph',
  'Susan',
  'Thomas',
  'Jessica',
  'Charles',
  'Sarah',
  'Christopher',
  'Karen',
  'Daniel',
  'Nancy',
  'Matthew',
  'Lisa',
  'Anthony',
  'Betty',
  'Mark',
  'Sandra',
  'Donald',
  'Ashley',
  'Steven',
  'Kimberly',
  'Paul',
  'Emily',
  'Andrew',
  'Donna',
  'Joshua',
  'Michelle',
  'Kenneth',
  'Carol',
  'Kevin',
  'Amanda',
  'Brian',
  'Melissa',
  'George',
  'Deborah',
  'Edward',
  'Stephanie',
  'Ronald',
  'Rebecca',
];

const communityNames = [
  'Web Developers Hub',
  'Fitness Warriors',
  'AI & Machine Learning',
  'Gaming Legends',
  'Creative Minds',
  'Data Science Masters',
  'Mobile App Creators',
  'Cloud Computing Pros',
  'Cybersecurity Squad',
  'DevOps Engineers',
  'Python Programmers',
  'JavaScript Enthusiasts',
  'Yoga & Meditation',
  'Marathon Runners',
  'Weightlifting Club',
  'Nutrition & Diet',
  'Mental Health Support',
  'Book Lovers Society',
  'Photography Artists',
  'Digital Marketing Gurus',
  'Startup Founders',
  'Blockchain Builders',
  'UI/UX Designers',
  'Content Creators',
  'Music Producers',
  'Video Editors',
  ' 3D Modeling Artists',
  'Language Learners',
  'Math & Science',
  'Writing Workshop',
  'Chess Masters',
  'E-Sports Champions',
  'Board Game Enthusiasts',
  'Cooking & Recipes',
  'Travel Explorers',
  'Environmental Activists',
  'Volunteer Network',
  'Pet Lovers Unite',
  'Gardening Community',
  'DIY Crafters',
  'Film & Cinema Club',
  'Stand-up Comedy',
  'Podcast Creators',
  'Investment & Finance',
  'Real Estate Network',
  'Legal Professionals',
  'Medical Community',
  'Teachers Network',
  'Architecture & Design',
  'Automotive Enthusiasts',
];

const clanPrefixes = [
  'Elite',
  'Alpha',
  'Shadow',
  'Phoenix',
  'Dragon',
  'Thunder',
  'Storm',
  'Mystic',
  'Iron',
  'Golden',
];
const clanSuffixes = [
  'Warriors',
  'Knights',
  'Squad',
  'Legion',
  'Alliance',
  'Guild',
  'Force',
  'Clan',
  'Order',
  'Brotherhood',
];

const questTemplates = {
  daily: [
    'Complete a 30-minute coding session',
    'Review and refactor old code',
    'Learn a new programming concept',
    'Solve 3 coding challenges',
    'Read technical documentation',
    'Write unit tests for a module',
    'Optimize database queries',
    'Implement a new feature',
    'Debug and fix 2 issues',
    'Code review for team',
    'Complete 30 minutes of cardio',
    'Do 50 push-ups',
    'Practice yoga for 20 minutes',
    'Drink 8 glasses of water',
    'Meal prep healthy lunch',
    'Take a 15-minute walk',
    'Stretch for 10 minutes',
    'Get 8 hours of sleep',
    'Read 20 pages of a book',
    'Practice a new language for 15 minutes',
    'Meditate for 10 minutes',
    'Journal your thoughts',
    'Learn something new',
    'Help a community member',
    'Share knowledge with others',
  ],
  weekly: [
    'Build a complete REST API',
    'Create a full-stack application',
    'Learn a new framework',
    'Complete an online course module',
    'Contribute to open source',
    'Write a technical blog post',
    'Attend a tech meetup or webinar',
    'Mentor a junior developer',
    'Complete a major project milestone',
    'Run 10 kilometers',
    'Attend 3 fitness classes',
    'Meal prep for the entire week',
    'Try a new workout routine',
    'Read a complete book',
    'Complete a personal project',
    'Network with 5 new people',
    'Learn a new skill',
    'Volunteer for 4 hours',
    'Create content for social media',
    'Review and update your goals',
  ],
};

async function main() {
  console.log(
    'Starting database seeding with 50 users, 50 communities, and extensive quests...'
  );

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
    prisma.category.create({
      data: {
        name: 'Business',
        description: 'Entrepreneurship and business development',
      },
    }),
    prisma.category.create({
      data: {
        name: 'Lifestyle',
        description: 'Personal development and lifestyle',
      },
    }),
  ]);

  console.log('Created categories');

  // Create 50 Users with hashed passwords
  const hashedPassword = await bcrypt.hash('Password123!', 10);

  console.log('Creating 50 users...');

  // Create users using createMany for better performance
  const usersData = [
    {
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
  ];

  // Create 49 regular users
  for (let i = 0; i < 49; i++) {
    const level = Math.floor(Math.random() * 40) + 5; // Level 5-45
    const xp = level * 1000 + Math.floor(Math.random() * 1000);
    const tokens = level * 10 + Math.floor(Math.random() * 50);

    usersData.push({
      UserName: userNames[i],
      email: `${userNames[i]}@levelup.com`,
      password: hashedPassword,
      xp: xp,
      level: level,
      tokens: tokens,
      isVerified: true,
      isAdmin: false,
      hasOnboarded: true,
      profilePicture: `https://i.pravatar.cc/150?img=${i + 2}`,
    });
  }

  await prisma.user.createMany({ data: usersData });
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } });

  console.log(`Created ${users.length} users`);

  // Create User Onboardings for all users (except admin)
  console.log('Creating user onboardings...');
  const experiences = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
  const heardAbout = [
    'Social Media',
    'Friend Referral',
    'Search Engine',
    'Advertisement',
    'Blog Post',
  ];
  const goals = [
    'Improve coding skills',
    'Get fit and healthy',
    'Learn new technologies',
    'Build a portfolio',
    'Network with professionals',
    'Start a side project',
    'Career advancement',
    'Personal growth',
  ];

  for (let i = 1; i < users.length; i++) {
    const categoryIds = categories
      .sort(() => 0.5 - Math.random())
      .slice(0, Math.floor(Math.random() * 3) + 1)
      .map((cat) => ({ id: cat.id }));

    await prisma.userOnboarding.create({
      data: {
        userId: users[i].id,
        heardAboutUs: heardAbout[Math.floor(Math.random() * heardAbout.length)],
        goal: goals[Math.floor(Math.random() * goals.length)],
        experience: experiences[
          Math.floor(Math.random() * experiences.length)
        ] as any,
        categories: {
          connect: categoryIds,
        },
      },
    });
  }

  console.log('Created user onboardings');

  // Create 50 Communities
  console.log('Creating 50 communities...');
  const communities: any[] = [];

  for (let i = 0; i < 50; i++) {
    const ownerIdx = Math.floor(Math.random() * users.length);
    const categoryIdx = Math.floor(Math.random() * categories.length);
    const communityLevel = Math.floor(Math.random() * 30) + 1;
    const xp = communityLevel * 5000 + Math.floor(Math.random() * 5000);

    communities.push(
      await prisma.community.create({
        data: {
          name: communityNames[i],
          description: `Join ${communityNames[i]} to connect with like-minded individuals and grow together`,
          photo: `https://picsum.photos/seed/community${i}/400/300`,
          isPrivate: Math.random() < 0.2, // 20% private
          memberLimit: 50 + Math.floor(Math.random() * 150),
          xp: xp,
          level: communityLevel,
          ownerId: users[ownerIdx].id,
          categoryId: categories[categoryIdx].id,
        },
      })
    );
  }

  console.log('Created 50 communities');

  // Create Community Members - each community gets 5-15 members
  console.log('Creating community members...');
  const communityMembers: any[] = [];
  const memberStatuses = ['Beginner', 'Intermediate', 'Advanced'];

  for (let i = 0; i < communities.length; i++) {
    const numMembers = 5 + Math.floor(Math.random() * 11); // 5-15 members
    const memberIndices = new Set<number>();

    // Add owner as admin
    const ownerUser = users.find((u) => u.id === communities[i].ownerId);
    if (ownerUser) {
      const memberLevel = Math.floor(ownerUser.level * 0.8);
      const member = await prisma.communityMember.create({
        data: {
          userId: ownerUser.id,
          communityId: communities[i].id,
          role: 'ADMIN',
          totalXP: memberLevel * 1000,
          level: memberLevel,
          status: memberStatuses[
            Math.floor(Math.random() * memberStatuses.length)
          ] as any,
          isPinned: Math.random() < 0.3,
        },
      });
      communityMembers.push(member);
      memberIndices.add(users.indexOf(ownerUser));
    }

    // Add random members
    while (
      memberIndices.size < numMembers &&
      memberIndices.size < users.length
    ) {
      const userIdx = Math.floor(Math.random() * users.length);
      if (!memberIndices.has(userIdx)) {
        memberIndices.add(userIdx);
        const memberLevel =
          Math.floor(users[userIdx].level * 0.6) +
          Math.floor(Math.random() * 5);
        const member = await prisma.communityMember.create({
          data: {
            userId: users[userIdx].id,
            communityId: communities[i].id,
            role: 'MEMBER',
            totalXP: memberLevel * 1000,
            level: memberLevel,
            status: memberStatuses[
              Math.floor(Math.random() * memberStatuses.length)
            ] as any,
            isPinned: Math.random() < 0.1,
          },
        });
        communityMembers.push(member);
      }
    }
  }

  console.log(`Created ${communityMembers.length} community members`);

  // Create Clans - 10 clans per community
  console.log('Creating clans (10 per community)...');
  const clans: any[] = [];

  for (let i = 0; i < communities.length; i++) {
    const communityUserMembers = communityMembers.filter(
      (cm) => cm.communityId === communities[i].id
    );

    for (let j = 0; j < 10; j++) {
      const ownerMember =
        communityUserMembers[
          Math.floor(Math.random() * communityUserMembers.length)
        ];
      const clanLevel = Math.floor(Math.random() * 25) + 1;
      const clanXp = clanLevel * 2000 + Math.floor(Math.random() * 2000);

      const prefix = clanPrefixes[j];
      const suffix =
        clanSuffixes[Math.floor(Math.random() * clanSuffixes.length)];
      const clanName = `${communities[i].name} - ${prefix} ${suffix}`;
      const slug = clanName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      clans.push(
        await prisma.clan.create({
          data: {
            name: clanName,
            slug: `${slug}-${i}-${j}`,
            description: `${prefix} ${suffix} of ${communities[i].name}`,
            isPrivate: Math.random() < 0.15,
            xp: clanXp,
            level: clanLevel,
            ownerId: ownerMember.userId,
            communityId: communities[i].id,
            limit: 20 + Math.floor(Math.random() * 30),
            welcomeMessage: `Welcome to ${prefix} ${suffix}! Let's achieve greatness together.`,
            stats: {
              memberCount: 0,
              battlesWon: Math.floor(Math.random() * 20),
            },
          },
        })
      );
    }
  }

  console.log(`Created ${clans.length} clans`);

  // Create Clan Members - each clan gets 3-8 members
  console.log('Creating clan members...');
  const clanMembers: any[] = [];

  for (let i = 0; i < clans.length; i++) {
    const clan = clans[i];
    const communityUserMembers = communityMembers.filter(
      (cm) => cm.communityId === clan.communityId
    );
    const numClanMembers = 3 + Math.floor(Math.random() * 6); // 3-8 members
    const clanMemberIndices = new Set<string>();

    // Add owner
    clanMemberIndices.add(clan.ownerId);
    clanMembers.push(
      await prisma.clanMember.create({
        data: {
          userId: clan.ownerId,
          clanId: clan.id,
          communityId: clan.communityId,
          totalXP: clan.xp * 0.3 + Math.floor(Math.random() * 5000),
        },
      })
    );

    // Add random members from community
    while (
      clanMemberIndices.size < numClanMembers &&
      clanMemberIndices.size < communityUserMembers.length
    ) {
      const member =
        communityUserMembers[
          Math.floor(Math.random() * communityUserMembers.length)
        ];
      if (!clanMemberIndices.has(member.userId)) {
        clanMemberIndices.add(member.userId);
        clanMembers.push(
          await prisma.clanMember.create({
            data: {
              userId: member.userId,
              clanId: clan.id,
              communityId: clan.communityId,
              totalXP: Math.floor(Math.random() * 10000) + 1000,
            },
          })
        );
      }
    }
  }

  console.log(`Created ${clanMembers.length} clan members`);

  // Create Quests - Daily and Weekly for each user
  console.log('Creating daily and weekly quests for all users...');
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const dayBeforeYesterday = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  let questCount = 0;

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const userCommunityMembers = communityMembers.filter(
      (cm) => cm.userId === user.id
    );

    // Skip if user has no community memberships
    if (userCommunityMembers.length === 0) continue;

    // Create 3 daily quests for TODAY
    for (let j = 0; j < 3; j++) {
      const communityMember =
        userCommunityMembers[
          Math.floor(Math.random() * userCommunityMembers.length)
        ];
      const questDesc =
        questTemplates.daily[
          Math.floor(Math.random() * questTemplates.daily.length)
        ];
      const xpValue = 200 + Math.floor(Math.random() * 400);
      const estimatedMins = 30 + Math.floor(Math.random() * 60);
      const isCompleted = Math.random() < 0.3;
      // Set startedAt to past time beyond estimatedMinutes requirement so quests can be completed immediately
      const startTime = new Date(
        now.getTime() - (estimatedMins + 10) * 60 * 1000
      );

      await prisma.quest.create({
        data: {
          userId: user.id,
          communityId: communityMember.communityId,
          communityMemberId: communityMember.id,
          description: `${questDesc} - ${firstNames[i] || 'User'}`,
          xpValue: xpValue,
          isCompleted: isCompleted,
          date: now,
          type: 'Daily',
          source: 'AI',
          periodStatus: 'TODAY',
          periodSeq: j + 1,
          viewedAt: now,
          startedAt: startTime,
          completedAt: isCompleted
            ? new Date(
                now.getTime() + Math.floor(Math.random() * 3 * 60 * 60 * 1000)
              )
            : null,
          estimatedMinutes: estimatedMins,
        },
      });
      questCount++;
    }

    // Create 2 daily quests for YESTERDAY
    for (let j = 0; j < 2; j++) {
      const communityMember =
        userCommunityMembers[
          Math.floor(Math.random() * userCommunityMembers.length)
        ];
      const questDesc =
        questTemplates.daily[
          Math.floor(Math.random() * questTemplates.daily.length)
        ];
      const xpValue = 200 + Math.floor(Math.random() * 400);
      const isCompleted = Math.random() < 0.7;

      await prisma.quest.create({
        data: {
          userId: user.id,
          communityId: communityMember.communityId,
          communityMemberId: communityMember.id,
          description: `${questDesc} - ${firstNames[i] || 'User'}`,
          xpValue: xpValue,
          isCompleted: isCompleted,
          date: yesterday,
          type: 'Daily',
          source: 'AI',
          periodStatus: 'YESTERDAY',
          periodSeq: j + 1,
          viewedAt: yesterday,
          startedAt: isCompleted
            ? yesterday
            : Math.random() < 0.5
              ? yesterday
              : null,
          completedAt: isCompleted
            ? new Date(
                yesterday.getTime() +
                  Math.floor(Math.random() * 5 * 60 * 60 * 1000)
              )
            : null,
          estimatedMinutes: 30 + Math.floor(Math.random() * 60),
        },
      });
      questCount++;
    }

    // Create 1 daily quest for DAY_BEFORE_YESTERDAY
    const communityMember1 =
      userCommunityMembers[
        Math.floor(Math.random() * userCommunityMembers.length)
      ];
    const questDesc1 =
      questTemplates.daily[
        Math.floor(Math.random() * questTemplates.daily.length)
      ];
    const isCompleted1 = Math.random() < 0.8;

    await prisma.quest.create({
      data: {
        userId: user.id,
        communityId: communityMember1.communityId,
        communityMemberId: communityMember1.id,
        description: `${questDesc1} - ${firstNames[i] || 'User'}`,
        xpValue: 200 + Math.floor(Math.random() * 400),
        isCompleted: isCompleted1,
        date: dayBeforeYesterday,
        type: 'Daily',
        source: 'AI',
        periodStatus: 'DAY_BEFORE_YESTERDAY',
        periodSeq: 1,
        viewedAt: dayBeforeYesterday,
        startedAt: isCompleted1 ? dayBeforeYesterday : null,
        completedAt: isCompleted1
          ? new Date(
              dayBeforeYesterday.getTime() +
                Math.floor(Math.random() * 5 * 60 * 60 * 1000)
            )
          : null,
        estimatedMinutes: 30 + Math.floor(Math.random() * 60),
      },
    });
    questCount++;

    // Create 2 weekly quests for THIS_WEEK
    for (let j = 0; j < 2; j++) {
      const communityMember =
        userCommunityMembers[
          Math.floor(Math.random() * userCommunityMembers.length)
        ];
      const questDesc =
        questTemplates.weekly[
          Math.floor(Math.random() * questTemplates.weekly.length)
        ];
      const xpValue = 800 + Math.floor(Math.random() * 700);
      const isCompleted = Math.random() < 0.2;

      await prisma.quest.create({
        data: {
          userId: user.id,
          communityId: communityMember.communityId,
          communityMemberId: communityMember.id,
          description: `${questDesc} - ${firstNames[i] || 'User'}`,
          xpValue: xpValue,
          isCompleted: isCompleted,
          date: now,
          type: 'Weekly',
          source: 'AI',
          periodStatus: 'THIS_WEEK',
          periodSeq: j + 1,
          viewedAt: now,
          startedAt: isCompleted ? now : Math.random() < 0.3 ? now : null,
          completedAt: isCompleted
            ? new Date(
                now.getTime() + Math.floor(Math.random() * 10 * 60 * 60 * 1000)
              )
            : null,
          estimatedMinutes: 120 + Math.floor(Math.random() * 180),
        },
      });
      questCount++;
    }

    // Create 2 weekly quests for LAST_WEEK
    for (let j = 0; j < 2; j++) {
      const communityMember =
        userCommunityMembers[
          Math.floor(Math.random() * userCommunityMembers.length)
        ];
      const questDesc =
        questTemplates.weekly[
          Math.floor(Math.random() * questTemplates.weekly.length)
        ];
      const xpValue = 800 + Math.floor(Math.random() * 700);
      const isCompleted = Math.random() < 0.6;

      await prisma.quest.create({
        data: {
          userId: user.id,
          communityId: communityMember.communityId,
          communityMemberId: communityMember.id,
          description: `${questDesc} - ${firstNames[i] || 'User'}`,
          xpValue: xpValue,
          isCompleted: isCompleted,
          date: lastWeek,
          type: 'Weekly',
          source: 'AI',
          periodStatus: 'LAST_WEEK',
          periodSeq: j + 1,
          viewedAt: lastWeek,
          startedAt: isCompleted
            ? lastWeek
            : Math.random() < 0.5
              ? lastWeek
              : null,
          completedAt: isCompleted
            ? new Date(
                lastWeek.getTime() +
                  Math.floor(Math.random() * 15 * 60 * 60 * 1000)
              )
            : null,
          estimatedMinutes: 120 + Math.floor(Math.random() * 180),
        },
      });
      questCount++;
    }

    // Create 1 weekly quest for TWO_WEEKS_AGO
    const communityMember2 =
      userCommunityMembers[
        Math.floor(Math.random() * userCommunityMembers.length)
      ];
    const questDesc2 =
      questTemplates.weekly[
        Math.floor(Math.random() * questTemplates.weekly.length)
      ];
    const isCompleted2 = Math.random() < 0.75;

    await prisma.quest.create({
      data: {
        userId: user.id,
        communityId: communityMember2.communityId,
        communityMemberId: communityMember2.id,
        description: `${questDesc2} - ${firstNames[i] || 'User'}`,
        xpValue: 800 + Math.floor(Math.random() * 700),
        isCompleted: isCompleted2,
        date: twoWeeksAgo,
        type: 'Weekly',
        source: 'AI',
        periodStatus: 'TWO_WEEKS_AGO',
        periodSeq: 1,
        viewedAt: twoWeeksAgo,
        startedAt: isCompleted2 ? twoWeeksAgo : null,
        completedAt: isCompleted2
          ? new Date(
              twoWeeksAgo.getTime() +
                Math.floor(Math.random() * 20 * 60 * 60 * 1000)
            )
          : null,
        estimatedMinutes: 120 + Math.floor(Math.random() * 180),
      },
    });
    questCount++;
  }

  console.log(`Created ${questCount} quests (daily and weekly)`);

  // Create some Tickets
  console.log('Creating tickets...');
  const subjects = [
    'BUG_REPORT',
    'FEATURE_REQUEST',
    'ACCOUNT_ISSUE',
    'COMMUNITY_MANAGEMENT',
    'QUEST_MANAGEMENT',
    'OTHER',
  ];
  const priorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const statuses = ['PENDING', 'WORKING_ON', 'TO_BE_DONE_LATER', 'APPROVED'];

  for (let i = 0; i < 25; i++) {
    const user = users[Math.floor(Math.random() * users.length)];
    await prisma.ticket.create({
      data: {
        userId: user.id,
        subject: subjects[Math.floor(Math.random() * subjects.length)] as any,
        message: `Ticket message from ${user.UserName}`,
        status: statuses[Math.floor(Math.random() * statuses.length)] as any,
        priority: priorities[
          Math.floor(Math.random() * priorities.length)
        ] as any,
        expectedDateOfCompletion:
          Math.random() < 0.5
            ? new Date(
                now.getTime() +
                  Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)
              )
            : null,
      },
    });
  }

  console.log('Created 25 tickets');

  // Create Messages for communities and clans
  console.log('Creating messages...');
  let messageCount = 0;

  // Community messages
  for (let i = 0; i < Math.min(30, communities.length); i++) {
    const community = communities[i];
    const members = communityMembers.filter(
      (cm) => cm.communityId === community.id
    );

    for (let j = 0; j < 3; j++) {
      const member = members[Math.floor(Math.random() * members.length)];
      await prisma.message.create({
        data: {
          content: `Message ${j + 1} in ${community.name}`,
          communityId: community.id,
          senderId: member.userId,
        },
      });
      messageCount++;
    }
  }

  // Clan messages
  for (let i = 0; i < Math.min(50, clans.length); i++) {
    const clan = clans[i];
    const members = clanMembers.filter((cm) => cm.clanId === clan.id);

    if (members.length > 0) {
      const member = members[Math.floor(Math.random() * members.length)];
      await prisma.message.create({
        data: {
          content: `Clan message in ${clan.name}`,
          communityId: clan.communityId,
          clanId: clan.id,
          senderId: member.userId,
        },
      });
      messageCount++;
    }
  }

  console.log(`Created ${messageCount} messages`);

  // Create AI Chat History
  console.log('Creating AI chat history...');
  const aiPrompts = [
    'Generate a daily quest for me',
    'Suggest a workout routine',
    'Help me with coding best practices',
    'What skills should I learn?',
    'Create a weekly challenge',
  ];

  for (let i = 0; i < 50; i++) {
    const user = users[Math.floor(Math.random() * users.length)];
    const prompt = aiPrompts[Math.floor(Math.random() * aiPrompts.length)];

    await prisma.aIChatHistory.create({
      data: {
        userId: user.id,
        sessionId: `session_${i}`,
        prompt: prompt,
        response: `AI response for: ${prompt}`,
        tokensUsed: 100 + Math.floor(Math.random() * 200),
        responseTime: 1000 + Math.floor(Math.random() * 2000),
      },
    });
  }

  console.log('Created 50 AI chat history entries');

  console.log('\n✅ Database seeding completed successfully!');
  console.log('\n=== Seeded Data Summary ===');
  console.log(`📚 Categories: ${categories.length}`);
  console.log(`👥 Users: ${users.length}`);
  console.log(`🏘️  Communities: ${communities.length}`);
  console.log(`👤 Community Members: ${communityMembers.length}`);
  console.log(`⚔️  Clans: ${clans.length}`);
  console.log(`🛡️  Clan Members: ${clanMembers.length}`);
  console.log(`📋 Quests: ${questCount}`);
  console.log(`🎫 Tickets: 25`);
  console.log(`💬 Messages: ${messageCount}`);
  console.log(`🤖 AI Chat Histories: 50`);
  console.log('\n=== Test Credentials ===');
  console.log('Admin: admin@levelup.com');
  console.log(
    'Users: james_anderson@levelup.com, mary_johnson@levelup.com, etc.'
  );
  console.log('Password: Password123!');
  console.log(
    '\nAll users have daily and weekly quests across multiple time periods!'
  );
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
