import { Response } from 'express';
import bcrypt from 'bcrypt';

import { sendEmailToken } from '../helpers/sendRecoveryOtp';
import client from '../helpers/prisma';
import {
  makeErrorResponse,
  makeSuccessResponse,
} from '../helpers/standardResponse';
import { TranslationRequest } from '../middlewares/translationMiddleware';
import { Language } from '../translation/translation';
import { EmailTopic } from '../helpers/emailMessage';
import { lucia } from '../middlewares/lucia';
import { AuthRequest } from '../middlewares/authMiddleware';
import { deleteFile, extractPublicId } from '../helpers/files/multer';
import { findUser } from '../helpers/auth/userHelper';
import logger from '../helpers/logger';

const register = async (
  req: TranslationRequest,
  res: Response
): Promise<void> => {
  const lang = req.language as Language;

  try {
    const { email, username, password } = req.body;
    const user = await client.user.findUnique({
      where: {
        email,
      },
    });

    const existingUserByUsername = await client.user.findUnique({
      where: { UserName: username },
    });

    if (existingUserByUsername) {
      res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('Username already exists'),
            'error.auth.username_exists',
            lang,
            400
          )
        );
      return;
    }

    if (user) {
      if (user.isVerified === false) {
        await client.otp.deleteMany({ where: { userId: user.id } });

        const otp = await sendEmailToken(
          email,
          email,
          EmailTopic.VerifyEmail,
          user.id
        );
        logger.debug('OTP sent for verification email');
        const hashedOTP = await bcrypt.hash(otp, 10);

        await client.otp.create({
          data: {
            otp_code: hashedOTP,
            userId: user.id,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          },
        });

        res.status(200).json(
          makeSuccessResponse(user, 'success.auth.otp_resent', lang, 200, {
            'Content-Type': 'application/json',
          })
        );
        return;
      }
      res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('User already exists'),
            'error.auth.email_exists',
            lang,
            400
          )
        );
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await client.user.create({
      data: {
        email: email,
        UserName: username,
        password: hashedPassword,
        isVerified: false,
      },
    });
    const otp = await sendEmailToken(
      email,
      email,
      EmailTopic.VerifyEmail,
      newUser?.id
    );

    const hashedOTP = await bcrypt.hash(otp, 10);

    await client.otp.create({
      data: {
        otp_code: hashedOTP,
        userId: newUser.id,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    res.status(200).json(
      makeSuccessResponse(newUser, 'success.auth.register', lang, 200, {
        'Content-Type': 'application/json',
      })
    );
    return;
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';

    if (e instanceof Error) {
      res
        .status(500)
        .json(makeErrorResponse(e, 'error.auth.unexpected', lang, 500));
      return;
    } else {
      res
        .status(500)
        .json(
          makeErrorResponse(
            new Error('Unexpected error'),
            'error.auth.unexpected',
            lang,
            500
          )
        );
      return;
    }
  }
};

const verifyEmail = async (
  req: TranslationRequest,
  res: Response
): Promise<void> => {
  const lang = req.language as Language;
  const { userId, otp } = req.body;
  try {
    await client.$transaction(async (tx: any) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        res
          .status(400)
          .json(
            makeErrorResponse(
              new Error('User does not exist'),
              'error.auth.user_not_found',
              lang,
              400
            )
          );
        return;
      }

      const otpDoc = await tx.otp.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      });

      if (!otpDoc) {
        res
          .status(400)
          .json(
            makeErrorResponse(
              new Error('Invalid OTP or expired'),
              'error.auth.invalid_otp',
              lang,
              400
            )
          );
        return;
      }

      if (otpDoc.expiresAt < new Date()) {
        res
          .status(400)
          .json(
            makeErrorResponse(
              new Error('OTP expired'),
              'error.auth.invalid_otp',
              lang,
              400
            )
          );
        return;
      }
      const providedOtp = otp?.toString().trim();
      if (!providedOtp) {
        res
          .status(400)
          .json(
            makeErrorResponse(
              new Error('OTP required'),
              'error.auth.invalid_otp',
              lang,
              400
            )
          );
        return;
      }
      const validOTP = await bcrypt.compare(providedOtp, otpDoc.otp_code);
      if (!validOTP) {
        res
          .status(400)
          .json(
            makeErrorResponse(
              new Error('Invalid OTP or expired'),
              'error.auth.invalid_otp',
              lang,
              400
            )
          );
        return;
      }

      await tx.user.update({
        where: { id: user.id },
        data: { isVerified: true },
      });
      await tx.otp.delete({ where: { id: otpDoc.id } });
      await tx.otp.deleteMany({ where: { userId: user.id } });
      const session = await lucia.createSession(user.id, {});
      const sessionCookie = lucia.createSessionCookie(session.id);

      res.setHeader('Set-Cookie', sessionCookie.serialize());
      res.status(200).json(
        makeSuccessResponse(
          {
            isAdmin: user.isAdmin,
            expiredAt: session.expiresAt,
          },
          'success.auth.verify',
          lang,
          200
        )
      );
      return;
    });
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';

    if (e instanceof Error) {
      res
        .status(500)
        .json(makeErrorResponse(e, 'error.auth.unexpected', lang, 500));
    } else {
      res
        .status(500)
        .json(
          makeErrorResponse(
            new Error('Unexpected error'),
            'error.auth.unexpected',
            lang,
            500
          )
        );
    }
  }
};

const login = async (req: TranslationRequest, res: Response): Promise<void> => {
  try {
    const lang = req.language as Language;
    const { email, password } = req.body;

    const existingUser = await client.user.findFirst({
      where: { email },
    });

    if (!existingUser) {
      res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('User does not exist'),
            'error.auth.user_not_found',
            lang,
            400
          )
        );
      return;
    }
    if (!existingUser.password) {
      res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('Password login not available. Use OAuth.'),
            'error.auth.password_not_set',
            lang,
            400
          )
        );
      return;
    }
    const comparePassword = await bcrypt.compare(
      password,
      existingUser.password
    );
    if (!comparePassword) {
      res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('Incorrect password'),
            'error.auth.incorrect_password',
            lang,
            400
          )
        );
      return;
    }
    if (existingUser.isVerified === false) {
      await client.otp.deleteMany({ where: { userId: existingUser.id } });

      const otp = await sendEmailToken(
        email,
        email,
        EmailTopic.VerifyEmail,
        existingUser.id
      );
      const hashedOTP = await bcrypt.hash(otp, 10); //hash the otp

      //create new otp
      await client.otp.create({
        data: {
          otp_code: hashedOTP,
          userId: existingUser.id,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min expiry
        },
      });

      res
        .status(403)
        .json(
          makeErrorResponse(
            new Error('Email not verified. Verification link resent.'),
            'error.auth.email_not_verified',
            lang,
            403
          )
        );
      return;
    }
    // Check if user already has an active session
    const checkSession = await client.session.findFirst({
      where: {
        userId: existingUser.id,
      },
    });
    if (checkSession) {
      // invalidate it
      await lucia.invalidateSession(checkSession.id);
    }

    // Now Create Lucia session instead of JWT
    const session = await lucia.createSession(existingUser.id, {});
    const sessionCookie = lucia.createSessionCookie(session.id);

    res.setHeader('Set-Cookie', sessionCookie.serialize());
    res.status(200).json(
      makeSuccessResponse(
        {
          id: existingUser.id,
          UserName: existingUser.UserName,
          isadmin: existingUser.isAdmin,
          expiredAt: session.expiresAt,
          authSession: session.id,
        },
        'success.auth.login',
        lang,
        200
      )
    );
    return;
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';

    if (e instanceof Error) {
      res
        .status(500)
        .json(makeErrorResponse(e, 'error.auth.unexpected', lang, 500));
      return;
    } else {
      res
        .status(500)
        .json(
          makeErrorResponse(
            new Error('Unexpected error'),
            'error.auth.unexpected',
            lang,
            500
          )
        );
      return;
    }
  }
};

const forgetPassword = async (
  req: TranslationRequest,
  res: Response
): Promise<void> => {
  try {
    const { email } = req.body;
    const lang = req.language as Language;

    const existingUser = await client.user.findUnique({ where: { email } });

    if (!existingUser) {
      res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('User does not exist'),
            'error.auth.user_not_found',
            lang,
            400
          )
        );
      return;
    }

    // If not verified, resend verification OTP
    if (!existingUser.isVerified) {
      await client.otp.deleteMany({ where: { userId: existingUser.id } });

      const otp = await sendEmailToken(
        email,
        email,
        EmailTopic.VerifyEmail,
        existingUser.id
      );
      const hashedOtp = await bcrypt.hash(otp.toString(), 10);

      await client.otp.create({
        data: {
          otp_code: hashedOtp,
          userId: existingUser.id,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
      });

      res
        .status(403)
        .json(
          makeErrorResponse(
            new Error('Email not verified. Verification link resent.'),
            'error.auth.email_not_verified',
            lang,
            403
          )
        );
      return;
    }

    await client.otp.deleteMany({ where: { userId: existingUser.id } });

    const otp = await sendEmailToken(
      email,
      existingUser.UserName,
      EmailTopic.ForgotPassword,
      existingUser.id
    );
    const hashedOtp = await bcrypt.hash(otp.toString(), 10);

    const newOtp = await client.otp.create({
      data: {
        otp_code: hashedOtp,
        userId: existingUser.id,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    res
      .status(200)
      .json(
        makeSuccessResponse(
          { userId: existingUser.id },
          'success.auth.otp_sent',
          lang,
          200
        )
      );
    return;
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          e instanceof Error ? e : new Error('Unexpected error'),
          'error.auth.unexpected',
          lang,
          500
        )
      );
    return;
  }
};

const resetPassword = async (
  req: TranslationRequest,
  res: Response
): Promise<void> => {
  const { otp, userId, newPassword } = req.body;
  const lang = (req.language as Language) || 'eng';
  try {
    await client.$transaction(async (tx: any) => {
      // Find user
      const existingUser = await tx.user.findUnique({
        where: { id: userId },
      });

      if (!existingUser) {
        res
          .status(400)
          .json(
            makeErrorResponse(
              new Error('User not found'),
              'error.auth.user_not_found',
              req.language as Language,
              400
            )
          );
        return;
      }

      // Fetch latest OTP and compare hashed value (otp_code is a hashed string)
      const latestOtp = await tx.otp.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      if (!latestOtp) {
        res
          .status(400)
          .json(
            makeErrorResponse(
              new Error('Invalid OTP'),
              'error.auth.invalid_otp',
              req.language as Language,
              400
            )
          );
        return;
      }

      const providedOtp = otp?.toString().trim();
      if (!providedOtp) {
        res
          .status(400)
          .json(
            makeErrorResponse(
              new Error('OTP required'),
              'error.auth.invalid_otp',
              req.language as Language,
              400
            )
          );
        return;
      }

      const otpValid = await bcrypt.compare(providedOtp, latestOtp.otp_code);
      if (!otpValid) {
        res
          .status(400)
          .json(
            makeErrorResponse(
              new Error('Invalid OTP'),
              'error.auth.invalid_otp',
              req.language as Language,
              400
            )
          );
        return;
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password & delete OTP inside the same ongoing transaction
      await tx.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });
      await tx.otp.delete({ where: { id: latestOtp.id } });
      res
        .status(200)
        .json(
          makeSuccessResponse(null, 'success.auth.password_updated', lang, 200)
        );
      return;
    });
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          e instanceof Error ? e : new Error('Unexpected error'),
          'error.auth.unexpected',
          lang,
          500
        )
      );
    return;
  }
};

const me = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const lang = (req.language as Language) || 'eng';

    if (!req.user || !req.session) {
      res
        .status(401)
        .json(
          makeErrorResponse(
            new Error('Not authenticated'),
            'error.auth.not_authenticated',
            lang,
            401
          )
        );
      return;
    }
    const user = await client.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        UserName: true,
        email: true,
        xp: true,
        level: true,
        createdAt: true,
        updatedAt: true,
        isVerified: true,
        provider: true,
        providerId: true,
        isAdmin: true,
        isBanned: true,
        banUntil: true,
        profilePicture: true,
        timezone: true,
        tokens: true,
        hasOnboarded: true,
      },
    });

    if (!user) {
      res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('User not found'),
            'error.auth.user_not_found',
            lang,
            404
          )
        );
      return;
    }

    res
      .status(200)
      .json(
        makeSuccessResponse(user, 'success.auth.user_retrieved', lang, 200)
      );
    return;
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to get user'),
          'error.auth.unexpected',
          lang,
          500
        )
      );
    return;
  }
};
const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const lang = req.language as Language;

    //getting session cookie

    const sessionId = req.session.id;

    await lucia.invalidateSession(sessionId);

    const blankCookie = lucia.createBlankSessionCookie();
    res.setHeader('Set-Cookie', blankCookie.serialize());

    res
      .status(200)
      .json(makeSuccessResponse(null, 'success.auth.logout', lang, 200));
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Logout failed'),
          'error.auth.logout_failed',
          lang,
          500
        )
      );
  }
};
const deleteAccount = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const lang = req.language as Language;
    const userId = req.user?.id;
    logger.debug('Delete account requested', { userId });

    if (!userId) {
      res
        .status(401)
        .json(
          makeErrorResponse(
            new Error('Not authenticated'),
            'error.auth.not_authenticated',
            lang,
            401
          )
        );
      return;
    }

    logger.debug('Deleting account', { userId });

    // delete user → sessions cascade automatically
    const check = await client.user.delete({
      where: { id: userId },
    });

    logger.debug('Account deletion completed', { userId: check?.id });

    if (!check) {
      res
        .status(401)
        .json(
          makeErrorResponse(
            new Error('Not authenticated'),
            'error.auth.not_authenticated',
            lang,
            401
          )
        );
      return;
    }

    // clear session cookie on client side
    const blankCookie = lucia.createBlankSessionCookie();
    res.setHeader('Set-Cookie', blankCookie.serialize());

    res
      .status(200)
      .json(
        makeSuccessResponse(null, 'success.auth.account_deleted', lang, 200)
      );
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Account deletion failed'),
          'error.auth.account_deletion_failed',
          lang,
          500
        )
      );
  }
};

const uploadProfilePicture = async (req: AuthRequest, res: Response) => {
  const lang = (req.language as Language) || 'eng';

  try {
    const userId = req.user?.id;
    if (!userId) {
      return res
        .status(401)
        .json(
          makeErrorResponse(
            new Error('Not authenticated'),
            'error.auth.not_authenticated',
            lang,
            401
          )
        );
    }

    if (!req.file) {
      return res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('No file uploaded'),
            'error.upload.no_file',
            lang,
            400
          )
        );
    }

    logger.debug('Profile picture upload received', {
      userId,
      fileSize: (req.file as any)?.size,
      mimeType: (req.file as any)?.mimetype,
    });

    const user = await client.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('User not found'),
            'error.auth.user_not_found',
            lang,
            404
          )
        );
    }

    // Delete old profile picture from Cloudinary if it exists
    if (user.profilePicture) {
      const publicId = extractPublicId(user.profilePicture);
      if (publicId) {
        await deleteFile(publicId);
      }
    }

    // Get Cloudinary URL from uploaded file
    const cloudinaryFile = req.file as any;
    const profilePictureUrl = cloudinaryFile.path || cloudinaryFile.url;

    if (!profilePictureUrl) {
      return res
        .status(500)
        .json(
          makeErrorResponse(
            new Error('Failed to get Cloudinary URL'),
            'error.upload.failed_to_upload',
            lang,
            500
          )
        );
    }

    // Update user with new profile picture URL from Cloudinary
    const updatedUser = await client.user.update({
      where: { id: userId },
      data: {
        profilePicture: profilePictureUrl, // Cloudinary URL
      },
    });

    res
      .status(200)
      .json(
        makeSuccessResponse(
          { profilePicture: updatedUser.profilePicture },
          'success.upload.profile_picture_uploaded',
          lang,
          200
        )
      );
  } catch (error) {
    logger.error('Error uploading profile picture', error, {
      userId: req.user?.id,
    });
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          new Error('Failed to upload profile picture'),
          'error.upload.failed_to_upload',
          lang,
          500
        )
      );
  }
};

const changePassword = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  const { confirmNewPassword, currentPassword, newPassword } = req.body;

  const userId = req.user?.id;
  logger.debug('Change password requested', { userId });
  const lang = (req.language as Language) || 'eng';
  try {
    await client.$transaction(async (tx: any) => {
      // Find user
      const existingUser = await tx.user.findUnique({
        where: { id: userId },
      });

      if (!existingUser) {
        res
          .status(400)
          .json(
            makeErrorResponse(
              new Error('User not found'),
              'error.auth.user_not_found',
              req.language as Language,
              400
            )
          );
        return;
      }

      if (newPassword !== confirmNewPassword) {
        res
          .status(400)
          .json(
            makeErrorResponse(
              new Error('New password and confirm password do not match'),
              'error.auth.passwords_do_not_match',
              req.language as Language,
              400
            )
          );
        return;
      }

      const isCurrentPasswordValid = await bcrypt.compare(
        currentPassword,
        existingUser.password
      );
      if (!isCurrentPasswordValid) {
        res
          .status(400)
          .json(
            makeErrorResponse(
              new Error('Current password is incorrect'),
              'error.auth.incorrect_current_password',
              req.language as Language,
              400
            )
          );
        return;
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await client.$transaction([
        client.user.update({
          where: { id: userId },
          data: { password: hashedPassword },
        }),
      ]);

      res
        .status(200)
        .json(
          makeSuccessResponse(null, 'success.auth.change_password', lang, 200)
        );
      return;
    });
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    res
      .status(500)
      .json(
        makeErrorResponse(
          e instanceof Error ? e : new Error('Unexpected error'),
          'error.auth.unexpected',
          lang,
          500
        )
      );
    return;
  }
};

const onBoarding = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const lang = req.language as Language;
    const userId = req.user?.id;
    const { goal, heardAboutUs, experience } = req.body;

    if (!userId) {
      res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('User ID is required'),
            'error.auth.user_id_required',
            lang,
            400
          )
        );
      return;
    }

    const user = await findUser(userId, res, lang);
    if (!user) return;

    const categoryNames: string[] = Array.isArray(req.body.categoriesNames)
      ? req.body.categoriesNames
      : [];

    logger.debug('Onboarding request received', {
      userId,
      categoryCount: categoryNames.length,
    });

    const onboarding = await client.userOnboarding.create({
      data: {
        userId,
        goal: goal,
        heardAboutUs: heardAboutUs,
        experience: experience,
        categories:
          categoryNames.length > 0
            ? {
                connectOrCreate: categoryNames.map((name) => ({
                  where: { name },
                  create: { name },
                })),
              }
            : undefined,
      },
      include: { categories: true },
    });

    logger.debug('Onboarding created', {
      userId,
      onboardingId: onboarding.id,
      categories: onboarding.categories?.length,
    });

    const updatedUser = await client.user.update({
      where: { id: userId },
      data: { hasOnboarded: true },
      select: {
        id: true,
        UserName: true,
        email: true,
        hasOnboarded: true,
        xp: true,
        level: true,
        tokens: true,
        profilePicture: true,
        isVerified: true,
      },
    });

    logger.info('User onboarding completed and hasOnboarded set to true', {
      userId,
      hasOnboarded: updatedUser.hasOnboarded,
    });

    res.status(200).json(
      makeSuccessResponse(
        {
          onboarding,
          user: updatedUser,
        },
        'success.auth.onboarding_complete',
        lang,
        200
      )
    );
    return;
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';

    if (e instanceof Error) {
      logger.error('Error fetching categories', e, { userId: req.user?.id });
      res
        .status(500)
        .json(makeErrorResponse(e, 'error.auth.unexpected', lang, 500));
      return;
    } else {
      logger.error('Unexpected error fetching categories', e, {
        userId: req.user?.id,
      });
      res
        .status(500)
        .json(
          makeErrorResponse(
            new Error('Unexpected error'),
            'error.auth.unexpected',
            lang,
            500
          )
        );
      return;
    }
  }
};

const fetchCategories = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const lang = req.language as Language;

    // Check which categories already exist
    const existingCategories = await client.category.findMany();

    // Validate input
    if (existingCategories.length === 0) {
      res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('No category found'),
            'error.admin.no_category_found',
            lang,
            400
          )
        );
      return;
    }

    res.status(200).json(
      makeSuccessResponse(
        {
          count: existingCategories.length,
          categories: existingCategories.map((c) => c.name),
        },
        'success.admin.fetched_category',
        lang,
        200
      )
    );
    return;
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    logger.error('Error fetching categories', e, { userId: req.user?.id });
    res
      .status(500)
      .json(
        makeErrorResponse(
          e instanceof Error ? e : new Error('Fetch category failed'),
          'error.admin.fetch_category_failed',
          lang,
          500
        )
      );
  }
};

const editProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    logger.apiRequest('PATCH', `/auth/editProfile`, {
      action: 'editProfile',
    });
    console.log(req.body);
    const userId = req.user?.id;
    const lang = req.language as Language;
    if (!userId) {
      res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('User ID is required'),
            'error.auth.user_id_required',
            lang,
            400
          )
        );
      return;
    }
    const { username } = req.body;
    const user = await client.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('User not found'),
            'error.auth.user_not_found',
            lang,
            404
          )
        );
      return;
    }
    const exisitingUsername = await client.user.findUnique({
      where: { UserName: username },
    });
    if (exisitingUsername) {
      res
        .status(404)
        .json(
          makeErrorResponse(
            new Error('Username already exist'),
            'error.auth.user_already_exist',
            lang,
            404
          )
        );
      return;
    }
    await client.user.update({
      where: {
        id: userId,
      },
      data: {
        UserName: username,
      },
    });
    logger.apiSuccess('PATCH', `/auth/editProfile`, 200, {
      username,
    });
    res.status(201).json(makeSuccessResponse(null, 'success.auth.editProfile'));
  } catch (e: unknown) {
    const lang = (req.language as Language) || 'eng';
    logger.error('Error editing profile', e, { userId: req.user?.id });
    res
      .status(500)
      .json(
        makeErrorResponse(
          e instanceof Error ? e : new Error('Edit Profile failed'),
          'error.auth.editProfile',
          lang,
          500
        )
      );
  }
};
const authController = {
  register,
  login,
  forgetPassword,
  resetPassword,
  me,
  verifyEmail,
  logout,
  deleteAccount,
  uploadProfilePicture,
  changePassword,
  onBoarding,
  fetchCategories,
  editProfile,
};

export default authController;
