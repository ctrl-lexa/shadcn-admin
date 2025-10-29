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
import { BillingService } from '../billing/billing.service';
import {
  CreateProductVariantDto,
  UpdateProductVariantDto,
  CreatePricingTierDto,
  UpdatePricingTierDto,
  CreateCategoryDto,
  UpdateCategoryDto,
  BulkImportProductDto,
} from './dto';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private auditLogs: AuditLogsService,
    private billing: BillingService,
  ) {}

  async create(
    tenantId: string,
    userId: string,
    outletId: string,
    dto: CreateProductDto,
  ) {
    // Check product limit
    await this.billing.checkLimit(tenantId, 'products');

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
    await this.auditLogs.logCreate(tenantId, userId, 'products', product.id, {
      name: product.name,
      sku: product.sku,
      sellingPrice: product.sellingPrice,
      currentStock: product.currentStock,
    });

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

  async update(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateProductDto,
  ) {
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
    await this.auditLogs.logDelete(tenantId, userId, 'products', id, {
      name: product.name,
      sku: product.sku,
    });

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

  // ============================================================================
  // PRODUCT VARIANTS
  // ============================================================================

  async createVariant(
    tenantId: string,
    userId: string,
    productId: string,
    dto: CreateProductVariantDto,
  ) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, outlet: { tenantId }, deletedAt: null },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Check SKU uniqueness
    const existing = await this.prisma.productVariant.findUnique({
      where: { sku: dto.sku },
    });

    if (existing) {
      throw new ConflictException(`Variant with SKU ${dto.sku} already exists`);
    }

    const variant = await this.prisma.productVariant.create({
      data: {
        productId,
        ...dto,
        barcode: dto.barcode || this.generateBarcode(dto.sku),
      },
    });

    // Audit log
    await this.auditLogs.logCreate(
      tenantId,
      userId,
      'product_variants',
      variant.id,
      { name: variant.name, sku: variant.sku },
    );

    return { message: 'Variant created successfully', variant };
  }

  async getVariants(tenantId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, outlet: { tenantId } },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const variants = await this.prisma.productVariant.findMany({
      where: { productId, isActive: true },
      orderBy: { name: 'asc' },
    });

    return { productId, count: variants.length, variants };
  }

  async updateVariant(
    tenantId: string,
    userId: string,
    variantId: string,
    dto: UpdateProductVariantDto,
  ) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: { include: { outlet: true } } },
    });

    if (!variant || variant.product.outlet.tenantId !== tenantId) {
      throw new NotFoundException('Variant not found');
    }

    const oldValues = { name: variant.name, sku: variant.sku };

    const updated = await this.prisma.productVariant.update({
      where: { id: variantId },
      data: dto,
    });

    // Audit log
    await this.auditLogs.logUpdate(
      tenantId,
      userId,
      'product_variants',
      variantId,
      oldValues,
      { name: updated.name, sku: updated.sku },
    );

    return { message: 'Variant updated successfully', variant: updated };
  }

  async deleteVariant(tenantId: string, userId: string, variantId: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: { include: { outlet: true } } },
    });

    if (!variant || variant.product.outlet.tenantId !== tenantId) {
      throw new NotFoundException('Variant not found');
    }

    await this.prisma.productVariant.update({
      where: { id: variantId },
      data: { isActive: false },
    });

    // Audit log
    await this.auditLogs.logDelete(
      tenantId,
      userId,
      'product_variants',
      variantId,
      { name: variant.name, sku: variant.sku },
    );

    return { message: 'Variant deactivated successfully' };
  }

  // ============================================================================
  // PRICING TIERS
  // ============================================================================

  async createPricingTier(
    tenantId: string,
    userId: string,
    productId: string,
    dto: CreatePricingTierDto,
  ) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, outlet: { tenantId }, deletedAt: null },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const tier = await this.prisma.productPricingTier.create({
      data: { productId, ...dto },
    });

    // Audit log
    await this.auditLogs.logCreate(
      tenantId,
      userId,
      'product_pricing_tiers',
      tier.id,
      { tierName: tier.tierName, price: tier.price },
    );

    return { message: 'Pricing tier created successfully', tier };
  }

  async getPricingTiers(tenantId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, outlet: { tenantId } },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const tiers = await this.prisma.productPricingTier.findMany({
      where: { productId, isActive: true },
      orderBy: { minQuantity: 'asc' },
    });

    return { productId, count: tiers.length, tiers };
  }

  async updatePricingTier(
    tenantId: string,
    userId: string,
    tierId: string,
    dto: UpdatePricingTierDto,
  ) {
    const tier = await this.prisma.productPricingTier.findUnique({
      where: { id: tierId },
      include: { product: { include: { outlet: true } } },
    });

    if (!tier || tier.product.outlet.tenantId !== tenantId) {
      throw new NotFoundException('Pricing tier not found');
    }

    const oldValues = { tierName: tier.tierName, price: tier.price };

    const updated = await this.prisma.productPricingTier.update({
      where: { id: tierId },
      data: dto,
    });

    // Audit log
    await this.auditLogs.logUpdate(
      tenantId,
      userId,
      'product_pricing_tiers',
      tierId,
      oldValues,
      { tierName: updated.tierName, price: updated.price },
    );

    return { message: 'Pricing tier updated successfully', tier: updated };
  }

  async deletePricingTier(tenantId: string, userId: string, tierId: string) {
    const tier = await this.prisma.productPricingTier.findUnique({
      where: { id: tierId },
      include: { product: { include: { outlet: true } } },
    });

    if (!tier || tier.product.outlet.tenantId !== tenantId) {
      throw new NotFoundException('Pricing tier not found');
    }

    await this.prisma.productPricingTier.update({
      where: { id: tierId },
      data: { isActive: false },
    });

    // Audit log
    await this.auditLogs.logDelete(
      tenantId,
      userId,
      'product_pricing_tiers',
      tierId,
      { tierName: tier.tierName, price: tier.price },
    );

    return { message: 'Pricing tier deactivated successfully' };
  }

  async getPriceForQuantity(tenantId: string, productId: string, quantity: number) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, outlet: { tenantId }, deletedAt: null },
      include: {
        pricingTiers: {
          where: { isActive: true },
          orderBy: { minQuantity: 'desc' },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Find applicable tier
    const tier = product.pricingTiers.find(
      (t) =>
        quantity >= t.minQuantity &&
        (t.maxQuantity === null || quantity <= t.maxQuantity),
    );

    return {
      productId,
      quantity,
      price: tier ? tier.price : product.sellingPrice,
      tierName: tier?.tierName || 'Standard',
      isTierPrice: !!tier,
    };
  }

  // ============================================================================
  // CATEGORIES
  // ============================================================================

  async createCategory(tenantId: string, userId: string, dto: CreateCategoryDto) {
    // Check parent exists if provided
    if (dto.parentId) {
      const parent = await this.prisma.productCategory.findFirst({
        where: { id: dto.parentId, tenantId },
      });

      if (!parent) {
        throw new NotFoundException('Parent category not found');
      }
    }

    const category = await this.prisma.productCategory.create({
      data: { tenantId, ...dto },
    });

    // Audit log
    await this.auditLogs.logCreate(
      tenantId,
      userId,
      'product_categories',
      category.id,
      { name: category.name },
    );

    return { message: 'Category created successfully', category };
  }

  async getCategories(tenantId: string, includeInactive = false) {
    const where: any = { tenantId };

    if (!includeInactive) {
      where.isActive = true;
    }

    const categories = await this.prisma.productCategory.findMany({
      where,
      include: {
        children: { where: { isActive: true } },
        parent: true,
        _count: { select: { products: true } },
      },
      orderBy: { name: 'asc' },
    });

    return { tenantId, count: categories.length, categories };
  }

  async getCategory(tenantId: string, categoryId: string) {
    const category = await this.prisma.productCategory.findFirst({
      where: { id: categoryId, tenantId },
      include: {
        children: { where: { isActive: true } },
        parent: true,
        _count: { select: { products: true } },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return { category };
  }

  async updateCategory(
    tenantId: string,
    userId: string,
    categoryId: string,
    dto: UpdateCategoryDto,
  ) {
    const category = await this.prisma.productCategory.findFirst({
      where: { id: categoryId, tenantId },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Check parent exists if provided
    if (dto.parentId) {
      if (dto.parentId === categoryId) {
        throw new BadRequestException('Category cannot be its own parent');
      }

      const parent = await this.prisma.productCategory.findFirst({
        where: { id: dto.parentId, tenantId },
      });

      if (!parent) {
        throw new NotFoundException('Parent category not found');
      }
    }

    const oldValues = { name: category.name };

    const updated = await this.prisma.productCategory.update({
      where: { id: categoryId },
      data: dto,
    });

    // Audit log
    await this.auditLogs.logUpdate(
      tenantId,
      userId,
      'product_categories',
      categoryId,
      oldValues,
      { name: updated.name },
    );

    return { message: 'Category updated successfully', category: updated };
  }

  async deleteCategory(tenantId: string, userId: string, categoryId: string) {
    const category = await this.prisma.productCategory.findFirst({
      where: { id: categoryId, tenantId },
      include: {
        products: { where: { deletedAt: null } },
        children: true,
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Check if has products
    if (category.products.length > 0) {
      throw new BadRequestException(
        'Cannot delete category with products. Move products first.',
      );
    }

    // Check if has children
    if (category.children.length > 0) {
      throw new BadRequestException(
        'Cannot delete category with subcategories. Delete subcategories first.',
      );
    }

    await this.prisma.productCategory.update({
      where: { id: categoryId },
      data: { isActive: false },
    });

    // Audit log
    await this.auditLogs.logDelete(
      tenantId,
      userId,
      'product_categories',
      categoryId,
      { name: category.name },
    );

    return { message: 'Category deactivated successfully' };
  }

  // ============================================================================
  // BULK OPERATIONS
  // ============================================================================

  async bulkImportProducts(
    tenantId: string,
    userId: string,
    outletId: string,
    products: BulkImportProductDto[],
  ) {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as any[],
    };

    for (const dto of products) {
      try {
        await this.create(tenantId, userId, outletId, dto);
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          sku: dto.sku,
          error: error.message,
        });
      }
    }

    return {
      message: `Import completed: ${results.success} successful, ${results.failed} failed`,
      results,
    };
  }

  // ============================================================================
  // UTILITY
  // ============================================================================

  private generateBarcode(sku: string): string {
    // Generate EAN-13 compatible barcode
    // Format: 2 (internal) + 10 digits from SKU hash + 1 check digit
    const hash = sku.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const base = `2${hash.toString().padStart(10, '0').slice(0, 10)}`;

    // Calculate check digit (EAN-13 algorithm)
    const digits = base.split('').map(Number);
    const sum = digits.reduce((acc, digit, i) => acc + digit * (i % 2 === 0 ? 1 : 3), 0);
    const checkDigit = (10 - (sum % 10)) % 10;

    return `${base}${checkDigit}`;
  }
}
