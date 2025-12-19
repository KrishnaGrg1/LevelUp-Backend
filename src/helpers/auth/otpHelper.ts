import bcrypt from 'bcrypt';
import { sendEmailToken } from '../sendRecoveryOtp';
import { EmailTopic } from '../emailMessage';
import client from '../prisma';

/**
 * Create and send OTP for a user
 * @param email - User's email address
 * @param userId - User's ID
 * @param topic - Email topic (VerifyEmail or PasswordReset)
 * @returns The created OTP record
 */
export async function createAndSendOTP(
  email: string,
  userId: string,
  topic: EmailTopic
) {
  // Delete any existing OTPs for this user
  await client.otp.deleteMany({ where: { userId } });

  // Send OTP via email
  const otp = await sendEmailToken(email, email, topic, userId);
  console.log('OTP sent:', otp);

  // Hash the OTP
  const hashedOTP = await bcrypt.hash(otp, 10);

  // Create new OTP record with 10 min expiry
  const otpRecord = await client.otp.create({
    data: {
      otp_code: hashedOTP,
      userId,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  return otpRecord;
}
