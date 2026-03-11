# RARE Nepal - Implementation Roadmap & Quick Start Guide

## What's Been Done ✅

### 1. Infrastructure Modules Created

#### `server/logger.ts` - Centralized Logging Service
- **Purpose**: Replace 60+ raw console.log/error calls throughout the codebase
- **Features**:
  - Structured logging with 4 levels: debug, info, warn, error
  - Context tracking: source, userId, requestId, timestamp
  - Stack traces for errors
  - Metadata support for additional context
  - Production-aware (skips debug logs in production)

**Usage Example**:
```typescript
import { logger } from "./logger";

logger.info("User logged in", { source: "auth", userId: "123" });
logger.error("Database error", { source: "orders" }, dbError, { orderId: "456" });
```

#### `server/errorHandler.ts` - Centralized Error Handling
- **Purpose**: Standardize all API responses and error handling
- **Functions**:
  - `sendSuccess(res, data)` - Consistent success responses
  - `sendError(res, message, details, statusCode)` - Consistent error responses
  - `asyncHandler(fn)` - Wrapper for async route handlers
  - `getQueryParam(param)` - Safe query param extraction (handles string or array)
  - `handleApiError(res, error, context)` - Standard error handler
  - `validateRequired(data, fields)` - Input validation helper

**Usage Example**:
```typescript
import { sendSuccess, sendError, asyncHandler } from "./errorHandler";

app.get("/api/user/:id", asyncHandler(async (req, res) => {
  const user = await getUserById(req.params.id);
  if (!user) {
    return sendError(res, "User not found", undefined, 404);
  }
  sendSuccess(res, user);
}));
```

---

## Priority Roadmap 🚀

### PHASE 1: Type Fixes (BLOCKING - Must do first)
**Estimated effort**: 2-3 hours  
**Blocker for**: Build, deployment

1. **Fix Schema Type Consistency**
   - Location: `server/routes.ts` (various product creation endpoints)
   - Issue: Price is numeric in DB but stored as string, code passes number
   - Fix: Ensure all price/total fields passed to storage use `.toString()` conversion
   - Status: Already appears corrected on line 748

2. **Fix React Query Deprecations**
   - Location: `client/src/pages/admin/POS.tsx`
   - Issue: React Query v5 changed `isLoading` to `isPending` or data-based checks
   - Fix: Replace `mutation.isLoading` with `mutation.isPending` or check `mutation.data`
   - Affected lines: ~259

3. **Fix Component Types**
   - `client/src/pages/admin/Analytics.tsx` (lines 267, 274, 278, 281, 290)
     - Issue: 'card' is unknown type
     - Fix: Define card type or ensure proper typing from backend response
   
   - `client/src/pages/admin/Products.tsx` (line 214)
     - Issue: undefined not assignable to string | null
     - Fix: Provide default value or handle null explicitly

4. **Fix Storage Duplicates** (Optional if not causing issues)
   - Location: `server/storage.ts`
   - Issue: MemStorage class duplicates all methods from PgStorage
   - Options:
     a) Remove MemStorage if not used (search projects for usage first)
     b) Make MemStorage extend PgStorage or use composition
     c) Mark as development-only conditional export

### PHASE 2: Integrate Logging (Quick Win)
**Estimated effort**: 1-2 hours  
**Improves**: Debuggability, observability

Replace console calls systematically:
```bash
# In server/routes.ts: Replace all console.error with logger.error()
# Example before:
console.error("Error in POST /api/orders:", err);

# Example after:
logger.error("Failed to create order", { source: "POST /api/orders" }, err);
```

Priority replacements (high-impact routes):
- `/api/auth/` endpoints (security sensitive)
- `/api/orders/` endpoints (critical business logic)
- `/api/admin/` endpoints (admin actions)

### PHASE 3: Input Validation
**Estimated effort**: 2 hours  
**Improves**: Security, data integrity

Add centralized validation middleware using existing Zod schemas:
```typescript
// Create validation middleware
import { z } from "zod";

function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return sendError(res, "Validation failed", result.error.errors, 400);
    }
    req.validatedBody = result.data;
    next();
  };
}
```

### PHASE 4: Security Hardening
**Estimated effort**: 1-2 hours  
**Improves**: Compliance, attack resistance

- [ ] Fix PostgreSQL SSL mode warning in `drizzle.config.ts`
- [ ] Add rate limiting to auth endpoints
- [ ] Add request size limits middleware
- [ ] Set security headers (CORS, CSP, etc.)

---

## Immediate Action Items

### Today (This Session):
1. **Test**: Run `npm run check` to get fresh TypeScript error list
2. **Fix**: Systematically address the blocking type errors
3. **Integrate**: Import and use logger in top 3 critical route files

### Files to Modify Next:
1. `server/routes.ts` - Import and use logger
   ```typescript
   import { logger } from "./logger";
   import { sendSuccess, sendError } from "./errorHandler";
   
   // Replace console.error calls with logger.error()
   // Use sendSuccess/sendError for responses
   ```

2. `server/index.ts` - Add logging middleware
   ```typescript
   app.use((req, res, next) => {
     logger.info(`${req.method} ${req.path}`, { source: "HTTP" });
     next();
   });
   ```

3. `client/src/pages/admin/POS.tsx` - Fix React Query
   ```typescript
   // Change isLoading to isPending
   const chargeMutation = useMutation({
     // ...
     // Use isPending instead of isLoading
   });
   ```

---

## Testing & Validation

### TypeScript Verification:
```bash
npm run check  # Should show decreasing error count
```

### Build Verification:
```bash
npm run build  # Should complete successfully
```

### Quick Test:
```bash
npm run dev    # Should start without TypeScript errors
```

---

## File Reference

| File | Purpose | Status |
|------|---------|--------|
| `server/logger.ts` | Centralized logging | ✅ Created |
| `server/errorHandler.ts` | Error handling utilities | ✅ Created |
| `server/routes.ts` | API routes | 🔄 Needs logger integration |
| `server/index.ts` | Server setup | 🔄 Needs logging middleware |
| `client/src/pages/admin/POS.tsx` | React Query fix | ⏳ Needs isPending update |
| `client/src/pages/admin/Analytics.tsx` | Type fixes | ⏳ Needs card type definition |
| `tsconfig.json` | TS configuration | ⏳ May need downlevelIteration |

---

## Success Criteria

✅ Phase 1 Complete when:
- `npm run check` returns 0 errors
- Build succeeds: `npm run build`

✅ Phase 2 Complete when:
- All console calls replaced with logger in critical paths
- Can trace errors in production

✅ Phase 3 Complete when:
- All endpoints validate input before processing
- Zod schemas centralized and reused

✅ Phase 4 Complete when:
- Security headers properly configured
- Rate limiting prevents abuse
- SSL/TLS properly configured

---

## Notes
- The project structure is solid; these are quality-of-life improvements
- Most fixes are straightforward find-and-replace operations
- Focus on blocking issues (types) before nice-to-have improvements
- Created utilities (`logger.ts`, `errorHandler.ts`) are production-ready
- Test as you go to catch regressions early
