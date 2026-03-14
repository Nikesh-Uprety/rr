# 📅 Next Steps: March 15 - POS & Admin Refinement

This document outlines the priorities and planned improvements for the rare admin portal, focusing on the Point of Sale (POS) system and overall branding consistency.

---

## 🚀 Priority 1: POS "Premium Feel" Overhaul
Standardize the POS UX with the new animation system.
- **[ ] Animated Button Conversion**: Replace all raw `<button>` and static icons with the new animated `Button` component (Micro-Bounce & Hover Lift).
- **[ ] Premium Modal Transistions**: Replace native `alert()` for session summaries with a branded Radix UI Dialog.
- **[ ] Cart AnimatePresence**: Implement entry/exit animations for cart items so they slide in smoothly when scanned or added.

## 🛠️ Priority 2: Functional Resilience
Ensure the POS is robust and reliable during high-traffic sessions.
- **[ ] Real-time Stock Guard**: Implement a hard check in `addToCart` to prevent adding more items than currently in stock.
- **[ ] Failure Recovery**: Ensure the cart state is preserved if a `chargeMutation` fails, allowing for immediate retry without re-scanning.
- **[ ] Skeleton Loaders**: Add skeleton states for the product grid/list to eliminate layout shifting on load.

## 👥 Priority 3: Customer Integration
Leverage the new Customers module within the sales flow.
- **[ ] Customer Lookup**: Replace the static text inputs with a searchable command-like interface to link sales to existing customer profiles.
- **[ ] Loyalty Status**: Display customer order count/total spent during the checkout process to help staff provide personalized service.

## 🎨 Priority 4: Branding & Consistency
Final polish to match the new "Products" page aesthetic.
- **[ ] Rounded-Full Standard**: Apply `rounded-full` to all POS inputs, search bars, and filter pills.
- **[ ] Parked Sales UI**: Redesign the parked sales chips into professional "Workspaces" with clear identifiers.

---

## 🧪 Quick Fix Checklist (Cleanup)
- **[ ]** Check all `lucide-react` imports for consistency.
- **[ ]** Verify Dark Mode visibility for all new POS components.
- **[ ]** Polish the "End of Day" summary layout.

---
**Prepared by Antigravity AI**
