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
import env from '../helpers/config';
import qs from 'qs';

const oauthLogin = async (req: TranslationRequest, res: Response) => {
  const lang = req.language as Language;

  try {
    const { provider, code, redirectUri } = req.body;

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
      const googleRedirectUri = redirectUri || env.GOOGLE_REDIRECT_URI;

      try {
        const tokenRes = await axios.post(
          'https://oauth2.googleapis.com/token',
          qs.stringify({
            client_id: env.GOOGLE_CLIENT_ID,
            client_secret: env.GOOGLE_CLIENT_SECRET,
            redirect_uri: googleRedirectUri,
            code,
            grant_type: 'authorization_code',
          }),
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          }
        );

        if (!tokenRes.data.access_token) {
          throw new Error('No access token received from Google');
        }

        const profile = await axios.get(
          'https://www.googleapis.com/oauth2/v3/userinfo',
          {
            headers: { Authorization: `Bearer ${tokenRes.data.access_token}` },
          }
        );

        if (!profile.data.email) {
          throw new Error('Email not provided by Google');
        }

        userInfo = {
          email: profile.data.email,
          name: profile.data.name || profile.data.email.split('@')[0],
          providerId: profile.data.sub,
        };
      } catch (error) {
        console.error('Google OAuth error:', error);
        res
          .status(400)
          .json(
            makeErrorResponse(
              new Error('Failed to authenticate with Google'),
              'error.auth.google_oauth_failed',
              lang,
              400
            )
          );
        return;
      }
    } else if (provider === 'github') {
      const githubRedirectUri = redirectUri || env.GITHUB_REDIRECT_URI;

      try {
        const tokenRes = await axios.post(
          `https://github.com/login/oauth/access_token`,
          null,
          {
            params: {
              client_id: env.GITHUB_CLIENT_ID,
              client_secret: env.GITHUB_CLIENT_SECRET,
              redirect_uri: githubRedirectUri,
              code,
            },
            headers: { Accept: 'application/json' },
          }
        );

        if (!tokenRes.data.access_token) {
          throw new Error('No access token received from GitHub');
        }

        const accessToken = tokenRes.data.access_token;

        // Get user profile
        const profile = await axios.get('https://api.github.com/user', {
          headers: { Authorization: `token ${accessToken}` },
        });

        // Get user email (GitHub might return null for email in profile)
        let email = profile.data.email;
        if (!email) {
          const emailRes = await axios.get(
            'https://api.github.com/user/emails',
            {
              headers: { Authorization: `token ${accessToken}` },
            }
          );
          const primaryEmail = emailRes.data.find(
            (e: any) => e.primary && e.verified
          );
          email = primaryEmail?.email || null;
        }

        if (!email) {
          return res
            .status(400)
            .json(
              makeErrorResponse(
                new Error(
                  'Email not available from GitHub. Please make sure your GitHub email is public or verified.'
                ),
                'error.auth.no_email_from_provider',
                lang,
                400
              )
            );
        }

        userInfo = {
          email: email,
          name: profile.data.name || profile.data.login || 'GitHub User',
          providerId: profile.data.id.toString(),
        };
      } catch (error) {
        console.error('GitHub OAuth error:', error);
        return res
          .status(400)
          .json(
            makeErrorResponse(
              new Error('Failed to authenticate with GitHub'),
              'error.auth.github_oauth_failed',
              lang,
              400
            )
          );
      }
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

    // Enhanced user finding/creation logic with better tracking
    let user = await client.user.findFirst({
      where: {
        email: userInfo.email,
      },
    });

    let isNewUser = false;
    let actionTaken: 'login' | 'register' | 'link_account' = 'login';

    if (user) {
      // User exists with this email
      if (!user.provider || !user.providerId) {
        // This is a regular email/password user, link the OAuth account
        user = await client.user.update({
          where: { id: user.id },
          data: {
            provider,
            providerId: userInfo.providerId,
            // Update name if not set or if OAuth provides a better one
            UserName: user.UserName || userInfo.name,
          },
        });
        actionTaken = 'link_account';
      } else if (
        user.provider === provider &&
        user.providerId === userInfo.providerId
      ) {
        // Same OAuth account - regular login
        actionTaken = 'login';
      } else {
        // Different OAuth provider - return error with helpful message
        return res
          .status(409) // Conflict status code
          .json(
            makeErrorResponse(
              new Error(
                `An account with this email already exists using ${user.provider}. Please login with ${user.provider} instead.`
              ),
              'error.auth.account_exists_different_provider',
              lang,
              409
            )
          );
      }
    } else {
      // No user found, create new OAuth user
      isNewUser = true;
      actionTaken = 'register';

      // Generate unique username if needed
      let uniqueUsername = userInfo.name
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .toLowerCase();
      if (uniqueUsername.length < 3) {
        uniqueUsername = userInfo.email.split('@')[0];
      }

      // Check if username is taken and make it unique
      let usernameCounter = 0;
      let finalUsername = uniqueUsername;
      while (true) {
        const existingUser = await client.user.findFirst({
          where: { UserName: finalUsername },
        });
        if (!existingUser) break;
        usernameCounter++;
        finalUsername = `${uniqueUsername}${usernameCounter}`;
      }

      user = await client.user.create({
        data: {
          email: userInfo.email,
          UserName: finalUsername,
          isVerified: true, // OAuth users are pre-verified
          provider,
          providerId: userInfo.providerId,
          xp: 0,
          level: 1,
        },
      });
    }

    const session = await lucia.createSession(user.id, {});
    const sessionCookie = lucia.createSessionCookie(session.id);

    res.setHeader('Set-Cookie', sessionCookie.serialize());

    // Return response with additional metadata
    res.status(200).json(
      makeSuccessResponse(
        {
          id: user.id,
          UserName: user.UserName,
          email: user.email,
          isVerified: user.isVerified,
          xp: user.xp,
          level: user.level,
          createdAt: user.createdAt,
          isNewUser,
          actionTaken,
          provider,
        },
        actionTaken === 'register'
          ? 'success.auth.oauth_register'
          : actionTaken === 'link_account'
            ? 'success.auth.oauth_account_linked'
            : 'success.auth.oauth_login',
        lang,
        200
      )
    );
  } catch (err) {
    console.error('OAuth error:', err);

    // Handle specific OAuth errors
    if (axios.isAxiosError(err)) {
      const statusCode = err.response?.status || 500;
      const errorMessage =
        err.response?.data?.error_description ||
        err.response?.data?.message ||
        'OAuth authentication failed';

      return res
        .status(statusCode)
        .json(
          makeErrorResponse(
            new Error(errorMessage),
            'error.auth.oauth_provider_error',
            lang,
            statusCode
          )
        );
    }

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
