# 🎨 FRONTEND MULTI-TENANCY RESTRUCTURE
## Maksimalkan Template UI untuk Multi-tenant SaaS

> **Team:** Reyvan + Aegner  
> **Base Template:** Shadcn Admin (React 19, TypeScript, TanStack Router, Shadcn UI)  
> **Goal:** Restructure frontend untuk multi-tenant, outlet switching, role-based UI

---

## 🎯 OBJECTIVES

1. **Multi-tenant Context** - Tenant & outlet switching
2. **Role-based UI** - Hide/show based on permissions
3. **Reuse ALL existing UI** - Table, Chart, Button, Toast, Dialog, Badge, dll
4. **Modular structure** - Easy add new modules (F&B, Retail, Koperasi, dll)
5. **Maintain template quality** - Keep the clean design & UX

---

## 📦 EXISTING UI COMPONENTS (LEVERAGE EVERYTHING!)

### **✅ Available Components:**

```
components/ui/
├── alert-dialog.tsx       ✅ Konfirmasi actions
├── alert.tsx              ✅ Notifications
├── avatar.tsx             ✅ User/team avatars
├── badge.tsx              ✅ Status indicators
├── button.tsx             ✅ All actions
├── calendar.tsx           ✅ Date selection
├── card.tsx               ✅ Content containers
├── checkbox.tsx           ✅ Multi-select
├── collapsible.tsx        ✅ Expandable sections
├── command.tsx            ✅ Command palette (⌘K)
├── dialog.tsx             ✅ Modals
├── dropdown-menu.tsx      ✅ Context menus
├── form.tsx               ✅ Form validation
├── input-otp.tsx          ✅ OTP verification
├── input.tsx              ✅ Text inputs
├── label.tsx              ✅ Form labels
├── popover.tsx            ✅ Tooltips/popovers
├── radio-group.tsx        ✅ Single select
├── scroll-area.tsx        ✅ Scrollable content
├── select.tsx             ✅ Dropdowns
├── separator.tsx          ✅ Dividers
├── sheet.tsx              ✅ Slide-in panels
├── sidebar.tsx            ✅ Navigation (PERFECT!)
├── skeleton.tsx           ✅ Loading states
├── sonner.tsx             ✅ Toast notifications
├── switch.tsx             ✅ Toggle on/off
├── table.tsx              ✅ Data tables (CRITICAL!)
├── tabs.tsx               ✅ Tab navigation
├── textarea.tsx           ✅ Multi-line input
└── tooltip.tsx            ✅ Hover tips

components/
├── data-table/            ✅ Advanced table features
│   ├── bulk-actions.tsx   ✅ Multi-row actions
│   ├── column-header.tsx  ✅ Sortable columns
│   ├── faceted-filter.tsx ✅ Multi-filter
│   ├── pagination.tsx     ✅ Page navigation
│   ├── toolbar.tsx        ✅ Search & filters
│   └── view-options.tsx   ✅ Column visibility
├── coming-soon.tsx        ✅ Placeholder pages
├── command-menu.tsx       ✅ Global search (⌘K)
├── config-drawer.tsx      ✅ Settings panel
├── confirm-dialog.tsx     ✅ Confirmation modal
├── date-picker.tsx        ✅ Date selection
├── learn-more.tsx         ✅ Info links
├── long-text.tsx          ✅ Text truncation
├── navigation-progress.tsx ✅ Loading bar
├── password-input.tsx     ✅ Password field
├── profile-dropdown.tsx   ✅ User menu
├── search.tsx             ✅ Search input
├── select-dropdown.tsx    ✅ Custom dropdown
├── sign-out-dialog.tsx    ✅ Logout confirm
├── skip-to-main.tsx       ✅ Accessibility
└── theme-switch.tsx       ✅ Dark/light mode
```

**🔥 SEMUA INI KITA PAKE! NO WASTE!**

---

## 🏗️ NEW CONTEXT PROVIDERS

### **1. Tenant Context Provider**

```tsx
// src/context/tenant-provider.tsx
import { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'sonner';

type Tenant = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  plan: 'starter' | 'business' | 'pro' | 'enterprise';
  planExpiry: Date | null;
  status: 'active' | 'suspended' | 'expired';
};

type Outlet = {
  id: string;
  name: string;
  code: string;
  type: 'retail' | 'fnb' | 'salon' | 'workshop' | 'clinic' | 'other';
  address: string;
  phone: string;
  isActive: boolean;
};

type TenantContextType = {
  // Tenant
  tenant: Tenant | null;
  tenants: Tenant[];
  switchTenant: (tenantId: string) => Promise<void>;
  
  // Outlet
  currentOutlet: Outlet | null;
  outlets: Outlet[];
  switchOutlet: (outletId: string) => Promise<void>;
  
  // Loading
  isLoading: boolean;
  
  // Permissions (from RBAC)
  permissions: string[];
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  
  // Feature flags
  hasFeature: (feature: string) => boolean;
  checkUsageLimit: (resource: string) => { current: number; limit: number; exceeded: boolean };
};

const TenantContext = createContext<TenantContextType | null>(null);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [currentOutlet, setCurrentOutlet] = useState<Outlet | null>(null);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Load tenant & outlets on mount
  useEffect(() => {
    loadTenantData();
  }, []);
  
  async function loadTenantData() {
    try {
      setIsLoading(true);
      
      // Load current user's tenant data
      const response = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${getAuthToken()}` }
      });
      const data = await response.json();
      
      setTenant(data.tenant);
      setTenants(data.tenants); // If user belongs to multiple tenants
      setCurrentOutlet(data.currentOutlet);
      setOutlets(data.outlets);
      setPermissions(data.permissions);
      
      // Store in localStorage for quick access
      localStorage.setItem('current_tenant', data.tenant.id);
      localStorage.setItem('current_outlet', data.currentOutlet.id);
      
    } catch (error) {
      console.error('Failed to load tenant data:', error);
      toast.error('Failed to load workspace');
    } finally {
      setIsLoading(false);
    }
  }
  
  async function switchTenant(tenantId: string) {
    try {
      const response = await fetch('/api/tenants/switch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({ tenantId }),
      });
      
      if (response.ok) {
        await loadTenantData();
        toast.success('Workspace switched successfully');
        
        // Refresh page to reload all data
        window.location.reload();
      } else {
        throw new Error('Failed to switch workspace');
      }
    } catch (error) {
      console.error('Switch tenant error:', error);
      toast.error('Failed to switch workspace');
    }
  }
  
  async function switchOutlet(outletId: string) {
    try {
      const response = await fetch('/api/outlets/switch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({ outletId }),
      });
      
      if (response.ok) {
        const newOutlet = outlets.find(o => o.id === outletId);
        setCurrentOutlet(newOutlet!);
        localStorage.setItem('current_outlet', outletId);
        
        toast.success(`Switched to ${newOutlet?.name}`);
        
        // Refresh current page data
        window.location.reload();
      }
    } catch (error) {
      console.error('Switch outlet error:', error);
      toast.error('Failed to switch outlet');
    }
  }
  
  function hasPermission(permission: string): boolean {
    return permissions.includes(permission);
  }
  
  function hasAnyPermission(requiredPermissions: string[]): boolean {
    return requiredPermissions.some(p => permissions.includes(p));
  }
  
  function hasAllPermissions(requiredPermissions: string[]): boolean {
    return requiredPermissions.every(p => permissions.includes(p));
  }
  
  async function hasFeature(feature: string): Promise<boolean> {
    // Check feature flags from API
    const response = await fetch(`/api/features/check/${feature}`);
    const data = await response.json();
    return data.enabled;
  }
  
  async function checkUsageLimit(resource: string) {
    const response = await fetch(`/api/usage/${resource}`);
    return await response.json();
  }
  
  const value: TenantContextType = {
    tenant,
    tenants,
    switchTenant,
    currentOutlet,
    outlets,
    switchOutlet,
    isLoading,
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasFeature,
    checkUsageLimit,
  };
  
  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within TenantProvider');
  }
  return context;
}

// Helper to get auth token
function getAuthToken(): string {
  return localStorage.getItem('auth_token') || '';
}
```

---

## 🔀 NEW UI COMPONENTS (USING EXISTING UI!)

### **1. Tenant & Outlet Switcher (Upgrade TeamSwitcher)**

```tsx
// src/components/layout/tenant-switcher.tsx
import { useTenant } from '@/context/tenant-provider';
import { ChevronsUpDown, Building2, Plus, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export function TenantSwitcher() {
  const { isMobile } = useSidebar();
  const { tenant, tenants, switchTenant, isLoading } = useTenant();
  
  if (isLoading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <Skeleton className="h-16 w-full" />
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }
  
  if (!tenant) return null;
  
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                {tenant.logo ? (
                  <img src={tenant.logo} alt={tenant.name} className="size-6 rounded" />
                ) : (
                  <Building2 className="size-4" />
                )}
              </div>
              <div className="grid flex-1 text-start text-sm leading-tight">
                <span className="truncate font-semibold">{tenant.name}</span>
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="text-xs capitalize">
                    {tenant.plan}
                  </Badge>
                  {tenant.status !== 'active' && (
                    <Badge variant="destructive" className="text-xs">
                      {tenant.status}
                    </Badge>
                  )}
                </div>
              </div>
              <ChevronsUpDown className="ms-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Workspaces
            </DropdownMenuLabel>
            
            {tenants.map((t) => (
              <DropdownMenuItem
                key={t.id}
                onClick={() => t.id !== tenant.id && switchTenant(t.id)}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-sm border">
                  {t.logo ? (
                    <img src={t.logo} alt={t.name} className="size-5 rounded" />
                  ) : (
                    <Building2 className="size-4 shrink-0" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-muted-foreground capitalize">{t.plan}</div>
                </div>
                {t.id === tenant.id && <Check className="size-4" />}
              </DropdownMenuItem>
            ))}
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem className="gap-2 p-2">
              <div className="bg-background flex size-6 items-center justify-center rounded-md border">
                <Plus className="size-4" />
              </div>
              <div className="text-muted-foreground font-medium">
                Create Workspace
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
```

### **2. Outlet Switcher (Below Tenant)**

```tsx
// src/components/layout/outlet-switcher.tsx
import { useTenant } from '@/context/tenant-provider';
import { Store, MapPin, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function OutletSwitcher() {
  const { currentOutlet, outlets, switchOutlet } = useTenant();
  
  if (!currentOutlet || outlets.length <= 1) return null;
  
  return (
    <div className="px-3 py-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-full justify-start gap-2 h-auto py-2">
            <Store className="h-4 w-4 shrink-0" />
            <div className="flex-1 text-start overflow-hidden">
              <div className="font-medium text-sm truncate">{currentOutlet.name}</div>
              <div className="text-xs text-muted-foreground truncate">
                {currentOutlet.code}
              </div>
            </div>
            <Badge variant="secondary" className="text-xs capitalize">
              {currentOutlet.type}
            </Badge>
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent className="w-80">
          <DropdownMenuLabel className="text-muted-foreground text-xs">
            Switch Outlet
          </DropdownMenuLabel>
          
          {outlets.map((outlet) => (
            <DropdownMenuItem
              key={outlet.id}
              onClick={() => outlet.id !== currentOutlet.id && switchOutlet(outlet.id)}
              className="gap-3 p-3 cursor-pointer"
              disabled={!outlet.isActive}
            >
              <Store className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{outlet.name}</span>
                  <Badge variant="outline" className="text-xs capitalize">
                    {outlet.type}
                  </Badge>
                  {!outlet.isActive && (
                    <Badge variant="destructive" className="text-xs">Inactive</Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate">{outlet.address}</span>
                </div>
                <div className="text-xs text-muted-foreground">{outlet.phone}</div>
              </div>
              {outlet.id === currentOutlet.id && <Check className="h-4 w-4 shrink-0" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
```

### **3. Permission Gate Component**

```tsx
// src/components/permission-gate.tsx
import { useTenant } from '@/context/tenant-provider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';

type PermissionGateProps = {
  children: React.ReactNode;
  permissions: string | string[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
  showAlert?: boolean;
};

export function PermissionGate({
  children,
  permissions,
  requireAll = false,
  fallback,
  showAlert = false,
}: PermissionGateProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = useTenant();
  
  const perms = Array.isArray(permissions) ? permissions : [permissions];
  
  const hasAccess = requireAll
    ? hasAllPermissions(perms)
    : hasAnyPermission(perms);
  
  if (hasAccess) {
    return <>{children}</>;
  }
  
  if (fallback) {
    return <>{fallback}</>;
  }
  
  if (showAlert) {
    return (
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertDescription>
          You don't have permission to access this feature.
        </AlertDescription>
      </Alert>
    );
  }
  
  return null;
}

// Usage examples:
// <PermissionGate permissions="pos.transaction.create">
//   <Button>New Transaction</Button>
// </PermissionGate>
//
// <PermissionGate permissions={["inventory.product.update", "inventory.product.delete"]}>
//   <Button>Edit Product</Button>
// </PermissionGate>
```

### **4. Feature Gate Component**

```tsx
// src/components/feature-gate.tsx
import { useTenant } from '@/context/tenant-provider';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Lock, Sparkles } from 'lucide-react';
import { Link } from '@tanstack/react-router';

type FeatureGateProps = {
  children: React.ReactNode;
  feature: string;
  fallback?: React.ReactNode;
  showUpgrade?: boolean;
};

export function FeatureGate({
  children,
  feature,
  fallback,
  showUpgrade = true,
}: FeatureGateProps) {
  const { hasFeature, tenant } = useTenant();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    hasFeature(feature).then((result) => {
      setEnabled(result);
      setLoading(false);
    });
  }, [feature]);
  
  if (loading) {
    return <Skeleton className="h-20 w-full" />;
  }
  
  if (enabled) {
    return <>{children}</>;
  }
  
  if (fallback) {
    return <>{fallback}</>;
  }
  
  if (showUpgrade) {
    return (
      <Alert>
        <Lock className="h-4 w-4" />
        <AlertTitle>Premium Feature</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>This feature is not available on your current plan ({tenant?.plan}).</p>
          <Button asChild size="sm">
            <Link to="/settings/billing">
              <Sparkles className="h-4 w-4 mr-2" />
              Upgrade Plan
            </Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  
  return null;
}

// Usage:
// <FeatureGate feature="multi_outlet">
//   <OutletSwitcher />
// </FeatureGate>
//
// <FeatureGate feature="advanced_reports">
//   <AdvancedReportsPage />
// </FeatureGate>
```

### **5. Usage Limit Indicator**

```tsx
// src/components/usage-limit-indicator.tsx
import { useTenant } from '@/context/tenant-provider';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

type UsageLimitProps = {
  resource: string;
  label: string;
  showAlert?: boolean;
};

export function UsageLimitIndicator({ resource, label, showAlert = true }: UsageLimitProps) {
  const { checkUsageLimit } = useTenant();
  const [usage, setUsage] = useState<any>(null);
  
  useEffect(() => {
    checkUsageLimit(resource).then(setUsage);
  }, [resource]);
  
  if (!usage) return null;
  
  const percentage = (usage.current / usage.limit) * 100;
  const isNearLimit = percentage >= 80;
  const isOverLimit = usage.exceeded;
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          <span className="font-medium">
            {usage.current.toLocaleString()} / {usage.limit.toLocaleString()}
          </span>
          {isOverLimit && <Badge variant="destructive">Limit Reached</Badge>}
          {isNearLimit && !isOverLimit && <Badge variant="warning">Near Limit</Badge>}
        </div>
      </div>
      
      <Progress
        value={Math.min(percentage, 100)}
        className={isOverLimit ? 'bg-destructive' : isNearLimit ? 'bg-yellow-500' : ''}
      />
      
      {showAlert && isOverLimit && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You've reached your {label.toLowerCase()} limit. Upgrade your plan to add more.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// Usage in Settings page:
// <UsageLimitIndicator resource="outlets" label="Outlets" />
// <UsageLimitIndicator resource="products" label="Products" />
// <UsageLimitIndicator resource="users" label="Users" />
```

---

## 🗂️ MODULE STRUCTURE (LEVERAGE DATA-TABLE!)

### **Example: POS Module**

```
src/features/pos/
├── index.tsx                    # Main POS page
├── components/
│   ├── pos-table.tsx            # Reuse DataTable!
│   ├── pos-columns.tsx          # Column definitions
│   ├── pos-filters.tsx          # Faceted filters
│   ├── pos-bulk-actions.tsx     # Bulk operations
│   ├── pos-row-actions.tsx      # Row context menu
│   ├── transaction-dialog.tsx   # Dialog for new txn
│   ├── product-search.tsx       # Command palette search
│   ├── cart-sheet.tsx           # Sheet for cart
│   ├── payment-dialog.tsx       # Payment modal
│   └── receipt-print.tsx        # Receipt component
├── hooks/
│   ├── use-pos-state.ts         # Cart state management
│   ├── use-product-search.ts    # Product search
│   └── use-offline-sync.ts      # Offline handling
└── api/
    ├── transactions.ts          # API calls
    └── products.ts
```

### **POS Page Example (Using ALL UI):**

```tsx
// src/features/pos/index.tsx
import { useState } from 'react';
import { useTenant } from '@/context/tenant-provider';
import { PermissionGate } from '@/components/permission-gate';
import { FeatureGate } from '@/components/feature-gate';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  ShoppingCart,
  Plus,
  History,
  BarChart3,
  Settings,
  WifiOff,
} from 'lucide-react';

import { ProductSearch } from './components/product-search';
import { CartSheet } from './components/cart-sheet';
import { TransactionDialog } from './components/transaction-dialog';
import { POSTable } from './components/pos-table';
import { useOfflineSync } from './hooks/use-offline-sync';

export default function POSPage() {
  const { currentOutlet, hasPermission } = useTenant();
  const { isOffline, pendingSync } = useOfflineSync();
  const [cartOpen, setCartOpen] = useState(false);
  
  return (
    <PermissionGate
      permissions="pos.access"
      showAlert
    >
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Point of Sale</h2>
            <p className="text-muted-foreground">
              {currentOutlet?.name} - {currentOutlet?.code}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Offline Indicator */}
            {isOffline && (
              <Badge variant="destructive" className="gap-1">
                <WifiOff className="h-3 w-3" />
                Offline ({pendingSync} pending)
              </Badge>
            )}
            
            {/* Cart Button */}
            <Sheet open={cartOpen} onOpenChange={setCartOpen}>
              <SheetTrigger asChild>
                <Button size="lg" className="gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Cart (3)
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-lg">
                <CartSheet onClose={() => setCartOpen(false)} />
              </SheetContent>
            </Sheet>
          </div>
        </div>
        
        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Sales</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Rp 1,234,000</div>
              <p className="text-xs text-muted-foreground">+20% from yesterday</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Transactions</CardTitle>
              <History className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">45</div>
              <p className="text-xs text-muted-foreground">+12 from yesterday</p>
            </CardContent>
          </Card>
          
          <FeatureGate feature="shift_management">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Current Shift</CardTitle>
                <Settings className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">Shift 1</div>
                <p className="text-xs text-muted-foreground">Started 08:00 AM</p>
              </CardContent>
            </Card>
          </FeatureGate>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Ticket</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Rp 27,422</div>
              <p className="text-xs text-muted-foreground">+5% from yesterday</p>
            </CardContent>
          </Card>
        </div>
        
        {/* Main Content */}
        <Tabs defaultValue="new" className="space-y-4">
          <TabsList>
            <TabsTrigger value="new">New Transaction</TabsTrigger>
            <TabsTrigger value="history">Transaction History</TabsTrigger>
            <TabsTrigger value="draft">Draft Transactions</TabsTrigger>
          </TabsList>
          
          <TabsContent value="new" className="space-y-4">
            {/* Product Search (Command Palette) */}
            <ProductSearch />
            
            {/* Empty State or Cart Items */}
            <Card>
              <CardContent className="pt-6">
                <div className="text-center text-muted-foreground">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Search and add products to create a transaction</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="history" className="space-y-4">
            {/* Reuse DataTable component! */}
            <POSTable />
          </TabsContent>
          
          <TabsContent value="draft" className="space-y-4">
            <Alert>
              <AlertDescription>
                Draft transactions are saved locally and can be resumed later.
              </AlertDescription>
            </Alert>
            {/* Draft table */}
          </TabsContent>
        </Tabs>
      </div>
    </PermissionGate>
  );
}
```

---

## 📊 REUSE DATA-TABLE EVERYWHERE!

### **Generic Table Wrapper:**

```tsx
// src/components/entity-table.tsx
import { useState } from 'react';
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { DataTablePagination, DataTableToolbar } from '@/components/data-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

type EntityTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  searchKey?: string;
  filters?: any[];
  BulkActions?: React.ComponentType<{ table: any }>;
};

export function EntityTable<TData, TValue>({
  columns,
  data,
  isLoading = false,
  searchKey,
  filters = [],
  BulkActions,
}: EntityTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Toolbar (Search + Filters) */}
      <DataTableToolbar
        table={table}
        searchKey={searchKey}
        filters={filters}
      />
      
      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      
      {/* Pagination */}
      <DataTablePagination table={table} />
      
      {/* Bulk Actions */}
      {BulkActions && <BulkActions table={table} />}
    </div>
  );
}
```

**Use everywhere:**
- Products table
- Transactions table
- Customers table
- Suppliers table
- Members table (Koperasi)
- Loans table
- Invoices table
- Users table
- etc...

---

## 🎨 SIDEBAR NAVIGATION (ROLE-BASED)

### **Dynamic Sidebar Data:**

```tsx
// src/components/layout/data/sidebar-data.ts
import { useTenant } from '@/context/tenant-provider';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Truck,
  Receipt,
  PiggyBank,
  Settings,
  BarChart3,
  UserPlus,
} from 'lucide-react';

export function useSidebarData() {
  const { hasPermission, hasFeature, tenant } = useTenant();
  
  const navGroups = [];
  
  // Dashboard (everyone)
  navGroups.push({
    title: 'Dashboard',
    items: [
      {
        title: 'Overview',
        url: '/',
        icon: LayoutDashboard,
      },
    ],
  });
  
  // POS Module
  if (hasPermission('pos.access')) {
    navGroups.push({
      title: 'Point of Sale',
      items: [
        {
          title: 'New Transaction',
          url: '/pos',
          icon: ShoppingCart,
          badge: hasFeature('offline_pos') ? 'Offline' : undefined,
        },
        hasPermission('pos.transaction.view') && {
          title: 'Transactions',
          url: '/pos/transactions',
          icon: Receipt,
        },
        hasPermission('pos.shift.view') && {
          title: 'Shifts',
          url: '/pos/shifts',
          icon: BarChart3,
        },
      ].filter(Boolean),
    });
  }
  
  // Inventory Module
  if (hasPermission('inventory.access')) {
    navGroups.push({
      title: 'Inventory',
      items: [
        hasPermission('inventory.product.view') && {
          title: 'Products',
          url: '/inventory/products',
          icon: Package,
        },
        hasPermission('inventory.stock.view') && {
          title: 'Stock Movements',
          url: '/inventory/stock',
          icon: Package,
        },
        hasPermission('inventory.adjustment.view') && {
          title: 'Adjustments',
          url: '/inventory/adjustments',
          icon: Package,
        },
      ].filter(Boolean),
    });
  }
  
  // Supplier Module
  if (hasPermission('supplier.access')) {
    navGroups.push({
      title: 'Supplier',
      items: [
        {
          title: 'Suppliers',
          url: '/suppliers',
          icon: Truck,
        },
        {
          title: 'Purchase Orders',
          url: '/suppliers/purchase-orders',
          icon: Receipt,
        },
      ],
    });
  }
  
  // Koperasi Module (Feature-gated!)
  if (hasFeature('koperasi_module') && hasPermission('koperasi.access')) {
    navGroups.push({
      title: 'Koperasi',
      items: [
        {
          title: 'Members',
          url: '/koperasi/members',
          icon: Users,
        },
        {
          title: 'Loans',
          url: '/koperasi/loans',
          icon: PiggyBank,
        },
        {
          title: 'Savings',
          url: '/koperasi/savings',
          icon: PiggyBank,
        },
      ],
    });
  }
  
  // Settings
  navGroups.push({
    title: 'Settings',
    items: [
      {
        title: 'General',
        url: '/settings',
        icon: Settings,
      },
      hasPermission('tenant.billing.view') && {
        title: 'Billing',
        url: '/settings/billing',
        icon: Receipt,
      },
      hasPermission('tenant.user.view') && {
        title: 'Users & Roles',
        url: '/settings/users',
        icon: UserPlus,
      },
    ].filter(Boolean),
  });
  
  return {
    navGroups,
    user: {
      name: 'Current User',
      email: 'user@example.com',
      avatar: '/avatars/default.png',
    },
  };
}
```

### **Update AppSidebar:**

```tsx
// src/components/layout/app-sidebar.tsx
import { useLayout } from '@/context/layout-provider';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar';
import { useSidebarData } from './data/sidebar-data';
import { NavGroup } from './nav-group';
import { NavUser } from './nav-user';
import { TenantSwitcher } from './tenant-switcher';
import { OutletSwitcher } from './outlet-switcher';

export function AppSidebar() {
  const { collapsible, variant } = useLayout();
  const { navGroups, user } = useSidebarData();
  
  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        <TenantSwitcher />
        <OutletSwitcher />
      </SidebarHeader>
      
      <SidebarContent>
        {navGroups.map((props) => (
          <NavGroup key={props.title} {...props} />
        ))}
      </SidebarContent>
      
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      
      <SidebarRail />
    </Sidebar>
  );
}
```

---

## 🔔 TOAST NOTIFICATIONS (LEVERAGE SONNER!)

### **Global Toast Patterns:**

```tsx
// src/lib/toast-helpers.ts
import { toast } from 'sonner';
import { CheckCircle2, XCircle, AlertCircle, Info } from 'lucide-react';

export const toastSuccess = (message: string, description?: string) => {
  toast.success(message, {
    description,
    icon: <CheckCircle2 className="h-4 w-4" />,
  });
};

export const toastError = (message: string, description?: string) => {
  toast.error(message, {
    description,
    icon: <XCircle className="h-4 w-4" />,
  });
};

export const toastWarning = (message: string, description?: string) => {
  toast.warning(message, {
    description,
    icon: <AlertCircle className="h-4 w-4" />,
  });
};

export const toastInfo = (message: string, description?: string) => {
  toast.info(message, {
    description,
    icon: <Info className="h-4 w-4" />,
  });
};

export const toastLoading = (message: string) => {
  return toast.loading(message);
};

export const toastPromise = <T,>(
  promise: Promise<T>,
  {
    loading,
    success,
    error,
  }: {
    loading: string;
    success: string | ((data: T) => string);
    error: string | ((error: any) => string);
  }
) => {
  return toast.promise(promise, {
    loading,
    success,
    error,
  });
};

// Usage examples:
// toastSuccess('Product created!');
// toastError('Failed to save', 'Please check your connection');
// toastPromise(
//   createProduct(data),
//   {
//     loading: 'Creating product...',
//     success: 'Product created successfully!',
//     error: 'Failed to create product',
//   }
// );
```

---

## 🎉 IMPLEMENTATION CHECKLIST

### **Phase 0: Foundation (Week 1-2)**

- [ ] **Context Providers:**
  - [ ] Create `TenantProvider` with tenant/outlet switching
  - [ ] Integrate with existing `ThemeProvider`, `LayoutProvider`, etc
  - [ ] Add to `__root.tsx`

- [ ] **Permission System:**
  - [ ] Create `PermissionGate` component
  - [ ] Create `FeatureGate` component
  - [ ] Create `UsageLimitIndicator` component
  - [ ] Add permission hooks

- [ ] **Layout Components:**
  - [ ] Create `TenantSwitcher` (replace `TeamSwitcher`)
  - [ ] Create `OutletSwitcher`
  - [ ] Update `AppSidebar` with dynamic navigation
  - [ ] Update `ProfileDropdown` with tenant info

- [ ] **Utilities:**
  - [ ] Create toast helper functions
  - [ ] Create API client with tenant headers
  - [ ] Create error handler with toast integration

### **Phase 1: First Module - POS (Week 3-8)**

- [ ] **Pages:**
  - [ ] POS main page with product search
  - [ ] Transaction history with DataTable
  - [ ] Transaction detail view
  - [ ] Receipt print view

- [ ] **Components:**
  - [ ] Product search (Command palette)
  - [ ] Cart sheet
  - [ ] Payment dialog
  - [ ] Receipt component
  - [ ] POS table with filters

- [ ] **Features:**
  - [ ] Offline support (IndexedDB + Service Worker)
  - [ ] Barcode scanner integration
  - [ ] Receipt printer (ESC/POS)
  - [ ] Multi-payment methods

### **Phase 2: Inventory Module (Week 9-14)**

- [ ] **Pages:**
  - [ ] Products list with DataTable
  - [ ] Product form (Dialog or Sheet)
  - [ ] Stock movements
  - [ ] Stock adjustments
  - [ ] Stock transfer

- [ ] **Components:**
  - [ ] Product card (Card component)
  - [ ] Stock alert badges
  - [ ] Barcode generator
  - [ ] Category tree (Collapsible)

### **Phase 3: Continue with other modules...**

---

## 🎨 UI COMPONENT MAPPING

**Every template component gets used:**

| Component | Use Case |
|-----------|----------|
| `alert-dialog` | Delete confirmations, destructive actions |
| `alert` | Info messages, warnings, errors |
| `avatar` | User profile, member photos, team logos |
| `badge` | Status indicators, plan labels, counts |
| `button` | All actions (primary, secondary, ghost, etc) |
| `calendar` | Date pickers for reports, loans, invoices |
| `card` | Stat cards, product cards, dashboard widgets |
| `checkbox` | Multi-select in tables, settings |
| `collapsible` | Expandable sections in forms |
| `command` | Product search, global search (⌘K) |
| `dialog` | Forms, modals (create/edit entities) |
| `dropdown-menu` | Context menus, row actions |
| `form` | All forms with validation |
| `input-otp` | 2FA, PIN verification |
| `input` | Text fields everywhere |
| `label` | Form labels |
| `popover` | Help text, additional info |
| `radio-group` | Payment method, order type |
| `scroll-area` | Long lists, product categories |
| `select` | Dropdowns (category, status, etc) |
| `separator` | Section dividers |
| `sheet` | Cart, filters panel, quick edit |
| `sidebar` | Main navigation (perfect!) |
| `skeleton` | Loading states everywhere |
| `sonner` | Toast notifications (success/error) |
| `switch` | Toggle settings, active/inactive |
| `table` | ALL data tables (80% of pages!) |
| `tabs` | Multiple views (POS, Settings, Reports) |
| `textarea` | Notes, descriptions, addresses |
| `tooltip` | Icon explanations |

**DataTable components:**
- `bulk-actions` → Multi-delete, export, status change
- `column-header` → Sortable columns
- `faceted-filter` → Filter by status, category, etc
- `pagination` → Page navigation
- `toolbar` → Search + filters
- `view-options` → Show/hide columns

**Custom components:**
- `coming-soon` → Future features placeholder
- `command-menu` → Global ⌘K search
- `config-drawer` → Layout/theme settings
- `confirm-dialog` → Reusable confirmations
- `date-picker` → Date range selection
- `learn-more` → Help links
- `long-text` → Truncate with "Read more"
- `navigation-progress` → Page load indicator
- `password-input` → Password with show/hide
- `profile-dropdown` → User menu
- `search` → Search input with icon
- `select-dropdown` → Custom select
- `sign-out-dialog` → Logout confirmation
- `theme-switch` → Dark/light mode
- `skip-to-main` → Accessibility

---

## 📱 RESPONSIVE DESIGN

Template already responsive! Just maintain:

- Mobile-first approach
- `sm:`, `md:`, `lg:` breakpoints
- `useMobile()` hook from sidebar
- Collapsible sidebar on mobile
- Sheet components for mobile modals
- Stack cards on small screens

---

## 🎉 FRONTEND MULTI-TENANCY COMPLETE!

**Key Achievements:**
- ✅ Multi-tenant context with outlet switching
- ✅ Permission-based UI rendering
- ✅ Feature-gated components
- ✅ Usage limit indicators
- ✅ Role-based navigation
- ✅ Reused ALL existing UI components
- ✅ DataTable for all entity lists
- ✅ Toast notifications patterns
- ✅ Responsive by default

**Template utilization: 100%!** 🔥

**Ready to push to GitHub?** 🚀
