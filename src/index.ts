import express from 'express';
import mainRoutes from './routes/mainRoutes';
import env from './helpers/config';
import translationMiddeware from './middlewares/translationMiddleware';

const app = express();
const port = env.PORT;

// Basic security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Simple CORS handling (replace with cors package in production)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-language'
  );
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use('/api/v1/', translationMiddeware, mainRoutes);

app.listen(port, () => {
  console.log('Server running on port', port);
});
