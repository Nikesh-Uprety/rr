# Image Management & Canvas Page Architecture Report

## Executive Summary

This report documents three interconnected admin pages responsible for visual content management in the RARE.NP e-commerce platform: **Canvas**, **Images**, and **Storefront Image Picker**. These pages form the backbone of the storefront's visual presentation, enabling administrators to build and customize the homepage, manage the media library, and assign images to specific storefront sections.

---

## 1. Canvas Page (`/admin/canvas`)

### Purpose & Functionality

The Canvas page is a visual homepage builder that allows administrators to:
- Select from pre-built homepage templates
- Customize individual sections within each template
- Preview changes in real-time (desktop and mobile viewports)
- Apply font theme presets
- Publish changes to the live storefront

### Supported Section Types

| Section Type | Description | Configuration Options |
|-------------|-------------|----------------------|
| **Hero** | Full-width banner with slides | Slides (tag, headline, eyebrow, body, CTA), secondary CTA |
| **Featured** | Featured products carousel | Title, hint, product IDs |
| **Arrivals** | New arrivals product grid | Title, text, product IDs, columns (2-4) |
| **Fresh Release** | Latest collection display | Title, text, product IDs, columns |
| **Campaign** | Editorial/lookbook grid | Title, text, eyebrow, CTA, layout preset (editorial/balanced), images |
| **Ticker** | Scrolling text announcements | Items (comma-separated) |
| **Quote** | Featured quote section | Text, attribution |
| **Services** | Trust pillars / concierge services | Title, text, service cards |

### Available Templates

- **Rare Dark Luxury** (Premium)
- **Clean Minimal** (Free)
- **Editorial Grid** (Free)

### Data Architecture

```
API Endpoints:
├── GET /api/admin/canvas/templates
│   └── Returns: { id, name, slug, description, thumbnailUrl, tier, priceNpr, isPurchased, isActive }
│
├── GET /api/admin/canvas/settings
│   └── Returns: { id, activeTemplateId, activeTemplate, fontPreset }
│
├── GET /api/admin/canvas/templates/:id/sections
│   └── Returns: [{ id, templateId, sectionType, label, orderIndex, isVisible, config }]
│
├── PATCH /api/admin/canvas/templates/:id/activate
│   └── Action: Set template as active
│
├── POST /api/admin/canvas/templates/:id/sections
│   └── Action: Add new section
│
├── PATCH /api/admin/canvas/sections/:id
│   └── Action: Update section config
│
├── DELETE /api/admin/canvas/sections/:id
│   └── Action: Remove section
│
├── POST /api/admin/canvas/sections/:id/duplicate
│   └── Action: Clone section
│
├── PATCH /api/admin/canvas/sections/reorder
│   └── Action: Reorder sections by orderedIds array
│
├── PATCH /api/admin/canvas/settings
│   └── Action: Update font preset
│
└── Media Upload
    └── Category: landing_page, Provider: local/cloudinary (max 30MB)
```

### Key Features

1. **Live Preview**: Iframe-based preview with viewport switching (desktop/mobile)
2. **Section Presets**: Pre-configured layouts for each section type
3. **Drag & Drop Reordering**: Reorder sections via drag or arrow buttons
4. **Media Library Integration**: Pick images from admin Images library
5. **Template Switching**: Activate different homepage templates instantly
6. **Font Themes**: Apply typography presets (Inter, Playfair Display, etc.)

### Database Schema

Tables involved in `shared/schema.ts`:
- `pageTemplates` - Stores template definitions
- `pageSections` - Stores individual section configurations

---

## 2. Images Page (`/admin/images`)

### Purpose & Functionality

The Images page serves as the central media library for the entire admin panel. It provides:
- Unified access to images across all storage providers
- Categorized organization (product, model, website, etc.)
- Bulk upload capabilities
- Search and filtering
- Payment QR code management

### Storage Providers

| Provider | Description |
|----------|-------------|
| **Local** | Server filesystem (`/uploads` folder) |
| **Cloudinary** | Cloud-based image hosting |
| **Tigris** | S3-compatible object storage |

### Image Categories

| Category | Usage |
|----------|-------|
| `product` | Product photography |
| `model` | Model/editorial shots |
| `website` | General website assets |
| `landing_page` | Homepage/Canvas images |
| `collection_page` | Collection page banners |
| `payment_qr` | Payment QR codes (eSewa, Khalti, Fonepay) |

### Data Architecture

```
API Endpoints:
├── GET /api/admin/images
│   └── Query Params: provider, category, search, limit, offset
│   └── Returns: { data: [{ id, url, filename, provider, category }], total }
│
├── POST /api/admin/images/upload
│   └── Body: file, category, provider
│   └── Returns: { id, url, filename, provider, category }
│
├── DELETE /api/admin/images/:id
│   └── Action: Remove image from storage
│
└── Payment QR Config:
    ├── GET /api/admin/payment-qr/config
    │   └── Returns: { esewa: { url, assetId }, khalti: { ... }, fonepay: { ... } }
    │
    └── PATCH /api/admin/payment-qr/activate
        └── Body: { provider, assetId }
        └── Action: Set QR image as active for checkout
```

### Key Features

1. **Multi-Provider Support**: Switch between Local/Cloudinary/Tigris
2. **Category Filtering**: Filter by content type
3. **Search**: Search by filename
4. **Bulk Upload**: Drag & drop multiple images with progress tracking
5. **Pagination**: Handle large image libraries efficiently
6. **Payment QR Management**: Activate QR codes for checkout (eSewa, Khalti, Fonepay)
7. **Image Preview**: Lightbox-style preview with navigation
8. **Bulk Delete**: Select and delete multiple images
9. **Copy URL**: Quick copy image URL to clipboard

### Upload Constraints

- Max file size: 30MB per image
- Supported formats: JPG, JPEG, PNG, WEBP
- Chunked upload: 3 images concurrently

---

## 3. Storefront Image Picker (`/admin/storefront-images`)

### Purpose & Functionality

The Storefront Image Picker is specifically designed to assign images to the homepage's feature sections. It provides:
- Selection interface for 4 slot types: Feature 1, Feature 2, Feature 3, Explore
- Combined view of local uploads and Cloudinary assets
- LocalStorage-based persistence (simple key-value mapping)

### Slot Configuration

| Slot Key | Default Image | Usage |
|----------|---------------|-------|
| `feature1` | `/images/feature1.webp` | First featured collection |
| `feature2` | `/images/feature2.webp` | Second featured collection |
| `feature3` | `/images/feature3.webp` | Third featured collection |
| `explore` | `/images/explore.webp` | Explore/CTA section |

### Data Architecture

```
API Endpoints:
├── GET /api/admin/storefront-image-library
│   └── Returns: [{ key, filename, url, provider, relPath }]
│
└── DELETE /api/admin/storefront-image-library
    └── Body: { relPath }
    └── Action: Delete local file

Client-Side Storage:
├── localStorage.setItem("storefront_feature_images", JSON.stringify([url1, url2, url3]))
└── localStorage.setItem("storefront_explore_image", url)
```

### Key Features

1. **Slot Selection**: Toggle between 4 slots to assign images
2. **Live Preview**: Show current slot image in preview area
3. **Provider Filter**: Filter by Local uploads or Cloudinary
4. **Search**: Find images by filename
5. **Reset to Defaults**: Revert all slots to default images
6. **Auto-Reset on Delete**: If assigned image is deleted, slot resets to default

### Usage in Storefront

The Storefront Home page (`client/src/pages/storefront/Home.tsx`) reads these values:
- `storefront_feature_images` → Featured collection images (3 slots)
- `storefront_explore_image` → Explore section image

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ADMIN PANEL                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │    Canvas    │    │    Images    │    │ Storefront Image    │  │
│  │    Page      │    │    Page      │    │     Picker          │  │
│  └──────┬───────┘    └──────┬───────┘    └──────────┬───────────┘  │
│         │                   │                       │               │
│         ▼                   ▼                       ▼               │
│  ┌─────────────────────────────────────────────────────────────────┤
│  │                     API LAYER (server/routes.ts)                │
│  ├─────────────┬─────────────┬──────────────┬─────────────────────┤
│  │ /canvas/*   │ /images/*   │ /storefront  │ /payment-qr/*       │
│  │             │             │ -image-lib   │                     │
│  └──────┬──────┴──────┬──────┴──────┬───────┴──────────┬────────┘
│         │             │             │                   │           │
│         ▼             │             │                   ▼           │
│  ┌──────────────┐     │             │         ┌─────────────────┐  │
│  │   Database   │     │             │         │ Payment QR      │  │
│  │ (PostgreSQL) │     │             │         │ Config (JSONB) │  │
│  └──────────────┘     │             │         └─────────────────┘  │
│         │             │             │                               │
│         ▼             ▼             ▼                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ pageTemplates│  │   Storage    │  │  localStorage│              │
│  │ pageSections │  │   Layer      │  │  (Browser)   │              │
│  └──────────────┘  └──────┬───────┘  └──────────────┘              │
│                           │                                         │
│         ┌─────────────────┼─────────────────┐                       │
│         ▼                 ▼                 ▼                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │    Local     │  │  Cloudinary  │  │    Tigris    │              │
│  │  (uploads/)  │  │     CDN      │  │   (S3)       │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

                            ▼
              ┌─────────────────────────────┐
              │      STOREFRONT (Public)    │
              ├─────────────────────────────┤
              │  Home Page reads:           │
              │  • pageSections (Canvas)   │
              │  • localStorage (Images)    │
              └─────────────────────────────┘
```

---

## Benefits of Using These Pages

### Canvas Page Benefits

1. **Visual Homepage Builder**: No coding required to create beautiful homepage layouts
2. **Template System**: Pre-built templates accelerate deployment
3. **Real-time Preview**: See changes before publishing
4. **Mobile Optimization**: Test responsive layouts directly
5. **Section Reusability**: Duplicate and reorder sections easily
6. **Brand Consistency**: Presets ensure cohesive typography and styling

### Images Page Benefits

1. **Centralized Media Library**: Single source of truth for all images
2. **Multi-Provider Flexibility**: Choose storage based on cost/performance needs
3. **Bulk Operations**: Upload and delete multiple images efficiently
4. **Payment Integration**: Direct QR code management for checkout
5. **Organization**: Category-based filtering prevents chaos
6. **Performance**: Pagination and lazy loading handle large libraries

### Storefront Image Picker Benefits

1. **Simplified Workflow**: Focused interface for homepage images
2. **Unified Selection**: Access both local and cloud images in one place
3. **Instant Updates**: Changes reflect immediately on storefront
4. **Fail-Safe Design**: Automatic reset when images are deleted
5. **Low Barrier to Entry**: No database knowledge required

---

## Interdependencies

1. **Canvas ↔ Images**: Canvas uses Images library for selecting section images
2. **Storefront Images ↔ Home**: Storefront Home page reads localStorage values set by Storefront Image Picker
3. **Images ↔ Payment QR**: Payment QR codes are stored in Images with special category
4. **Canvas ↔ Storefront**: Canvas sections directly render on the public storefront

---

## Security Considerations

- All endpoints require `requireAdmin` or `requireAdminPageAccess` middleware
- Image upload size limits enforced (30MB max)
- File type validation (image/* only)
- XSS protection via sanitized filenames
- Path traversal prevention in local storage operations

---

## Performance Notes

- Images use pagination (60 per page default)
- Cloudinary/Canvas queries use `staleTime: 60 * 1000` for caching
- Bulk upload processes 3 images concurrently
- Thumbnail generation for preview (lazy loading)
- localStorage for storefront image mapping (fast read)

---

*Report generated: April 5, 2026*
*Project: RARE.NP E-commerce Platform*