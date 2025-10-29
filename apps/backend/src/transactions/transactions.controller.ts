import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { CreateRefundDto } from './dto/create-refund.dto';
import { TenantId } from '../common/decorators/tenant.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';

@ApiTags('transactions')
@ApiBearerAuth()
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @RequirePermissions('transactions.create.outlet')
  @ApiOperation({ summary: 'Create a new transaction (POS sale)' })
  @ApiResponse({ status: 201, description: 'Transaction created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid data or insufficient stock' })
  create(
    @TenantId() tenantId: string,
    @Request() req: any,
    @Body() createTransactionDto: CreateTransactionDto,
  ) {
    const userId = req.user.userId;
    return this.transactionsService.create(
      tenantId,
      userId,
      createTransactionDto,
    );
  }

  @Get()
  @RequirePermissions('transactions.read.outlet')
  @ApiOperation({ summary: 'Get all transactions with filters' })
  @ApiQuery({
    name: 'outletId',
    required: false,
    description: 'Filter by outlet ID',
  })
  @ApiQuery({
    name: 'shiftId',
    required: false,
    description: 'Filter by shift ID',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Start date (ISO format)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'End date (ISO format)',
  })
  @ApiResponse({
    status: 200,
    description: 'Transactions retrieved successfully',
  })
  findAll(
    @TenantId() tenantId: string,
    @Query('outletId') outletId?: string,
    @Query('shiftId') shiftId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.transactionsService.findAll(
      tenantId,
      outletId,
      shiftId,
      start,
      end,
    );
  }

  @Get('stats')
  @RequirePermissions('transactions.read.outlet')
  @ApiOperation({ summary: 'Get transaction statistics' })
  @ApiQuery({
    name: 'outletId',
    required: false,
    description: 'Filter by outlet ID',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Start date (ISO format)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'End date (ISO format)',
  })
  @ApiResponse({ status: 200, description: 'Stats retrieved successfully' })
  getStats(
    @TenantId() tenantId: string,
    @Query('outletId') outletId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.transactionsService.getStats(tenantId, outletId, start, end);
  }

  @Get(':id')
  @RequirePermissions('transactions.read.outlet')
  @ApiOperation({ summary: 'Get a single transaction by ID' })
  @ApiResponse({
    status: 200,
    description: 'Transaction retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  findOne(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.transactionsService.findOne(tenantId, id);
  }

  @Post('refund')
  @RequirePermissions('transactions.refund.outlet')
  @ApiOperation({ summary: 'Create a refund for a transaction' })
  @ApiResponse({ status: 201, description: 'Refund created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid refund request' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  createRefund(
    @TenantId() tenantId: string,
    @Request() req: any,
    @Body() createRefundDto: CreateRefundDto,
  ) {
    return this.transactionsService.createRefund(tenantId, req.user.userId, createRefundDto);
  }
}
