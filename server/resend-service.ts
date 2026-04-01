import { Resend } from 'resend';

export interface EmailConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
}

export class ResendEmailService {
  private resend: any; // Use any to avoid TypeScript issues with Resend types
  private config: EmailConfig;

  constructor() {
    this.config = {
      apiKey: process.env.RESEND_API_KEY || '',
      fromEmail: process.env.RESEND_FROM_EMAIL || 'noreply@yourdomain.com',
      fromName: process.env.RESEND_FROM_NAME || 'Your App Name',
    };

    if (!this.config.apiKey) {
      console.warn('⚠️  Resend API key not configured, falling back to SMTP');
      return;
    }

    this.resend = new Resend(this.config.apiKey);
    console.log('📧 Resend email service initialized');
  }

  async sendEmail(options: {
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    attachments?: Array<{
      filename: string;
      content: Buffer;
      contentType: string;
    }>;
  }): Promise<{ success: boolean; error?: string; messageId?: string }> {
    try {
      const { data, error } = await this.resend.emails.send({
        from: `${this.config.fromName} <${this.config.fromEmail}>`,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments,
      });

      if (error) {
        console.error('❌ Resend email failed:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Email sent successfully via Resend');
      return { 
        success: true, 
        messageId: data?.id 
      };
    } catch (error) {
      console.error('❌ Resend service error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async sendOrderConfirmation(orderData: {
    orderNumber: string;
    customerEmail: string;
    customerName: string;
    total: number;
    items: Array<{
      name: string;
      quantity: number;
      price: number;
    }>;
  }): Promise<{ success: boolean; error?: string }> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #f8f9fa; padding: 30px; border-radius: 8px;">
          <h2 style="color: #333; margin-bottom: 20px;">Order Confirmation</h2>
          <p style="color: #666; line-height: 1.6;">Dear ${orderData.customerName},</p>
          <p style="color: #666; line-height: 1.6;">Thank you for your order! We're pleased to confirm your purchase.</p>
          
          <div style="background: #fff; padding: 20px; border-radius: 6px; margin: 20px 0;">
            <h3 style="color: #333; margin-bottom: 15px;">Order #${orderData.orderNumber}</h3>
            
            <table style="width: 100%; border-collapse: collapse;">
              <tr style="background: #f8f9fa;">
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Item</th>
                <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;">Quantity</th>
                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #ddd;">Price</th>
                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #ddd;">Total</th>
              </tr>
              
              ${orderData.items.map(item => `
                <tr>
                  <td style="padding: 12px; border-bottom: 1px solid #eee;">${item.name}</td>
                  <td style="padding: 12px; text-align: center; border-bottom: 1px solid #eee;">${item.quantity}</td>
                  <td style="padding: 12px; text-align: right; border-bottom: 1px solid #eee;">$${item.price.toFixed(2)}</td>
                  <td style="padding: 12px; text-align: right; border-bottom: 1px solid #eee; font-weight: bold;">$${(item.quantity * item.price).toFixed(2)}</td>
                </tr>
              `).join('')}
              
              <tr>
                <td colspan="3" style="padding: 16px; text-align: right; border-top: 2px solid #333; font-size: 18px; font-weight: bold;">
                  Total: $${orderData.total.toFixed(2)}
                </td>
              </tr>
            </table>
          </div>
          
          <div style="margin-top: 30px; padding: 20px; background: #e8f5e8; border-radius: 6px;">
            <p style="color: #666; margin-bottom: 10px;">We'll send you updates about your order status and shipping information.</p>
            <p style="color: #666; margin-bottom: 0;">If you have any questions, please don't hesitate to contact us.</p>
          </div>
        </div>
        
        <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
          <p>This is an automated message from ${this.config.fromName}</p>
        </div>
      </div>
    `;

    return await this.sendEmail({
      to: orderData.customerEmail,
      subject: `Order Confirmation #${orderData.orderNumber}`,
      html,
    });
  }

  async sendPasswordReset(email: string, resetToken: string): Promise<{ success: boolean; error?: string }> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #f8f9fa; padding: 40px; border-radius: 8px;">
          <h2 style="color: #333; margin-bottom: 20px;">Password Reset</h2>
          <p style="color: #666; line-height: 1.6;">You requested a password reset for your account.</p>
          <p style="color: #666; line-height: 1.6;">Click the button below to reset your password:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.RAILWAY_ENVIRONMENT === 'production' ? 'https://yourapp.up.railway.app' : 'http://localhost:5001'}/reset-password?token=${resetToken}" 
               style="background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Reset Password
            </a>
          </div>
          
          <div style="margin-top: 30px; padding: 20px; background: #fff3cd; border-radius: 6px; border: 1px solid #ffeaa7;">
            <p style="color: #856404; margin-bottom: 0;"><strong>Security Notice:</strong></p>
            <p style="color: #856404; font-size: 14px;">This link will expire in 1 hour for security reasons.</p>
            <p style="color: #856404; font-size: 14px;">If you didn't request this reset, please ignore this email.</p>
          </div>
        </div>
        
        <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
          <p>This is an automated message from ${this.config.fromName}</p>
        </div>
      </div>
    `;

    return await this.sendEmail({
      to: email,
      subject: 'Password Reset Request',
      html,
    });
  }

  async sendOTPEmail(email: string, otp: string, expiry: number): Promise<{ success: boolean; error?: string }> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #f8f9fa; padding: 40px; border-radius: 8px;">
          <h2 style="color: #333; margin-bottom: 20px;">Your Verification Code</h2>
          <p style="color: #666; line-height: 1.6;">Your verification code is:</p>
          
          <div style="background: #fff; padding: 20px; border-radius: 6px; margin: 20px 0; text-align: center;">
            <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #007bff; background: #f8f9fa; padding: 20px; border-radius: 6px; display: inline-block;">
              ${otp}
            </div>
          </div>
          
          <div style="margin-top: 30px; padding: 20px; background: #fff3cd; border-radius: 6px; border: 1px solid #ffeaa7;">
            <p style="color: #856404; margin-bottom: 0;"><strong>Important:</strong></p>
            <ul style="color: #856404; font-size: 14px; line-height: 1.6;">
              <li>This code will expire in ${expiry} minutes</li>
              <li>Never share this code with anyone</li>
              <li>If you didn't request this, please ignore this email</li>
            </ul>
          </div>
        </div>
        
        <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
          <p>This is an automated message from ${this.config.fromName}</p>
        </div>
      </div>
    `;

    return await this.sendEmail({
      to: email,
      subject: 'Your Verification Code',
      html,
    });
  }
}

export const resendEmailService = new ResendEmailService();
