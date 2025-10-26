# 📴 OFFLINE POS ARCHITECTURE
## Service Worker + IndexedDB Strategy

> **Team:** Reyvan + Aegner  
> **Critical:** Retail & F&B businesses MUST work offline  
> **Tech Stack:** Service Worker, IndexedDB, Background Sync API

---

## 🎯 OBJECTIVES

1. **Zero downtime** - POS works even without internet
2. **Data integrity** - No lost transactions
3. **Seamless sync** - Auto-sync when online
4. **Conflict resolution** - Handle sync conflicts gracefully
5. **User experience** - Clear offline indicators

---

## 🏗️ ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────┐
│                   POS APPLICATION                        │
│                    (React App)                          │
└───────────────────┬─────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
    [ONLINE]               [OFFLINE]
        │                       │
        ↓                       ↓
┌───────────────┐       ┌──────────────────┐
│  API SERVER   │       │   IndexedDB      │
│  (NestJS)     │       │   (Local Store)  │
└───────────────┘       └──────────────────┘
        ↑                       │
        │                       │
        └───────────────────────┘
              Background Sync
          (When connection restored)
```

---

## 📦 INDEXEDDB SCHEMA

### **Database: `bermadani_pos_offline`**

```typescript
interface OfflineDatabase {
  version: 1;
  stores: {
    // Transaction queue (pending sync)
    transactions: {
      key: string; // local UUID
      value: OfflineTransaction;
      indexes: ['status', 'createdAt', 'syncAttempts'];
    };
    
    // Products (cached for offline use)
    products: {
      key: string; // product ID
      value: CachedProduct;
      indexes: ['sku', 'barcode', 'updatedAt'];
    };
    
    // Sync queue (generic)
    syncQueue: {
      key: string; // queue item ID
      value: SyncQueueItem;
      indexes: ['endpoint', 'status', 'nextRetry'];
    };
    
    // Configuration
    config: {
      key: string; // config key
      value: ConfigValue;
    };
    
    // Audit log (local)
    auditLog: {
      key: string; // log ID
      value: AuditEntry;
      indexes: ['timestamp', 'action'];
    };
  };
}
```

### **Transaction Schema:**

```typescript
interface OfflineTransaction {
  // Local identifiers
  localId: string;                    // UUID v4 (client-generated)
  idempotencyKey: string;             // UUID v4 (prevent duplicates)
  
  // Server identifiers (after sync)
  serverId: string | null;            // ID from server
  serverTransactionNumber: string | null;
  
  // Transaction data
  outletId: string;
  userId: string;
  shiftId: string | null;
  
  items: Array<{
    productId: string;
    productName: string;              // Snapshot
    productSku: string;
    quantity: number;
    unitPrice: number;                // in cents
    discount: number;
    tax: number;
    subtotal: number;
  }>;
  
  subtotal: number;                   // in cents
  discount: number;
  tax: number;
  total: number;
  
  paymentMethod: string;              // "cash", "qris", etc
  amountPaid: number | null;
  changeAmount: number | null;
  
  customerName: string | null;
  customerPhone: string | null;
  
  // Offline metadata
  status: 'pending_sync' | 'syncing' | 'synced' | 'sync_failed' | 'conflict';
  createdAt: Date;                    // Local timestamp
  syncedAt: Date | null;
  
  // Sync tracking
  syncAttempts: number;
  lastSyncAttempt: Date | null;
  nextRetryAt: Date | null;
  syncError: string | null;
  
  // Conflict data (if any)
  conflictData: any | null;
  
  // Receipt
  receiptPrinted: boolean;
  receiptData: string | null;         // Base64 or JSON
}
```

### **Product Cache:**

```typescript
interface CachedProduct {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  sellingPrice: number;               // in cents
  currentStock: number;
  images: string[];
  
  categoryId: string | null;
  categoryName: string | null;
  
  isTaxable: boolean;
  taxRate: number;
  
  // Cache metadata
  cachedAt: Date;
  expiresAt: Date;                    // Refresh after 24h
}
```

### **Sync Queue Item:**

```typescript
interface SyncQueueItem {
  id: string;
  
  // Request details
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  endpoint: string;                   // '/api/transactions'
  body: any;
  headers: Record<string, string>;
  
  // Retry logic
  status: 'pending' | 'retrying' | 'success' | 'failed' | 'abandoned';
  attempts: number;
  maxAttempts: number;                // Default: 5
  
  // Timing
  createdAt: Date;
  nextRetry: Date;
  lastAttempt: Date | null;
  completedAt: Date | null;
  
  // Error tracking
  lastError: string | null;
  
  // Priority
  priority: number;                   // Higher = more urgent
  
  // Idempotency
  idempotencyKey: string;
}
```

---

## 🔄 SYNC STRATEGY

### **1. Transaction Creation (Offline)**

```typescript
// services/offline-transaction.service.ts

async function createOfflineTransaction(
  transactionData: CreateTransactionDto
): Promise<OfflineTransaction> {
  // 1. Generate local IDs
  const localId = crypto.randomUUID();
  const idempotencyKey = crypto.randomUUID();
  
  // 2. Create offline transaction
  const transaction: OfflineTransaction = {
    localId,
    idempotencyKey,
    serverId: null,
    serverTransactionNumber: null,
    ...transactionData,
    status: 'pending_sync',
    createdAt: new Date(),
    syncedAt: null,
    syncAttempts: 0,
    lastSyncAttempt: null,
    nextRetryAt: new Date(), // Immediate retry
    syncError: null,
    conflictData: null,
    receiptPrinted: false,
    receiptData: null,
  };
  
  // 3. Save to IndexedDB
  await db.transactions.add(transaction);
  
  // 4. Add to sync queue
  await addToSyncQueue({
    method: 'POST',
    endpoint: '/api/transactions',
    body: transaction,
    idempotencyKey,
    priority: 10, // High priority
  });
  
  // 5. Update local stock (optimistic)
  await updateLocalStock(transaction.items);
  
  // 6. Trigger background sync (if online)
  if (navigator.onLine) {
    await triggerBackgroundSync();
  }
  
  return transaction;
}
```

### **2. Background Sync (When Online)**

```typescript
// service-worker.ts

self.addEventListener('sync', async (event: SyncEvent) => {
  if (event.tag === 'sync-transactions') {
    event.waitUntil(syncPendingTransactions());
  }
});

async function syncPendingTransactions() {
  const db = await openDB('bermadani_pos_offline');
  
  // Get all pending transactions
  const pending = await db
    .transaction('transactions')
    .objectStore('transactions')
    .index('status')
    .getAll('pending_sync');
  
  console.log(`[Sync] Found ${pending.length} pending transactions`);
  
  for (const txn of pending) {
    try {
      // Update status
      txn.status = 'syncing';
      txn.syncAttempts++;
      txn.lastSyncAttempt = new Date();
      await db.transaction('transactions', 'readwrite')
        .objectStore('transactions')
        .put(txn);
      
      // Send to server
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': txn.idempotencyKey,
          'Authorization': `Bearer ${await getAuthToken()}`,
        },
        body: JSON.stringify({
          ...txn,
          isOfflineSync: true,
        }),
      });
      
      if (response.ok) {
        const serverData = await response.json();
        
        // Update with server data
        txn.status = 'synced';
        txn.serverId = serverData.id;
        txn.serverTransactionNumber = serverData.transactionNumber;
        txn.syncedAt = new Date();
        txn.syncError = null;
        
        await db.transaction('transactions', 'readwrite')
          .objectStore('transactions')
          .put(txn);
        
        console.log(`[Sync] ✅ Transaction ${txn.localId} synced successfully`);
        
      } else if (response.status === 409) {
        // Conflict detected
        const conflictData = await response.json();
        await handleConflict(txn, conflictData);
        
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
    } catch (error) {
      console.error(`[Sync] ❌ Failed to sync ${txn.localId}:`, error);
      
      // Update error state
      txn.status = 'sync_failed';
      txn.syncError = error.message;
      txn.nextRetryAt = calculateNextRetry(txn.syncAttempts);
      
      await db.transaction('transactions', 'readwrite')
        .objectStore('transactions')
        .put(txn);
      
      // Abandon after max attempts
      if (txn.syncAttempts >= 5) {
        console.error(`[Sync] 🚨 Transaction ${txn.localId} abandoned after 5 attempts`);
        await notifyUser('Transaction sync failed. Please contact support.');
      }
    }
  }
}
```

### **3. Retry Logic**

```typescript
function calculateNextRetry(attempts: number): Date {
  // Exponential backoff: 1s, 2s, 4s, 8s, 16s
  const delayMs = Math.min(1000 * Math.pow(2, attempts), 60000); // Max 1 minute
  return new Date(Date.now() + delayMs);
}

// Periodic retry check (every 30 seconds)
setInterval(async () => {
  const db = await openDB('bermadani_pos_offline');
  const now = new Date();
  
  const readyForRetry = await db
    .transaction('transactions')
    .objectStore('transactions')
    .index('status')
    .getAll('sync_failed')
    .then(txns => txns.filter(t => t.nextRetryAt <= now));
  
  if (readyForRetry.length > 0 && navigator.onLine) {
    console.log(`[Retry] Retrying ${readyForRetry.length} transactions`);
    await triggerBackgroundSync();
  }
}, 30000);
```

---

## ⚔️ CONFLICT RESOLUTION

### **Conflict Types:**

1. **Duplicate Detection** - Same idempotency key
2. **Stock Mismatch** - Server stock differs from local
3. **Price Change** - Product price changed since offline
4. **Deleted Product** - Product deleted from server

### **Resolution Strategy:**

```typescript
async function handleConflict(
  localTxn: OfflineTransaction,
  conflictData: ConflictResponse
) {
  console.warn(`[Conflict] Transaction ${localTxn.localId}:`, conflictData);
  
  switch (conflictData.type) {
    case 'duplicate':
      // Server already has this transaction (idempotency worked!)
      localTxn.status = 'synced';
      localTxn.serverId = conflictData.existingId;
      localTxn.serverTransactionNumber = conflictData.existingNumber;
      localTxn.syncedAt = new Date();
      break;
      
    case 'stock_mismatch':
      // Stock insufficient on server
      // Option 1: Accept partial (if allowed)
      // Option 2: Mark for manual review
      localTxn.status = 'conflict';
      localTxn.conflictData = conflictData;
      await notifyUser('Stock mismatch detected. Manual review required.');
      break;
      
    case 'price_change':
      // Price changed since offline
      // Option: Auto-update to new price and resync
      for (const item of localTxn.items) {
        const newPrice = conflictData.newPrices[item.productId];
        if (newPrice) {
          item.unitPrice = newPrice;
          item.subtotal = item.quantity * newPrice;
        }
      }
      // Recalculate total
      localTxn.subtotal = localTxn.items.reduce((sum, i) => sum + i.subtotal, 0);
      localTxn.total = localTxn.subtotal - localTxn.discount + localTxn.tax;
      localTxn.status = 'pending_sync'; // Retry with new prices
      break;
      
    case 'product_deleted':
      // Product no longer exists
      localTxn.status = 'conflict';
      localTxn.conflictData = conflictData;
      await notifyUser('Some products no longer exist. Manual review required.');
      break;
      
    default:
      localTxn.status = 'sync_failed';
      localTxn.syncError = 'Unknown conflict type';
  }
  
  await db.transactions.put(localTxn);
}
```

---

## 🔐 IDEMPOTENCY ENFORCEMENT

### **Server-Side Check:**

```typescript
// backend: transactions.controller.ts

@Post()
async create(
  @Body() dto: CreateTransactionDto,
  @Headers('x-idempotency-key') idempotencyKey: string,
) {
  if (!idempotencyKey) {
    throw new BadRequestException('Idempotency key required');
  }
  
  // Check if transaction with this key already exists
  const existing = await this.prisma.transaction.findUnique({
    where: { idempotencyKey },
  });
  
  if (existing) {
    console.log(`[Idempotency] Duplicate request detected: ${idempotencyKey}`);
    
    // Return existing transaction (HTTP 200, not 201)
    return {
      id: existing.id,
      transactionNumber: existing.transactionNumber,
      isDuplicate: true,
    };
  }
  
  // Create new transaction
  const transaction = await this.transactionService.create({
    ...dto,
    idempotencyKey,
  });
  
  return transaction;
}
```

---

## 💾 PRODUCT CACHE STRATEGY

### **Initial Sync (When Going Offline):**

```typescript
async function cacheProductsForOffline(outletId: string) {
  console.log('[Cache] Downloading products for offline use...');
  
  const response = await fetch(`/api/outlets/${outletId}/products`);
  const products = await response.json();
  
  const db = await openDB('bermadani_pos_offline');
  const tx = db.transaction('products', 'readwrite');
  const store = tx.objectStore('products');
  
  for (const product of products) {
    await store.put({
      ...product,
      cachedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });
  }
  
  await tx.done;
  console.log(`[Cache] ✅ Cached ${products.length} products`);
}

// Trigger on app load
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then(() => {
    cacheProductsForOffline(currentOutlet.id);
  });
}
```

### **Product Search (Offline):**

```typescript
async function searchProducts(query: string): Promise<CachedProduct[]> {
  const db = await openDB('bermadani_pos_offline');
  
  // Search by name, SKU, or barcode
  const all = await db.products.getAll();
  const now = new Date();
  
  const results = all.filter(p => {
    // Skip expired cache
    if (p.expiresAt < now) return false;
    
    const q = query.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.includes(q))
    );
  });
  
  return results;
}
```

### **Stock Update (Optimistic):**

```typescript
async function updateLocalStock(items: TransactionItem[]) {
  const db = await openDB('bermadani_pos_offline');
  
  for (const item of items) {
    const product = await db.products.get(item.productId);
    
    if (product) {
      product.currentStock -= item.quantity;
      
      if (product.currentStock < 0) {
        console.warn(`[Stock] Negative stock for ${product.name}: ${product.currentStock}`);
      }
      
      await db.products.put(product);
    }
  }
}
```

---

## 📱 USER INTERFACE

### **Offline Indicator:**

```tsx
// components/offline-indicator.tsx
import { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSync, setPendingSync] = useState(0);
  
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Check pending transactions
    const checkPending = async () => {
      const db = await openDB('bermadani_pos_offline');
      const pending = await db.transactions
        .index('status')
        .getAllKeys('pending_sync');
      setPendingSync(pending.length);
    };
    
    checkPending();
    const interval = setInterval(checkPending, 5000);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);
  
  if (isOnline && pendingSync === 0) {
    return null; // Don't show anything when online & synced
  }
  
  return (
    <div className={`
      fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2
      ${isOnline ? 'bg-yellow-500 text-white' : 'bg-red-500 text-white'}
    `}>
      {isOnline ? (
        <>
          <Wifi className="h-4 w-4" />
          <span>Syncing {pendingSync} transactions...</span>
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4" />
          <span>Offline Mode - {pendingSync} pending</span>
        </>
      )}
    </div>
  );
}
```

### **Sync Status List:**

```tsx
// components/sync-status.tsx
import { useQuery } from '@tanstack/react-query';
import { CheckCircle, Clock, XCircle, AlertTriangle } from 'lucide-react';

export function SyncStatus() {
  const { data: transactions = [] } = useQuery({
    queryKey: ['offline-transactions'],
    queryFn: async () => {
      const db = await openDB('bermadani_pos_offline');
      return db.transactions.getAll();
    },
    refetchInterval: 5000,
  });
  
  const statusIcon = (status: string) => {
    switch (status) {
      case 'synced':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending_sync':
      case 'syncing':
        return <Clock className="h-4 w-4 text-yellow-500 animate-spin" />;
      case 'sync_failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'conflict':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    }
  };
  
  return (
    <div className="space-y-2">
      {transactions.map(txn => (
        <div key={txn.localId} className="flex items-center justify-between p-2 border rounded">
          <div className="flex items-center gap-2">
            {statusIcon(txn.status)}
            <div>
              <div className="font-medium">
                {txn.serverTransactionNumber || txn.localId.slice(0, 8)}
              </div>
              <div className="text-sm text-muted-foreground">
                {new Date(txn.createdAt).toLocaleString()}
              </div>
            </div>
          </div>
          
          <div className="text-right">
            <div className="font-medium">
              Rp {(txn.total / 100).toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">
              {txn.status === 'sync_failed' && `Retry ${txn.syncAttempts}/5`}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## 🧪 TESTING STRATEGY

### **Offline Simulation:**

```typescript
// test/offline-simulation.test.ts

describe('Offline POS', () => {
  beforeEach(async () => {
    // Simulate offline
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    });
    
    // Clear IndexedDB
    await deleteDB('bermadani_pos_offline');
  });
  
  it('should create transaction offline', async () => {
    const txn = await createOfflineTransaction({
      items: [
        { productId: '1', quantity: 2, unitPrice: 10000 }
      ],
      total: 20000,
    });
    
    expect(txn.status).toBe('pending_sync');
    expect(txn.localId).toBeDefined();
    expect(txn.idempotencyKey).toBeDefined();
  });
  
  it('should sync when online', async () => {
    // Create offline
    const txn = await createOfflineTransaction({...});
    
    // Go online
    Object.defineProperty(navigator, 'onLine', { value: true });
    
    // Trigger sync
    await syncPendingTransactions();
    
    const updated = await db.transactions.get(txn.localId);
    expect(updated.status).toBe('synced');
    expect(updated.serverId).toBeDefined();
  });
  
  it('should handle duplicate detection', async () => {
    // Create transaction
    const txn = await createOfflineTransaction({...});
    
    // Sync twice (simulate retry)
    await syncPendingTransactions();
    await syncPendingTransactions();
    
    // Should only create one transaction on server
    const count = await fetch('/api/transactions/count').then(r => r.json());
    expect(count).toBe(1);
  });
});
```

---

## 🎉 OFFLINE POS ARCHITECTURE COMPLETE!

**Deliverables:**
- ✅ IndexedDB schema designed
- ✅ Sync strategy defined
- ✅ Conflict resolution strategy
- ✅ Idempotency enforcement
- ✅ Product caching strategy
- ✅ UI components (indicators, sync status)
- ✅ Testing strategy

**Ready untuk last doc (Frontend Multi-tenancy)?** 🚀
