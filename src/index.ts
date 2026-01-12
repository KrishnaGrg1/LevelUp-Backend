import express from 'express';
import mainRoutes from './routes/mainRoutes';
import env from './helpers/config';
import translationMiddeware from './middlewares/translationMiddleware';
import helmet from 'helmet';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import initializeSocket from './sockets';
import { startDailyAiQuestJob } from './jobs/aiDailyQuests';
import { startWeeklyAiQuestJob } from './jobs/aiWeeklyQuests';
import logger from './helpers/logger';
const app = express();
const port = env.PORT;

//create HTTP Server (required for Socket.IO)
const httpServer = createServer(app);

// Socket.IO server setup
export const io = new Server(httpServer, {
  cors: {
    origin: [
      'http://localhost:3000',
      'https://www.melevelup.me',
      'https://level-up-olive-gamma.vercel.app',
      env.NEXT_PUBLIC_APP_URL,
    ].filter(Boolean) as string[],
    credentials: true,
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

//io is a Socket.IO instance attached to the HTTP server.
// It wraps the server to enable real-time communication (

// CORS configuration
const corsOptions = {
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ) => {
    // Allow requests from these origins
    const allowedOrigins = [
      'http://localhost:3000',
      'https://www.melevelup.me',
      'https://level-up-olive-gamma.vercel.app',
      process.env.NEXT_PUBLIC_APP_URL,
      process.env.FRONTEND_URL,
    ].filter(Boolean);

    // Allow requests with no origin (like mobile apps, Postman, curl)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('❌ CORS blocked origin', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-language',
    'X-Requested-With',
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 600, // Cache preflight requests for 10 minutes
};

app.use(cors(corsOptions));

// Security headers - Configure helmet to work with CORS
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  })
);

// Request logging middleware
app.use((req, res, next) => {
  logger.info('HTTP request', { method: req.method, url: req.originalUrl });
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use('/api/v1/', translationMiddeware, mainRoutes);

//Initialize Socket.IO wit handlers
initializeSocket(io);

httpServer.listen(port, () => {
  logger.info('🚀 LevelUp Backend Server Started', {
    port,
    environment: env.NODE_ENV,
  });
  logger.info('📍 HTTP Server', { url: `http://localhost:${port}` });
  logger.info('🔌 Socket.IO', { url: `ws://localhost:${port}/socket.io/` });
  logger.info('🔐 CORS allowed origins', {
    origins: [
      'http://localhost:3000',
      'https://www.melevelup.me',
      env.NEXT_PUBLIC_APP_URL,
    ].filter(Boolean),
  });

  // Start AI quest cron jobs
  startDailyAiQuestJob();
  startWeeklyAiQuestJob();
  logger.info('✅ AI Quest cron jobs scheduled');
});
