import { Lucia, TimeSpan } from 'lucia';
import { PrismaAdapter } from '@lucia-auth/adapter-prisma';
import client from '../helpers/prisma.js';
import env from '../helpers/config.js';
import logger from '../helpers/logger';

const adapter = new PrismaAdapter(client.session, client.user);

// Log cookie configuration on startup
logger.info('🍪 Lucia Cookie Configuration', {
  nodeEnv: env.NODE_ENV,
  secure: env.NODE_ENV === 'production',
  sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
});

declare module 'lucia' {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: {
      id: string;
      UserName: string;
      email: string;
      isVerified: boolean;
      xp: number;
      level: number;
      isAdmin: boolean;
    };
  }
}
export const lucia = new Lucia(adapter, {
  sessionExpiresIn: new TimeSpan(1, 'd'), // 1 day
  sessionCookie: {
    name: 'auth-session', // optional: cookie name
    attributes: {
      secure: env.NODE_ENV === 'production', // true in production (HTTPS required)
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' for cross-origin in production
      // Don't set domain - let browser handle it automatically
      // domain: env.NODE_ENV === 'production' ? '.melevelup.me' : undefined,
    },
  },
  getUserAttributes: (attributes) => ({
    id: attributes.id,
    UserName: attributes.UserName,
    email: attributes.email,
    isVerified: attributes.isVerified,
    xp: attributes.xp,
    level: attributes.level,
    isAdmin: attributes.isAdmin,
  }),
});
