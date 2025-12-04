import { runDailyAiQuestNow } from './aiDailyQuests';
import client from '../helpers/prisma';

(async () => {
  console.log('[DailyQuest] Manual run initiated');
  try {
    await runDailyAiQuestNow();
    console.log('[DailyQuest] Manual run completed successfully');
  } catch (e) {
    console.error('[DailyQuest] Manual run failed', e);
    process.exit(1);
  } finally {
    await client.$disconnect();
  }
})();
