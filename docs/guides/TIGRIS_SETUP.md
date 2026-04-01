# Tigris S3 Storage Setup Guide

## 🐅 Overview
Tigris is an S3-compatible object storage service that provides high-performance, low-cost storage with the same API as AWS S3.

## 📋 Prerequisites
- Tigris account (https://tigris.dev)
- Access key and secret key
- Bucket created and configured

## 🔧 Step 1: Get Tigris Credentials

1. Go to [Tigris Dashboard](https://tigris.dev/dashboard)
2. Click "Access Keys" in the sidebar
3. Click "Create New Access Key"
4. Give your key a descriptive name (e.g., "Railway Production")
5. Copy the Access Key ID and Secret Access Key

## 🔧 Step 2: Configure Bucket

### Bucket Policy
Apply this policy to your bucket `expandable-cube-xogsjgx1g` in Tigris dashboard:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "tigris:GetObject",
      "Resource": "arn:aws:s3:::expandable-cube-xogsjgx1g/*"
    },
    {
      "Sid": "AllowPutObject",
      "Effect": "Allow",
      "Principal": {
        "AWS": "tid_dXDjuETPLqTrwnHNIAFmBoZNBs_akGLrQvHsTRmqVHsaTeCSNd"
      },
      "Action": "tigris:PutObject",
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

## 🔧 Step 3: Update Environment Variables

Add these to your Railway service:

```bash
# Tigris Storage (Primary)
TIGRIS_ENDPOINT=https://t3.storage.dev
TIGRIS_REGION=auto
TIGRIS_BUCKET=expandable-cube-xogsjgx1g
TIGRIS_ACCESS_KEY_ID=tid_dXDjuETPLqTrwnHNIAFmBoZNBs_akGLrQvHsTRmqVHsaTeCSNd
TIGRIS_SECRET_ACCESS_KEY=tsec_1ir5o9rSoDN5V+eGLpFASk8GA6YV-2mztVQcyYN-sER2NsYF1sX3Cl_9hSTu_fiiShc3HK

# Alternative: t3.storageapi.dev (fallback)
# S3_ENDPOINT=https://t3.storage.dev
# S3_REGION=auto
# S3_BUCKET=expandable-cube-xogsjgx1g
# S3_ACCESS_KEY_ID=tid_iTopfnRonDzRhpGZLvPivodEpyuqJJGcXbDwVIRAfWknqsoxjJ
# S3_SECRET_ACCESS_KEY=tsec_-1thIo56mB967pD0SvR-FWhu4xgY56+j0k7+ust+dI8ZaovKA5Yzgy+F2TSo8urtklzj2G
```

## 🔧 Step 4: Test Tigris Integration

### Test Script
Run the test script to verify Tigris is working:

```bash
node test-tigris-s3.js
```

### Expected Test Results
```
🐅 Testing Tigris S3 Storage...
✅ Tigris upload successful!
📁 File: tigris-test-123456789.txt
🔗 URL: https://t3.storage.dev/expandable-cube-xogsjgx1g/tigris-test-123456789.txt
📏 ETag: "a6408734b2a56a17c62eb9f76d963196"

✅ Tigris image upload successful!
📁 File: tigris-test-image-123456789.png
🔗 URL: https://t3.storage.dev/expandable-cube-xogsjgx1g/tigris-test-image-123456789.png
📏 ETag: "b357a19c87624c7c4d131aeeb4ae677f"

✅ Tigris text file accessible: https://t3.storage.dev/expandable-cube-xogsjgx1g/tigris-test-123456789.txt
✅ Tigris image file accessible: https://t3.storage.dev/expandable-cube-xogsjgx1g/tigris-test-image-123456789.png
```

## 📊 Application Integration

### Current Setup
Your application now supports both Tigris and t3.storageapi.dev:

```typescript
// server/storage-service.ts
export function createStorageService(): StorageService {
  // Use Tigris if available, fallback to t3.storageapi.dev
  if (
    process.env.TIGRIS_ENDPOINT &&
    process.env.TIGRIS_BUCKET &&
    process.env.TIGRIS_ACCESS_KEY_ID &&
    process.env.TIGRIS_SECRET_ACCESS_KEY
  ) {
    console.log('🐅 Using Tigris S3 storage');
    return new S3StorageService();
  }

  // Fallback to t3.storageapi.dev if configured
  if (
    process.env.S3_ENDPOINT &&
    process.env.S3_BUCKET &&
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY
  ) {
    console.log('🗂️ Using t3.storageapi.dev S3 storage');
    return new S3StorageService();
  }

  // Fallback to local storage
  console.log('💾 Using local file storage');
  return new LocalStorageService();
}
```

## 🔍 Troubleshooting

### Common Issues

#### Access Denied
```
Error: Access Denied
Solution: 
1. Check bucket policy permissions
2. Verify IAM permissions
3. Ensure access key is correct
4. Check bucket exists and is accessible
```

#### Invalid Credentials
```
Error: Invalid credentials
Solution: 
1. Verify TIGRIS_ACCESS_KEY_ID and TIGRIS_SECRET_ACCESS_KEY
2. Check for typos in credentials
3. Generate new access key in Tigris dashboard
```

#### CORS Issues
```
Error: CORS policy not configured
Solution: 
1. Apply CORS configuration in Tigris dashboard
2. Ensure allowed origins include your domain
3. Check MaxAgeSeconds is reasonable
```

## 📈 Benefits of Tigris

### ✅ Cost Effective
- Pay-as-you-go pricing
- No minimum commitments
- Free egress for first 100GB/month
- Predictable billing

### ✅ High Performance
- Global CDN with edge locations
- 99.9% uptime SLA
- Fast upload speeds
- S3-compatible API

### ✅ Easy Integration
- Drop-in replacement for AWS S3
- Same API calls and functionality
- No code changes required for basic operations

### ✅ Advanced Features
- Bucket policies for fine-grained access control
- Lifecycle management for automatic cleanup
- Versioning and object locking
- Multipart upload for large files
- Event notifications for real-time monitoring

## 🚀 Production Deployment

### Environment Setup
```bash
# Railway Environment Variables
TIGRIS_ENDPOINT=https://t3.storage.dev
TIGRIS_REGION=auto
TIGRIS_BUCKET=expandable-cube-xogsjgx1g
TIGRIS_ACCESS_KEY_ID=tid_dXDjuETPLqTrwnHNIAFmBoZNBs_akGLrQvHsTRmqVHsaTeCSNd
TIGRIS_SECRET_ACCESS_KEY=tsec_1ir5o9rSoDN5V+eGLpFASk8GA6YV-2mztVQcyYN-sER2NsYF1sX3Cl_9hSTu_fiiShc3HK
NODE_ENV=production
```

### Monitoring
- **Tigris Dashboard** - Monitor storage usage and costs
- **Sentry** - Track upload errors and performance
- **Application Logs** - Monitor storage service performance

## 📈 Comparison: Tigris vs t3.storageapi.dev

| Feature | t3.storageapi.dev | Tigris |
|----------|------------------|--------|
| Provider | Same | Different |
| API | AWS S3 | S3-compatible |
| Endpoint | https://t3.storage.dev | https://t3.storage.dev |
| Pricing | Pay-as-you-go | Pay-as-you-go |
| Dashboard | Basic | Advanced |
| Support | Community | Enterprise |
| SLA | 99.9% | 99.9% |
| Features | Standard | Advanced |

## 🎯 Best Practices

### 1. Use Environment Variables
Never hardcode credentials in your application

### 2. Implement Error Handling
Always handle upload failures gracefully

### 3. Monitor Usage
Track storage costs and usage patterns

### 4. Set Up Alerts
Configure alerts for unusual activity

### 5. Test Before Deploy
Always test with real credentials before production

---

**🎉 Your Tigris S3 storage is now ready for production!**
