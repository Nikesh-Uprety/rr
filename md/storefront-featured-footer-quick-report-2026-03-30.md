# Quick Change Report - Storefront Featured and Footer

Date: 2026-03-30
Branch: `main`
Scope: Storefront home visual expansion + footer logo fix

## Summary
Implemented quick UI updates to improve section scale, visual balance, and brand consistency on the storefront home page.

## Files Updated
- `client/src/components/home/CampaignBanner.tsx`
- `client/src/components/home/FeaturedCollection.tsx`
- `client/src/components/home/NewArrivalsSection.tsx`
- `client/src/components/layout/Footer.tsx`

## Core Changes
1. Campaign section expansion (`CampaignBanner.tsx`)
- Increased lookbook section footprint by removing narrow max-width wrappers.
- Expanded spacing to full-width layout paddings for better use of horizontal space.
- Increased campaign grid row heights for larger, more prominent visuals.

2. Featured collection scaling (`FeaturedCollection.tsx`)
- Enlarged featured section wrappers for better fill at common browser zoom levels.
- Increased card width clamp from `clamp(240px, 25vw, 300px)` to `clamp(320px, 33vw, 500px)`.
- Increased product image framing from `aspect-[2/3]` to `aspect-[3/4]` in the large featured variants.
- Expanded top carousel visual area in default featured block for stronger editorial presentation.

3. Footer brand logo fix (`Footer.tsx`)
- Replaced broken external logo URL with local asset: `/images/logo.webp`.
- Updated alt text to `Rare Atelier`.
- Wrapped logo in homepage link for consistent brand navigation behavior.

4. New Arrivals section scaling (`NewArrivalsSection.tsx`)
- Applied the same full-width layout treatment used in featured/campaign sections.
- Expanded responsive spacing to better fill screen width on desktop.
- Increased product media presentation from `aspect-[4/5]` to `aspect-[3/4]`.

## UX Impact
- Better section presence and reduced empty space on wider displays.
- Stronger visual continuity between hero and downstream featured sections.
- Resolved broken footer branding asset and improved logo reliability.

## Verification
- Build verification: `npm run build` passed successfully.
- Manual expectation: homepage featured and campaign sections render larger; footer logo loads from local asset path.
