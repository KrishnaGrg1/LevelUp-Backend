import { runWeeklyAiQuestNow } from './aiWeeklyQuests';
import client from '../helpers/prisma';

(async () => {
  try {
    await runWeeklyAiQuestNow();
  } catch (e) {
    console.error('[WeeklyQuest] Manual run failed', e);
  } finally {
    await client.$disconnect();
  }
})();
