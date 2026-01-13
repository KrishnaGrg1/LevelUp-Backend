import { runDailyAiQuestNow } from './aiDailyQuests';
import client from '../helpers/prisma';
import logger from '../helpers/logger';

(async () => {
  logger.info('[DailyQuest] Manual run initiated');
  try {
    await runDailyAiQuestNow();
    logger.info('[DailyQuest] Manual run completed successfully');
  } catch (e) {
    logger.error('[DailyQuest] Manual run failed', e);
    process.exit(1);
  } finally {
    await client.$disconnect();
  }
})();
