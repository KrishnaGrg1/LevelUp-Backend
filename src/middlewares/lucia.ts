import { Lucia, TimeSpan } from 'lucia';
import { PrismaAdapter } from '@lucia-auth/adapter-prisma';
import client from '../helpers/prisma.js';

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
    };
  }
}
export const lucia = new Lucia(adapter, {
  sessionExpiresIn: new TimeSpan(3, 'm'), // 3min
  sessionCookie: {
    name: 'session', // optional: cookie name
    attributes: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    },
  },
  getUserAttributes: (attributes) => ({
    id: attributes.id,
    UserName: attributes.UserName,
    email: attributes.email,
    isVerified: attributes.isVerified,
    xp: attributes.xp,
    level: attributes.level,
  }),
});
