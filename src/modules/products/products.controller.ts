import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { imageFileFilter } from '../../common/utils/image-file-filter';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { UpdateProductStatusDto } from './dto/update-product-status.dto';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Public()
  @Get('attributes')
  @ApiOperation({ summary: 'Get all reusable product attributes' })
  getAttributes() {
    return this.productsService.getAttributes();
  }

  @Public()
  @Get('all')
  @ApiOperation({ summary: 'Get all products with search/filter/pagination' })
  findAll(@Query() query: ProductQueryDto) {
    return this.productsService.findAll(query);
  }

  @Public()
  @Get('search/:search')
  @ApiOperation({ summary: 'Search products' })
  search(@Param('search') search: string, @Query() query: ProductQueryDto) {
    return this.productsService.search(search, query);
  }

  @Public()
  @Get('stock')
  @ApiOperation({ summary: 'Check stock availability' })
  @ApiQuery({ name: 'productId', required: true })
  @ApiQuery({ name: 'quantity', required: true })
  checkStock(
    @Query('productId', ParseUUIDPipe) productId: string,
    @Query('quantity', ParseIntPipe) quantity: number,
  ) {
    return this.productsService.checkStock(productId, quantity);
  }

  @Public()
  @Get('related/:id')
  @ApiOperation({ summary: 'Get related products' })
  getRelated(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.getRelated(id);
  }

  @Public()
  @Get('similar')
  @ApiOperation({
    summary: 'Filter similar products by category, subcategory or tags',
  })
  findSimilar(@Query() query: ProductQueryDto) {
    return this.productsService.findSimilar(query);
  }

  @Public()
  @Get('prices/:id')
  @ApiOperation({ summary: 'Get product price tiers' })
  getPrices(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.getPriceTiers(id);
  }

  @Public()
  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get product by slug' })
  findBySlug(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }

  @Public()
  @Get('sku/:sku')
  @ApiOperation({ summary: 'Get product by SKU' })
  findBySku(@Param('sku') sku: string) {
    return this.productsService.findBySku(sku);
  }

  @Get('count')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Get product count' })
  count() {
    return this.productsService.count();
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.findById(id);
  }

  @Post('add')
  @Roles('admin', 'super admin')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'thumbnail', maxCount: 1 },
        { name: 'images', maxCount: 10 },
      ],
      { fileFilter: imageFileFilter },
    ),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create product (with optional images)' })
  create(
    @Body() dto: CreateProductDto,
    @UploadedFiles()
    files?: {
      thumbnail?: Express.Multer.File[];
      images?: Express.Multer.File[];
    },
  ) {
    return this.productsService.create(
      dto,
      files?.thumbnail?.[0],
      files?.images,
    );
  }

  @Put('update/:id')
  @Roles('admin', 'super admin')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'thumbnail', maxCount: 1 },
        { name: 'images', maxCount: 10 },
      ],
      { fileFilter: imageFileFilter },
    ),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update product (with optional images)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
    @UploadedFiles()
    files?: {
      thumbnail?: Express.Multer.File[];
      images?: Express.Multer.File[];
    },
  ) {
    return this.productsService.update(
      id,
      dto,
      files?.thumbnail?.[0],
      files?.images,
    );
  }

  @Delete('delete/:id')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Delete product (soft)' })
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.softDelete(id);
  }

  @Put('status/:id')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Update product status & stock' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductStatusDto,
  ) {
    return this.productsService.updateStatus(id, dto);
  }

  @Put('specification/:id')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Update product specifications' })
  updateSpecifications(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('specifications') specifications: Record<string, string>[],
  ) {
    return this.productsService.updateSpecifications(id, specifications);
  }

  @Get('category/:id')
  @Roles('admin', 'super admin')
  @ApiOperation({ summary: 'Get products by category' })
  findByCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ProductQueryDto,
  ) {
    return this.productsService.findByCategory(id, query);
  }
}
