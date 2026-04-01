# Railway Deployment Guide with S3 Storage

## 🚀 Overview
This guide will help you deploy your application to Railway with S3-compatible storage from t3.storageapi.dev.

## 📋 Prerequisites
- Railway account
- t3.storageapi.dev bucket configured
- GitHub repository with latest code

## 🔧 Step 1: Configure Bucket Permissions

### Bucket Policy
Apply this policy to your bucket `expandable-cube-xogsjgx1g` in t3.storageapi.dev dashboard:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::expandable-cube-xogsjgx1g/*"
    },
    {
      "Sid": "AllowListBucket",
      "Effect": "Allow", 
      "Principal": "*",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::expandable-cube-xogsjgx1g"
    },
    {
      "Sid": "AllowPutObject",
      "Effect": "Allow",
      "Principal": {
        "AWS": "tid_iTopfnRonDzRhpGZLvPivodEpyuqJJGcXbDwVIRAfWknqsoxjJ"
      },
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::expandable-cube-xogsjgx1g/*"
    }
  ]
}
```

### CORS Configuration
Apply this CORS configuration:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag", "Content-Type", "Content-Length"],
    "MaxAgeSeconds": 3000
  }
]
```

## 🔧 Step 2: Deploy to Railway

### 2.1 Connect Repository
1. Go to [Railway Dashboard](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Choose deployment branch (main)

### 2.2 Add Environment Variables
Add these environment variables to your Railway service:

```bash
# Database
DATABASE_URL=your_postgresql_connection_string

# S3 Storage
S3_ENDPOINT=https://t3.storageapi.dev
S3_REGION=auto
S3_BUCKET=expandable-cube-xogsjgx1g
S3_ACCESS_KEY_ID=tid_iTopfnRonDzRhpGZLvPivodEpyuqJJGcXbDwVIRAfWknqsoxjJ
S3_SECRET_ACCESS_KEY=tsec_-1thIo56mB967pD0SvR-FWhu4xgY56+j0k7+ust+dI8ZaovKA5Yzgy+F2TSo8urtklzj2G

# Authentication
SESSION_SECRET=your-session-secret
JWT_SECRET=your-jwt-secret

# Sentry (optional)
SENTRY_DSN=https://2cac7de2820ac50245300310975b777c@o4511137391771648.ingest.de.sentry.io/4511137395245136
VITE_SENTRY_DSN=https://2cac7de2820ac50245300310975b777c@o4511137391771648.ingest.de.sentry.io/4511137395245136

# Other
NODE_ENV=production
PORT=5000
```

### 2.3 Persistent Volume (Optional but Recommended)
Add a persistent volume for local backups:
- Mount Path: `/uploads`
- Size: 1GB or more

## 🔧 Step 3: Configure Domain (Optional)

### Custom Domain
1. Go to Railway project settings
2. Click "Settings" → "Custom Domain"
3. Add your domain (e.g., `yourapp.com`)
4. Configure DNS records as shown by Railway

### Railway Domain
Your app will be available at:
- `your-app-name.up.railway.app`
- Or custom domain if configured

## 🧪 Step 4: Test Deployment

### Health Check
```bash
curl https://your-app-name.up.railway.app/api/health
```

### File Upload Test
```bash
# Test product image upload
curl -X POST https://your-app-name.up.railway.app/api/admin/upload-product-image \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -F "imageBase64=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB..."
```

### S3 Storage Test
```bash
# Test S3 connectivity
node test-s3-proper.js
```

## 📊 Features Enabled

### ✅ S3 Storage
- **Product Images** - Stored in S3 bucket
- **Media Files** - Stored in S3 bucket  
- **Automatic Fallback** - Local storage if S3 unavailable
- **Public URLs** - Direct access to uploaded files
- **CDN Ready** - Global distribution via t3.storageapi.dev

### ✅ Application Features
- **Error Tracking** - Sentry integration
- **Performance Monitoring** - Metrics and traces
- **TypeScript** - Full type safety
- **Optimized Loading** - Fast page loads
- **Responsive Design** - Mobile-friendly

## 🔍 Verification Checklist

### Post-Deployment Tests
- [ ] Health check responds correctly
- [ ] Admin panel loads
- [ ] Product image upload works
- [ ] Media upload works  
- [ ] File deletion works
- [ ] Sentry errors appear in dashboard
- [ ] S3 files are publicly accessible
- [ ] All pages load without errors

### URLs to Test
- **Health**: `https://your-app.up.railway.app/api/health`
- **Admin**: `https://your-app.up.railway.app/admin`
- **Products**: `https://your-app.up.railway.app/products`
- **404 Page**: `https://your-app.up.railway.app/invalid-url`

## 🚨 Troubleshooting

### Common Issues

#### S3 Upload Failures
```bash
# Check environment variables
echo $S3_ENDPOINT
echo $S3_BUCKET
echo $S3_ACCESS_KEY_ID

# Test S3 connectivity
node test-s3-proper.js
```

#### Build Failures
```bash
# Check build logs in Railway
# Verify all dependencies installed
npm run build
```

#### Database Connection
```bash
# Test database connection
curl https://your-app.up.railway.app/api/health
```

## 📈 Monitoring

### Railway Dashboard
- Monitor logs in real-time
- Check resource usage
- View deployment metrics
- Set up alerts for errors

### Sentry Dashboard
- Monitor error rates
- Track performance metrics
- Set up alerting rules
- Monitor user sessions

## 🎯 Success Criteria

Your deployment is successful when:
1. ✅ Application builds without errors
2. ✅ Health check returns 200 OK
3. ✅ Admin panel loads and functions
4. ✅ File uploads work and store in S3
5. ✅ Uploaded files are publicly accessible
6. ✅ Sentry captures errors and metrics
7. ✅ All pages load correctly

## 🚀 Next Steps

After successful deployment:
1. **Monitor Performance** - Use Sentry metrics
2. **Scale as Needed** - Add more Railway resources
3. **Backup Strategy** - Regular database backups
4. **Security Review** - Regular security audits
5. **User Testing** - Gather user feedback

---

**🎉 Your application is now ready for production deployment with enterprise-grade S3 storage!**
