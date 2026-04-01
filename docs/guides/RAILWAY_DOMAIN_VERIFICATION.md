# Railway Domain Verification for Resend

## 🚀 Overview
To send emails from your Railway domain `resend-starter-production-cfd3.up.railway.app`, you need to verify it in Resend.

## 📋 Current Status
- **Railway Domain:** `resend-starter-production-cfd3.up.railway.app`
- **Resend API Key:** `re_DPhnpXp4_93SVeBCNovQbw9BjpLHiqJs6`
- **Account Email:** `upretynikesh123@gmail.com`
- **Test Limitation:** Can only send to account email until domain is verified

## 🔧 Step 1: Add Domain in Resend

1. Go to [Resend Dashboard](https://resend.com/domains)
2. Click "Add Domain"
3. Enter: `resend-starter-production-cfd3.up.railway.app`
4. Click "Add Domain"

## 🔧 Step 2: Verify DNS Records

After adding the domain, Resend will show you DNS records to add. You'll need to add these records to your Railway domain's DNS.

### Required DNS Records
```dns
# TXT Record for Domain Verification
Type: TXT
Name: _resend
Value: v=spf1 include:_spf.resend.com ~all
TTL: 3600

# TXT Record for DKIM
Type: TXT
Name: resend._domainkey
Value: v=DKIM1; k=rsa; p=YOUR_PUBLIC_KEY_HERE
TTL: 3600

# TXT Record for SPF (alternative)
Type: TXT
Name: @
Value: v=spf1 include:_spf.resend.com ~all
TTL: 3600
```

## 🔧 Step 3: Configure Railway DNS

### Option A: Railway Custom Domain (Recommended)
1. In Railway project, go to "Settings" → "Custom Domain"
2. Add your domain if not already added
3. Railway will provide DNS records to add to your domain registrar

### Option B: External DNS Provider
If you're using an external DNS provider:

1. Log into your domain registrar (GoDaddy, Namecheap, etc.)
2. Go to DNS management
3. Add the TXT records provided by Resend
4. Wait for DNS propagation (2-24 hours)

## 🔧 Step 4: Wait for Verification

After adding DNS records:

1. **Wait 2-24 hours** for DNS propagation
2. Go back to [Resend Dashboard](https://resend.com/domains)
3. Click "Verify" next to your domain
4. Resend will check the DNS records

## 🔧 Step 5: Update Application Configuration

Once the domain is verified, update your Railway environment variables:

```bash
# Update these in Railway
RESEND_FROM_EMAIL=noreply@resend-starter-production-cfd3.up.railway.app
RESEND_FROM_NAME=Your App Name
RESEND_API_KEY=re_DPhnpXp4_93SVeBCNovQbw9BjpLHiqJs6

# Keep these as is
TIGRIS_ENDPOINT=https://t3.storage.dev
TIGRIS_BUCKET=expandable-cube-xogsjgx1g
TIGRIS_ACCESS_KEY_ID=tid_dXDjuETPLqTrwnHNIAFmBoZNBs_akGLrQvHsTRmqVHsaTeCSNd
TIGRIS_SECRET_ACCESS_KEY=tsec_1ir5o9rSoDN5V+eGLpFASk8GA6YV-2mztVQcyYN-sER2NsYF1sX3Cl_9hSTu_fiiShc3HK
```

## 🧪 Step 6: Test with Verified Domain

Create a test script for your verified domain:

```javascript
import { Resend } from 'resend';

const resend = new Resend('re_DPhnpXp4_93SVeBCNovQbw9BjpLHiqJs6');

// Test with verified Railway domain
const result = await resend.emails.send({
  from: 'Your App <noreply@resend-starter-production-cfd3.up.railway.app>',
  to: ['upretynikesh021@gmail.com'],
  subject: '✅ Railway Domain Test Successful!',
  html: '<h1>Your domain is now verified!</h1>'
});
```

## 🔍 Troubleshooting

### Common Issues

#### DNS Propagation Delay
```
Issue: Domain not verifying
Solution: Wait 24-48 hours for full DNS propagation
```

#### Incorrect DNS Records
```
Issue: Verification fails
Solution: Double-check DNS records match exactly what Resend shows
```

#### TTL Too Low
```
Issue: Records not propagating
Solution: Use TTL of 3600 or higher
```

#### Subdomain vs Root Domain
```
Issue: Records not found
Solution: Ensure you're adding records for the correct subdomain
```

## 📊 Benefits of Domain Verification

### ✅ Before Verification
- Can only send to `upretynikesh123@gmail.com`
- Limited to 100 emails/day
- Uses `@resend.dev` domain
- Lower deliverability

### ✅ After Verification
- Can send to any email address
- Higher sending limits
- Custom branding with your domain
- Better deliverability
- Professional appearance

## 🚀 Production Setup

### Complete Environment Variables for Railway
```bash
# Email Configuration
RESEND_API_KEY=re_DPhnpXp4_93SVeBCNovQbw9BjpLHiqJs6
RESEND_FROM_EMAIL=noreply@resend-starter-production-cfd3.up.railway.app
RESEND_FROM_NAME=Your App Name

# Storage Configuration
TIGRIS_ENDPOINT=https://t3.storage.dev
TIGRIS_REGION=auto
TIGRIS_BUCKET=expandable-cube-xogsjgx1g
TIGRIS_ACCESS_KEY_ID=tid_dXDjuETPLqTrwnHNIAFmBoZNBs_akGLrQvHsTRmqVHsaTeCSNd
TIGRIS_SECRET_ACCESS_KEY=tsec_1ir5o9rSoDN5V+eGLpFASk8GA6YV-2mztVQcyYN-sER2NsYF1sX3Cl_9hSTu_fiiShc3HK

# Application Configuration
NODE_ENV=production
DATABASE_URL=your_production_db_url
SESSION_SECRET=your_production_session_secret
```

## 📈 Monitoring

### Resend Dashboard
- Monitor email deliverability
- Track open rates and clicks
- View bounce and complaint rates
- Set up alerts for issues

### Application Logs
- Monitor email sending errors
- Track performance metrics
- Set up Sentry alerts

## 🎯 Success Criteria

Your domain verification is successful when:

1. ✅ **Domain appears as "Verified"** in Resend dashboard
2. ✅ **Can send to any email address** (not just your own)
3. ✅ **Emails arrive in inboxes** (not spam folders)
4. ✅ **Custom from address works** with your Railway domain
5. ✅ **No DNS errors** in Resend dashboard

## 📞 Support

If you encounter issues:

- **Resend Support:** https://resend.com/support
- **Documentation:** https://resend.com/docs
- **Status Page:** https://resend.status.page

---

**🎉 Once verified, you'll be able to send professional emails from your Railway domain!**
