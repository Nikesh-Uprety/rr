# Project Structure

This document outlines the clean, organized structure of the project.

## 📁 Root Directory Structure

```
rr/
├── 📄 Configuration Files
│   ├── .env                     # Environment variables (local)
│   ├── .env.example             # Environment variables template
│   ├── package.json              # Dependencies and scripts
│   ├── tsconfig.json            # TypeScript configuration
│   ├── vite.config.ts           # Vite build configuration
│   ├── tailwind.config.js        # Tailwind CSS configuration
│   ├── playwright.config.ts      # Playwright testing configuration
│   └── drizzle.config.ts        # Database configuration
│
├── 📚 Documentation (docs/)
│   ├── guides/                  # Setup and integration guides
│   │   ├── EMAIL_ALTERNATIVES.md
│   │   ├── RAILWAY_DEPLOYMENT.md
│   │   ├── RAILWAY_DOMAIN_VERIFICATION.md
│   │   ├── RESEND_SETUP.md
│   │   └── TIGRIS_SETUP.md
│   ├── planning/                # Project planning documents
│   │   ├── IMPLEMENTATION_PLAN.md
│   │   ├── HOMEPAGE_UX_IMPROVEMENT_PLAN.md
│   │   ├── PERFORMANCE_OPTIMIZATION_PLAN.md
│   │   ├── PRODUCTION_READINESS_REVIEW.md
│   │   └── SKILLS.md
│   ├── reports/                 # Generated reports and analysis
│   │   ├── CHANGES_SUMMARY_2026-03-25.md
│   │   ├── codex.md
│   │   ├── performance.md
│   │   ├── quick_report_products_search_sort_2026-03-30.md
│   │   └── quick_report_products_search_sort_2026-03-30.pdf
│   └── setup/                  # Additional setup documentation
│
├── 🎨 Client Application (client/)
│   ├── src/                    # Source code
│   │   ├── components/         # Reusable components
│   │   ├── pages/              # Page components
│   │   └── lib/                # Client utilities
│   ├── public/                  # Static assets
│   └── dist/                    # Build output
│
├── 🖥️ Server Application (server/)
│   ├── routes.ts               # API routes
│   ├── index.ts                # Server entry point
│   ├── uploads.ts              # Upload configuration
│   ├── storage-service.ts       # S3/Tigris storage abstraction
│   ├── resend-service.ts       # Resend email service
│   ├── enhanced-email-service.ts # Enhanced email with multiple domains
│   ├── s3-upload.ts           # S3 upload functionality
│   ├── email.ts               # Email sending logic
│   └── lib/                   # Server utilities
│
├── 🧪 Tests (tests/)
│   ├── Integration/            # Integration tests
│   ├── E2E/                  # End-to-end tests
│   └── Unit/                  # Unit tests
│
├── 📦 Shared Code (shared/)
│   ├── auth-policy.ts          # Authentication policies
│   └── index.ts               # Shared utilities
│
├── 📁 Uploads (uploads/)
│   └── [uploaded files]        # Local file uploads
│
├── 📚 Additional Documentation
│   ├── README.md               # Project overview
│   ├── CLAUDE.md              # AI assistant context
│   └── LICENSE                 # License information
│
├── 🔧 Configuration (/.git/)
│   ├── .gitignore             # Git ignore rules
│   └── .github/               # GitHub workflows
│
└── 📦 Dependencies
    ├── node_modules/           # Installed packages
    └── package-lock.json       # Dependency lock file
```

## 📋 Key Features

### **🚀 Production Services**
- **📧 Email Service:** Resend with multiple verified domains
- **🗂️ Storage:** Tigris S3 with fallback to local
- **📊 Monitoring:** Sentry error tracking and metrics
- **🚀 Deployment:** Railway with environment configuration
- **🔐 Authentication:** 2FA with OTP support

### **🎨 Application Features**
- **🛒 E-commerce:** Product catalog and orders
- **👤 User Management:** Admin authentication and roles
- **📱 Responsive Design:** Mobile-friendly interface
- **🎨 Modern UI:** Tailwind CSS styling

### **🔧 Development Tools**
- **📝 TypeScript:** Full type safety
- **🧪 Testing:** Playwright E2E tests
- **📦 Build Tools:** Vite for fast development
- **🗃️ Database:** Drizzle ORM with PostgreSQL

## 📊 Documentation Organization

### **📚 Guides (docs/guides/)**
- **EMAIL_ALTERNATIVES.md** - Email service options without domain verification
- **RAILWAY_DEPLOYMENT.md** - Complete Railway deployment guide
- **RAILWAY_DOMAIN_VERIFICATION.md** - Domain verification setup
- **RESEND_SETUP.md** - Resend email service configuration
- **TIGRIS_SETUP.md** - Tigris S3 storage setup

### **📋 Planning (docs/planning/)**
- **IMPLEMENTATION_PLAN.md** - Project implementation roadmap
- **HOMEPAGE_UX_IMPROVEMENT_PLAN.md** - UI/UX enhancement plans
- **PERFORMANCE_OPTIMIZATION_PLAN.md** - Performance optimization strategies
- **PRODUCTION_READINESS_REVIEW.md** - Production deployment checklist
- **SKILLS.md** - Technical skills and capabilities

### **📊 Reports (docs/reports/)**
- **CHANGES_SUMMARY_2026-03-25.md** - Development changes summary
- **codex.md** - Code analysis and documentation
- **performance.md** - Performance metrics and analysis

## 🎯 Clean Project Benefits

### **✅ Improved Organization**
- **Clear separation** of concerns across directories
- **Easy navigation** for developers
- **Scalable structure** for future growth
- **Professional appearance** for collaboration

### **✅ Better Documentation**
- **Centralized guides** in docs/guides/
- **Organized planning** in docs/planning/
- **Consolidated reports** in docs/reports/
- **Quick access** to important information

### **✅ Development Efficiency**
- **Faster file location** with logical grouping
- **Reduced clutter** in root directory
- **Better onboarding** for new developers
- **Maintainable structure** for long-term growth

## 🚀 Getting Started

### **For New Developers:**
1. **Read README.md** for project overview
2. **Check docs/guides/** for setup instructions
3. **Review docs/planning/** for project context
4. **Explore client/** and server/** for code structure
5. **Run tests/** to verify functionality

### **For Deployment:**
1. **Configure .env** using .env.example as template
2. **Follow RAILWAY_DEPLOYMENT.md** for deployment steps
3. **Monitor with Sentry** for production issues
4. **Use Tigris S3** for file storage

---

**🎉 Project is now clean, organized, and ready for professional development!**
