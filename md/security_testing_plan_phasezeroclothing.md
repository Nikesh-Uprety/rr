# Security Testing Plan: phasezeroclothing.com
**Date:** March 26, 2026  
**Target:** phasezeroclothing.com & api.phasezeroclothing.com  
**Purpose:** Personal project security hardening  

---

## 🧪 Test Categories

### 1. Information Gathering
- [ ] DNS enumeration
- [ ] WHOIS lookup
- [ ] SSL/TLS certificate analysis
- [ ] Technology fingerprinting
- [ ] Subdomain enumeration

### 2. Web Application Testing
- [ ] SQL Injection (SQLi)
- [ ] Cross-Site Scripting (XSS)
- [ ] CSRF testing
- [ ] Authentication bypass
- [ ] IDOR (Insecure Direct Object References)
- [ ] Path traversal
- [ ] Command injection

### 3. API Security Testing
- [ ] API endpoint enumeration
- [ ] Authentication testing
- [ ] Rate limiting verification
- [ ] Input validation
- [ ] Swagger/OpenAPI testing

### 4. SSL/TLS Testing
- [ ] SSL certificate validation
- [ ] TLS version support
- [ ] Weak cipher detection

### 5. Headers & Configuration
- [ ] Security header analysis
- [ ] CORS configuration
- [ ] Cookie security

---

## 🚀 Quick Test Commands

### Basic Health Checks
```bash
# Check if site is up
curl -sI https://phasezeroclothing.com

# Check SSL certificate
curl -vI https://phasezeroclothing.com 2>&1 | grep -E "SSL|TLS|certificate"

# Check security headers
curl -sI https://phasezeroclothing.com | grep -iE "x-frame|csp|x-xss|content-type|hsts"
```

### SQL Injection Tests
```bash
# Test common SQLi patterns
curl -s "https://phasezeroclothing.com/products/1'" | grep -iE "sql|mysql|error|syntax"
curl -s "https://phasezeroclothing.com/products/1 OR 1=1" | grep -iE "sql|mysql|error"

# Test API endpoints
curl -s "https://api.phasezeroclothing.com/api/products/1'"
```

### XSS Tests
```bash
# Reflected XSS test
curl -s "https://phasezeroclothing.com/search?q=<script>alert(1)</script>" | grep -o "<script>"
curl -s "https://phasezeroclothing.com/products/?q=test" 
```

### Authentication Tests
```bash
# Check login endpoint headers
curl -sI https://phasezeroclothing.com/account/login | grep -iE "set-cookie|www-authenticate"

# Test rate limiting (multiple rapid requests)
for i in {1..10}; do curl -sI https://phasezeroclothing.com/account/login -o /dev/null -w "%{http_code}\n"; done
```

---

## 📋 Test Scripts

### 1. ssl-test.sh - SSL/TLS Analysis
```bash
#!/bin/bash
echo "=== SSL/TLS Analysis ==="
echo ""
echo "1. Certificate Info:"
openssl s_client -connect phasezeroclothing.com:443 -showcerts </dev/null 2>/dev/null | openssl x509 -noout -dates -issuer -subject

echo ""
echo "2. TLS Version Support:"
openssl s_client -connect phasezeroclothing.com:443 -tls1_2 </dev/null 2>&1 | grep -E "Protocol|Cipher"
openssl s_client -connect phasezeroclothing.com:443 -tls1_3 </dev/null 2>&1 | grep -E "Protocol|Cipher"
```

### 2. headers-test.sh - Security Headers Check
```bash
#!/bin/bash
echo "=== Security Headers Analysis ==="
HEADERS=$(curl -sI https://phasezeroclothing.com)

echo "Checking headers..."
echo "$HEADERS" | grep -iE "strict-transport|x-frame-options|x-content-type|x-xss-protection|content-security|referrer-policy|access-control" || echo "Some headers may be missing"
```

### 3. api-test.sh - API Testing
```bash
#!/bin/bash
echo "=== API Security Test ==="
echo ""
echo "1. Swagger Documentation:"
curl -sI https://api.phasezeroclothing.com/api/docs | head -1

echo ""
echo "2. API Root:"
curl -sI https://api.phasezeroclothing.com/api | head -1

echo ""
echo "3. Testing auth-required endpoints:"
curl -s https://api.phasezeroclothing.com/api/orders -w "\nHTTP: %{http_code}\n"
```

---

## 🎯 Priority Test Cases

### Critical (Run First)
1. **SQL Injection on products/collections**
2. **Swagger documentation access**
3. **Login brute-force vulnerability**
4. **Authentication bypass**

### High (Run Second)
5. **XSS in search/forms**
6. **IDOR on orders/profile**
7. **Missing security headers**
8. **SSL certificate issues**

### Medium (Run Third)
9. **CORS misconfiguration**
10. **Cookie security**
11. **Rate limiting verification**
12. **Information disclosure**

---

## 📊 Expected Results Format

```
=== TEST: [Name] ===
Target: [URL]
Expected: [What we expect to find]
Result: [PASS/FAIL/VULNERABLE]
Evidence: [curl output or screenshot description]
```

---

## 🛡️ Remediation Checklist

After each test, document:
- [ ] Vulnerability found? (Yes/No)
- [ ] Severity (Critical/High/Medium/Low)
- [ ] Affected endpoint
- [ ] Remediation steps
- [ ] Verified fix?

---

*Test Plan for phasezeroclothing.com security assessment*
