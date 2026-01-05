import cron from 'node-cron';
import client from '../helpers/prisma';
import logger from '../helpers/logger';

export function startSessionCleanupJob() {
  // Runs every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    const result = await client.session.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    logger.info('[Session Cleanup] Deleted expired sessions', { deleted: result.count });
  });
}
