import { runWeeklyAiQuestNow } from './aiWeeklyQuests';
import client from '../helpers/prisma';
import logger from '../helpers/logger';

(async () => {
  try {
    await runWeeklyAiQuestNow();
  } catch (e) {
    logger.error('[WeeklyQuest] Manual run failed', e);
  } finally {
    await client.$disconnect();
  }
})();
