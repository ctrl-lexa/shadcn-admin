# Audit Decorators & Interceptor - Usage Guide

## Overview

This guide explains how to use the **@Audit()** decorator and **@NoAudit()** decorator along with the **AuditInterceptor** for automatic audit logging.

---

## Why Optional?

### Manual Integration (Current Approach)
**Pros:**
- ✅ Granular control over what data is logged
- ✅ Can extract old values before update
- ✅ Custom logic per operation
- ✅ No performance overhead on read operations

**Cons:**
- ❌ Repetitive code in every service method
- ❌ Easy to forget to add audit logs
- ❌ More maintenance

### Automatic Interceptor
**Pros:**
- ✅ DRY (Don't Repeat Yourself)
- ✅ Consistent logging across all endpoints
- ✅ Less code to maintain
- ✅ Catches all operations automatically

**Cons:**
- ❌ Less control over what gets logged
- ❌ Can't easily capture old values for updates
- ❌ May log unnecessary data
- ❌ Performance overhead on all requests

### Hybrid Approach (Recommended)
Use interceptor for standard CRUD + decorators for customization!

---

## Setup

### Option 1: Global Audit Interceptor (Auto-log everything)

```typescript
// apps/backend/src/app.module.ts
import { GlobalAuditModule } from './common/global-audit.module';

@Module({
  imports: [
    // ... other modules
    GlobalAuditModule, // Enable global audit interceptor
  ],
})
export class AppModule {}
```

Now all POST/PUT/PATCH/DELETE operations are automatically logged!

### Option 2: Manual Per-Controller

```typescript
// In your controller
import { UseInterceptors } from '@nestjs/common';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

@UseInterceptors(AuditInterceptor)
@Controller('products')
export class ProductsController {
  // All methods in this controller will be audited
}
```

---

## Using @NoAudit() Decorator

Use when you want to **disable** automatic audit logging:

```typescript
import { NoAudit } from '@/common/decorators/no-audit.decorator';

@Controller('products')
export class ProductsController {
  
  // This endpoint won't be audited (already manually logged in service)
  @NoAudit()
  @Post()
  async create(@Body() dto: CreateProductDto) {
    return this.service.create(dto);
  }

  // This will be auto-audited
  @Get()
  async findAll() {
    return this.service.findAll();
  }
}
```

**When to use:**
- ✅ When you already have manual audit logging in the service
- ✅ For public endpoints that don't need auditing
- ✅ For read-only operations (GET requests are skipped by default)

---

## Using @Audit() Decorator

Use when you want to **customize** audit behavior:

### Example 1: Custom Resource Name

```typescript
import { Audit } from '@/common/decorators/audit.decorator';

@Audit({ resource: 'product', action: 'CREATE' })
@Post()
async create(@Body() dto: CreateProductDto) {
  return this.service.create(dto);
}
```

### Example 2: Exclude Sensitive Fields

```typescript
@Audit({ 
  resource: 'user', 
  action: 'UPDATE',
  excludeFields: ['password', 'passwordHash', 'twoFactorSecret']
})
@Patch(':id')
async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
  return this.service.update(id, dto);
}
```

### Example 3: Log Only Specific Fields

```typescript
@Audit({ 
  resource: 'product', 
  action: 'UPDATE',
  fields: ['name', 'price', 'stock'] // Only log these fields
})
@Patch(':id')
async update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
  return this.service.update(id, dto);
}
```

### Example 4: Add Custom Metadata

```typescript
@Audit({ 
  resource: 'transaction',
  action: 'REFUND',
  metadata: {
    category: 'financial',
    severity: 'high'
  }
})
@Post('refund')
async refund(@Body() dto: RefundDto) {
  return this.service.refund(dto);
}
```

### Example 5: Disable Response Logging (for large payloads)

```typescript
@Audit({ 
  resource: 'report',
  action: 'EXPORT',
  logResponse: false // Don't log response (could be huge CSV)
})
@Get('export')
async export() {
  return this.service.generateReport();
}
```

---

## Comparison: Manual vs Interceptor vs Decorator

### Scenario: Create Product

#### 1. Manual (Current)
```typescript
// products.service.ts
async create(tenantId: string, userId: string, dto: CreateProductDto) {
  const product = await this.prisma.product.create({ data: dto });
  
  // Manual audit log
  await this.auditLogs.logCreate(tenantId, userId, 'product', product.id, {
    name: product.name,
    sku: product.sku,
    price: product.sellingPrice,
  });
  
  return product;
}

// products.controller.ts
@Post()
create(@TenantId() tenantId: string, @Body() dto: CreateProductDto, @Request() req) {
  return this.service.create(tenantId, req.user.userId, dto);
}
```

#### 2. With Interceptor (Automatic)
```typescript
// products.service.ts
async create(tenantId: string, dto: CreateProductDto) {
  return this.prisma.product.create({ data: dto });
  // No manual audit log needed!
}

// products.controller.ts
@Post()
create(@TenantId() tenantId: string, @Body() dto: CreateProductDto) {
  return this.service.create(tenantId, dto);
  // Auto-logged by interceptor!
}
```

#### 3. With @Audit() Decorator (Customized)
```typescript
// products.service.ts
async create(tenantId: string, dto: CreateProductDto) {
  return this.prisma.product.create({ data: dto });
}

// products.controller.ts
@Audit({ 
  resource: 'product',
  action: 'CREATE',
  fields: ['name', 'sku', 'sellingPrice'], // Only log these
  metadata: { category: 'inventory' }
})
@Post()
create(@TenantId() tenantId: string, @Body() dto: CreateProductDto) {
  return this.service.create(tenantId, dto);
}
```

---

## Best Practices

### 1. **Use Global Interceptor + @NoAudit() for exceptions**
```typescript
// Enable globally in app.module.ts
imports: [GlobalAuditModule]

// Disable for specific endpoints
@NoAudit()
@Get('public-data')
async getPublicData() {
  return this.service.findPublic();
}
```

### 2. **Use @Audit() for sensitive operations**
```typescript
@Audit({ 
  resource: 'user',
  action: 'PERMISSION_CHANGE',
  excludeFields: ['password'],
  metadata: { severity: 'critical' }
})
@Post('change-role')
async changeRole(@Body() dto: ChangeRoleDto) {
  return this.service.changeRole(dto);
}
```

### 3. **Keep manual logging for complex scenarios**
```typescript
// When you need old/new comparison
async update(id: string, dto: UpdateDto) {
  const old = await this.prisma.product.findUnique({ where: { id } });
  const updated = await this.prisma.product.update({ 
    where: { id }, 
    data: dto 
  });
  
  // Manual log with proper old/new values
  await this.auditLogs.logUpdate(tenantId, userId, 'product', id, old, updated);
  
  return updated;
}
```

### 4. **Combine approaches**
```typescript
// Use interceptor for basic CRUD
@UseInterceptors(AuditInterceptor)
@Controller('products')
export class ProductsController {
  
  // Auto-logged by interceptor
  @Post()
  create() { }
  
  // Custom config for special operation
  @Audit({ action: 'EXPORT', logBody: false })
  @Get('export')
  export() { }
  
  // Manually logged in service (more control)
  @NoAudit()
  @Patch(':id/complex-update')
  complexUpdate() { }
}
```

---

## Migration Strategy

### Phase 1: Keep Manual (Current) ✅
- Already implemented
- Full control
- Works great!

### Phase 2: Add Interceptor for New Features
```typescript
// For new modules, use interceptor
@UseInterceptors(AuditInterceptor)
@Controller('new-feature')
export class NewFeatureController {
  // All operations auto-logged!
}
```

### Phase 3: Gradually Migrate Existing
```typescript
// Remove manual logs from service
async create(tenantId: string, dto: CreateDto) {
  const result = await this.prisma.create({ data: dto });
  // Remove this: await this.auditLogs.logCreate(...)
  return result;
}

// Add @Audit() to controller
@Audit({ resource: 'product', action: 'CREATE' })
@Post()
create() { }
```

---

## Performance Considerations

### Interceptor Overhead
- Adds ~1-5ms per request
- Runs on ALL requests (even if skipped)
- Use @NoAudit() for high-frequency endpoints

### Manual Logging
- Only runs when called
- No overhead on endpoints without audit
- Better for performance-critical operations

### Recommendation
- Use interceptor for admin/management endpoints
- Keep manual for high-frequency transactional endpoints (POS checkout, etc.)

---

## Summary

| Approach | Best For | Pros | Cons |
|----------|----------|------|------|
| **Manual** | Complex logic, old/new comparison | Full control, precise data | Repetitive code |
| **Interceptor** | Standard CRUD, new features | DRY, automatic, consistent | Less control, all requests |
| **@Audit() Decorator** | Customization, sensitive data | Flexible, reusable | Need to remember to add |
| **@NoAudit() Decorator** | Opt-out exceptions | Simple, clear intent | Only works with interceptor |

**Recommendation**: Hybrid approach - use what makes sense per use case! 🚀
