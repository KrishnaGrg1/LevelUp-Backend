import express from 'express';
import mainRoutes from './routes/mainRoutes';
import env from './helpers/config';
import translationMiddeware from './middlewares/translationMiddleware';
import helmet from 'helmet';
import cors from 'cors';

const app = express();
const port = env.PORT;

// CORS configuration
const corsOptions = {
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ) => {
    // Allow requests from these origins
    const allowedOrigins = [
      'http://localhost:3000',
      'https://www.melevelup.me', // ✅ Added www subdomain
      process.env.NEXT_PUBLIC_APP_URL,
    ].filter(Boolean);

    // Allow requests with no origin (like mobile apps, Postman, curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`❌ CORS blocked origin: ${origin}`);
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
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use('/api/v1/', translationMiddeware, mainRoutes);

app.listen(port, () => {
  console.log('Server running on port', port);
});
