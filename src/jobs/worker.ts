import { startSessionCleanupJob } from './sessionCleanup';
import { startDailyAiQuestJob } from './aiDailyQuests';
import { startWeeklyAiQuestJob } from './aiWeeklyQuests';
import logger from '../helpers/logger';

startSessionCleanupJob();
startDailyAiQuestJob();
startWeeklyAiQuestJob();
logger.info('Worker started: running cron jobs...');

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
