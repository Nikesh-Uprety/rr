import nodemailer from "nodemailer";

const hasSmtp =
  process.env.SMTP_EMAIL && process.env.SMTP_PASSWORD && process.env.SMTP_EMAIL.trim() && process.env.SMTP_PASSWORD.trim();

const transporter = hasSmtp
  ? nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD,
      },
    })
  : null;

export async function sendOTPEmail(to: string, code: string, name: string) {
  if (!transporter || !hasSmtp) {
    console.warn(
      "[DEV] SMTP not configured (SMTP_EMAIL/SMTP_PASSWORD missing). OTP for",
      to,
      "->",
      code
    );
    return;
  }
  try {
    await transporter.sendMail({
      from: `"RARE Nepal" <${process.env.SMTP_EMAIL}>`,
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
  } catch (err) {
    console.warn(
      "[DEV] SMTP send failed (invalid Gmail creds?). OTP for",
      to,
      "->",
      code,
      err
    );
  }
}

export async function sendInviteEmail(
  to: string,
  name: string,
  code: string,
  invitedBy: string,
) {
  if (!transporter || !hasSmtp) {
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
      from: `"RARE Nepal" <${process.env.SMTP_EMAIL}>`,
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
  } catch (err) {
    console.warn("[DEV] SMTP send failed. Invite code for", to, "->", code, err);
  }
}

