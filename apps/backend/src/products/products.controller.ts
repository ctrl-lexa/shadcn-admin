import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  ParseBoolPipe,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { TenantId } from '../common/decorators/tenant.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';

@ApiTags('products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @RequirePermissions('products.create.outlet')
  @ApiOperation({ summary: 'Create a new product' })
  @ApiResponse({ status: 201, description: 'Product created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid outlet or validation error' })
  @ApiResponse({ status: 409, description: 'SKU or barcode already exists' })
  create(
    @TenantId() tenantId: string,
    @Body() createProductDto: CreateProductDto,
  ) {
    return this.productsService.create(
      tenantId,
      createProductDto.outletId,
      createProductDto,
    );
  }

  @Get()
  @RequirePermissions('products.read.outlet')
  @ApiOperation({ summary: 'Get all products with filters' })
  @ApiQuery({
    name: 'outletId',
    required: false,
    description: 'Filter by outlet ID',
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    description: 'Filter by category ID',
  })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    type: Boolean,
    description: 'Include inactive products',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search by name, SKU, or barcode',
  })
  @ApiResponse({ status: 200, description: 'Products retrieved successfully' })
  findAll(
    @TenantId() tenantId: string,
    @Query('outletId') outletId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('includeInactive', new ParseBoolPipe({ optional: true }))
    includeInactive?: boolean,
    @Query('search') search?: string,
  ) {
    return this.productsService.findAll(
      tenantId,
      outletId,
      categoryId,
      includeInactive,
      search,
    );
  }

  @Get('low-stock')
  @RequirePermissions('products.read.outlet')
  @ApiOperation({ summary: 'Get products with low stock' })
  @ApiQuery({
    name: 'outletId',
    required: false,
    description: 'Filter by outlet ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Low stock products retrieved successfully',
  })
  getLowStock(
    @TenantId() tenantId: string,
    @Query('outletId') outletId?: string,
  ) {
    return this.productsService.getLowStock(tenantId, outletId);
  }

  @Get(':id')
  @RequirePermissions('products.read.outlet')
  @ApiOperation({ summary: 'Get a single product by ID' })
  @ApiResponse({ status: 200, description: 'Product retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  findOne(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.productsService.findOne(tenantId, id);
  }

  @Patch(':id')
  @RequirePermissions('products.update.outlet')
  @ApiOperation({ summary: 'Update a product' })
  @ApiResponse({ status: 200, description: 'Product updated successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 409, description: 'SKU or barcode already exists' })
  update(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productsService.update(tenantId, id, updateProductDto);
  }

  @Delete(':id')
  @RequirePermissions('products.delete.outlet')
  @ApiOperation({ summary: 'Delete a product' })
  @ApiResponse({ status: 200, description: 'Product deleted successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete product with transactions',
  })
  remove(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.remove(tenantId, id);
  }

  @Patch(':id/toggle-active')
  @RequirePermissions('products.update.outlet')
  @ApiOperation({ summary: 'Toggle product active status' })
  @ApiResponse({
    status: 200,
    description: 'Product status toggled successfully',
  })
  @ApiResponse({ status: 404, description: 'Product not found' })
  toggleActive(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.productsService.toggleActive(tenantId, id);
  }

  @Patch(':id/adjust-stock')
  @RequirePermissions('products.update.outlet')
  @ApiOperation({ summary: 'Adjust product stock' })
  @ApiQuery({
    name: 'quantity',
    type: Number,
    description: 'Positive to add stock, negative to reduce',
  })
  @ApiQuery({
    name: 'reason',
    required: false,
    description: 'Reason for stock adjustment',
  })
  @ApiResponse({ status: 200, description: 'Stock adjusted successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 400, description: 'Insufficient stock or tracking disabled' })
  adjustStock(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('quantity', ParseIntPipe) quantity: number,
    @Query('reason') reason = 'Manual adjustment',
  ) {
    return this.productsService.adjustStock(tenantId, id, quantity, reason);
  }
}
