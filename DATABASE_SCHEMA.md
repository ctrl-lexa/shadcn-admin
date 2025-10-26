# 🗄️ DATABASE SCHEMA (ERD) - Multi-tenant Multi-industry SaaS
## NestJS + PostgreSQL + Prisma + RLS

> **Team:** Reyvan + Aegner (2 developers)  
> **Stack:** TypeScript, NestJS (Modular Monolith), Prisma, PostgreSQL  
> **Focus MVP:** Koperasi + Minimarket (Retail)  
> **Architecture:** Single Database + RLS (Row Level Security)

---

## 🏗️ ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────┐
│           NestJS MODULAR MONOLITH                        │
├─────────────────────────────────────────────────────────┤
│  src/modules/                                           │
│    ├─ auth/          → Authentication & JWT            │
│    ├─ tenancy/       → Multi-tenant management         │
│    ├─ rbac/          → Role-Based Access Control       │
│    ├─ billing/       → Subscription & payments         │
│    ├─ pos/           → Point of Sale (Retail)          │
│    ├─ inventory/     → Stock management                │
│    ├─ supplier/      → Supplier portal & procurement   │
│    ├─ koperasi/      → Loan & savings (KSP)           │
│    ├─ members/       → Koperasi members               │
│    ├─ accounting/    → General ledger & reports       │
│    ├─ reports/       → Analytics & dashboards         │
│    └─ audit/         → Audit trail & logging          │
└─────────────────────────────────────────────────────────┘
                          ↓
              PostgreSQL 16 + RLS
              Single DB + tenant_id isolation
```

---

## 📊 COMPLETE ERD (Entity Relationship Diagram)

### **CORE MODULES**

#### 1️⃣ **PLATFORM & TENANCY**

```prisma
// ============================================
// PLATFORM & MULTI-TENANCY
// ============================================

model Platform {
  id          String   @id @default(uuid())
  name        String   // "BermaDani POS"
  domain      String   @unique // "bermadani.app"
  settings    Json?    // Platform-wide settings
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenants     Tenant[]
  plans       Plan[]
}

model Tenant {
  id                String   @id @default(uuid())
  platformId        String
  
  // Business info
  businessName      String
  businessType      BusinessType // RETAIL, FNB, KOPERASI, BEAUTY, etc
  registrationNo    String?  // NIB, SIUP
  taxId             String?  // NPWP
  
  // Contact
  ownerName         String
  email             String   @unique
  phone             String
  address           String?
  city              String?
  province          String?
  postalCode        String?
  
  // Subscription
  status            TenantStatus @default(TRIAL) // TRIAL, ACTIVE, SUSPENDED, CANCELED
  trialEndsAt       DateTime?
  currentPlanId     String?
  
  // Settings
  settings          Json?    // Tenant-specific settings
  timezone          String   @default("Asia/Jakarta")
  currency          String   @default("IDR")
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  platform          Platform @relation(fields: [platformId], references: [id])
  currentPlan       Plan?    @relation(fields: [currentPlanId], references: [id])
  
  outlets           Outlet[]
  users             User[]
  subscriptions     Subscription[]
  usageMetrics      UsageMetric[]
  auditLogs         AuditLog[]
  
  @@index([platformId])
  @@index([status])
  @@index([email])
}

enum BusinessType {
  RETAIL          // Minimarket, fashion, etc
  FNB             // F&B (restaurant, cafe)
  KOPERASI        // Koperasi Simpan Pinjam
  BEAUTY          // Salon, spa
  SERVICE         // Car wash, laundry
  EDUCATION       // Course, bimbel
  HOSPITALITY     // Hotel, kost
  AUTOMOTIVE      // Dealer, bengkel
  AGRICULTURE     // Farm, agro
  HEALTHCARE      // Pharmacy, clinic
}

enum TenantStatus {
  TRIAL
  ACTIVE
  SUSPENDED
  CANCELED
  CHURNED
}

model Outlet {
  id              String   @id @default(uuid())
  tenantId        String
  
  name            String
  code            String   // Unique code per tenant
  address         String
  city            String?
  phone           String?
  
  type            OutletType @default(STORE) // STORE, WAREHOUSE, BRANCH
  isActive        Boolean  @default(true)
  
  settings        Json?    // Outlet-specific settings (printer, POS config)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  userOutlets     UserOutlet[]
  products        Product[]
  transactions    Transaction[]
  stockMovements  StockMovement[]
  shifts          Shift[]
  
  @@unique([tenantId, code])
  @@index([tenantId])
  @@index([isActive])
}

enum OutletType {
  STORE       // Toko fisik
  WAREHOUSE   // Gudang
  BRANCH      // Cabang
  KIOSK       // Stand/gerai kecil
}
```

---

#### 2️⃣ **SUBSCRIPTION & BILLING**

```prisma
// ============================================
// SUBSCRIPTION & BILLING
// ============================================

model Plan {
  id                  String   @id @default(uuid())
  platformId          String
  
  name                String   // "Starter", "Business", "Pro", "Enterprise"
  slug                String   @unique
  description         String?
  
  // Pricing
  pricePerOutlet      Int      // in cents (IDR)
  maxOutlets          Int?     // null = unlimited
  maxUsers            Int?     // null = unlimited
  maxTransactions     Int?     // per month, null = unlimited
  
  // Features (JSON for flexibility)
  features            Json     // {offline_pos: true, kds: false, supplier_portal: true, ...}
  
  // Industry-specific modules
  modules             String[] // ["pos", "inventory", "koperasi", "accounting"]
  
  isActive            Boolean  @default(true)
  isPublic            Boolean  @default(true)
  
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  
  platform            Platform @relation(fields: [platformId], references: [id])
  
  subscriptions       Subscription[]
  tenants             Tenant[]
  
  @@index([platformId])
  @@index([slug])
  @@index([isActive, isPublic])
}

model Subscription {
  id                    String   @id @default(uuid())
  tenantId              String
  planId                String
  
  status                SubscriptionStatus @default(ACTIVE)
  
  // Billing period
  startedAt             DateTime @default(now())
  currentPeriodStart    DateTime
  currentPeriodEnd      DateTime
  nextBillingAt         DateTime?
  
  // Cancellation
  canceledAt            DateTime?
  cancelReason          String?
  
  // Add-ons
  addons                SubscriptionAddon[]
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  
  tenant                Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  plan                  Plan     @relation(fields: [planId], references: [id])
  
  invoices              Invoice[]
  
  @@index([tenantId])
  @@index([status])
}

enum SubscriptionStatus {
  TRIAL
  ACTIVE
  PAST_DUE
  SUSPENDED
  CANCELED
}

model SubscriptionAddon {
  id                String   @id @default(uuid())
  subscriptionId    String
  
  name              String   // "Koperasi Pack", "WhatsApp BA", "KDS"
  slug              String
  price             Int      // in cents
  
  status            AddonStatus @default(ACTIVE)
  
  activatedAt       DateTime @default(now())
  deactivatedAt     DateTime?
  
  subscription      Subscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)
  
  @@index([subscriptionId])
}

enum AddonStatus {
  ACTIVE
  SUSPENDED
  CANCELED
}

model Invoice {
  id                String   @id @default(uuid())
  subscriptionId    String
  tenantId          String
  
  invoiceNumber     String   @unique // INV-2025-001
  
  // Amounts (in cents)
  subtotal          Int
  tax               Int      @default(0)
  total             Int
  
  // Items
  items             Json     // [{description: "Pro Plan", amount: 599000}, ...]
  
  // Payment
  status            InvoiceStatus @default(PENDING)
  dueDate           DateTime
  paidAt            DateTime?
  paymentMethod     String?  // "midtrans", "xendit", "manual"
  paymentProof      String?  // URL to proof of payment
  
  // Period
  periodStart       DateTime
  periodEnd         DateTime
  
  notes             String?
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  subscription      Subscription @relation(fields: [subscriptionId], references: [id])
  
  @@index([tenantId])
  @@index([status])
  @@index([dueDate])
}

enum InvoiceStatus {
  PENDING
  PAID
  OVERDUE
  CANCELED
  REFUNDED
}

model UsageMetric {
  id                String   @id @default(uuid())
  tenantId          String
  
  metricType        MetricType
  currentValue      Int      // Current usage count
  limitValue        Int?     // Plan limit (null = unlimited)
  
  periodStart       DateTime
  periodEnd         DateTime
  
  tenant            Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  @@unique([tenantId, metricType, periodStart])
  @@index([tenantId])
}

enum MetricType {
  OUTLETS
  USERS
  TRANSACTIONS
  PRODUCTS
  API_CALLS
}
```

---

#### 3️⃣ **USERS & RBAC (Role-Based Access Control)**

```prisma
// ============================================
// USERS & RBAC
// ============================================

model User {
  id              String   @id @default(uuid())
  tenantId        String?  // null for platform admins
  
  // Personal info
  firstName       String
  lastName        String
  email           String   @unique
  phone           String?
  avatar          String?
  
  // Auth
  password        String   // hashed
  isEmailVerified Boolean  @default(false)
  
  // Status
  status          UserStatus @default(ACTIVE)
  
  // Security
  twoFactorSecret String?
  twoFactorEnabled Boolean @default(false)
  lastLoginAt     DateTime?
  lastLoginIp     String?
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  tenant          Tenant?  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  userRoles       UserRole[]
  userOutlets     UserOutlet[]
  shifts          Shift[]
  transactions    Transaction[]
  auditLogs       AuditLog[]
  
  @@index([tenantId])
  @@index([email])
  @@index([status])
}

enum UserStatus {
  ACTIVE
  INACTIVE
  INVITED
  SUSPENDED
}

model Role {
  id              String   @id @default(uuid())
  tenantId        String?  // null for platform roles
  
  name            String
  slug            String
  description     String?
  
  level           RoleLevel
  
  isSystem        Boolean  @default(false) // System roles can't be deleted
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  rolePermissions RolePermission[]
  userRoles       UserRole[]
  
  @@unique([tenantId, slug])
  @@index([tenantId])
  @@index([level])
}

enum RoleLevel {
  PLATFORM        // Superadmin, Developer (your team)
  TENANT          // Owner, Admin, Manager
  OUTLET          // Staff, Cashier
  EXTERNAL        // Supplier, Member
}

model Permission {
  id              String   @id @default(uuid())
  
  resource        String   // "pos", "inventory", "koperasi", "reports"
  action          String   // "create", "read", "update", "delete", "approve", "export"
  scope           String   // "own_outlet", "all_outlets", "platform_wide"
  
  description     String?
  
  rolePermissions RolePermission[]
  
  @@unique([resource, action, scope])
  @@index([resource])
}

model RolePermission {
  roleId          String
  permissionId    String
  
  role            Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission      Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)
  
  @@id([roleId, permissionId])
}

model UserRole {
  userId          String
  roleId          String
  outletId        String?  // Role scope: specific outlet or all outlets (null)
  
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  role            Role     @relation(fields: [roleId], references: [id], onDelete: Cascade)
  outlet          Outlet?  @relation(fields: [outletId], references: [id], onDelete: Cascade)
  
  @@id([userId, roleId, outletId])
  @@index([userId])
  @@index([roleId])
}

model UserOutlet {
  userId          String
  outletId        String
  
  isDefault       Boolean  @default(false) // Default outlet for user
  
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  outlet          Outlet   @relation(fields: [outletId], references: [id], onDelete: Cascade)
  
  @@id([userId, outletId])
}
```

---

#### 4️⃣ **POS & RETAIL (Minimarket)**

```prisma
// ============================================
// POS & RETAIL MODULE
// ============================================

model Category {
  id              String   @id @default(uuid())
  tenantId        String
  
  name            String
  slug            String
  description     String?
  parentId        String?  // For sub-categories
  
  imageUrl        String?
  sortOrder       Int      @default(0)
  isActive        Boolean  @default(true)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  parent          Category?  @relation("CategoryHierarchy", fields: [parentId], references: [id])
  children        Category[] @relation("CategoryHierarchy")
  
  products        Product[]
  
  @@unique([tenantId, slug])
  @@index([tenantId])
  @@index([parentId])
}

model Product {
  id              String   @id @default(uuid())
  tenantId        String
  outletId        String?  // null = available in all outlets
  categoryId      String?
  
  // Basic info
  name            String
  slug            String
  sku             String   @unique
  barcode         String?  @unique
  
  description     String?
  images          String[] // Array of image URLs
  
  // Pricing
  costPrice       Int      // in cents (for margin calculation)
  sellingPrice    Int      // in cents
  
  // Inventory
  trackInventory  Boolean  @default(true)
  currentStock    Int      @default(0)
  minStock        Int      @default(0)  // Alert threshold
  maxStock        Int?
  unit            String   @default("pcs") // "pcs", "kg", "liter", etc
  
  // Product type
  type            ProductType @default(SIMPLE)
  
  // Variants (for type = VARIANT)
  parentProductId String?
  variantOptions  Json?    // {size: "L", color: "Red"}
  
  // Tax
  isTaxable       Boolean  @default(true)
  taxRate         Int      @default(11) // PPN 11%
  
  // Status
  isActive        Boolean  @default(true)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  outlet          Outlet?    @relation(fields: [outletId], references: [id])
  category        Category?  @relation(fields: [categoryId], references: [id])
  
  parentProduct   Product?   @relation("ProductVariants", fields: [parentProductId], references: [id])
  variants        Product[]  @relation("ProductVariants")
  
  transactionItems TransactionItem[]
  stockMovements   StockMovement[]
  supplierProducts SupplierProduct[]
  
  @@index([tenantId])
  @@index([outletId])
  @@index([categoryId])
  @@index([sku])
  @@index([barcode])
}

enum ProductType {
  SIMPLE          // Regular product
  VARIANT         // Product with variants (size, color)
  SERVICE         // Service item
  BUNDLE          // Package/combo
}

model Transaction {
  id                String   @id @default(uuid())
  tenantId          String
  outletId          String
  userId            String   // Cashier
  shiftId           String?
  
  // Transaction info
  transactionNumber String   @unique // TRX-2025-0001
  type              TransactionType @default(SALE)
  
  // Amounts (in cents)
  subtotal          Int
  discount          Int      @default(0)
  discountType      String?  // "percentage" or "fixed"
  tax               Int      @default(0)
  total             Int
  
  // Payment
  paymentMethod     String   // "cash", "qris", "debit", "credit", "ewallet"
  paymentStatus     PaymentStatus @default(COMPLETED)
  
  amountPaid        Int?
  changeAmount      Int?
  
  // Customer (optional)
  customerName      String?
  customerPhone     String?
  customerId        String?  // If registered member
  
  // Offline sync
  isOffline         Boolean  @default(false)
  idempotencyKey    String   @unique // Prevent duplicate from offline sync
  syncStatus        SyncStatus @default(SYNCED)
  syncedAt          DateTime?
  
  // Receipt
  receiptPrinted    Boolean  @default(false)
  
  notes             String?
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  outlet            Outlet   @relation(fields: [outletId], references: [id])
  user              User     @relation(fields: [userId], references: [id])
  shift             Shift?   @relation(fields: [shiftId], references: [id])
  
  items             TransactionItem[]
  refunds           Refund[]
  
  @@index([tenantId])
  @@index([outletId])
  @@index([userId])
  @@index([transactionNumber])
  @@index([createdAt])
  @@index([syncStatus])
}

enum TransactionType {
  SALE
  RETURN
  VOID
}

enum PaymentStatus {
  PENDING
  COMPLETED
  FAILED
  REFUNDED
}

enum SyncStatus {
  SYNCED
  PENDING_SYNC
  SYNC_FAILED
  CONFLICT
}

model TransactionItem {
  id              String   @id @default(uuid())
  transactionId   String
  productId       String
  
  productName     String   // Snapshot at time of sale
  productSku      String
  
  quantity        Int
  unitPrice       Int      // in cents
  discount        Int      @default(0)
  tax             Int      @default(0)
  subtotal        Int
  
  transaction     Transaction @relation(fields: [transactionId], references: [id], onDelete: Cascade)
  product         Product     @relation(fields: [productId], references: [id])
  
  @@index([transactionId])
  @@index([productId])
}

model Refund {
  id              String   @id @default(uuid())
  tenantId        String
  transactionId   String
  userId          String   // Who processed refund
  
  refundNumber    String   @unique // REF-2025-0001
  
  amount          Int      // in cents
  reason          String
  notes           String?
  
  status          RefundStatus @default(PENDING)
  approvedBy      String?  // User ID who approved
  approvedAt      DateTime?
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  transaction     Transaction @relation(fields: [transactionId], references: [id])
  
  @@index([tenantId])
  @@index([transactionId])
}

enum RefundStatus {
  PENDING
  APPROVED
  REJECTED
  COMPLETED
}

model Shift {
  id              String   @id @default(uuid())
  tenantId        String
  outletId        String
  userId          String   // Cashier
  
  shiftNumber     String   // SHIFT-2025-0001
  
  // Cash management
  openingCash     Int      // in cents
  closingCash     Int?
  expectedCash    Int?
  cashDifference  Int?     // Selisih
  
  // Timestamps
  openedAt        DateTime @default(now())
  closedAt        DateTime?
  
  status          ShiftStatus @default(OPEN)
  
  notes           String?
  
  outlet          Outlet   @relation(fields: [outletId], references: [id])
  user            User     @relation(fields: [userId], references: [id])
  
  transactions    Transaction[]
  
  @@index([tenantId])
  @@index([outletId])
  @@index([userId])
  @@index([status])
}

enum ShiftStatus {
  OPEN
  CLOSED
}
```

---

**TO BE CONTINUED...**

Next sections to generate:
- 5️⃣ Inventory & Stock Management
- 6️⃣ Supplier & Procurement
- 7️⃣ Koperasi (Loan & Savings)
- 8️⃣ Members (Koperasi)
- 9️⃣ Accounting & Finance
- 🔟 Audit Trail & System

**Should I continue generating the complete ERD?** This is getting long - I can:
1. Continue in this file (complete schema)
2. Split into multiple files per module
3. Generate Prisma schema file directly

**Which approach do you prefer?** 🤔
