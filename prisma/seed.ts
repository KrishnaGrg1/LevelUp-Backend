import { PrismaClient, SubscriptionPlan, MemberStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Seed Skills
  const skills = [
    {
      name: 'Coding',
      slug: 'coding',
      description: 'Master programming languages and software development',
      icon: '💻',
      isPremium: false,
    },
    {
      name: 'Fitness',
      slug: 'fitness',
      description: 'Build strength, endurance, and overall health',
      icon: '💪',
      isPremium: false,
    },
    {
      name: 'Productivity',
      slug: 'productivity',
      description: 'Optimize time management and workflow efficiency',
      icon: '⚡',
      isPremium: false,
    },
    {
      name: 'Public Speaking',
      slug: 'public-speaking',
      description: 'Improve communication and presentation skills',
      icon: '🎤',
      isPremium: true,
    },
    {
      name: 'Creative Writing',
      slug: 'creative-writing',
      description: 'Develop storytelling and writing techniques',
      icon: '✍️',
      isPremium: false,
    },
    {
      name: 'Design',
      slug: 'design',
      description: 'Learn UI/UX, graphic design, and visual thinking',
      icon: '🎨',
      isPremium: true,
    },
  ];

  console.log('Creating skills...');
  for (const skill of skills) {
    await prisma.skill.upsert({
      where: { slug: skill.slug },
      update: skill,
      create: skill,
    });
  }
  console.log(`✅ Created ${skills.length} skills`);

  // Seed Milestones
  const milestones = [
    {
      name: 'First Streak',
      description: 'Complete quests for 3 consecutive days',
      xpReward: 50,
    },
    {
      name: 'Week Warrior',
      description: 'Maintain a 7-day streak',
      xpReward: 150,
    },
    {
      name: 'Level 3 Achieved',
      description: 'Reach level 3 in any skill',
      xpReward: 100,
    },
    {
      name: 'Level 5 Master',
      description: 'Reach level 5 in any skill',
      xpReward: 250,
    },
    {
      name: 'Quest Completion Champion',
      description: 'Complete 50 quests',
      xpReward: 500,
    },
    {
      name: 'Skill Collector',
      description: 'Start progressing in 5 different skills',
      xpReward: 200,
    },
  ];

  console.log('Creating milestones...');
  let milestoneCount = 0;
  for (const milestone of milestones) {
    const existing = await prisma.milestone.findFirst({
      where: { name: milestone.name },
    });
    
    if (!existing) {
      await prisma.milestone.create({
        data: milestone,
      });
      milestoneCount++;
    }
  }
  console.log(`✅ Created ${milestoneCount} new milestones`);


  console.log('🎉 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
