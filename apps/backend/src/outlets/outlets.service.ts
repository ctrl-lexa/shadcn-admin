import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { TenantPrismaService } from '../common/services/tenant-prisma.service';
import { CreateOutletDto } from './dto/create-outlet.dto';
import { UpdateOutletDto } from './dto/update-outlet.dto';

@Injectable()
export class OutletsService {
  constructor(private tenantPrisma: TenantPrismaService) {}

  async create(tenantId: string, dto: CreateOutletDto) {
    const db = this.tenantPrisma.forTenant(tenantId);

    // Check if code already exists in tenant
    const existing = await db.outlet.findFirst({
      where: { code: dto.code },
    });

    if (existing) {
      throw new ConflictException(
        `Outlet with code '${dto.code}' already exists`,
      );
    }

    const outlet = await db.outlet.create({
      data: {
        name: dto.name,
        code: dto.code,
        type: dto.type,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        city: dto.city,
        province: dto.province,
        postalCode: dto.postalCode,
        timezone: dto.timezone || 'Asia/Jakarta',
        currency: dto.currency || 'IDR',
        taxRate: dto.taxRate || 11.0,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });

    return {
      message: 'Outlet created successfully',
      outlet,
    };
  }

  async findAll(tenantId: string, includeInactive = false) {
    const db = this.tenantPrisma.forTenant(tenantId);

    const outlets = await db.outlet.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    return {
      tenantId,
      count: outlets.length,
      outlets,
    };
  }

  async findOne(tenantId: string, id: string) {
    const db = this.tenantPrisma.forTenant(tenantId);

    const outlet = await db.outlet.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            products: true,
            transactions: true,
          },
        },
      },
    });

    if (!outlet) {
      throw new NotFoundException('Outlet not found in your tenant');
    }

    return { outlet };
  }

  async update(tenantId: string, id: string, dto: UpdateOutletDto) {
    const db = this.tenantPrisma.forTenant(tenantId);

    // Check if outlet exists
    const existing = await db.outlet.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Outlet not found in your tenant');
    }

    // Check code uniqueness if code is being changed
    if (dto.code && dto.code !== existing.code) {
      const codeExists = await db.outlet.findFirst({
        where: { code: dto.code },
      });

      if (codeExists) {
        throw new ConflictException(
          `Outlet with code '${dto.code}' already exists`,
        );
      }
    }

    const outlet = await db.outlet.update({
      where: { id },
      data: dto,
    });

    return {
      message: 'Outlet updated successfully',
      outlet,
    };
  }

  async remove(tenantId: string, id: string) {
    const db = this.tenantPrisma.forTenant(tenantId);

    // Check if outlet exists
    const outlet = await db.$prisma.outlet.findUnique({
      where: { id, tenantId },
      include: {
        _count: {
          select: {
            users: true,
            products: true,
            transactions: true,
          },
        },
      },
    });

    if (!outlet) {
      throw new NotFoundException('Outlet not found in your tenant');
    }

    // Prevent deletion if outlet has users, products, or transactions
    if (
      outlet._count.users > 0 ||
      outlet._count.products > 0 ||
      outlet._count.transactions > 0
    ) {
      throw new BadRequestException(
        'Cannot delete outlet with existing users, products, or transactions. Deactivate instead.',
      );
    }

    await db.outlet.delete({
      where: { id },
    });

    return {
      message: 'Outlet deleted successfully',
    };
  }

  async toggleActive(tenantId: string, id: string) {
    const db = this.tenantPrisma.forTenant(tenantId);

    const outlet = await db.outlet.findUnique({
      where: { id },
    });

    if (!outlet) {
      throw new NotFoundException('Outlet not found in your tenant');
    }

    const updated = await db.outlet.update({
      where: { id },
      data: { isActive: !outlet.isActive },
    });

    return {
      message: `Outlet ${updated.isActive ? 'activated' : 'deactivated'} successfully`,
      outlet: updated,
    };
  }
}
