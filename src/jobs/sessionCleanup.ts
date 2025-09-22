import cron from 'node-cron';
import client from '../helpers/prisma';

export function startSessionCleanupJob() {
  // Runs every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    const result = await client.session.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    console.log(`[Session Cleanup] Deleted ${result.count} expired sessions`);
  });
}
