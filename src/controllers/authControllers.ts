import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import env from '../helpers/config';
import { sendEmailToken } from '../helpers/sendRecoveryOtp';
import IRequest from '../middlewares/authMiddleware';
import client from '../helpers/prisma';
import {
  makeErrorResponse,
  makeSuccessResponse,
} from '../helpers/standardResponse';
import { TranslationRequest } from '../middlewares/translationMiddleware';
import { Language } from '../translation/translation';
import { EmailTopic } from '../helpers/emailMessage';
import { promises } from 'nodemailer/lib/xoauth2';

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
        const hashedOTP = await bcrypt.hash(otp, 10); //hash the otp

        //create new otp
        await client.otp.create({
          data: {
            otp_code: hashedOTP,
            userId: user.id,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min expiry
          },
        });
        res.status(200).json(
          makeSuccessResponse(null, 'success.auth.register', lang, 200, {
            'Content-Type': 'application/json',
          })
        );
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

    const otp = await sendEmailToken(email, email, EmailTopic.VerifyEmail);
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    //create new user
    const newUser = await client.user.create({
      data: {
        email: email,
        UserName: username, // temporary unique username
        password: hashedPassword, // placeholder password
        isVerified: false,
      },
    });

    const hashedOTP = await bcrypt.hash(otp, 10); //hash the otp

    //create new otp
    await client.otp.create({
      data: {
        otp_code: hashedOTP,
        userId: newUser.id,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min expiry
      },
    });

    res.status(200).json(
      makeSuccessResponse(null, 'success.auth.register', lang, 200, {
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

const verifyOTP = async (
  req: TranslationRequest,
  res: Response
): Promise<void> => {
  const lang = req.language as Language;
  const { email, otp } = req.body;

  try {
    await client.$transaction(async (tx: any) => {
      // Find user
      const user = await tx.user.findFirst({
        where: { email },
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

      // Check expiry
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

      const validOTP = await bcrypt.compare(otp, otpDoc.otp_code);
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

      await client.user.update({
        where: { id: user.id },
        data: { isVerified: true },
      });

      // Delete all OTPs for this user
      await tx.otp.deleteMany({ where: { userId: user.id } });

      res
        .status(200)
        .json(
          makeSuccessResponse(
            { email: email },
            'success.auth.otp_sent',
            lang,
            200,
            { 'Content-Type': 'application/json' }
          )
        );
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

    const JWT_Password = env.JWT_Password as string;
    const token = jwt.sign({ userID: existingUser.id }, JWT_Password, {
      expiresIn: '1h',
    });

    res
      .status(200)
      .json(makeSuccessResponse(token, 'success.auth.login', lang));
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
    const existingUser = await client.user.findFirst({
      where: {
        email,
      },
    });
    if (!existingUser) {
      res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('User does not exist'),
            'error.auth.user_not_found',
            req.language as Language,
            400
          )
        );
      return;
    }
    const otp = await sendEmailToken(
      email,
      existingUser.UserName,
      EmailTopic.ForgotPassword
    );
    const hashed_Otp = await bcrypt.hash(otp, 10);

    const newOtp = await client.otp.create({
      data: {
        otp_code: hashed_Otp,
        userId: existingUser.id,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    res
      .status(200)
      .json(
        makeSuccessResponse(
          { otpId: newOtp.id },
          'success.auth.otp_sent',
          req.language as Language,
          200,
          { 'Content-Type': 'application/json' }
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

const verifyOTPLink = async (
  req: TranslationRequest,
  res: Response
): Promise<void> => {
  const { id, token } = req.query;
  const lang = req.language as Language;
  const userId = Number(id); // convert string to number

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
              new Error('User not found'),
              'error.auth.user_not_found',
              req.language as Language,
              400
            )
          );
        return;
      }

      const otpDoc = await tx.otp.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      if (!otpDoc) {
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
      // Check expiry
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
      const validOTP = await bcrypt.compare(token as string, otpDoc.otp_code);
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

      const verifiedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          isVerified: true,
        },
      });

      // Delete all OTPs for this user
      await tx.otp.deleteMany({ where: { userId: user.id } });

      res
        .status(200)
        .json(
          makeSuccessResponse(
            { verifiedUser },
            'success.auth.otp_sent',
            lang,
            200,
            { 'Content-Type': 'application/json' }
          )
        );
    });
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

const resetPassword = async (
  req: TranslationRequest,
  res: Response
): Promise<void> => {
  const { otp, userId, newPassword } = req.body;

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

      // Find OTP
      const existingOtp = await tx.otp.findFirst({
        where: {
          userId,
          otp_code: otp,
        },
      });

      if (!existingOtp) {
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

      // Update password
      await tx.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });

      // Delete OTP entry
      await tx.otp.delete({
        where: { id: existingOtp.id },
      });

      res.status(200).json({ message: 'Password updated successfully' });
    });
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

const me = async (req: TranslationRequest, res: Response): Promise<void> => {
  try {
    const userID = req.userID;
    if (!userID) {
      res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('User ID is required'),
            'error.auth.user_id_required',
            req.language as Language,
            400
          )
        );
      return;
    }
    const existingUser = await client.user.findUnique({
      where: {
        id: Number(userID),
      },
      select: {
        id: true,
        UserName: true,
        email: true,
        xp: true,
        level: true,
        createdAt: true,
      },
    });
    if (!existingUser) {
      res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('User does not exist'),
            'error.auth.user_not_found',
            req.language as Language,
            400
          )
        );
      return;
    }
    res
      .status(200)
      .json(
        makeSuccessResponse(
          existingUser,
          'success.auth.user_info',
          req.language as Language,
          200,
          { 'Content-Type': 'application/json' }
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

const authController = {
  register,
  login,
  forgetPassword,
  resetPassword,
  me,
  verifyOTP,

  verifyOTPLink,
};

export default authController;
