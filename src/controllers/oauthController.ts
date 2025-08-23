import { Response } from 'express';
import axios from 'axios';
import client from '../helpers/prisma';
import { lucia } from '../middlewares/lucia';
import {
  makeErrorResponse,
  makeSuccessResponse,
} from '../helpers/standardResponse';
import { TranslationRequest } from '../middlewares/translationMiddleware';
import { Language } from '../translation/translation';

const oauthLogin = async (req: TranslationRequest, res: Response) => {
  const lang = req.language as Language;

  try {
    const { provider, code } = req.body; // e.g., provider = 'google' | 'github'

    if (!provider || !code) {
      return res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('Provider or code missing'),
            'error.auth.missing_provider_or_code',
            lang,
            400
          )
        );
    }

    let userInfo: { email: string; name: string; providerId: string };

    if (provider === 'google') {
      // Exchange code for access token
      const tokenRes = await axios.post(
        `https://oauth2.googleapis.com/token`,
        null,
        {
          params: {
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            redirect_uri: process.env.GOOGLE_REDIRECT_URI,
            code,
            grant_type: 'authorization_code',
          },
        }
      );

      const { id_token } = tokenRes.data;
      const profile = await axios.get(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        {
          headers: { Authorization: `Bearer ${id_token}` },
        }
      );
      userInfo = {
        email: profile.data.email,
        name: profile.data.name,
        providerId: profile.data.sub,
      };
    } else if (provider === 'github') {
      // Exchange code for access token
      const tokenRes = await axios.post(
        `https://github.com/login/oauth/access_token`,
        null,
        {
          params: {
            client_id: process.env.GITHUB_CLIENT_ID,
            client_secret: process.env.GITHUB_CLIENT_SECRET,
            code,
          },
          headers: { Accept: 'application/json' },
        }
      );

      const accessToken = tokenRes.data.access_token;
      const profile = await axios.get('https://api.github.com/user', {
        headers: { Authorization: `token ${accessToken}` },
      });
      userInfo = {
        email: profile.data.email,
        name: profile.data.login,
        providerId: profile.data.id.toString(),
      };
    } else {
      return res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('Unsupported provider'),
            'error.auth.unsupported_provider',
            lang,
            400
          )
        );
    }

    // Find or create user
    let user = await client.user.findFirst({
      where: {
        OR: [
          { email: userInfo.email },
          { provider: provider, providerId: userInfo.providerId },
        ],
      },
    });

    if (!user) {
      user = await client.user.create({
        data: {
          email: userInfo.email,
          UserName: userInfo.name,
          isVerified: true,
          provider,
          providerId: userInfo.providerId,
        },
      });
    }

    // Create Lucia session
    const session = await lucia.createSession(user.id, {});
    const sessionCookie = lucia.createSessionCookie(session.id);

    res.setHeader('Set-Cookie', sessionCookie.serialize());
    res.status(200).json(
      makeSuccessResponse(
        {
          id: user.id,
          UserName: user.UserName,
          email: user.email,
          isVerified: user.isVerified,
          xp: user.xp,
          level: user.level,
        },
        'success.auth.oauth_login',
        lang,
        200
      )
    );
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json(
        makeErrorResponse(
          err as Error,
          'error.auth.oauth_failed',
          req.language as Language,
          500
        )
      );
  }
};

const oauthController = {
  oauthLogin,
};
export default oauthController;
