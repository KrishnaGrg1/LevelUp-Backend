import { Lucia, TimeSpan } from 'lucia';
import { PrismaAdapter } from '@lucia-auth/adapter-prisma';
import client from '../helpers/prisma.js';
import env from '../helpers/config.js';
const adapter = new PrismaAdapter(client.session, client.user);
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
      domain: env.NODE_ENV === 'production' ? '.melevelup.me' : undefined, // Share cookie across subdomains
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
