import express from 'express';
import mainRoutes from './routes/mainRoutes';
import env from './helpers/config';
import translationMiddeware from './middlewares/translationMiddleware';
import helmet from 'helmet';
import cors from 'cors';
import { startJobs } from './jobs';

const app = express();
const port = env.PORT;

// CORS configuration
const corsOptions = {
  origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-language'],
};

app.use(cors(corsOptions));

// Security headers
app.use(helmet());

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use('/api/v1/', translationMiddeware, mainRoutes);

app.listen(port, () => {
  console.log('Server running on port', port);
  
  // Initialize cron jobs for daily quest generation and token refill
  startJobs();
});
