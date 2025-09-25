// Define enum
export enum EmailTopic {
  ForgotPassword = 'forgot-password',
  VerifyEmail = 'verify-email',
}

// Props interface
interface HtmlProps {
  token: string;
  username: string;
  topic: EmailTopic;
  userId?: string | number;
}

// Function to get message
const message = (topic: EmailTopic): string => {
  switch (topic) {
    case EmailTopic.ForgotPassword:
      return 'You requested to reset your password. Use the token below to complete the process:';
    case EmailTopic.VerifyEmail:
      return 'Thank you for signing up! Please use the token below to verify your email address:';
    default:
      return '';
  }
};

const verifyEmailButton = (
  topic: EmailTopic,
  token: string,
  userId?: string | number
): string => {
  const baseUrl = 'http://localhost:8080/api/v1/auth';

  switch (topic) {
    case EmailTopic.VerifyEmail:
      return `<a 
        href="${baseUrl}/verify-email?token=${token}&id=${userId}" 
        style="
          display:inline-block;
          background-color:#4f46e5;
          color:#ffffff;
          font-size:16px;
          font-weight:bold;
          text-decoration:none;
          padding:14px 28px;
          border-radius:8px;
          box-shadow:0 4px 10px rgba(0,0,0,0.15);
          transition:background-color 0.3s ease;
        "
      >
         Verify Email
      </a>
      `;
    default:
      return '';
  }
};
// Function to get a nicer title
const subject = (topic: EmailTopic): string => {
  switch (topic) {
    case EmailTopic.ForgotPassword:
      return '🔒 Reset Your Password';
    case EmailTopic.VerifyEmail:
      return '📩 Verify Your Email';
    default:
      return 'Notification';
  }
};

// HTML template
const html = ({ token, topic, username, userId }: HtmlProps): string => {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${subject(topic)}</title>
  </head>
  <body style="margin:0; padding:0; font-family: Arial, sans-serif; background-color:#f4f6f8;">
    <table width="100%" cellspacing="0" cellpadding="0" border="0" style="padding:40px 0;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="20" cellspacing="0" border="0" style="background:#ffffff; border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,0.1);">
            
            <!-- Header -->
            <tr>
              <td align="center" style="border-bottom:1px solid #eee; padding:30px;">
                <h2 style="margin:0; color:#333;">${subject(topic)}</h2>
              </td>
            </tr>
            
            <!-- Body -->
            <tr>
              <td style="padding:30px; color:#555; font-size:16px; line-height:1.6;">
                <p>Dear ${username},</p>
                <p>${message(topic)}</p>

               
                <!-- Token -->
                <div style="margin:30px 0; text-align:center;">
                  <span style="display:inline-block; background:#4f46e5; color:#fff; font-size:24px; font-weight:bold; padding:15px 30px; border-radius:8px; letter-spacing:3px;">
                    ${token}
                  </span>
                </div>
                
                <p style="margin-top:20px;">⚠️ Do not share this code with anyone.</p>
                <p style="margin-top:20px;">  Otherwise Click this button</p>
        
                 <div style="margin:30px 0; text-align:center;">
                    ${verifyEmailButton(topic, token, userId)}
                    
                </div>
              </td>
            </tr>
            
            <!-- Footer -->
            <tr>
              <td align="center" style="border-top:1px solid #eee; padding:20px; font-size:14px; color:#999;">
                <p>Thank you,<br /><b>The LevelUp Team</b></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

// ✅ Example usage
// const emailHtml = html({
//   token: "123456",
//   username: "Suyan",
//   topic: EmailTopic.VerifyEmail,
// });

// console.log(emailHtml);
export default html;
