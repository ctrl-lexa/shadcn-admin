import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private auditLogs: AuditLogsService,
  ) {}

  async create(
    tenantId: string,
    userId: string,
    outletId: string,
    dto: CreateProductDto,
  ) {
    // Verify outlet belongs to tenant
    const outlet = await this.prisma.outlet.findFirst({
      where: { id: dto.outletId, tenantId },
    });

    if (!outlet) {
      throw new BadRequestException('Outlet not found in your tenant');
    }

    // Check SKU uniqueness within outlet
    const existingSku = await this.prisma.product.findFirst({
      where: {
        outletId: dto.outletId,
        sku: dto.sku,
      },
    });

    if (existingSku) {
      throw new ConflictException(
        `Product with SKU '${dto.sku}' already exists in this outlet`,
      );
    }

    // Check barcode uniqueness if provided
    if (dto.barcode) {
      const existingBarcode = await this.prisma.product.findFirst({
        where: {
          outletId: dto.outletId,
          barcode: dto.barcode,
        },
      });

      if (existingBarcode) {
        throw new ConflictException(
          `Product with barcode '${dto.barcode}' already exists in this outlet`,
        );
      }
    }

    const product = await this.prisma.product.create({
      data: {
        tenantId,
        outletId: dto.outletId,
        name: dto.name,
        description: dto.description,
        sku: dto.sku,
        barcode: dto.barcode,
        categoryId: dto.categoryId,
        sellingPrice: dto.sellingPrice,
        costPrice: dto.costPrice || 0,
        currentStock: dto.currentStock || 0,
        minStock: dto.minStock || 0,
        maxStock: dto.maxStock,
        unit: dto.unit || 'pcs',
        images: dto.image ? [dto.image] : [],
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
      include: {
        category: true,
        outlet: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    // Audit log
    await this.auditLogs.logCreate(
      tenantId,
      userId,
      'products',
      product.id,
      {
        name: product.name,
        sku: product.sku,
        sellingPrice: product.sellingPrice,
        currentStock: product.currentStock,
      },
    );

    return {
      message: 'Product created successfully',
      product,
    };
  }

  async findAll(
    tenantId: string,
    outletId?: string,
    categoryId?: string,
    includeInactive = false,
    search?: string,
  ) {
    const where: any = {
      outlet: { tenantId },
    };

    if (outletId) {
      where.outletId = outletId;
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (!includeInactive) {
      where.isActive = true;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
      ];
    }

    const products = await this.prisma.product.findMany({
      where,
      include: {
        category: true,
        outlet: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Check low stock
    const lowStockProducts = products.filter(
      (p) => p.minStock && p.currentStock <= p.minStock,
    );

    return {
      tenantId,
      count: products.length,
      lowStockCount: lowStockProducts.length,
      products,
    };
  }

  async findOne(tenantId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        id,
        outlet: { tenantId },
      },
      include: {
        category: true,
        outlet: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        transactionItems: {
          take: 10,
          include: {
            transaction: {
              select: {
                id: true,
                transactionNumber: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found in your tenant');
    }

    return { product };
  }

  async update(tenantId: string, userId: string, id: string, dto: UpdateProductDto) {
    // Check product exists and belongs to tenant
    const existing = await this.prisma.product.findFirst({
      where: {
        id,
        outlet: { tenantId },
      },
    });

    if (!existing) {
      throw new NotFoundException('Product not found in your tenant');
    }

    // Check SKU uniqueness if changed
    if (dto.sku && dto.sku !== existing.sku) {
      const skuExists = await this.prisma.product.findFirst({
        where: {
          outletId: existing.outletId,
          sku: dto.sku,
          NOT: { id },
        },
      });

      if (skuExists) {
        throw new ConflictException(
          `Product with SKU '${dto.sku}' already exists`,
        );
      }
    }

    // Check barcode uniqueness if changed
    if (dto.barcode && dto.barcode !== existing.barcode) {
      const barcodeExists = await this.prisma.product.findFirst({
        where: {
          outletId: existing.outletId,
          barcode: dto.barcode,
          NOT: { id },
        },
      });

      if (barcodeExists) {
        throw new ConflictException(
          `Product with barcode '${dto.barcode}' already exists`,
        );
      }
    }

    const product = await this.prisma.product.update({
      where: { id },
      data: dto,
      include: {
        category: true,
        outlet: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    // Audit log
    await this.auditLogs.logUpdate(
      tenantId,
      userId,
      'products',
      id,
      {
        name: existing.name,
        sku: existing.sku,
        sellingPrice: existing.sellingPrice,
        currentStock: existing.currentStock,
      },
      {
        name: product.name,
        sku: product.sku,
        sellingPrice: product.sellingPrice,
        currentStock: product.currentStock,
      },
    );

    return {
      message: 'Product updated successfully',
      product,
    };
  }

  async remove(tenantId: string, userId: string, id: string) {
    // Check product exists
    const product = await this.prisma.product.findFirst({
      where: {
        id,
        outlet: { tenantId },
      },
      include: {
        _count: {
          select: {
            transactionItems: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found in your tenant');
    }

    // Prevent deletion if has transactions
    if (product._count.transactionItems > 0) {
      throw new BadRequestException(
        'Cannot delete product with existing transactions. Deactivate instead.',
      );
    }

    await this.prisma.product.delete({
      where: { id },
    });

    // Audit log
    await this.auditLogs.logDelete(
      tenantId,
      userId,
      'products',
      id,
      {
        name: product.name,
        sku: product.sku,
      },
    );

    return {
      message: 'Product deleted successfully',
    };
  }

  async toggleActive(tenantId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        id,
        outlet: { tenantId },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found in your tenant');
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: { isActive: !product.isActive },
    });

    return {
      message: `Product ${updated.isActive ? 'activated' : 'deactivated'} successfully`,
      product: updated,
    };
  }

  async adjustStock(
    tenantId: string,
    id: string,
    quantity: number,
    reason: string,
  ) {
    const product = await this.prisma.product.findFirst({
      where: {
        id,
        outlet: { tenantId },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found in your tenant');
    }

    const newStock = product.currentStock + quantity;

    if (newStock < 0) {
      throw new BadRequestException('Insufficient stock');
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: { currentStock: newStock },
    });

    return {
      message: 'Stock adjusted successfully',
      product: updated,
      previousStock: product.currentStock,
      newStock: updated.currentStock,
      adjustment: quantity,
      reason,
    };
  }

  async getLowStock(tenantId: string, outletId?: string) {
    const where: any = {
      outlet: { tenantId },
      trackStock: true,
      isActive: true,
    };

    if (outletId) {
      where.outletId = outletId;
    }

    const products = await this.prisma.product.findMany({
      where,
      include: {
        category: true,
        outlet: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    const lowStockProducts = products.filter(
      (p) => p.minStock && p.currentStock <= p.minStock,
    );

    return {
      tenantId,
      count: lowStockProducts.length,
      products: lowStockProducts,
    };
  }
}
