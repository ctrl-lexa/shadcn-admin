# Feature Flags System

Complete feature flag infrastructure for managing tenant features, plan-based access, and gradual rollouts.

## 🎯 Overview

The feature flags system provides:
- **Plan-based access control**: Features restricted to specific plans (starter/business/pro)
- **Gradual rollout**: Release features to percentage of tenants (0-100%)
- **Tenant-specific overrides**: Enable/disable features per tenant
- **Beta testing**: Explicit tenant allowlist for early access
- **Caching**: 5-minute cache for performance
- **Metadata**: Flexible JSON config per feature

## 📊 Database Models

### FeatureFlag
```prisma
model FeatureFlag {
  key                String   @unique  // e.g., "offline_pos", "kds"
  name               String             // Display name
  description        String?            // Feature description
  category           String?            // "pos", "inventory", "koperasi", etc.
  enabled            Boolean  @default(true)  // Global toggle
  plans              String[]           // ["starter", "business", "pro"]
  rolloutPercentage  Int      @default(100)   // 0-100
  rolloutTenants     String[]           // Explicit tenant IDs for beta
  metadata           Json?              // Additional config
}
```

### TenantEntitlement
```prisma
model TenantEntitlement {
  tenantId   String
  featureKey String   // References FeatureFlag.key
  enabled    Boolean  @default(true)
  config     Json?    // Tenant-specific configuration
  
  @@unique([tenantId, featureKey])
}
```

## 🚀 Usage

### 1. Controller Protection with @RequireFeature()

```typescript
import { RequireFeature } from '@/common/decorators/require-feature.decorator';
import { UseGuards } from '@nestjs/common';
import { FeatureGuard } from '@/common/guards/feature.guard';

@Controller('kds')
@UseGuards(FeatureGuard)
export class KDSController {
  @Get()
  @RequireFeature({ feature: 'kds' })
  getKDSData() {
    // Only accessible if tenant has 'kds' feature enabled
    return { message: 'KDS data' };
  }
  
  @Get('/orders')
  @RequireFeature({ 
    feature: 'kds',
    message: 'KDS requires Business plan or higher'
  })
  getOrders() {
    // Custom error message
    return { orders: [] };
  }
}
```

### 2. Programmatic Feature Check

```typescript
import { FeatureFlagsService } from '@/feature-flags/feature-flags.service';

constructor(private featureFlagsService: FeatureFlagsService) {}

async someMethod(tenantId: string) {
  const result = await this.featureFlagsService.isEnabled(
    tenantId,
    'offline_pos'
  );
  
  if (result.enabled) {
    // Feature is enabled
    console.log('Config:', result.config);
  } else {
    // Feature disabled
    console.log('Reason:', result.reason);
    // Reasons: 'Feature not found', 'Feature globally disabled',
    // 'Feature not available in current plan', 
    // 'Tenant not in rollout percentage', 'Feature disabled for tenant'
  }
}
```

### 3. Get Tenant Features

```typescript
// Get all enabled features for a tenant
const features = await this.featureFlagsService.getTenantFeatures(tenantId);
// Returns: ['offline_pos', 'kds', 'advanced_reports', ...]
```

### 4. Get Plan Features

```typescript
// Get all features available in a plan
const features = await this.featureFlagsService.getPlanFeatures('business');
// Returns array of FeatureFlag objects
```

## 🔧 Admin API Endpoints

All admin endpoints require appropriate permissions.

### Check Feature for Current Tenant
```http
GET /api/v1/feature-flags/check/offline_pos
Authorization: Bearer {token}

Response:
{
  "featureKey": "offline_pos",
  "enabled": true,
  "config": { "maxDevices": 5 }
}
```

### Get My Features
```http
GET /api/v1/feature-flags/my-features
Authorization: Bearer {token}

Response:
{
  "features": ["offline_pos", "kds", "advanced_reports"]
}
```

### Create Feature Flag
```http
POST /api/v1/feature-flags
Authorization: Bearer {token}
Permission: manage_feature_flags

{
  "key": "new_feature",
  "name": "New Feature",
  "description": "Description here",
  "category": "pos",
  "enabled": true,
  "plans": ["business", "pro"],
  "rolloutPercentage": 50,
  "rolloutTenants": ["tenant-id-1"],
  "metadata": { "icon": "star" }
}
```

### Update Feature Flag
```http
PUT /api/v1/feature-flags/offline_pos
Authorization: Bearer {token}
Permission: manage_feature_flags

{
  "enabled": false,
  "rolloutPercentage": 100
}
```

### Delete Feature Flag
```http
DELETE /api/v1/feature-flags/offline_pos
Authorization: Bearer {token}
Permission: manage_feature_flags
```

### Override Feature for Tenant
```http
POST /api/v1/feature-flags/tenant/{tenantId}/override
Authorization: Bearer {token}
Permission: manage_tenant_features

{
  "featureKey": "offline_pos",
  "enabled": true,
  "config": { "maxDevices": 10 }
}
```

### Bulk Enable Features
```http
POST /api/v1/feature-flags/tenant/{tenantId}/bulk-enable
Authorization: Bearer {token}
Permission: manage_tenant_features

{
  "featureKeys": ["offline_pos", "kds", "advanced_reports"]
}
```

## 📋 Pre-seeded Features

18 features are automatically seeded:

### POS Features
- `offline_pos` - Offline POS (Business+)
- `kds` - Kitchen Display System (Business+)
- `multi_outlet` - Multi-Outlet Management (Pro)
- `custom_receipts` - Custom Receipt Templates (Business+)

### Inventory Features
- `advanced_inventory` - Advanced Inventory (Business+)
- `batch_tracking` - Batch & Expiry Tracking (Pro)
- `barcode_scanner` - Barcode Scanner (All plans)

### Koperasi Features
- `koperasi_module` - Full Koperasi Suite (Pro)
- `member_savings` - Member Savings Accounts (Pro)
- `member_loans` - Member Loans (Pro)

### Reporting Features
- `advanced_reports` - Custom Reports (Business+)
- `export_data` - Data Export (Business+)
- `scheduled_reports` - Scheduled Reports (Pro)

### Integration Features
- `api_access` - REST API Access (Pro)
- `whatsapp_integration` - WhatsApp Integration (Business+, 50% rollout)
- `email_notifications` - Email Notifications (Business+)

### Support Features
- `priority_support` - 24/7 Priority Support (Pro)
- `dedicated_account_manager` - Personal Account Manager (Pro)

## 🔄 Rollout Strategy

### Global Rollout (Default)
```typescript
{
  key: 'new_feature',
  enabled: true,
  rolloutPercentage: 100,  // All tenants
  plans: ['business', 'pro']
}
```

### Gradual Rollout
```typescript
{
  key: 'experimental_feature',
  enabled: true,
  rolloutPercentage: 25,  // 25% of tenants
  plans: ['pro']
}
// Uses hash-based distribution for consistency
```

### Beta Testing
```typescript
{
  key: 'beta_feature',
  enabled: true,
  rolloutPercentage: 10,  // 10% general rollout
  rolloutTenants: [
    'tenant-id-1',  // Explicit beta testers
    'tenant-id-2'   // Always get access regardless of percentage
  ],
  plans: ['business', 'pro']
}
```

### Tenant Override
```typescript
// Disable feature for specific tenant
await featureFlagsService.overrideFeature(
  'tenant-id-123',
  'whatsapp_integration',
  false,  // Disabled
  { reason: 'Requested by customer' }
);

// Enable with custom config
await featureFlagsService.overrideFeature(
  'tenant-id-456',
  'offline_pos',
  true,
  { maxDevices: 20 }  // Increased limit
);
```

## 🎨 Frontend Integration

### Get Tenant Features
```typescript
const response = await fetch('/api/v1/feature-flags/my-features', {
  headers: { Authorization: `Bearer ${token}` }
});
const { features } = await response.json();

// Check feature
if (features.includes('kds')) {
  // Show KDS menu item
}
```

### Check Specific Feature
```typescript
const response = await fetch('/api/v1/feature-flags/check/offline_pos', {
  headers: { Authorization: `Bearer ${token}` }
});
const result = await response.json();

if (result.enabled) {
  console.log('Config:', result.config);
} else {
  // Show upgrade prompt
  showUpgradeModal(result.reason);
}
```

## 🔒 Permissions Required

- `view_plan_features` - View features by plan
- `view_feature_flags` - List all feature flags
- `manage_feature_flags` - Create, update, delete flags
- `manage_tenant_features` - Override features per tenant

## 🚦 Feature Check Logic

```
1. Feature exists?
   ├─ No → Return disabled
   └─ Yes → Continue

2. Globally enabled?
   ├─ No → Return disabled
   └─ Yes → Continue

3. Plan has access?
   ├─ No → Return disabled (upgrade required)
   └─ Yes → Continue

4. Rollout percentage < 100?
   ├─ Yes → Is tenant in rolloutTenants OR hash in percentage?
   │         ├─ No → Return disabled (not in rollout)
   │         └─ Yes → Continue
   └─ No → Continue

5. Tenant override exists?
   ├─ Yes → Return override.enabled
   └─ No → Return enabled with config
```

## 📊 Caching

- **Feature flags**: Cached for 5 minutes
- **Tenant features**: Cached for 5 minutes
- **Feature checks**: Cached for 5 minutes
- **Cache invalidation**: Automatic on updates/overrides

## 🔍 Monitoring

Check feature usage:
```sql
SELECT 
  f.key,
  f.name,
  COUNT(te.id) as tenant_count
FROM feature_flags f
LEFT JOIN tenant_entitlements te ON te."featureKey" = f.key
WHERE f.enabled = true
GROUP BY f.id, f.key, f.name
ORDER BY tenant_count DESC;
```

## 🎯 Use Cases

### 1. Plan Enforcement
Features automatically restricted by plan. Upgrade prompts shown when accessing premium features.

### 2. Beta Testing
New features rolled out to select tenants for testing before general release.

### 3. Gradual Rollout
Reduce risk by releasing features to 10% → 25% → 50% → 100% of tenants.

### 4. Emergency Disable
Quickly disable problematic features globally without code deploy.

### 5. Tenant-Specific Customization
Increase limits or enable features for specific customers (e.g., enterprise clients).

## 📚 Related Documentation

- [TECHNICAL_BLUEPRINT.md](../TECHNICAL_BLUEPRINT.md) - Phase 0 requirements
- [AUDIT_DECORATORS_GUIDE.md](./AUDIT_DECORATORS_GUIDE.md) - Audit system guide
- Prisma Schema: `prisma/schema.prisma`
- Seed Script: `prisma/seeds/feature-flags.seed.ts`

---

✅ **Feature Flags Infrastructure Complete!**
