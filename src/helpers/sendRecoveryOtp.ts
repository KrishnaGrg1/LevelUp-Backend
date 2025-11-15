import nodemailer from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport'; // 👈 add this
import env from './config';
import html, { EmailTopic } from './emailMessage';
import { Resend } from 'resend';
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
    console.log('Sending email to:', to);
    const { data, error } = await resend.emails.send({
      from: env.RESEND_EMAIL_FROM as string,
      to: [to],
      subject: subject,
      html: htmlMsg,
    });
    if (error) {
      console.error('Resend API error:', error);
      throw new Error(error.message);
    }
    console.log('Message sent: %s', data);
    return data;
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
  console.log('Generated Token:', userId);
  const htmlMsg = html({
    token,
    topic,
    username,
    userId,
  });

  await sendEmail(userEmail, topic, htmlMsg);
  return token;
}
