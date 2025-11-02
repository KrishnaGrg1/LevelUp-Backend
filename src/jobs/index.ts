import { scheduleDailyQuestGeneration } from './dailyQuestGeneration';
import { scheduleDailyTokenRefill } from './dailyTokenRefill';

export function startJobs() {
  scheduleDailyQuestGeneration();
  scheduleDailyTokenRefill();
  console.log('[JOBS] All cron jobs initialized');
}
