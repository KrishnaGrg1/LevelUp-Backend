import nodemailer from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport'; // 👈 add this
import env from './config';
import html, { EmailTopic } from './emailMessage';
import { Resend } from 'resend';
import logger from './logger';
// const transporter = nodemailer.createTransport({
//   host: env.SMTP_HOST,
//   port: Number(env.SMTP_PORT),
//   secure: Number(env.SMTP_PORT) === 465,
//   auth: {
//     user: env.SMTP_USER,
//     pass: env.SMTP_PASS,
//   },
// } as SMTPTransport.Options);
const resend = new Resend(env.RESEND_API_KEY as string);

function generateToken(): string {
  return (100000 + Math.floor(Math.random() * 900000)).toString();
}
async function sendEmail(
  to: string,
  subject: string,
  htmlMsg: string
): Promise<any> {
  try {
    logger.debug('Sending email', { to });
    const { data, error } = await resend.emails.send({
      from: env.RESEND_EMAIL_FROM as string,
      to: [to],
      subject: subject,
      html: htmlMsg,
    });
    if (error) {
      logger.error('Resend API error', error, { to });
      throw new Error(error.message);
    }
    logger.debug('Email sent', { to, id: data?.id });
    return data;
  } catch (error) {
    logger.error('Failed to send email', error, { to });
    throw new Error('Email service failure');
  }
}

export async function sendEmailToken(
  userEmail: string,
  username: string,
  topic: EmailTopic,
  userId?: string | number
): Promise<string> {
  const token = generateToken();
  logger.debug('Generated email token', { topic, userEmail });
  const htmlMsg = html({
    token,
    topic,
    username,
    userId,
  });

  await sendEmail(userEmail, topic, htmlMsg);
  return token;
}
