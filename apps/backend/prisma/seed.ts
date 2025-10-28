import { PrismaClient, Permission } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Create Subscription Plans
  console.log('📦 Creating subscription plans...');
  const freePlan = await prisma.subscriptionPlan.upsert({
    where: { code: 'FREE' },
    update: {},
    create: {
      name: 'Free',
      code: 'FREE',
      description: 'Free plan for testing',
      monthlyPrice: 0,
      maxOutlets: 1,
      maxProducts: 50,
      maxUsers: 3,
      maxStorage: 512,
      features: ['pos', 'inventory'],
      isActive: true,
      isPublic: true,
    },
  });

  const basicPlan = await prisma.subscriptionPlan.upsert({
    where: { code: 'BASIC' },
    update: {},
    create: {
      name: 'Basic',
      code: 'BASIC',
      description: 'Basic plan for small business',
      monthlyPrice: 9900000, // Rp 99,000
      annualPrice: 99000000, // Rp 990,000 (save 10%)
      maxOutlets: 3,
      maxProducts: 500,
      maxUsers: 10,
      maxStorage: 5120, // 5GB
      features: ['pos', 'inventory', 'reports', 'multi-outlet'],
      isActive: true,
      isPublic: true,
    },
  });

  const proPlan = await prisma.subscriptionPlan.upsert({
    where: { code: 'PRO' },
    update: {},
    create: {
      name: 'Pro',
      code: 'PRO',
      description: 'Pro plan for growing business',
      monthlyPrice: 29900000, // Rp 299,000
      annualPrice: 299000000, // Rp 2,990,000 (save 17%)
      maxOutlets: 10,
      maxProducts: 5000,
      maxUsers: 50,
      maxStorage: 20480, // 20GB
      features: [
        'pos',
        'inventory',
        'reports',
        'multi-outlet',
        'api',
        'advanced-reports',
        'custom-branding',
      ],
      isActive: true,
      isPublic: true,
    },
  });

  console.log('✅ Subscription plans created');

  // Create Test Tenant
  console.log('🏢 Creating test tenant...');
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      name: 'Demo Koperasi',
      slug: 'demo',
      planId: proPlan.id,
      status: 'ACTIVE',
      planExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
    },
  });

  // Create Subscription for Tenant
  await prisma.subscription.create({
    data: {
      tenantId: tenant.id,
      planId: proPlan.id,
      status: 'ACTIVE',
      amount: proPlan.monthlyPrice,
      billingCycle: 'MONTHLY',
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
    },
  });

  console.log('✅ Tenant created with Pro subscription');

  // Create Main Outlet
  console.log('🏪 Creating outlet...');
  const outlet = await prisma.outlet.upsert({
    where: {
      tenantId_code: {
        tenantId: tenant.id,
        code: 'MAIN',
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Outlet Pusat',
      code: 'MAIN',
      type: 'RETAIL',
      address: 'Jl. Raya Demo No. 123',
      phone: '081234567890',
      isActive: true,
    },
  });

  console.log('✅ Outlet created');

  // Create Permissions
  console.log('🔐 Creating permissions...');
  const permissionsData = [
    // Users
    {
      code: 'users.read.outlet',
      resource: 'users',
      action: 'read',
      scope: 'outlet',
      description: 'View Users in own outlet',
    },
    {
      code: 'users.create.outlet',
      resource: 'users',
      action: 'create',
      scope: 'outlet',
      description: 'Create Users',
    },
    {
      code: 'users.update.outlet',
      resource: 'users',
      action: 'update',
      scope: 'outlet',
      description: 'Update Users',
    },
    {
      code: 'users.delete.outlet',
      resource: 'users',
      action: 'delete',
      scope: 'outlet',
      description: 'Delete Users',
    },
    // Roles
    {
      code: 'roles.read.tenant',
      resource: 'roles',
      action: 'read',
      scope: 'tenant',
      description: 'View Roles',
    },
    {
      code: 'roles.create.tenant',
      resource: 'roles',
      action: 'create',
      scope: 'tenant',
      description: 'Create Roles',
    },
    {
      code: 'roles.update.tenant',
      resource: 'roles',
      action: 'update',
      scope: 'tenant',
      description: 'Update Roles',
    },
    {
      code: 'roles.delete.tenant',
      resource: 'roles',
      action: 'delete',
      scope: 'tenant',
      description: 'Delete Roles',
    },
    // Outlets
    {
      code: 'outlets.read.tenant',
      resource: 'outlets',
      action: 'read',
      scope: 'tenant',
      description: 'View Outlets',
    },
    {
      code: 'outlets.create.tenant',
      resource: 'outlets',
      action: 'create',
      scope: 'tenant',
      description: 'Create Outlets',
    },
    {
      code: 'outlets.update.tenant',
      resource: 'outlets',
      action: 'update',
      scope: 'tenant',
      description: 'Update Outlets',
    },
    {
      code: 'outlets.delete.tenant',
      resource: 'outlets',
      action: 'delete',
      scope: 'tenant',
      description: 'Delete Outlets',
    },
    // Products
    {
      code: 'products.read.outlet',
      resource: 'products',
      action: 'read',
      scope: 'outlet',
      description: 'View Products',
    },
    {
      code: 'products.create.outlet',
      resource: 'products',
      action: 'create',
      scope: 'outlet',
      description: 'Create Products',
    },
    {
      code: 'products.update.outlet',
      resource: 'products',
      action: 'update',
      scope: 'outlet',
      description: 'Update Products',
    },
    {
      code: 'products.delete.outlet',
      resource: 'products',
      action: 'delete',
      scope: 'outlet',
      description: 'Delete Products',
    },
    // Transactions
    {
      code: 'transactions.read.outlet',
      resource: 'transactions',
      action: 'read',
      scope: 'outlet',
      description: 'View Transactions',
    },
    {
      code: 'transactions.create.outlet',
      resource: 'transactions',
      action: 'create',
      scope: 'outlet',
      description: 'Create Transactions',
    },
    {
      code: 'transactions.refund.outlet',
      resource: 'transactions',
      action: 'refund',
      scope: 'outlet',
      description: 'Refund Transactions',
    },
    {
      code: 'transactions.void.outlet',
      resource: 'transactions',
      action: 'void',
      scope: 'outlet',
      description: 'Void Transactions',
    },
    // Reports
    {
      code: 'reports.view.outlet',
      resource: 'reports',
      action: 'view',
      scope: 'outlet',
      description: 'View Reports',
    },
    {
      code: 'reports.export.outlet',
      resource: 'reports',
      action: 'export',
      scope: 'outlet',
      description: 'Export Reports',
    },
    // System
    {
      code: 'system.settings.tenant',
      resource: 'system',
      action: 'settings',
      scope: 'tenant',
      description: 'Manage System Settings',
    },
    {
      code: 'system.delete.tenant',
      resource: 'system',
      action: 'delete',
      scope: 'tenant',
      description: 'Delete System Data',
    },
  ];

  const permissions: Permission[] = [];
  for (const perm of permissionsData) {
    const permission = await prisma.permission.upsert({
      where: { code: perm.code },
      update: {},
      create: perm,
    });
    permissions.push(permission);
  }

  console.log(`✅ Created ${permissions.length} permissions`);

  // Create Roles
  console.log('👥 Creating roles...');

  // Super Admin Role (all permissions)
  const superAdminRole = await prisma.role.upsert({
    where: {
      tenantId_name: {
        tenantId: tenant.id,
        name: 'SUPER_ADMIN',
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'SUPER_ADMIN',
      description: 'Super Administrator with all permissions',
    },
  });

  // Assign all permissions to Super Admin
  for (const permission of permissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: superAdminRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: superAdminRole.id,
        permissionId: permission.id,
      },
    });
  }

  // Admin Role (most permissions except system delete)
  const adminRole = await prisma.role.upsert({
    where: {
      tenantId_name: {
        tenantId: tenant.id,
        name: 'ADMIN',
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'ADMIN',
      description: 'Administrator',
    },
  });

  const adminPermissions = permissions.filter(
    (p) => p.code !== 'system.delete.tenant',
  );
  for (const permission of adminPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: adminRole.id,
        permissionId: permission.id,
      },
    });
  }

  // Cashier Role (limited permissions)
  const cashierRole = await prisma.role.upsert({
    where: {
      tenantId_name: {
        tenantId: tenant.id,
        name: 'CASHIER',
      },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'CASHIER',
      description: 'Cashier',
    },
  });

  const cashierPermissions = permissions.filter((p) =>
    [
      'products.read.outlet',
      'transactions.read.outlet',
      'transactions.create.outlet',
      'reports.view.outlet',
    ].includes(p.code),
  );
  for (const permission of cashierPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: cashierRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: cashierRole.id,
        permissionId: permission.id,
      },
    });
  }

  console.log('✅ Roles created with permissions');

  // Create Test Users
  console.log('👤 Creating test users...');
  const passwordHash = await bcrypt.hash('password123', 10);

  const superAdminUser = await prisma.user.upsert({
    where: { email: 'superadmin@demo.com' },
    update: {},
    create: {
      tenantId: tenant.id,
      outletId: outlet.id,
      roleId: superAdminRole.id,
      username: 'superadmin',
      email: 'superadmin@demo.com',
      passwordHash,
      firstName: 'Super',
      lastName: 'Admin',
      isActive: true,
    },
  });

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@demo.com' },
    update: {},
    create: {
      tenantId: tenant.id,
      outletId: outlet.id,
      roleId: adminRole.id,
      username: 'admin',
      email: 'admin@demo.com',
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      isActive: true,
    },
  });

  const cashierUser = await prisma.user.upsert({
    where: { email: 'cashier@demo.com' },
    update: {},
    create: {
      tenantId: tenant.id,
      outletId: outlet.id,
      roleId: cashierRole.id,
      username: 'cashier',
      email: 'cashier@demo.com',
      passwordHash,
      firstName: 'Cashier',
      lastName: 'User',
      isActive: true,
    },
  });

  console.log('✅ Test users created');

  console.log('\n🎉 Seed completed successfully!\n');
  console.log('📝 Test Users:');
  console.log('  1. Super Admin:');
  console.log('     Email: superadmin@demo.com');
  console.log('     Password: password123');
  console.log('     Permissions: ALL');
  console.log('');
  console.log('  2. Admin:');
  console.log('     Email: admin@demo.com');
  console.log('     Password: password123');
  console.log('     Permissions: ALL except system.delete');
  console.log('');
  console.log('  3. Cashier:');
  console.log('     Email: cashier@demo.com');
  console.log('     Password: password123');
  console.log(
    '     Permissions: products.read, transactions.read/create, reports.view',
  );
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
