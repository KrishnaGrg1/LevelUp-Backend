import { startSessionCleanupJob } from './sessionCleanup';
import { startDailyAiQuestJob } from './aiDailyQuests';
import { startWeeklyAiQuestJob } from './aiWeeklyQuests';

startSessionCleanupJob();
startDailyAiQuestJob();
startWeeklyAiQuestJob();
console.log('Worker started: running cron jobs...');

// Gracefully disconnect Prisma when process stops
import client from '../helpers/prisma';
process.on('SIGINT', async () => {
  await client.$disconnect();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await client.$disconnect();
  process.exit(0);
});
