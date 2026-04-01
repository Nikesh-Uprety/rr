// Enhanced Email Service using Resend's verified domains
import { Resend } from 'resend';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  type: 'welcome' | 'order' | 'password' | 'otp' | 'notification';
}

export class EnhancedEmailService {
  private resend: any;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn('⚠️  Resend API key not configured');
      return;
    }

    this.resend = new Resend(apiKey);
    console.log('📧 Enhanced Resend email service initialized');
  }

  private getFromAddress(type: EmailOptions['type']): string {
    const fromAddresses = {
      welcome: 'Your App <onboarding@resend.dev>',
      order: 'Your App <notifications@resend.dev>',
      password: 'Your App <support@resend.dev>',
      otp: 'Your App <updates@resend.dev>',
      notification: 'Your App <notifications@resend.dev>'
    };

    return fromAddresses[type];
  }

  async sendEmail(options: EmailOptions): Promise<{ success: boolean; error?: string; messageId?: string }> {
    try {
      const fromAddress = this.getFromAddress(options.type);
      
      const result = await this.resend.emails.send({
        from: fromAddress,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
      });

      if (result.error) {
        console.error('❌ Enhanced email failed:', result.error);
        return { success: false, error: result.error.message };
      }

      console.log(`✅ Enhanced email sent successfully via ${fromAddress}`);
      console.log(`📧 Message ID: ${result.data?.id}`);
      
      return { 
        success: true, 
        messageId: result.data?.id 
      };
    } catch (error) {
      console.error('❌ Enhanced email service error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async sendWelcomeEmail(to: string, userName: string): Promise<{ success: boolean; error?: string; messageId?: string }> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px;">
        <div style="background: rgba(255,255,255,0.1); padding: 30px; border-radius: 8px; backdrop-filter: blur(10px);">
          <h1 style="color: white; margin-bottom: 20px; font-size: 28px;">🎉 Welcome ${userName}!</h1>
          <p style="color: white; line-height: 1.6; margin-bottom: 30px; font-size: 16px;">Thank you for joining our platform!</p>
          <p style="color: white; line-height: 1.6; margin-bottom: 30px; font-size: 16px;">We're excited to have you on board and look forward to helping you succeed.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://resend-starter-production-cfd3.up.railway.app" 
               style="background: white; color: #667eea; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
              Get Started
            </a>
          </div>
          
          <div style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); border-radius: 8px; padding: 20px; margin: 30px 0;">
            <p style="color: white; margin: 0; font-weight: bold;">🚀 Quick Start:</p>
            <ul style="color: white; font-size: 14px; line-height: 1.6; margin: 10px 0 0 20px;">
              <li>Complete your profile setup</li>
              <li>Explore our features</li>
              <li>Join our community</li>
            </ul>
          </div>
        </div>
        
        <div style="text-align: center; padding: 20px; color: rgba(255,255,255,0.7); font-size: 12px;">
          <p style="margin: 0;">Sent with ❤️ via Resend</p>
          <p style="margin: 10px 0 0 0;">Your App Team</p>
        </div>
      </div>
    `;

    return await this.sendEmail({
      to,
      subject: `Welcome to Your App, ${userName}!`,
      html,
      type: 'welcome'
    });
  }

  async sendOrderConfirmation(to: string, orderData: {
    orderNumber: string;
    customerName: string;
    total: number;
    items: Array<{ name: string; quantity: number; price: number }>;
  }): Promise<{ success: boolean; error?: string; messageId?: string }> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; background: #f8f9fa; border-radius: 8px;">
        <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h2 style="color: #28a745; margin-bottom: 20px;">🛒 Order Confirmed!</h2>
          <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">Thank you for your order, ${orderData.customerName}!</p>
          
          <div style="background: #e8f5e8; border: 1px solid #d4edda; border-radius: 6px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #155724; margin-bottom: 15px;">Order #${orderData.orderNumber}</h3>
            
            <table style="width: 100%; border-collapse: collapse;">
              <tr style="background: #f8f9fa;">
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #28a745;">Item</th>
                <th style="padding: 12px; text-align: center; border-bottom: 2px solid #28a745;">Quantity</th>
                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #28a745;">Price</th>
                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #28a745;">Total</th>
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
                <td colspan="3" style="padding: 16px; text-align: right; border-top: 2px solid #28a745; font-size: 18px; font-weight: bold; color: #28a745;">
                  Total: $${orderData.total.toFixed(2)}
                </td>
              </tr>
            </table>
          </div>
          
          <div style="background: #d1ecf1; border: 1px solid #bee5eb; border-radius: 6px; padding: 20px; margin: 20px 0;">
            <p style="color: #0c5460; margin: 0; font-weight: bold;">📦 Order Status</p>
            <p style="color: #0c5460; margin: 10px 0 0 0; font-size: 14px;">We'll process your order and ship within 24 hours.</p>
            <p style="color: #0c5460; margin: 10px 0 0 0; font-size: 14px;">You'll receive tracking information once your order ships.</p>
          </div>
        </div>
        
        <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
          <p style="margin: 0;">This is an automated message from Your App</p>
          <p style="margin: 10px 0 0 0;">Sent via Resend Email Service</p>
        </div>
      </div>
    `;

    return await this.sendEmail({
      to,
      subject: `Order Confirmation #${orderData.orderNumber}`,
      html,
      type: 'order'
    });
  }

  async sendPasswordReset(to: string, resetToken: string): Promise<{ success: boolean; error?: string; messageId?: string }> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; background: #f8f9fa; border-radius: 8px;">
        <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h2 style="color: #dc3545; margin-bottom: 20px;">🔒 Password Reset Request</h2>
          <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">You requested to reset your password.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://resend-starter-production-cfd3.up.railway.app/reset-password?token=${resetToken}" 
               style="background: #dc3545; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px; box-shadow: 0 4px 15px rgba(220,53,69,0.3);">
              Reset Password
            </a>
          </div>
          
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 20px; margin: 30px 0;">
            <p style="color: #856404; margin: 0; font-weight: bold;">⚠️ Security Notice</p>
            <ul style="color: #856404; font-size: 14px; line-height: 1.6; margin: 10px 0 0 20px;">
              <li>This link expires in 1 hour for security reasons</li>
              <li>If you didn't request this, please ignore this email</li>
              <li>Never share this link with anyone</li>
              <li>If you didn't request a reset, your account is still secure</li>
            </ul>
          </div>
        </div>
        
        <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
          <p style="margin: 0;">This is an automated message from Your App</p>
          <p style="margin: 10px 0 0 0;">Sent via Resend Support Team</p>
        </div>
      </div>
    `;

    return await this.sendEmail({
      to,
      subject: 'Password Reset Request',
      html,
      type: 'password'
    });
  }

  async sendOTP(to: string, otp: string, name: string): Promise<{ success: boolean; error?: string; messageId?: string }> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; background: #f8f9fa; border-radius: 8px;">
        <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h2 style="color: #007bff; margin-bottom: 20px;">🔐 Your Verification Code</h2>
          <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">Hi ${name}, use this code to complete your sign-in:</p>
          
          <div style="background: #fff; border: 2px solid #007bff; border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0;">
            <p style="font-size: 48px; font-weight: bold; letter-spacing: 8px; color: #007bff; margin: 0; text-shadow: 2px 2px 4px rgba(0,123,255,0.1);">
              ${otp}
            </p>
          </div>
          
          <div style="background: #e8f5e8; border: 1px solid #d4edda; border-radius: 6px; padding: 20px; margin: 20px 0;">
            <p style="color: #155724; margin: 0; font-weight: bold;">✅ This code is valid for 10 minutes</p>
            <p style="color: #155724; margin: 10px 0 0 0; font-size: 14px;">If you didn't request this, ignore this email.</p>
          </div>
        </div>
        
        <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
          <p style="margin: 0;">This is an automated message from Your App</p>
          <p style="margin: 10px 0 0 0;">Sent via Resend Updates</p>
        </div>
      </div>
    `;

    return await this.sendEmail({
      to,
      subject: 'Your Verification Code',
      html,
      type: 'otp'
    });
  }
}

export const enhancedEmailService = new EnhancedEmailService();
