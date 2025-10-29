import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { CreateRefundDto } from './dto/create-refund.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class TransactionsService {
  constructor(
    private prisma: PrismaService,
    private auditLogs: AuditLogsService,
  ) {}

  async create(tenantId: string, userId: string, dto: CreateTransactionDto) {
    // Verify outlet belongs to tenant
    const outlet = await this.prisma.outlet.findFirst({
      where: { id: dto.outletId, tenantId },
    });

    if (!outlet) {
      throw new BadRequestException('Outlet not found in your tenant');
    }

    // Check idempotency key for offline sync
    if (dto.idempotencyKey) {
      const existing = await this.prisma.transaction.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
      });

      if (existing) {
        return {
          message: 'Transaction already exists (idempotent)',
          transaction: existing,
          isDuplicate: true,
        };
      }
    }

    // Verify shift if provided
    if (dto.shiftId) {
      const shift = await this.prisma.shift.findFirst({
        where: {
          id: dto.shiftId,
          outletId: dto.outletId,
          status: 'OPEN',
        },
      });

      if (!shift) {
        throw new BadRequestException(
          'Shift not found or not open in this outlet',
        );
      }
    }

    // Process items - fetch product details and calculate
    const processedItems: Array<{
      productId: string;
      productName: string;
      productSku: string;
      quantity: number;
      unitPrice: number;
      discount: number;
      tax: number;
      subtotal: number;
    }> = [];
    let itemsSubtotal = 0;
    let itemsTax = 0;

    for (const item of dto.items) {
      const product = await this.prisma.product.findFirst({
        where: {
          id: item.productId,
          outletId: dto.outletId,
          isActive: true,
        },
      });

      if (!product) {
        throw new NotFoundException(
          `Product ${item.productId} not found or inactive`,
        );
      }

      // Check stock
      if (product.currentStock < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for ${product.name}. Available: ${product.currentStock}, Required: ${item.quantity}`,
        );
      }

      // Calculate item totals
      const unitPrice = product.sellingPrice;
      const itemDiscount = item.discount || 0;
      const lineSubtotal = Math.round(unitPrice * item.quantity - itemDiscount);

      // Calculate tax
      const itemTax = product.isTaxable
        ? Math.round((lineSubtotal * product.taxRate) / 100)
        : 0;

      processedItems.push({
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        quantity: item.quantity,
        unitPrice,
        discount: itemDiscount,
        tax: itemTax,
        subtotal: lineSubtotal,
      });

      itemsSubtotal += lineSubtotal;
      itemsTax += itemTax;
    }

    // Calculate transaction totals
    const transactionDiscount = dto.discount || 0;
    const subtotal = itemsSubtotal;
    const tax = itemsTax;
    const total = subtotal + tax - transactionDiscount;

    // Validate payment for cash
    if (dto.paymentMethod === 'cash') {
      if (!dto.amountPaid || dto.amountPaid < total) {
        throw new BadRequestException(
          `Insufficient payment. Total: ${total}, Paid: ${dto.amountPaid || 0}`,
        );
      }
    }

    const changeAmount =
      dto.paymentMethod === 'cash' ? (dto.amountPaid || 0) - total : 0;

    // Generate transaction number
    const transactionNumber = await this.generateTransactionNumber(
      tenantId,
      dto.outletId,
    );

    // Create transaction with items in a transaction
    const transaction = await this.prisma.$transaction(async (prisma) => {
      // Create transaction
      const newTransaction = await prisma.transaction.create({
        data: {
          tenantId,
          outletId: dto.outletId,
          userId,
          shiftId: dto.shiftId,
          transactionNumber,
          subtotal,
          discount: transactionDiscount,
          tax,
          total,
          paymentMethod: dto.paymentMethod,
          amountPaid: dto.amountPaid,
          changeAmount,
          customerName: dto.customerName,
          customerPhone: dto.customerPhone,
          idempotencyKey: dto.idempotencyKey,
          localId: dto.localId,
          isOfflineSync: dto.isOfflineSync || false,
          status: 'COMPLETED',
          items: {
            create: processedItems,
          },
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          outlet: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      });

      // Update product stocks
      for (const item of processedItems) {
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            currentStock: {
              decrement: item.quantity,
            },
          },
        });
      }

      // Update shift totals if shift provided
      if (dto.shiftId) {
        await prisma.shift.update({
          where: { id: dto.shiftId },
          data: {
            totalTransactions: { increment: 1 },
            totalSales: { increment: total },
          },
        });
      }

      return newTransaction;
    });

    // Audit log
    await this.auditLogs.logCreate(
      tenantId,
      userId,
      'transactions',
      transaction.id,
      {
        transactionNumber: transaction.transactionNumber,
        total: transaction.total,
        paymentMethod: transaction.paymentMethod,
        itemCount: transaction.items.length,
      },
    );

    return {
      message: 'Transaction completed successfully',
      transaction,
    };
  }

  async findAll(
    tenantId: string,
    outletId?: string,
    shiftId?: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    const where: any = {
      tenantId,
    };

    if (outletId) {
      where.outletId = outletId;
    }

    if (shiftId) {
      where.shiftId = shiftId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const transactions = await this.prisma.transaction.findMany({
      where,
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        outlet: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        shift: {
          select: {
            id: true,
            shiftNumber: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const totalAmount = transactions.reduce((sum, t) => sum + t.total, 0);

    return {
      tenantId,
      count: transactions.length,
      totalAmount,
      transactions,
    };
  }

  async findOne(tenantId: string, id: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        outlet: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        shift: true,
        refunds: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found in your tenant');
    }

    return { transaction };
  }

  async createRefund(tenantId: string, userId: string, dto: CreateRefundDto) {
    // Verify transaction exists and belongs to tenant
    const transaction = await this.prisma.transaction.findFirst({
      where: {
        id: dto.transactionId,
        tenantId,
      },
      include: {
        refunds: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found in your tenant');
    }

    // Check if already fully refunded
    if (transaction.status === 'REFUNDED') {
      throw new BadRequestException('Transaction already fully refunded');
    }

    // Calculate total refunded amount
    const totalRefunded = transaction.refunds.reduce(
      (sum, r) => sum + r.amount,
      0,
    );

    // Check refund amount doesn't exceed transaction total
    if (totalRefunded + dto.amount > transaction.total) {
      throw new BadRequestException(
        `Refund amount exceeds transaction total. Available: ${transaction.total - totalRefunded}`,
      );
    }

    // Generate refund number
    const refundNumber = await this.generateRefundNumber(tenantId);

    // Determine new transaction status
    const isFullRefund = totalRefunded + dto.amount === transaction.total;
    const newStatus = isFullRefund
      ? 'REFUNDED'
      : totalRefunded > 0
        ? 'PARTIAL_REFUND'
        : 'PARTIAL_REFUND';

    // Create refund and update transaction
    const refund = await this.prisma.$transaction(async (prisma) => {
      const newRefund = await prisma.refund.create({
        data: {
          tenantId,
          transactionId: dto.transactionId,
          refundNumber,
          amount: dto.amount,
          reason: dto.reason,
          approvedBy: dto.approvedBy,
          approvedAt: dto.approvedBy ? new Date() : null,
          status: dto.approvedBy ? 'APPROVED' : 'PENDING',
        },
        include: {
          transaction: {
            include: {
              items: true,
              outlet: true,
            },
          },
        },
      });

      // Update transaction status
      await prisma.transaction.update({
        where: { id: dto.transactionId },
        data: { status: newStatus },
      });

      return newRefund;
    });

    // Audit log
    await this.auditLogs.log({
      tenantId,
      userId,
      action: 'REFUND',
      resource: 'transactions',
      resourceId: dto.transactionId,
      newValues: {
        refundNumber: refund.refundNumber,
        amount: refund.amount,
        reason: refund.reason,
        transactionStatus: newStatus,
      },
    });

    return {
      message: 'Refund created successfully',
      refund,
    };
  }

  async getStats(
    tenantId: string,
    outletId?: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    const where: any = {
      tenantId,
      status: 'COMPLETED',
    };

    if (outletId) {
      where.outletId = outletId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [transactions, totalRevenue, paymentMethodBreakdown] =
      await Promise.all([
        this.prisma.transaction.count({ where }),
        this.prisma.transaction.aggregate({
          where,
          _sum: {
            total: true,
            tax: true,
            discount: true,
          },
        }),
        this.prisma.transaction.groupBy({
          by: ['paymentMethod'],
          where,
          _count: true,
          _sum: {
            total: true,
          },
        }),
      ]);

    return {
      tenantId,
      outletId,
      period: {
        startDate,
        endDate,
      },
      totalTransactions: transactions,
      totalRevenue: totalRevenue._sum.total || 0,
      totalTax: totalRevenue._sum.tax || 0,
      totalDiscount: totalRevenue._sum.discount || 0,
      paymentMethods: paymentMethodBreakdown.map((pm) => ({
        method: pm.paymentMethod,
        count: pm._count,
        total: pm._sum.total || 0,
      })),
    };
  }

  private async generateTransactionNumber(
    tenantId: string,
    outletId: string,
  ): Promise<string> {
    const outlet = await this.prisma.outlet.findUnique({
      where: { id: outletId },
    });

    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD

    // Count today's transactions for this outlet
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const count = await this.prisma.transaction.count({
      where: {
        tenantId,
        outletId,
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    const sequenceNum = String(count + 1).padStart(4, '0');
    return `${outlet?.code || 'TRX'}-${dateStr}-${sequenceNum}`;
  }

  private async generateRefundNumber(tenantId: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');

    const count = await this.prisma.refund.count({
      where: { tenantId },
    });

    const sequenceNum = String(count + 1).padStart(4, '0');
    return `RFD-${dateStr}-${sequenceNum}`;
  }
}
