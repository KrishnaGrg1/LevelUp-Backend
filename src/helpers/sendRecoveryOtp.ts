import nodemailer from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport'; // 👈 add this
import env from './config';
import html, { EmailTopic } from './emailMessage';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: Number(env.SMTP_PORT),
  secure: Number(env.SMTP_PORT) === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
} as SMTPTransport.Options);

function generateToken(): string {
  return (100000 + Math.floor(Math.random() * 900000)).toString();
}
async function sendEmail(
  to: string,
  subject: string,
  htmlMsg: string
): Promise<any> {
  try {
    const info = await transporter.sendMail({
      from: `"LevelUp" `,
      to,
      subject,
      html: htmlMsg,
    });

    console.log('Message sent: %s', info.messageId);
    return info;
  } catch (error) {
    console.error('Failed to send email:', error);
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

  const htmlMsg = html({
    token,
    topic,
    username,
    userId,
  });

  await sendEmail(userEmail, topic, htmlMsg);
  return token;
}
