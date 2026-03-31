import "dotenv/config";
import { emailQueue } from "./queues/emailQueue";

const isE2ETestMode = process.env.E2E_TEST_MODE === "1";
const shouldLogOtpCodes =
  process.env.NODE_ENV !== "production" || process.env.LOG_OTP_CODES === "1";

function skipEmailInE2EMode(kind: string, meta: Record<string, unknown> = {}) {
  if (!isE2ETestMode) return false;
  console.log(`[E2E] Skipping ${kind} email delivery`, meta);
  return true;
}

export async function sendOTPEmail(to: string, code: string, name: string) {
  if (skipEmailInE2EMode("otp", { to, code, name })) {
    return;
  }

  if (shouldLogOtpCodes) {
    console.log(`[DEV OTP] ${to} -> ${code}`);
  }

  try {
    await emailQueue.add("otp", {
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
    console.log(`[Queue] OTP email job added for: ${to}`);
  } catch (err: any) {
    console.warn("[Queue] OTP job failed for", to, "Error:", err.message);
  }
}

export async function sendInviteEmail(
  to: string,
  name: string,
  code: string,
  invitedBy: string,
) {
  if (skipEmailInE2EMode("invite", { to, name, code, invitedBy })) {
    return;
  }

  try {
    await emailQueue.add("invite", {
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
    console.log(`[Queue] Invite email job added for: ${to}`);
  } catch (err: any) {
    console.warn("[Queue] Invite job failed for", to, "Error:", err.message);
  }
}

export async function sendStoreUserWelcomeEmail(
  to: string,
  name: string,
  invitedBy: string,
) {
  if (skipEmailInE2EMode("store-user-welcome", { to, name, invitedBy })) {
    return;
  }

  try {
    await emailQueue.add("store-user-welcome", {
      to,
      subject: "Welcome to RARE.np Admin",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 40px 24px; background: #FAFAF8;">
          <h1 style="font-size: 22px; color: #111; margin-bottom: 8px;">Welcome to RARE.np Admin</h1>
          <p style="color: #555; margin-bottom: 20px;">
            Hi ${name}, <strong>${invitedBy}</strong> has added you as a team member for RARE Nepal.
          </p>

          <p style="color: #555; margin-bottom: 14px;">
            Use the email address on this message and the password shared with you by your administrator.
          </p>
          <p style="color: #555; margin-bottom: 18px;">
            On your first successful sign-in, you'll complete a one-time email verification step to finish setting up secure access.
          </p>

          <p style="color: #666; font-size: 13px; margin-bottom: 24px;">
            Login at:
            <a href="https://rarenp.com/login" style="color: #2D4A35; text-decoration: none;">rarenp.com/login</a>
          </p>

          <p style="color: #999; font-size: 12px; margin: 0;">
            If you did not expect this email, you can ignore it.
          </p>
        </div>
      `,
    });
    console.log(`[Queue] Store user welcome job added for: ${to}`);
  } catch (err: any) {
    console.warn("[Queue] Store user welcome job failed for", to, "Error:", err.message);
  }
}

export async function sendContactReplyEmail(to: string, subject: string, html: string) {
  if (skipEmailInE2EMode("contact-reply", { to, subject })) {
    return;
  }

  try {
    await emailQueue.add("contact-reply", {
      to,
      subject,
      html,
    });
    console.log(`[Queue] Contact reply email job added for: ${to}`);
  } catch (err: any) {
    console.warn("[Queue] Contact reply job failed for", to, "Error:", err.message);
    throw err;
  }
}

export async function sendMarketingBroadcastEmail(bccList: string[], subject: string, html: string) {
  if (skipEmailInE2EMode("marketing-broadcast", { recipients: bccList.length, subject })) {
    return { sent: bccList.length, failed: 0, errors: [] };
  }

  try {
    const job = await emailQueue.add("marketing-broadcast", {
      bcc: bccList,
      subject,
      html,
    });
    console.log(`[Queue] Added marketing broadcast job: ${job.id} for ${bccList.length} recipients`);
    return { sent: bccList.length, failed: 0, errors: [] };
  } catch (err: any) {
    console.warn("[Queue] Marketing broadcast job failed:", err.message);
    return { sent: 0, failed: bccList.length, errors: [err.message] };
  }
}

export async function sendNewsletterWelcomeEmail(to: string) {
  if (skipEmailInE2EMode("newsletter-welcome", { to })) {
    return;
  }

  try {
    await emailQueue.add("newsletter-welcome", {
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
    console.log(`[Queue] Newsletter welcome job added for: ${to}`);
  } catch (err: any) {
    console.warn("[Queue] Newsletter welcome job failed for", to, "Error:", err.message);
  }
}

interface OrderEmailItem {
  productName: string;
  quantity: number;
  unitPrice: number;
}

interface OrderConfirmationData {
  orderId: string;
  fullName: string;
  email: string;
  items: OrderEmailItem[];
  subtotal: number;
  shippingFee: number;
  promoCode?: string;
  promoDiscountAmount?: number;
  total: number;
  paymentMethod: string;
}

function formatPrice(amount: number): string {
  return `Rs ${amount.toLocaleString("en-NP")}`;
}

function paymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    cash_on_delivery: "Cash on Delivery",
    esewa: "eSewa",
    khalti: "Khalti",
    bank_transfer: "Bank Transfer",
    fonepay: "FonePay",
  };
  return labels[method] || method;
}

export async function sendOrderConfirmationEmail(data: OrderConfirmationData) {
  if (skipEmailInE2EMode("order-confirmation", { to: data.email, orderId: data.orderId })) {
    return;
  }

  const shortId = data.orderId.substring(0, 8).toUpperCase();

  const itemRows = data.items
    .map(
      (item) => `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid rgba(242,239,232,0.1); color: #f2efe8; font-size: 14px;">${item.productName}</td>
        <td style="padding: 12px 0; border-bottom: 1px solid rgba(242,239,232,0.1); color: rgba(242,239,232,0.7); font-size: 14px; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px 0; border-bottom: 1px solid rgba(242,239,232,0.1); color: rgba(242,239,232,0.7); font-size: 14px; text-align: right;">${formatPrice(item.unitPrice * item.quantity)}</td>
      </tr>`,
    )
    .join("");

  const promoRow =
    data.promoDiscountAmount && data.promoDiscountAmount > 0
      ? `<tr>
          <td colspan="2" style="padding: 6px 0; color: rgba(242,239,232,0.7); font-size: 14px;">Discount (${data.promoCode ?? "promo"})</td>
          <td style="padding: 6px 0; color: #4ade80; font-size: 14px; text-align: right;">-${formatPrice(data.promoDiscountAmount)}</td>
        </tr>`
      : "";

  try {
    await emailQueue.add("order-confirmation", {
      to: data.email,
      subject: `Order Confirmed — #${shortId}`,
      html: `
        <div style="font-family: 'serif'; max-width: 600px; margin: 0 auto; padding: 40px; background: #07060a; color: #f2efe8; border-radius: 24px;">
          <h1 style="font-size: 28px; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 8px; color: #f2efe8; text-align: center;">RARE ATELIER</h1>
          <div style="width: 40px; height: 1px; background: rgba(242, 239, 232, 0.3); margin: 0 auto 32px;"></div>

          <h2 style="font-size: 22px; font-style: italic; margin-bottom: 8px; text-align: center;">Order Confirmed</h2>
          <p style="font-size: 15px; color: rgba(242,239,232,0.7); text-align: center; margin-bottom: 32px;">
            Thank you, ${data.fullName}. Your order <strong style="color: #f2efe8;">#${shortId}</strong> has been placed successfully.
          </p>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <thead>
              <tr style="border-bottom: 1px solid rgba(242,239,232,0.2);">
                <th style="padding: 8px 0; text-align: left; font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(242,239,232,0.5);">Item</th>
                <th style="padding: 8px 0; text-align: center; font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(242,239,232,0.5);">Qty</th>
                <th style="padding: 8px 0; text-align: right; font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(242,239,232,0.5);">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemRows}
            </tbody>
          </table>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 32px;">
            <tr>
              <td colspan="2" style="padding: 6px 0; color: rgba(242,239,232,0.7); font-size: 14px;">Subtotal</td>
              <td style="padding: 6px 0; color: rgba(242,239,232,0.7); font-size: 14px; text-align: right;">${formatPrice(data.subtotal)}</td>
            </tr>
            <tr>
              <td colspan="2" style="padding: 6px 0; color: rgba(242,239,232,0.7); font-size: 14px;">Shipping</td>
              <td style="padding: 6px 0; color: rgba(242,239,232,0.7); font-size: 14px; text-align: right;">${formatPrice(data.shippingFee)}</td>
            </tr>
            ${promoRow}
            <tr style="border-top: 1px solid rgba(242,239,232,0.2);">
              <td colspan="2" style="padding: 12px 0; color: #f2efe8; font-size: 18px; font-weight: 700;">Total</td>
              <td style="padding: 12px 0; color: #f2efe8; font-size: 18px; font-weight: 700; text-align: right;">${formatPrice(data.total)}</td>
            </tr>
          </table>

          <p style="font-size: 14px; color: rgba(242,239,232,0.7); margin-bottom: 8px;">
            <strong style="color: #f2efe8;">Payment:</strong> ${paymentMethodLabel(data.paymentMethod)}
          </p>

          <div style="margin-top: 48px; padding-top: 24px; border-top: 1px solid rgba(242,239,232,0.1); text-align: center;">
            <p style="font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(242,239,232,0.4);">RARE Nepal · Khusibu, Nayabazar, Kathmandu</p>
          </div>
        </div>
      `,
    });
    console.log(`[Queue] Order confirmation job added for: ${data.email}`);
  } catch (err: any) {
    console.warn("[Queue] Order confirmation job failed for", data.email, "Error:", err.message);
  }
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: "Pending",
    processing: "Processing",
    completed: "Completed",
    cancelled: "Cancelled",
    pos: "POS Sale",
  };
  return labels[status] || status;
}

function statusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: "#facc15",
    processing: "#38bdf8",
    completed: "#4ade80",
    cancelled: "#f87171",
    pos: "#a78bfa",
  };
  return colors[status] || "#f2efe8";
}

export async function sendOrderStatusUpdateEmail(
  email: string,
  fullName: string,
  orderId: string,
  newStatus: string,
) {
  if (skipEmailInE2EMode("order-status", { email, fullName, orderId, newStatus })) {
    return;
  }

  const shortId = orderId.substring(0, 8).toUpperCase();
  const label = statusLabel(newStatus);
  const color = statusColor(newStatus);

  try {
    await emailQueue.add("order-status", {
      to: email,
      subject: `Order #${shortId} — ${label}`,
      html: `
        <div style="font-family: 'serif'; max-width: 600px; margin: 0 auto; padding: 40px; background: #07060a; color: #f2efe8; border-radius: 24px;">
          <h1 style="font-size: 28px; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 8px; color: #f2efe8; text-align: center;">RARE ATELIER</h1>
          <div style="width: 40px; height: 1px; background: rgba(242, 239, 232, 0.3); margin: 0 auto 32px;"></div>

          <h2 style="font-size: 22px; font-style: italic; margin-bottom: 16px; text-align: center;">Order Update</h2>
          <p style="font-size: 15px; color: rgba(242,239,232,0.7); text-align: center; margin-bottom: 32px;">
            Hi ${fullName}, your order <strong style="color: #f2efe8;">#${shortId}</strong> status has been updated.
          </p>

          <div style="background: rgba(242,239,232,0.05); border: 1px solid rgba(242,239,232,0.1); border-radius: 12px; padding: 32px; text-align: center; margin-bottom: 32px;">
            <p style="font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(242,239,232,0.5); margin-bottom: 12px;">Current Status</p>
            <p style="font-size: 28px; font-weight: 700; color: ${color}; margin: 0;">${label}</p>
          </div>

          <div style="margin-top: 48px; padding-top: 24px; border-top: 1px solid rgba(242,239,232,0.1); text-align: center;">
            <p style="font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(242,239,232,0.4);">RARE Nepal · Khusibu, Nayabazar, Kathmandu</p>
          </div>
        </div>
      `,
    });
    console.log(`[Queue] Order status job added for: ${email}`);
  } catch (err: any) {
    console.warn("[Queue] Order status job failed for", email, "Error:", err.message);
  }
}
