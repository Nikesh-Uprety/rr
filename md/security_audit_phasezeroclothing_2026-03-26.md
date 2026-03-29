# Security Audit Report: phasezeroclothing.com
**Date:** March 26, 2026  
**Scan Tool:** Feroxbuster v2.13.0  
**Wordlist:** raft-medium-directories.txt (30,000+ entries)  
**Scan Duration:** ~10 minutes  

---

## Executive Summary

The feroxbuster directory enumeration scan on phasezeroclothing.com revealed **134 discovered endpoints** with **90 unique URLs** returning non-404 responses. The site demonstrates **good baseline security** with Cloudflare protection, but has some areas that warrant attention.

### Overall Security Rating: **NEEDS ATTENTION** ⭐⭐⭐

---

## 🚨 CRITICAL: API Subdomain Vulnerability

### Critical Finding: Swagger/OpenAPI Documentation Exposed

**Target:** `https://api.phasezeroclothing.com/api`

| Endpoint | Status | Size |
|----------|--------|-------|
| `/api/docs` | 200 | 3KB |
| `/api/docs/swagger-ui-init.js` | 200 | 97KB |
| `/api/docs/swagger-ui.css` | 200 | 150KB |
| `/api/docs/swagger-ui-bundle.js` | 200 | 1.4MB |
| `/api/docs/LICENSE` | 200 | 11KB |

### Security Impact:

1. **Full API Structure Exposed** - All endpoints, parameters, schemas visible
2. **Attack Surface Mapping** - Attackers can identify all available operations
3. **No Authentication Required** - Anyone can access documentation

### Immediate Actions Required:

- [ ] **RESTRICT `/api/docs`** - Require authentication or block in production
- [ ] Disable Swagger in production environment
- [ ] Block via nginx: `location /api/docs { deny all; }`
- [ ] Review exposed endpoints for sensitive operations

### Recommended Fix (Express):

```javascript
// Block swagger in production
if (process.env.NODE_ENV === 'production') {
  app.use('/api/docs', (req, res) => res.status(403).send('Forbidden'));
}
```

---

## ✅ Strengths Identified

### 1. Cloudflare WAF Protection
- Cloudflare CDN and DDoS protection active
- Email addresses obfuscated via `cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js`
- Automatic filtering of 404-like responses

### 2. No Admin Panel Exposure (Main Site)
**Main site:** No administrative endpoints discovered:
- ❌ `/admin` - Not found
- ❌ `/wp-admin` - Not found  
- ❌ `/administrator` - Not found
- ❌ `/manager` - Not found
- ❌ `/cpanel` - Not found
- ❌ `/phpmyadmin` - Not found

### 3. No Version Control Exposure
- ❌ `.git` directory - Not accessible
- ❌ `.env` files - Not accessible
- ❌ `.htaccess` - Not accessible
- ❌ `composer.json` - Not accessible

### 4. UUID-Based Product URLs
Products use cryptographic UUIDs:
```
/products/bb292c42-e8b7-4b1f-a659-513d044e22ac
/products/7e982dc7-b887-4799-b3fb-9573c0d9f596
```
This prevents sequential ID enumeration attacks.

### 5. Internal Path Protection
Most `/_next/static/` subdirectories return **308 redirects** rather than listing contents, indicating proper configuration.

---

## ⚠️ Concerns & Recommendations

### 1. Sequential Collection IDs (MEDIUM PRIORITY)
**Issue:** Collections use integer IDs allowing enumeration
```
/collections/8
/collections/9
/collections/10
```

**Risk:** Attackers can iterate through collections to discover all products/categories

**Recommendation:** Consider using UUIDs for collections, or implement rate limiting on collection endpoints

---

### 2. Next.js Version Fingerprinting (LOW PRIORITY)
**Issue:** Static chunk filenames may reveal framework version:
```
/_next/static/chunks/app/(main)/layout-02daa7e471dd4bf8.js
/_next/static/chunks/main-app-a213c9b311244bdc.js
```

**Recommendation:** Configure Next.js to use non-revealing chunk hashes

---

### 3. Login Endpoint Enumeration (MEDIUM PRIORITY)
**Issue:** `/account/login` endpoint is discoverable and likely vulnerable to brute-force

**Recommendation:**
- Implement rate limiting on login attempts
- Add CAPTCHA after failed attempts
- Consider adding 2FA requirement

---

### 4. Missing Security Headers (MEDIUM PRIORITY)
**Recommendation:** Add these headers to server response:
```http
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Content-Security-Policy: default-src 'self'
```

---

## 📊 Scan Statistics

### Main Site (phasezeroclothing.com)
| Metric | Value |
|--------|-------|
| Total Endpoints Scanned | 30,099 |
| Found | 134 |
| Unique URLs | 90 |
| Errors | 148 |
| Scan Duration | ~10 minutes |
| Threads Used | 50 |
| Timeout | 7 seconds |

### API Subdomain (api.phasezeroclothing.com)
| Metric | Value |
|--------|-------|
| Total Endpoints Scanned | 30,000+ |
| Found | 19 |
| Unique URLs | 19 |
| Critical Finding | Swagger UI Exposed |

---

## 🔍 Discovered Endpoints (Main Site)

### Public Pages
| Endpoint | Status | Size |
|----------|--------|------|
| `/` | 200 | 184KB |
| `/store` | 200 | 22KB |
| `/cart` | 200 | 22KB |
| `/checkout` | 200 | 9KB |
| `/about-us` | 200 | 41KB |
| `/contact` | 200 | 21KB |
| `/exclusive` | 200 | 19KB |

### Account Pages (Requires Auth)
| Endpoint | Status |
|----------|--------|
| `/account` | 200 |
| `/account/login` | 200 |
| `/account/addresses` | 200 |
| `/account/profile` | 200 |
| `/account/orders` | 200 |

### Collections
| Endpoint | Status | Size |
|----------|--------|-------|
| `/collections/8` | 200 | 127KB |
| `/collections/9` | 200 | 196KB |
| `/collections/10` | 200 | 41KB |

---

## 🚫 Properly Blocked Endpoints

These common attack targets were correctly blocked/not found:
- `/admin`, `/wp-admin`, `/administrator`
- `/api-docs`, `/swagger` (main site)
- `/server-status`, `/server-info`
- `/phpmyadmin`, `/phpinfo`
- `/.git/config`, `/.env`
- `/backup`, `/db`, `/database`
- `/web.config`, `/web.xml`
- Common CMS endpoints

---

## 📋 Action Items

### Immediate (CRITICAL)
- [ ] **RESTRICT `/api/docs`** - Block Swagger UI in production
- [ ] Add rate limiting to `/account/login`
- [ ] Add security headers to all responses

### Short-term (Medium Priority)
- [ ] Implement CAPTCHA on login
- [ ] Change collection IDs to UUIDs
- [ ] Add HSTS header
- [ ] Configure CSP headers
- [ ] Enable audit logging for admin actions

### Long-term (Low Priority)
- [ ] Consider adding Web Application Firewall rules
- [ ] Regular security scanning schedule
- [ ] Penetration testing engagement

---

## Conclusion

PhaseZero Clothing's main site demonstrates **good security posture**, but the **API subdomain has a critical vulnerability** - Swagger documentation is publicly accessible without authentication. This is a **high priority issue** that exposes the entire API structure to potential attackers.

**Immediate action required:** Restrict access to `/api/docs` or disable Swagger in production.

---

*Report generated from feroxbuster directory enumeration scan*
