import "dotenv/config";
import nodemailer from "nodemailer";

// SMTP Configuration
const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587");
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";

// Check if SMTP is properly configured
const isSMTPConfigured = SMTP_HOST && SMTP_USER && SMTP_PASS;

// Create transporter (only if SMTP is configured)
let transporter: nodemailer.Transporter | null = null;

if (isSMTPConfigured) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465, // true for 465, false for other ports
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    // Required for some cloud providers and Mailjet fallback ports
    tls: {
      rejectUnauthorized: false
    },
    debug: true,
    logger: true,
  });
  console.log(`[EMAIL] SMTP transporter configured: ${SMTP_HOST}:${SMTP_PORT} (secure: ${SMTP_PORT === 465})`);
}

// Sender configuration - can be set via environment or use default
const SENDER_EMAIL = process.env.SENDER_EMAIL || "upretynikesh021@gmail.com";
const SENDER_NAME = process.env.SENDER_NAME || "RARE Nepal";

export async function sendOTPEmail(to: string, code: string, name: string) {
  if (!isSMTPConfigured || !transporter) {
    console.warn(
      "[DEV] SMTP not configured (SMTP_HOST, SMTP_USER, SMTP_PASS missing). OTP for",
      to,
      "->",
      code
    );
    return;
  }
  
  try {
    await transporter.sendMail({
      from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
      to,
      subject: "Your RARE.np verification code",
      html: `
        <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; background: #FAFAF8;">
          <h1 style="font-size: 24px; color: #111; margin-bottom: 8px;">Verification Code</h1>
          <p style="color: #666; margin-bottom: 32px;">Hi ${name}, use this code to complete your sign-in to RARE.np admin.</p>
          <div style="background: #fff; border: 1px solid #E8E4DE; border-radius: 12px; padding: 32px; text-align: center; margin-bottom: 24px;">
            <p style="font-size: 48px; font-weight: 700; letter-spacing: 12px; color: #2D4A35; margin: 0;">${code}</p>
          </div>
          <p style="color: #999; font-size: 13px;">This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #E8E4DE; margin: 24px 0;">
          <p style="color: #bbb; font-size: 12px;">RARE Nepal · Khusibu, Nayabazar, Kathmandu</p>
        </div>
      `,
    });
    console.log(`[SMTP] OTP email sent to: ${to}`);
  } catch (err: any) {
    console.warn("[SMTP] OTP delivery failed for", to, "Error:", {
      message: err.message,
      code: err.code,
      command: err.command,
      response: err.response,
      stack: err.stack
    });
  }
}

export async function sendInviteEmail(
  to: string,
  name: string,
  code: string,
  invitedBy: string,
) {
  if (!isSMTPConfigured || !transporter) {
    console.warn(
      "[DEV] SMTP not configured. Invite code for",
      to,
      "->",
      code
    );
    return;
  }
  try {
    await transporter.sendMail({
      from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
      to,
      subject: "You've been invited to RARE.np Admin",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; background: #FAFAF8;">
          <h1 style="font-size: 22px; color: #111;">You're invited to RARE.np</h1>
          <p style="color: #555;">Hi ${name}, <strong>${invitedBy}</strong> has added you as an admin user for RARE Nepal.</p>
          <p style="color: #555;">Use this one-time code when you first log in:</p>
          <div style="background: #fff; border: 1px solid #E8E4DE; border-radius: 12px; padding: 32px; text-align: center; margin: 24px 0;">
            <p style="font-size: 48px; font-weight: 700; letter-spacing: 12px; color: #2D4A35; margin: 0;">${code}</p>
          </div>
          <p style="color: #666;">Login at: <a href="https://rarenp.com/login" style="color: #2D4A35;">rarenp.com/login</a></p>
          <p style="color: #999; font-size: 12px;">Code expires in 24 hours.</p>
        </div>
      `,
    });
    console.log(`[SMTP] Invite email sent to: ${to}`);
  } catch (err: any) {
    console.warn("[SMTP] Invite delivery failed for", to, "Error:", {
      message: err.message,
      code: err.code,
      command: err.command,
      response: err.response,
      stack: err.stack
    });
  }
}

export async function sendContactReplyEmail(to: string, subject: string, html: string) {
  if (!isSMTPConfigured || !transporter) {
    console.warn("[DEV] SMTP not configured. Contact reply for", to, "->", subject);
    return;
  }
  try {
    await transporter.sendMail({
      from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
      to,
      subject,
      html,
    });
    console.log(`[SMTP] Contact reply email sent to: ${to}`);
  } catch (err: any) {
    console.warn("[SMTP] Contact reply delivery failed for", to, "Error:", {
      message: err.message,
      code: err.code,
      command: err.command,
      response: err.response,
      stack: err.stack
    });
  }
}

export async function sendMarketingBroadcastEmail(bccList: string[], subject: string, html: string) {
  if (!isSMTPConfigured || !transporter || bccList.length === 0) {
    console.warn("[DEV] SMTP not configured or empty BCC. Broadcast ->", subject);
    return;
  }
  try {
    await transporter.sendMail({
      from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
      bcc: bccList,
      subject,
      html,
    });
    console.log(`[SMTP] Marketing broadcast email sent to: ${bccList.length} recipients`);
  } catch (err: any) {
    console.warn("[SMTP] Marketing broadcast failed. Error:", {
      message: err.message,
      code: err.code,
      command: err.command,
      response: err.response,
      stack: err.stack
    });
  }
}

export async function sendNewsletterWelcomeEmail(to: string) {
  if (!isSMTPConfigured || !transporter) {
    console.warn("[DEV] SMTP not configured. Newsletter welcome for", to);
    return;
  }
  try {
    await transporter.sendMail({
      from: `"${SENDER_NAME}" <${SENDER_EMAIL}>`,
      to,
      subject: "Welcome to the RARE Community",
      html: `
        <div style="font-family: 'serif'; max-width: 600px; margin: 0 auto; padding: 40px; background: #07060a; color: #f2efe8; text-align: center; border-radius: 24px;">
          <h1 style="font-size: 32px; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 24px; color: #f2efe8;">RARE ATELIER</h1>
          <div style="width: 40px; height: 1px; background: rgba(242, 239, 232, 0.3); margin: 0 auto 32px;"></div>
          <h2 style="font-size: 24px; font-style: italic; margin-bottom: 16px;">Welcome to the Inner Circle</h2>
          <p style="font-size: 16px; line-height: 1.6; color: rgba(242, 239, 232, 0.7); margin-bottom: 32px;">
            Thank you for joining our community. You are now part of an exclusive group that appreciates the intersection of luxury, heritage, and streetwear.
          </p>
          <p style="font-size: 14px; letter-spacing: 0.1em; color: rgba(242, 239, 232, 0.5); margin-bottom: 40px;">
            As a member, you'll be the first to know about new collection drops, private events, and archival releases.
          </p>
          <a href="https://rarenp.com" style="display: inline-block; padding: 16px 32px; background: #f2efe8; color: #07060a; text-decoration: none; font-size: 12px; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase;">Discover the Collection</a>
          <div style="margin-top: 60px; padding-top: 32px; border-top: 1px solid rgba(242, 239, 232, 0.1);">
            <p style="font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(242, 239, 232, 0.4);">RARE Nepal · Khusibu, Nayabazar, Kathmandu</p>
          </div>
        </div>
      `,
    });
    console.log(`[SMTP] Newsletter welcome email sent to: ${to}`);
  } catch (err: any) {
    console.warn("[SMTP] Newsletter welcome failed for", to, "Error:", {
      message: err.message,
      code: err.code,
      command: err.command,
      response: err.response,
      stack: err.stack
    });
  }
}
