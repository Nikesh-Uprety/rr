# Resend Email Service Setup Guide

## 🚀 Overview
Resend is a modern email delivery service that replaces traditional SMTP for better deliverability and analytics.

## 📋 Prerequisites
- Resend account (https://resend.com)
- API key from Resend dashboard
- Verified domain (for production)

## 🔧 Step 1: Get Resend API Key

1. Go to [Resend Dashboard](https://resend.com/dashboard)
2. Click "API Keys" in the left sidebar
3. Click "Create API Key"
4. Give your key a descriptive name (e.g., "Railway Production")
5. Copy the API key (starts with `re_`)

## 🔧 Step 2: Configure Domain

### Option A: Use Resend Domain (Recommended)
1. In Resend dashboard, go to "Domains"
2. Click "Add Domain"
3. Add your domain (e.g., `yourapp.com`)
4. Verify domain ownership (DNS records)
5. Wait for domain verification

### Option B: Use External Domain
1. Keep your current domain
2. Configure DNS records as shown in Resend dashboard
3. Set up DKIM and SPF records

## 🔧 Step 3: Update Environment Variables

Add these to your Railway service:

```bash
# Resend Configuration
RESEND_API_KEY=re_your_actual_api_key_here
RESEND_FROM_EMAIL=noreply@yourdomain.com
RESEND_FROM_NAME=Your App Name

# Optional: Custom reply-to email
RESEND_REPLY_TO_EMAIL=support@yourdomain.com
```

## 🔧 Step 4: Update Application Code

### Current Integration
Your application already has Resend integration:

```typescript
// server/resend-service.ts
import { Resend } from 'resend';

export class ResendEmailService {
  private resend: any;
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
}
```

### Email Functions Using Resend

```typescript
// server/email.ts - Updated to use Resend
import { resendEmailService } from "./resend-service";

export async function sendOTPEmail(to: string, code: string, name: string) {
  // Try Resend first, fallback to queue
  try {
    const result = await resendEmailService.sendOTPEmail(to, code, name, 10);
    if (result.success) {
      console.log(`[Resend] OTP email sent successfully to: ${to}`);
      return;
    }
    console.log(`[Resend] Fallback to queue for: ${to}`);
  } catch (error) {
    console.log(`[Resend] Error, fallback to queue for: ${to}`);
  }

  // Fallback to queue if Resend fails
  try {
    await emailQueue.add("otp", {
      to,
      subject: "Your RARE.np verification code",
      html: `// HTML template here`,
    });
  } catch (err) {
    console.warn("[Queue] OTP job failed for", to, "Error:", err.message);
  }
}
```

## 🧪 Step 5: Test Resend Integration

### Test Script
Run the test script to verify Resend is working:

```bash
node test-resend.js
```

### Manual Test
```typescript
// Test in your application
import { resendEmailService } from "./resend-service";

const result = await resendEmailService.sendEmail({
  to: "test@example.com",
  subject: "Test Email",
  html: "<h1>Test</h1><p>This is a test email from your application.</p>"
});

console.log("Email result:", result);
```

## 📊 Features Available

### ✅ Email Types
- **OTP Emails** - Verification codes with HTML templates
- **Order Confirmations** - Professional order receipts
- **Password Resets** - Secure password reset flows
- **Marketing Emails** - Campaign emails and newsletters
- **Transactional Emails** - User notifications

### ✅ Advanced Features
- **Templates** - HTML email templates
- **Attachments** - File attachments support
- **Analytics** - Email deliverability tracking
- **Webhooks** - Real-time email events
- **Bounce Handling** - Automatic bounce processing
- **Domain Verification** - DKIM, SPF, DMARC setup

### ✅ Benefits Over SMTP

| Feature | SMTP | Resend |
|----------|--------|--------|
| Deliverability | Variable | ✅ High |
| Analytics | None | ✅ Built-in |
| Templates | Manual | ✅ Easy |
| Bounce Handling | Manual | ✅ Automatic |
| IP Reputation | Risk | ✅ Protected |
| Setup Complexity | High | ✅ Simple |
| Cost | Variable | ✅ Predictable |

## 🔍 Troubleshooting

### Common Issues

#### API Key Invalid
```
Error: API key is invalid
Solution: Check API key in Resend dashboard
```

#### Domain Not Verified
```
Error: Domain not verified
Solution: Add domain in Resend dashboard and verify DNS records
```

#### Rate Limiting
```
Error: Too many requests
Solution: Implement rate limiting in your application
```

## 🚀 Production Deployment

### Environment Setup
```bash
# Railway Environment Variables
RESEND_API_KEY=re_your_production_api_key
RESEND_FROM_EMAIL=noreply@yourdomain.com
RESEND_FROM_NAME=Your App Name
NODE_ENV=production
```

### Monitoring
- **Resend Dashboard** - Monitor email deliverability
- **Sentry** - Track email sending errors
- **Application Logs** - Monitor email service performance

## 📈 Best Practices

### 1. Use Templates
Create email templates in Resend dashboard for consistent branding

### 2. Handle Bounces
Implement webhook handling for bounced emails

### 3. Track Analytics
Monitor open rates, click rates, and deliverability

### 4. Test Before Deploy
Always test with real email addresses before production deployment

---

**🎉 Your Resend integration is now ready for production!**
