import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import env from '../helpers/config';
import { sendRecoveryEmail } from '../helpers/sendRecoveryOtp';
import IRequest from '../middlewares/authMiddleware';
import client from '../helpers/prisma';
import {
  makeErrorResponse,
  makeSuccessResponse,
} from '../helpers/standartResponse';
import { TranslationRequest } from '../middlewares/translationMiddleware';
import { Language } from '../translation/translation';

const register = async (
  req: TranslationRequest,
  res: Response
): Promise<void> => {
  try {
    const lang = req.language as Language;
    const { UserName, email, password } = req.body;
    const existingUser = await client.user.findFirst({
      where: {
        UserName,
      },
    });
    if (existingUser) {
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
    const existingEmail = await client.user.findFirst({
      where: {
        email,
      },
    });
    if (existingEmail) {
      res
        .status(400)
        .json(
          makeErrorResponse(
            new Error('Email already exists'),
            'error.auth.email_exists',
            lang,
            400
          )
        );
      return;
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const NewUser = await client.user.create({
      data: {
        UserName,
        email: email,
        password: hashedPassword,
      },
    });
    res
      .status(200)
      .json(
        makeSuccessResponse(NewUser, 'success.auth.register', lang, 200, {
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

    const JWT_Password = env.JWT_SECRET as string;
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
    const otp = await sendRecoveryEmail(email);
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

const verifyPassword = async (
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
        streak: true,
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
  verifyPassword,
  me,
};

export default authController;
