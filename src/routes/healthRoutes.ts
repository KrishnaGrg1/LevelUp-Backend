import { Router, Request, Response } from 'express';
import env from '../helpers/config';
import prisma from '../helpers/prisma';
import { io } from '../index';

const healthRoutes = Router();

healthRoutes.get('/', async (req: Request, res: Response) => {
  const healthCheck = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: env.NODE_ENV,
    version: '1.0.0',
    services: {
      server: 'healthy',
      database: 'unknown',
      socket: io ? 'healthy' : 'unhealthy',
    },
  };

  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    healthCheck.services.database = 'healthy';
  } catch (error) {
    healthCheck.services.database = 'unhealthy';
    healthCheck.status = 'degraded';
  }

  const statusCode = healthCheck.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(healthCheck);
});

export default healthRoutes;
